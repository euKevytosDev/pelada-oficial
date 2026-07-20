package br.com.peladaoficial.service;

import br.com.peladaoficial.dto.IniciarPartidaRequest;
import br.com.peladaoficial.dto.RegistrarEventoRequest;
import br.com.peladaoficial.model.*;
import br.com.peladaoficial.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Partidas ao vivo: iniciar rodada, registrar gol/cartão e finalizar com pontuação.
 * Vitória = 3 pts | Empate = 1 pt cada | Derrota = 0.
 */
@Service
public class PartidaService {

    private final PeladaRepository peladaRepository;
    private final PartidaRepository partidaRepository;
    private final TimeRepository timeRepository;
    private final JogadorRepository jogadorRepository;
    private final EventoPartidaRepository eventoRepository;

    public PartidaService(PeladaRepository peladaRepository,
                          PartidaRepository partidaRepository,
                          TimeRepository timeRepository,
                          JogadorRepository jogadorRepository,
                          EventoPartidaRepository eventoRepository) {
        this.peladaRepository = peladaRepository;
        this.partidaRepository = partidaRepository;
        this.timeRepository = timeRepository;
        this.jogadorRepository = jogadorRepository;
        this.eventoRepository = eventoRepository;
    }

    @Transactional
    public Partida iniciar(Long peladaId, IniciarPartidaRequest request) {
        Pelada pelada = peladaRepository.findById(peladaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pelada não encontrada"));

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
        partida.getEventos().size();
        partida.getTimeA().getJogadores().size();
        partida.getTimeB().getJogadores().size();
        return partida;
    }

    @Transactional(readOnly = true)
    public List<Partida> listarPorPelada(Long peladaId) {
        List<Partida> partidas = partidaRepository.findByPeladaIdOrderByNumeroRodadaDesc(peladaId);
        partidas.forEach(p -> {
            p.getTimeA().getNome();
            p.getTimeB().getNome();
        });
        return partidas;
    }

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

            // Atualiza placar
            if (time.getId().equals(partida.getTimeA().getId())) {
                partida.setGolsTimeA(partida.getGolsTimeA() + 1);
            } else {
                partida.setGolsTimeB(partida.getGolsTimeB() + 1);
            }

            jogador.setGols(jogador.getGols() + 1);
            goleiro.setGolsSofridos(goleiro.getGolsSofridos() + 1);
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
            aplicarResultado(timeA, timeB, 3, 0, true, false);
        } else if (golsB > golsA) {
            aplicarResultado(timeB, timeA, 3, 0, true, false);
        } else {
            aplicarResultado(timeA, timeB, 1, 1, false, true);
        }

        partida.setStatus(StatusPartida.FINALIZADA);
        partida.setFinalizadaEm(LocalDateTime.now());
        return partida;
    }

    private void aplicarResultado(Time vencedorOuA, Time perdedorOuB,
                                  int ptsA, int ptsB, boolean temVencedor, boolean empate) {
        if (empate) {
            vencedorOuA.setEmpates(vencedorOuA.getEmpates() + 1);
            perdedorOuB.setEmpates(perdedorOuB.getEmpates() + 1);
            vencedorOuA.setPontos(vencedorOuA.getPontos() + 1);
            perdedorOuB.setPontos(perdedorOuB.getPontos() + 1);
            somarPontosJogadores(vencedorOuA, 1);
            somarPontosJogadores(perdedorOuB, 1);
            return;
        }

        // vencedorOuA ganhou, perdedorOuB perdeu
        vencedorOuA.setVitorias(vencedorOuA.getVitorias() + 1);
        vencedorOuA.setPontos(vencedorOuA.getPontos() + ptsA);
        perdedorOuB.setDerrotas(perdedorOuB.getDerrotas() + 1);
        perdedorOuB.setPontos(perdedorOuB.getPontos() + ptsB);
        somarPontosJogadores(vencedorOuA, 3);
        somarPontosJogadores(perdedorOuB, 0);
    }

    private void somarPontosJogadores(Time time, int pontos) {
        for (Jogador jogador : time.getJogadores()) {
            jogador.setPontos(jogador.getPontos() + pontos);
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
}
