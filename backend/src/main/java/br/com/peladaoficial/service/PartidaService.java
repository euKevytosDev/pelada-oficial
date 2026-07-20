package br.com.peladaoficial.service;

import br.com.peladaoficial.dto.IniciarPartidaRequest;
import br.com.peladaoficial.dto.RegistrarEventoRequest;
import br.com.peladaoficial.model.*;
import br.com.peladaoficial.repository.*;
import br.com.peladaoficial.security.AuthSupport;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Partidas ao vivo: gol, gol contra, cartões e pontuação.
 */
@Service
public class PartidaService {

    private final PeladaRepository peladaRepository;
    private final PartidaRepository partidaRepository;
    private final TimeRepository timeRepository;
    private final JogadorRepository jogadorRepository;
    private final EventoPartidaRepository eventoRepository;
    private final AuthSupport authSupport;

    public PartidaService(PeladaRepository peladaRepository,
                          PartidaRepository partidaRepository,
                          TimeRepository timeRepository,
                          JogadorRepository jogadorRepository,
                          EventoPartidaRepository eventoRepository,
                          AuthSupport authSupport) {
        this.peladaRepository = peladaRepository;
        this.partidaRepository = partidaRepository;
        this.timeRepository = timeRepository;
        this.jogadorRepository = jogadorRepository;
        this.eventoRepository = eventoRepository;
        this.authSupport = authSupport;
    }

    private Pelada buscarPeladaDoUsuario(Long peladaId) {
        return peladaRepository.findByIdAndUsuario(peladaId, authSupport.usuarioAtual())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pelada não encontrada"));
    }

    @Transactional
    public Partida iniciar(Long peladaId, IniciarPartidaRequest request) {
        Pelada pelada = buscarPeladaDoUsuario(peladaId);

        if (pelada.getStatus() != StatusPelada.EM_ANDAMENTO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sorteie os times antes de iniciar a partida");
        }

        partidaRepository.findFirstByPeladaIdAndStatusOrderByNumeroRodadaDesc(peladaId, StatusPartida.EM_ANDAMENTO)
                .ifPresent(p -> {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Já existe uma partida em andamento");
                });

        if (request.getTimeAId().equals(request.getTimeBId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escolha dois times diferentes");
        }

        Time timeA = buscarTime(request.getTimeAId(), peladaId);
        Time timeB = buscarTime(request.getTimeBId(), peladaId);

        Partida partida = new Partida();
        partida.setPelada(pelada);
        partida.setTimeA(timeA);
        partida.setTimeB(timeB);
        partida.setNumeroRodada((int) partidaRepository.countByPeladaId(peladaId) + 1);
        partida.setStatus(StatusPartida.EM_ANDAMENTO);

        return partidaRepository.save(partida);
    }

    @Transactional(readOnly = true)
    public Partida buscar(Long partidaId) {
        Partida partida = partidaRepository.findById(partidaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Partida não encontrada"));
        // garante que a partida é do usuário logado
        buscarPeladaDoUsuario(partida.getPelada().getId());
        partida.getEventos().size();
        partida.getTimeA().getJogadores().size();
        partida.getTimeB().getJogadores().size();
        return partida;
    }

    @Transactional(readOnly = true)
    public List<Partida> listarPorPelada(Long peladaId) {
        buscarPeladaDoUsuario(peladaId);
        List<Partida> partidas = partidaRepository.findByPeladaIdOrderByNumeroRodadaDesc(peladaId);
        partidas.forEach(p -> {
            p.getTimeA().getNome();
            p.getTimeB().getNome();
        });
        return partidas;
    }

    /**
     * GOL: time que fez o gol + autor + goleiro que sofreu (pode ser emprestado de outro time).
     * GOL_CONTRA: time que sofreu + jogador desse time que fez o gol contra → placar sobe para o adversário.
     */
    @Transactional
    public EventoPartida registrarEvento(Long partidaId, RegistrarEventoRequest request) {
        Partida partida = buscar(partidaId);
        if (partida.getStatus() != StatusPartida.EM_ANDAMENTO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Partida já finalizada");
        }

        Time time = buscarTime(request.getTimeId(), partida.getPelada().getId());
        if (!time.getId().equals(partida.getTimeA().getId()) && !time.getId().equals(partida.getTimeB().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Time não participa desta partida");
        }

        Jogador jogador = jogadorRepository.findById(request.getJogadorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Jogador não encontrado"));

        Jogador goleiro = null;

        if (request.getTipo() == TipoEvento.GOL) {
            if (request.getGoleiroId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o goleiro que sofreu o gol");
            }
            goleiro = jogadorRepository.findById(request.getGoleiroId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goleiro não encontrado"));
            if (!Boolean.TRUE.equals(goleiro.getGoleiro())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione um goleiro cadastrado");
            }

            // Placar sobe para o time que fez o gol
            if (time.getId().equals(partida.getTimeA().getId())) {
                partida.setGolsTimeA(partida.getGolsTimeA() + 1);
            } else {
                partida.setGolsTimeB(partida.getGolsTimeB() + 1);
            }
            jogador.setGols(jogador.getGols() + 1);
            goleiro.setGolsSofridos(goleiro.getGolsSofridos() + 1);

        } else if (request.getTipo() == TipoEvento.GOL_CONTRA) {
            // time = time que sofreu (onde está o jogador do gol contra)
            // placar sobe para o adversário
            if (time.getId().equals(partida.getTimeA().getId())) {
                partida.setGolsTimeB(partida.getGolsTimeB() + 1);
            } else {
                partida.setGolsTimeA(partida.getGolsTimeA() + 1);
            }
            jogador.setGolsContra(jogador.getGolsContra() + 1);

        } else if (request.getTipo() == TipoEvento.CARTAO_AMARELO) {
            jogador.setCartoesAmarelos(jogador.getCartoesAmarelos() + 1);
        } else if (request.getTipo() == TipoEvento.CARTAO_VERMELHO) {
            jogador.setCartoesVermelhos(jogador.getCartoesVermelhos() + 1);
        }

        EventoPartida evento = new EventoPartida(request.getTipo(), partida, time, jogador, goleiro);
        partida.getEventos().add(evento);
        return eventoRepository.save(evento);
    }

    @Transactional
    public Partida finalizar(Long partidaId) {
        Partida partida = buscar(partidaId);
        if (partida.getStatus() == StatusPartida.FINALIZADA) {
            return partida;
        }

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
        return partida;
    }

    private void aplicarResultado(Time timeA, Time timeB, boolean empate) {
        if (empate) {
            timeA.setEmpates(timeA.getEmpates() + 1);
            timeB.setEmpates(timeB.getEmpates() + 1);
            timeA.setPontos(timeA.getPontos() + 1);
            timeB.setPontos(timeB.getPontos() + 1);
            somarPontosLinha(timeA, 1);
            somarPontosLinha(timeB, 1);
            return;
        }
        // timeA = vencedor, timeB = perdedor
        timeA.setVitorias(timeA.getVitorias() + 1);
        timeA.setPontos(timeA.getPontos() + 3);
        timeB.setDerrotas(timeB.getDerrotas() + 1);
        somarPontosLinha(timeA, 3);
        somarPontosLinha(timeB, 0);
    }

    private void somarPontosLinha(Time time, int pontos) {
        for (Jogador jogador : time.getJogadores()) {
            if (!Boolean.TRUE.equals(jogador.getGoleiro())) {
                jogador.setPontos(jogador.getPontos() + pontos);
            }
        }
    }

    private Time buscarTime(Long timeId, Long peladaId) {
        Time time = timeRepository.findById(timeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Time não encontrado"));
        if (!time.getPelada().getId().equals(peladaId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Time não pertence a esta pelada");
        }
        time.getJogadores().size();
        return time;
    }

    /** Lista todos os goleiros da pelada (para emprestar entre times). */
    @Transactional(readOnly = true)
    public List<Jogador> listarGoleirosDaPelada(Long peladaId) {
        buscarPeladaDoUsuario(peladaId);
        return jogadorRepository.findByPeladaIdOrderByNomeAsc(peladaId).stream()
                .filter(j -> Boolean.TRUE.equals(j.getGoleiro()))
                .peek(j -> {
                    if (j.getTime() != null) {
                        j.getTime().getId();
                    }
                })
                .collect(Collectors.toList());
    }
}
