package br.com.peladaoficial.service;

import br.com.peladaoficial.dto.AdicionarJogadorRequest;
import br.com.peladaoficial.dto.AtualizarTimeRequest;
import br.com.peladaoficial.dto.CriarPeladaRequest;
import br.com.peladaoficial.model.*;
import br.com.peladaoficial.repository.JogadorRepository;
import br.com.peladaoficial.repository.PeladaRepository;
import br.com.peladaoficial.repository.TimeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Regras da pelada: criar, jogadores/goleiros, sorteio, nomes dos times e encerrar.
 */
@Service
public class PeladaService {

    private static final String[] CORES_TIMES = {
            "#1B5E20", "#0D47A1", "#B71C1C", "#E65100", "#4A148C", "#006064"
    };

    private final PeladaRepository peladaRepository;
    private final JogadorRepository jogadorRepository;
    private final TimeRepository timeRepository;

    public PeladaService(PeladaRepository peladaRepository,
                         JogadorRepository jogadorRepository,
                         TimeRepository timeRepository) {
        this.peladaRepository = peladaRepository;
        this.jogadorRepository = jogadorRepository;
        this.timeRepository = timeRepository;
    }

    @Transactional
    public Pelada criar(CriarPeladaRequest request) {
        Pelada pelada = new Pelada();
        pelada.setNome(request.getNome());
        pelada.setQuantidadeTimes(request.getQuantidadeTimes());
        pelada.setStatus(StatusPelada.AGUARDANDO);
        return peladaRepository.save(pelada);
    }

    @Transactional(readOnly = true)
    public Pelada buscar(Long id) {
        return peladaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pelada não encontrada"));
    }

    @Transactional
    public Jogador adicionarJogador(Long peladaId, AdicionarJogadorRequest request) {
        Pelada pelada = buscar(peladaId);
        if (pelada.getStatus() == StatusPelada.ENCERRADA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pelada já encerrada");
        }

        boolean isGoleiro = Boolean.TRUE.equals(request.getGoleiro());
        if (!isGoleiro && request.getEstrelas() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe as estrelas do jogador (1 a 10)");
        }

        Jogador jogador = new Jogador(
                request.getNome().trim(),
                isGoleiro ? 0 : request.getEstrelas(),
                isGoleiro,
                pelada
        );
        return jogadorRepository.save(jogador);
    }

    @Transactional(readOnly = true)
    public List<Jogador> listarJogadores(Long peladaId) {
        buscar(peladaId);
        return jogadorRepository.findByPeladaIdOrderByNomeAsc(peladaId);
    }

    /**
     * Sorteia só jogadores de linha.
     * Goleiros são distribuídos (1 por time quando possível).
     * Nome do time = jogador com mais estrelas (até o usuário renomear).
     */
    @Transactional
    public List<Time> sortearTimes(Long peladaId) {
        Pelada pelada = buscar(peladaId);
        List<Jogador> todos = jogadorRepository.findByPeladaIdOrderByNomeAsc(peladaId);

        List<Jogador> linha = todos.stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()))
                .collect(Collectors.toList());
        List<Jogador> goleiros = todos.stream()
                .filter(j -> Boolean.TRUE.equals(j.getGoleiro()))
                .collect(Collectors.toList());

        if (linha.size() < pelada.getQuantidadeTimes()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cadastre pelo menos " + pelada.getQuantidadeTimes() + " jogadores de linha"
            );
        }

        for (Jogador j : todos) {
            j.setTime(null);
        }
        timeRepository.deleteAll(timeRepository.findByPeladaIdOrderByPontosDescIdAsc(peladaId));
        timeRepository.flush();

        List<Time> times = new ArrayList<>();
        for (int i = 0; i < pelada.getQuantidadeTimes(); i++) {
            String cor = CORES_TIMES[i % CORES_TIMES.length];
            Time time = new Time("Time " + (char) ('A' + i), cor, pelada);
            time.setNomeManual(false);
            times.add(timeRepository.save(time));
        }

        List<Jogador> embaralhados = new ArrayList<>(linha);
        Collections.shuffle(embaralhados);
        embaralhados.sort((a, b) -> Integer.compare(b.getEstrelas(), a.getEstrelas()));

        int[] somaEstrelas = new int[times.size()];
        int[] qtdJogadores = new int[times.size()];

        for (Jogador jogador : embaralhados) {
            int melhorIndice = indiceTimeMaisFraco(somaEstrelas, qtdJogadores);
            Time escolhido = times.get(melhorIndice);
            jogador.setTime(escolhido);
            escolhido.getJogadores().add(jogador);
            somaEstrelas[melhorIndice] += jogador.getEstrelas();
            qtdJogadores[melhorIndice]++;
        }

        // Goleiros também entram no primeiro sorteio:
        // vão para os PRIMEIROS times (A, B, C...).
        // Ex.: 4 times e 2 goleiros → 1 no Time A e 1 no Time B.
        // Times sem goleiro (C, D...) emprestam na hora do gol.
        List<Jogador> goleirosEmbaralhados = new ArrayList<>(goleiros);
        Collections.shuffle(goleirosEmbaralhados);
        int qtdGoleirosParaTimes = Math.min(goleirosEmbaralhados.size(), times.size());
        for (int i = 0; i < qtdGoleirosParaTimes; i++) {
            Jogador gk = goleirosEmbaralhados.get(i);
            Time time = times.get(i); // i=0 Time A, i=1 Time B, ...
            gk.setTime(time);
            time.getJogadores().add(gk);
        }

        for (Time time : times) {
            time.atualizarNomeAutomaticoSePreciso();
        }

        pelada.setStatus(StatusPelada.EM_ANDAMENTO);
        return times;
    }

    private int indiceTimeMaisFraco(int[] somaEstrelas, int[] qtdJogadores) {
        int melhorIndice = 0;
        for (int i = 1; i < somaEstrelas.length; i++) {
            boolean menosEstrelas = somaEstrelas[i] < somaEstrelas[melhorIndice];
            boolean empateMenosGente =
                    somaEstrelas[i] == somaEstrelas[melhorIndice]
                            && qtdJogadores[i] < qtdJogadores[melhorIndice];
            if (menosEstrelas || empateMenosGente) {
                melhorIndice = i;
            }
        }
        return melhorIndice;
    }

    @Transactional(readOnly = true)
    public List<Time> listarTimes(Long peladaId) {
        buscar(peladaId);
        List<Time> times = timeRepository.findByPeladaIdOrderByPontosDescIdAsc(peladaId);
        times.forEach(t -> t.getJogadores().size());
        return times;
    }

    @Transactional
    public Time atualizarTime(Long peladaId, Long timeId, AtualizarTimeRequest request) {
        Time time = timeRepository.findById(timeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Time não encontrado"));
        if (!time.getPelada().getId().equals(peladaId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Time não pertence a esta pelada");
        }
        time.getJogadores().size();

        if (Boolean.TRUE.equals(request.getUsarNomeAutomatico())) {
            time.setNomeManual(false);
            time.atualizarNomeAutomaticoSePreciso();
        } else if (request.getNome() != null) {
            String nome = request.getNome().trim();
            if (nome.isEmpty()) {
                time.setNomeManual(false);
                time.atualizarNomeAutomaticoSePreciso();
            } else {
                time.setNome(nome);
                time.setNomeManual(true);
            }
        }

        if (Boolean.TRUE.equals(request.getRemoverGoleiro())) {
            time.getGoleiroDoTime().ifPresent(gk -> {
                gk.setTime(null);
                time.getJogadores().remove(gk);
            });
        } else if (request.getGoleiroId() != null) {
            Jogador goleiro = jogadorRepository.findById(request.getGoleiroId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goleiro não encontrado"));
            if (!Boolean.TRUE.equals(goleiro.getGoleiro())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este jogador não é goleiro");
            }
            if (!goleiro.getPelada().getId().equals(peladaId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Goleiro de outra pelada");
            }

            // Remove goleiro atual deste time
            time.getGoleiroDoTime().ifPresent(atual -> {
                if (!atual.getId().equals(goleiro.getId())) {
                    atual.setTime(null);
                    time.getJogadores().remove(atual);
                }
            });

            // Se o goleiro estava em outro time, tira de lá
            if (goleiro.getTime() != null && !goleiro.getTime().getId().equals(time.getId())) {
                Time timeAntigo = goleiro.getTime();
                timeAntigo.getJogadores().remove(goleiro);
            }

            goleiro.setTime(time);
            if (time.getJogadores().stream().noneMatch(j -> j.getId().equals(goleiro.getId()))) {
                time.getJogadores().add(goleiro);
            }
        }

        return time;
    }

    @Transactional
    public Pelada encerrar(Long peladaId) {
        Pelada pelada = buscar(peladaId);
        pelada.setStatus(StatusPelada.ENCERRADA);
        pelada.setEncerradaEm(LocalDateTime.now());
        return pelada;
    }
}
