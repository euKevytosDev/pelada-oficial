package br.com.peladaoficial.service;

import br.com.peladaoficial.dto.AdicionarJogadorRequest;
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

/**
 * Regras da pelada: criar, adicionar jogadores, sortear times e encerrar.
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

        Jogador jogador = new Jogador(request.getNome().trim(), request.getEstrelas(), pelada);
        return jogadorRepository.save(jogador);
    }

    @Transactional(readOnly = true)
    public List<Jogador> listarJogadores(Long peladaId) {
        buscar(peladaId);
        return jogadorRepository.findByPeladaIdOrderByNomeAsc(peladaId);
    }

    /**
     * Sorteio aleatório + equilíbrio por estrelas:
     * 1) embaralha os jogadores
     * 2) ordena por estrelas (mais forte primeiro)
     * 3) coloca cada um no time com menor soma de estrelas no momento
     */
    @Transactional
    public List<Time> sortearTimes(Long peladaId) {
        Pelada pelada = buscar(peladaId);
        List<Jogador> jogadores = jogadorRepository.findByPeladaIdOrderByNomeAsc(peladaId);

        if (jogadores.size() < pelada.getQuantidadeTimes()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cadastre pelo menos " + pelada.getQuantidadeTimes() + " jogadores"
            );
        }

        // Limpa times antigos desta pelada (permite re-sortear)
        for (Jogador j : jogadores) {
            j.setTime(null);
        }
        timeRepository.deleteAll(timeRepository.findByPeladaIdOrderByPontosDesc(peladaId));
        timeRepository.flush();

        List<Time> times = new ArrayList<>();
        for (int i = 0; i < pelada.getQuantidadeTimes(); i++) {
            String nome = "Time " + (char) ('A' + i);
            String cor = CORES_TIMES[i % CORES_TIMES.length];
            Time time = new Time(nome, cor, pelada);
            times.add(timeRepository.save(time));
        }

        List<Jogador> embaralhados = new ArrayList<>(jogadores);
        Collections.shuffle(embaralhados);
        embaralhados.sort((a, b) -> Integer.compare(b.getEstrelas(), a.getEstrelas()));

        int[] somaEstrelas = new int[times.size()];
        int[] qtdJogadores = new int[times.size()];

        for (Jogador jogador : embaralhados) {
            int melhorIndice = 0;
            for (int i = 1; i < times.size(); i++) {
                boolean menosEstrelas = somaEstrelas[i] < somaEstrelas[melhorIndice];
                boolean empateEstrelasMenosGente =
                        somaEstrelas[i] == somaEstrelas[melhorIndice]
                                && qtdJogadores[i] < qtdJogadores[melhorIndice];
                if (menosEstrelas || empateEstrelasMenosGente) {
                    melhorIndice = i;
                }
            }

            Time escolhido = times.get(melhorIndice);
            jogador.setTime(escolhido);
            escolhido.getJogadores().add(jogador);
            somaEstrelas[melhorIndice] += jogador.getEstrelas();
            qtdJogadores[melhorIndice]++;
        }

        pelada.setStatus(StatusPelada.EM_ANDAMENTO);
        return times;
    }

    @Transactional(readOnly = true)
    public List<Time> listarTimes(Long peladaId) {
        buscar(peladaId);
        List<Time> times = timeRepository.findByPeladaIdOrderByPontosDesc(peladaId);
        // força carregar jogadores dentro da transação
        times.forEach(t -> t.getJogadores().size());
        return times;
    }

    @Transactional
    public Pelada encerrar(Long peladaId) {
        Pelada pelada = buscar(peladaId);
        pelada.setStatus(StatusPelada.ENCERRADA);
        pelada.setEncerradaEm(LocalDateTime.now());
        return pelada;
    }
}
