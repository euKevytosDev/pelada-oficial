package br.com.peladaoficial.service;

import br.com.peladaoficial.dto.SyncCompletaRequest;
import br.com.peladaoficial.model.*;
import br.com.peladaoficial.repository.*;
import br.com.peladaoficial.security.AuthSupport;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Recria uma pelada a partir do snapshot local do cliente em uma única transação.
 */
@Service
public class SyncCompletaService {

    private final PeladaRepository peladaRepository;
    private final JogadorRepository jogadorRepository;
    private final TimeRepository timeRepository;
    private final PartidaRepository partidaRepository;
    private final EventoPartidaRepository eventoRepository;
    private final ObservacaoPeladaRepository observacaoRepository;
    private final PeladaService peladaService;
    private final ResumoService resumoService;
    private final AuthSupport authSupport;

    public SyncCompletaService(PeladaRepository peladaRepository,
                               JogadorRepository jogadorRepository,
                               TimeRepository timeRepository,
                               PartidaRepository partidaRepository,
                               EventoPartidaRepository eventoRepository,
                               ObservacaoPeladaRepository observacaoRepository,
                               PeladaService peladaService,
                               ResumoService resumoService,
                               AuthSupport authSupport) {
        this.peladaRepository = peladaRepository;
        this.jogadorRepository = jogadorRepository;
        this.timeRepository = timeRepository;
        this.partidaRepository = partidaRepository;
        this.eventoRepository = eventoRepository;
        this.observacaoRepository = observacaoRepository;
        this.peladaService = peladaService;
        this.resumoService = resumoService;
        this.authSupport = authSupport;
    }

    @Transactional
    public Map<String, Object> sincronizar(Long peladaId, SyncCompletaRequest request) {
        Pelada pelada = peladaRepository.findByIdAndUsuario(peladaId, authSupport.usuarioAtual())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pelada não encontrada"));
        if (pelada.getStatus() == StatusPelada.ENCERRADA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pelada já encerrada");
        }
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Snapshot da pelada é obrigatório");
        }

        limparSnapshotAnterior(peladaId);

        Map<String, Jogador> jogadores = criarJogadores(pelada, request.getJogadores());
        Map<String, Time> times = criarTimes(pelada, request.getTimes(), jogadores);
        criarPartidas(pelada, request.getPartidas(), times, jogadores);
        criarObservacoes(pelada, request.getObservacoes(), jogadores);

        if (Boolean.TRUE.equals(request.getEncerrar())) {
            pelada.setStatus(StatusPelada.ENCERRADA);
            pelada.setEncerradaEm(LocalDateTime.now());
            peladaService.salvarElencoDaPelada(peladaId);
        } else {
            pelada.setStatus(times.isEmpty() ? StatusPelada.AGUARDANDO : StatusPelada.EM_ANDAMENTO);
            pelada.setEncerradaEm(null);
        }

        peladaRepository.flush();
        return resumoService.montar(peladaId);
    }

    private void limparSnapshotAnterior(Long peladaId) {
        observacaoRepository.deleteByPeladaId(peladaId);

        List<Partida> partidas = partidaRepository.findByPeladaIdOrderByNumeroRodadaDesc(peladaId);
        partidaRepository.deleteAll(partidas);
        partidaRepository.flush();

        List<Jogador> jogadores = jogadorRepository.findByPeladaIdOrderByNomeAsc(peladaId);
        jogadores.forEach(j -> j.setTime(null));
        jogadorRepository.flush();

        timeRepository.deleteAll(timeRepository.findByPeladaIdOrderByPontosDescIdAsc(peladaId));
        timeRepository.flush();
        jogadorRepository.deleteAll(jogadores);
        jogadorRepository.flush();
    }

    private Map<String, Jogador> criarJogadores(Pelada pelada, List<SyncCompletaRequest.JogadorSync> snapshot) {
        Map<String, Jogador> jogadores = new HashMap<>();
        for (SyncCompletaRequest.JogadorSync item : lista(snapshot)) {
            String clientId = obrigatorio(item.getClientId(), "clientId do jogador");
            String nome = obrigatorio(item.getNome(), "nome do jogador");
            boolean goleiro = Boolean.TRUE.equals(item.getGoleiro());
            if (!goleiro && item.getEstrelas() == null) {
                throw erro("Informe as estrelas do jogador " + clientId);
            }

            Jogador jogador = new Jogador(nome, goleiro ? 0 : item.getEstrelas(), goleiro, pelada);
            jogador.setApto(!Boolean.FALSE.equals(item.getApto()));
            jogador = jogadorRepository.save(jogador);
            adicionarUnico(jogadores, clientId, jogador, "jogador");
        }
        return jogadores;
    }

    private Map<String, Time> criarTimes(Pelada pelada,
                                         List<SyncCompletaRequest.TimeSync> snapshot,
                                         Map<String, Jogador> jogadores) {
        Map<String, Time> times = new HashMap<>();
        List<SyncCompletaRequest.TimeSync> itens = lista(snapshot);

        for (int i = 0; i < itens.size(); i++) {
            SyncCompletaRequest.TimeSync item = itens.get(i);
            String clientId = obrigatorio(item.getClientId(), "clientId do time");
            String nome = obrigatorio(item.getNome(), "nome do time");
            Time time = new Time(nome, valorOuPadrao(item.getCor(), "#1B5E20"), pelada);
            time.setNomeManual(Boolean.TRUE.equals(item.getNomeManual()));
            time = timeRepository.save(time);
            adicionarUnico(times, clientId, time, "time");
        }

        for (SyncCompletaRequest.TimeSync item : itens) {
            Time time = times.get(item.getClientId().trim());
            for (String jogadorClientId : lista(item.getJogadorClientIds())) {
                Jogador jogador = buscar(jogadores, jogadorClientId, "jogador");
                if (jogador.getTime() != null) {
                    throw erro("Jogador " + jogadorClientId + " foi informado em mais de um time");
                }
                jogador.setTime(time);
                time.getJogadores().add(jogador);
            }
            if (!Boolean.TRUE.equals(time.getNomeManual())) {
                time.atualizarNomeAutomaticoSePreciso();
            }
        }
        return times;
    }

    private void criarPartidas(Pelada pelada,
                               List<SyncCompletaRequest.PartidaSync> snapshot,
                               Map<String, Time> times,
                               Map<String, Jogador> jogadores) {
        List<SyncCompletaRequest.PartidaSync> partidas = new ArrayList<>(lista(snapshot));
        partidas.sort(Comparator.comparing(
                SyncCompletaRequest.PartidaSync::getNumeroRodada,
                Comparator.nullsLast(Comparator.naturalOrder())
        ));

        for (int i = 0; i < partidas.size(); i++) {
            SyncCompletaRequest.PartidaSync item = partidas.get(i);
            Time timeA = buscar(times, item.getTimeAClientId(), "time A");
            Time timeB = buscar(times, item.getTimeBClientId(), "time B");
            if (timeA.getId().equals(timeB.getId())) {
                throw erro("Uma partida precisa ter dois times diferentes");
            }

            Partida partida = new Partida();
            partida.setPelada(pelada);
            partida.setTimeA(timeA);
            partida.setTimeB(timeB);
            partida.setNumeroRodada(item.getNumeroRodada() != null ? item.getNumeroRodada() : i + 1);
            partida.setStatus(StatusPartida.EM_ANDAMENTO);
            partida = partidaRepository.save(partida);

            for (SyncCompletaRequest.EventoSync evento : lista(item.getEventos())) {
                registrarEvento(partida, evento, times, jogadores);
            }

            // O placar do snapshot é a fonte final, inclusive para partidas sem autoria de todos os gols.
            partida.setGolsTimeA(valorOuZero(item.getGolsTimeA()));
            partida.setGolsTimeB(valorOuZero(item.getGolsTimeB()));
            if (item.getStatus() == StatusPartida.FINALIZADA) {
                finalizar(partida);
            }
        }
    }

    private void registrarEvento(Partida partida,
                                 SyncCompletaRequest.EventoSync item,
                                 Map<String, Time> times,
                                 Map<String, Jogador> jogadores) {
        if (item.getTipo() == null) {
            throw erro("Tipo do evento é obrigatório");
        }
        Time time = buscar(times, item.getTimeClientId(), "time do evento");
        if (!time.getId().equals(partida.getTimeA().getId()) && !time.getId().equals(partida.getTimeB().getId())) {
            throw erro("Time do evento não participa da partida");
        }
        Jogador jogador = buscar(jogadores, item.getJogadorClientId(), "jogador do evento");
        Jogador goleiro = null;

        if (item.getTipo() == TipoEvento.GOL) {
            goleiro = buscar(jogadores, item.getGoleiroClientId(), "goleiro do evento");
            if (!Boolean.TRUE.equals(goleiro.getGoleiro())) {
                throw erro("Goleiro informado não é goleiro");
            }
            jogador.setGols(jogador.getGols() + 1);
            goleiro.setGolsSofridos(goleiro.getGolsSofridos() + 1);
        } else if (item.getTipo() == TipoEvento.GOL_CONTRA) {
            jogador.setGolsContra(jogador.getGolsContra() + 1);
        } else if (item.getTipo() == TipoEvento.CARTAO_AMARELO) {
            jogador.setCartoesAmarelos(jogador.getCartoesAmarelos() + 1);
        } else if (item.getTipo() == TipoEvento.CARTAO_VERMELHO) {
            jogador.setCartoesVermelhos(jogador.getCartoesVermelhos() + 1);
        }

        EventoPartida evento = new EventoPartida(item.getTipo(), partida, time, jogador, goleiro);
        if (item.getClientLanceId() != null && !item.getClientLanceId().isBlank()) {
            evento.setClientLanceId(item.getClientLanceId().trim());
        }
        partida.getEventos().add(evento);
        eventoRepository.save(evento);
    }

    private void finalizar(Partida partida) {
        Time timeA = partida.getTimeA();
        Time timeB = partida.getTimeB();
        int golsA = partida.getGolsTimeA();
        int golsB = partida.getGolsTimeB();

        timeA.setGolsPro(timeA.getGolsPro() + golsA);
        timeA.setGolsContra(timeA.getGolsContra() + golsB);
        timeB.setGolsPro(timeB.getGolsPro() + golsB);
        timeB.setGolsContra(timeB.getGolsContra() + golsA);

        if (golsA > golsB) {
            aplicarResultado(timeA, timeB, false);
        } else if (golsB > golsA) {
            aplicarResultado(timeB, timeA, false);
        } else {
            aplicarResultado(timeA, timeB, true);
        }
        partida.setStatus(StatusPartida.FINALIZADA);
        partida.setFinalizadaEm(LocalDateTime.now());
    }

    private void aplicarResultado(Time vencedorOuA, Time perdedorOuB, boolean empate) {
        if (empate) {
            vencedorOuA.setEmpates(vencedorOuA.getEmpates() + 1);
            perdedorOuB.setEmpates(perdedorOuB.getEmpates() + 1);
            vencedorOuA.setPontos(vencedorOuA.getPontos() + 1);
            perdedorOuB.setPontos(perdedorOuB.getPontos() + 1);
            somarPontosLinha(vencedorOuA, 1);
            somarPontosLinha(perdedorOuB, 1);
            return;
        }
        vencedorOuA.setVitorias(vencedorOuA.getVitorias() + 1);
        vencedorOuA.setPontos(vencedorOuA.getPontos() + 3);
        perdedorOuB.setDerrotas(perdedorOuB.getDerrotas() + 1);
        somarPontosLinha(vencedorOuA, 3);
    }

    private void somarPontosLinha(Time time, int pontos) {
        for (Jogador jogador : time.getJogadores()) {
            if (!Boolean.TRUE.equals(jogador.getGoleiro())) {
                jogador.setPontos(jogador.getPontos() + pontos);
            }
        }
    }

    private void criarObservacoes(Pelada pelada,
                                  List<SyncCompletaRequest.ObservacaoSync> snapshot,
                                  Map<String, Jogador> jogadores) {
        for (SyncCompletaRequest.ObservacaoSync item : lista(snapshot)) {
            Jogador jogador = item.getJogadorClientId() == null || item.getJogadorClientId().isBlank()
                    ? null
                    : buscar(jogadores, item.getJogadorClientId(), "jogador da observação");
            String horario = textoOuNull(item.getHorario());
            String texto = textoOuNull(item.getTexto());
            if (horario == null && texto == null) {
                throw erro("Informe o horário ou texto da observação");
            }
            String tipo = valorOuPadrao(item.getTipo(), "ATRASO").toUpperCase();
            observacaoRepository.save(new ObservacaoPelada(pelada, jogador, tipo, horario, texto));
        }
    }

    private <T> T buscar(Map<String, T> itens, String clientId, String descricao) {
        String chave = obrigatorio(clientId, descricao);
        T item = itens.get(chave);
        if (item == null) {
            throw erro("Não foi encontrado " + descricao + " com clientId " + chave);
        }
        return item;
    }

    private <T> void adicionarUnico(Map<String, T> itens, String clientId, T item, String descricao) {
        if (itens.putIfAbsent(clientId, item) != null) {
            throw erro("clientId duplicado de " + descricao + ": " + clientId);
        }
    }

    private String obrigatorio(String valor, String campo) {
        String texto = textoOuNull(valor);
        if (texto == null) {
            throw erro(campo + " é obrigatório");
        }
        return texto;
    }

    private String valorOuPadrao(String valor, String padrao) {
        String texto = textoOuNull(valor);
        return texto != null ? texto : padrao;
    }

    private String textoOuNull(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        return valor.trim();
    }

    private int valorOuZero(Integer valor) {
        if (valor == null || valor < 0) {
            return 0;
        }
        return valor;
    }

    private ResponseStatusException erro(String mensagem) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, mensagem);
    }

    private <T> List<T> lista(List<T> itens) {
        return itens != null ? itens : List.of();
    }
}
