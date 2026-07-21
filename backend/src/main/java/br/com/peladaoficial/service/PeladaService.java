package br.com.peladaoficial.service;

import br.com.peladaoficial.dto.AdicionarJogadorRequest;
import br.com.peladaoficial.dto.AtualizarJogadorRequest;
import br.com.peladaoficial.dto.AtualizarTimeRequest;
import br.com.peladaoficial.dto.CriarPeladaRequest;
import br.com.peladaoficial.dto.MoverJogadorRequest;
import br.com.peladaoficial.dto.ObservacaoRequest;
import br.com.peladaoficial.model.*;
import br.com.peladaoficial.repository.ElencoJogadorRepository;
import br.com.peladaoficial.repository.JogadorRepository;
import br.com.peladaoficial.repository.ObservacaoPeladaRepository;
import br.com.peladaoficial.repository.PeladaRepository;
import br.com.peladaoficial.repository.TimeRepository;
import br.com.peladaoficial.security.AuthSupport;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Regras da pelada: criar, jogadores/goleiros, sorteio, nomes dos times e encerrar.
 * Cada pelada pertence ao usuário logado.
 * O elenco (nomes + estrelas) fica salvo na conta para a próxima pelada.
 */
@Service
public class PeladaService {

    private static final String[] CORES_TIMES = {
            "#1B5E20", "#0D47A1", "#B71C1C", "#E65100", "#4A148C", "#006064"
    };

    private final PeladaRepository peladaRepository;
    private final JogadorRepository jogadorRepository;
    private final TimeRepository timeRepository;
    private final ElencoJogadorRepository elencoRepository;
    private final ObservacaoPeladaRepository observacaoRepository;
    private final AuthSupport authSupport;

    public PeladaService(PeladaRepository peladaRepository,
                         JogadorRepository jogadorRepository,
                         TimeRepository timeRepository,
                         ElencoJogadorRepository elencoRepository,
                         ObservacaoPeladaRepository observacaoRepository,
                         AuthSupport authSupport) {
        this.peladaRepository = peladaRepository;
        this.jogadorRepository = jogadorRepository;
        this.timeRepository = timeRepository;
        this.elencoRepository = elencoRepository;
        this.observacaoRepository = observacaoRepository;
        this.authSupport = authSupport;
    }

    @Transactional
    public Pelada criar(CriarPeladaRequest request) {
        Usuario dono = authSupport.usuarioAtual();
        Pelada pelada = new Pelada();
        pelada.setNome(request.getNome());
        pelada.setQuantidadeTimes(request.getQuantidadeTimes());
        pelada.setStatus(StatusPelada.AGUARDANDO);
        pelada.setUsuario(dono);
        pelada = peladaRepository.save(pelada);

        if (!Boolean.FALSE.equals(request.getImportarElenco())) {
            importarElencoParaPelada(dono, pelada);
        }
        return pelada;
    }

    private void importarElencoParaPelada(Usuario dono, Pelada pelada) {
        List<ElencoJogador> elenco = elencoRepository.findByUsuarioOrderByGoleiroAscNomeAsc(dono);
        for (ElencoJogador salvo : elenco) {
            Jogador j = new Jogador(
                    salvo.getNome(),
                    salvo.getEstrelas(),
                    Boolean.TRUE.equals(salvo.getGoleiro()),
                    pelada
            );
            jogadorRepository.save(j);
        }
    }

    /** Salva o elenco atual da pelada na conta (substitui o anterior). */
    @Transactional
    public void salvarElencoDaPelada(Long peladaId) {
        Pelada pelada = buscar(peladaId);
        Usuario dono = authSupport.usuarioAtual();
        List<Jogador> jogadores = jogadorRepository.findByPeladaIdOrderByNomeAsc(peladaId);

        elencoRepository.deleteByUsuario(dono);
        elencoRepository.flush();

        for (Jogador j : jogadores) {
            elencoRepository.save(new ElencoJogador(
                    dono,
                    j.getNome(),
                    j.getEstrelas(),
                    Boolean.TRUE.equals(j.getGoleiro())
            ));
        }
    }

    @Transactional(readOnly = true)
    public List<ElencoJogador> listarElenco() {
        return elencoRepository.findByUsuarioOrderByGoleiroAscNomeAsc(authSupport.usuarioAtual());
    }

    @Transactional(readOnly = true)
    public List<Pelada> listarMinhas() {
        return peladaRepository.findByUsuarioOrderByCriadaEmDesc(authSupport.usuarioAtual());
    }

    /** Pelada em andamento (ou aguardando) para retomar sem perder o jogo. */
    @Transactional(readOnly = true)
    public Optional<Pelada> buscarAtiva() {
        return peladaRepository.findFirstByUsuarioAndStatusInOrderByCriadaEmDesc(
                authSupport.usuarioAtual(),
                List.of(StatusPelada.AGUARDANDO, StatusPelada.EM_ANDAMENTO)
        );
    }

    @Transactional(readOnly = true)
    public Pelada buscar(Long id) {
        return peladaRepository.findByIdAndUsuario(id, authSupport.usuarioAtual())
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

    /** Edita nome/estrelas antes do sorteio (ou enquanto AGUARDANDO / EM_ANDAMENTO sem travar). */
    @Transactional
    public Jogador atualizarJogador(Long peladaId, Long jogadorId, AtualizarJogadorRequest request) {
        Pelada pelada = buscar(peladaId);
        if (pelada.getStatus() == StatusPelada.ENCERRADA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pelada já encerrada");
        }

        Jogador jogador = jogadorRepository.findById(jogadorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Jogador não encontrado"));
        if (!jogador.getPelada().getId().equals(peladaId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Jogador não pertence a esta pelada");
        }

        if (request.getNome() != null) {
            String nome = request.getNome().trim();
            if (nome.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome não pode ser vazio");
            }
            jogador.setNome(nome);
        }

        if (request.getEstrelas() != null) {
            if (Boolean.TRUE.equals(jogador.getGoleiro())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Goleiro não tem estrelas");
            }
            jogador.setEstrelas(request.getEstrelas());
            // se já está em um time e o nome do time é automático, atualiza
            if (jogador.getTime() != null) {
                jogador.getTime().atualizarNomeAutomaticoSePreciso();
            }
        }

        if (request.getApto() != null) {
            jogador.setApto(request.getApto());
            if (Boolean.FALSE.equals(request.getApto()) && jogador.getTime() != null) {
                Time time = jogador.getTime();
                time.getJogadores().remove(jogador);
                jogador.setTime(null);
                time.atualizarNomeAutomaticoSePreciso();
            }
        }

        return jogador;
    }

    /** Remove jogador ou goleiro antes (ou depois) do sorteio, se a pelada não estiver encerrada. */
    @Transactional
    public void removerJogador(Long peladaId, Long jogadorId) {
        Pelada pelada = buscar(peladaId);
        if (pelada.getStatus() == StatusPelada.ENCERRADA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pelada já encerrada");
        }

        Jogador jogador = jogadorRepository.findById(jogadorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Jogador não encontrado"));

        if (!jogador.getPelada().getId().equals(peladaId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Jogador não pertence a esta pelada");
        }

        if (jogador.getTime() != null) {
            jogador.getTime().getJogadores().remove(jogador);
            jogador.setTime(null);
        }

        jogadorRepository.delete(jogador);
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
                .filter(j -> !Boolean.FALSE.equals(j.getApto()))
                .collect(Collectors.toList());
        List<Jogador> goleiros = todos.stream()
                .filter(j -> Boolean.TRUE.equals(j.getGoleiro()))
                .filter(j -> !Boolean.FALSE.equals(j.getApto()))
                .collect(Collectors.toList());

        if (linha.size() < pelada.getQuantidadeTimes()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cadastre pelo menos " + pelada.getQuantidadeTimes() + " jogadores aptos de linha"
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

    /**
     * Move jogador de linha para outro time (livre, sem equilibrar estrelas).
     * Goleiros continuam sendo trocados pelo fluxo de atualizarTime.
     */
    @Transactional
    public List<Time> moverJogador(Long peladaId, Long jogadorId, MoverJogadorRequest request) {
        Pelada pelada = buscar(peladaId);
        if (pelada.getStatus() == StatusPelada.ENCERRADA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pelada já encerrada");
        }

        Jogador jogador = jogadorRepository.findById(jogadorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Jogador não encontrado"));
        if (!jogador.getPelada().getId().equals(peladaId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Jogador não pertence a esta pelada");
        }
        if (Boolean.TRUE.equals(jogador.getGoleiro())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use Trocar para mover goleiro");
        }

        Time destino = timeRepository.findById(request.getTimeDestinoId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Time de destino não encontrado"));
        if (!destino.getPelada().getId().equals(peladaId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Time não pertence a esta pelada");
        }
        destino.getJogadores().size();

        Time origem = jogador.getTime();
        if (origem != null && origem.getId().equals(destino.getId())) {
            return listarTimes(peladaId);
        }

        if (origem != null) {
            origem.getJogadores().size();
            origem.getJogadores().remove(jogador);
            origem.atualizarNomeAutomaticoSePreciso();
        }

        jogador.setTime(destino);
        if (destino.getJogadores().stream().noneMatch(j -> j.getId().equals(jogador.getId()))) {
            destino.getJogadores().add(jogador);
        }
        destino.atualizarNomeAutomaticoSePreciso();

        return listarTimes(peladaId);
    }

    @Transactional
    public Pelada encerrar(Long peladaId) {
        Pelada pelada = buscar(peladaId);
        pelada.setStatus(StatusPelada.ENCERRADA);
        pelada.setEncerradaEm(LocalDateTime.now());
        // guarda nomes + estrelas para a próxima pelada
        salvarElencoDaPelada(peladaId);
        return pelada;
    }

    /**
     * Reabre uma pelada encerrada para continuar com mais partidas.
     * Só permite se não houver outra pelada ativa na conta.
     */
    @Transactional
    public Pelada reabrir(Long peladaId) {
        Pelada pelada = buscar(peladaId);
        if (pelada.getStatus() != StatusPelada.ENCERRADA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Esta pelada já está aberta");
        }

        Optional<Pelada> ativa = buscarAtiva();
        if (ativa.isPresent() && !ativa.get().getId().equals(peladaId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Já existe uma pelada em andamento. Encerre ela antes de continuar esta."
            );
        }

        List<Time> times = listarTimes(peladaId);
        if (times.isEmpty()) {
            pelada.setStatus(StatusPelada.AGUARDANDO);
        } else {
            pelada.setStatus(StatusPelada.EM_ANDAMENTO);
        }
        pelada.setEncerradaEm(null);
        return pelada;
    }

    @Transactional
    public ObservacaoPelada adicionarObservacao(Long peladaId, ObservacaoRequest request) {
        Pelada pelada = buscar(peladaId);
        Jogador jogador = jogadorRepository.findById(request.getJogadorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Jogador não encontrado"));
        if (!jogador.getPelada().getId().equals(peladaId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Jogador não pertence a esta pelada");
        }

        String horario = request.getHorario() != null ? request.getHorario().trim() : null;
        if (horario != null && horario.isEmpty()) {
            horario = null;
        }
        String texto = request.getTexto() != null ? request.getTexto().trim() : null;
        if (texto != null && texto.isEmpty()) {
            texto = null;
        }
        if (horario == null && texto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o horário ou uma observação");
        }

        String tipo = request.getTipo() != null && !request.getTipo().isBlank()
                ? request.getTipo().trim().toUpperCase()
                : "ATRASO";

        return observacaoRepository.save(new ObservacaoPelada(pelada, jogador, tipo, horario, texto));
    }

    @Transactional(readOnly = true)
    public List<ObservacaoPelada> listarObservacoes(Long peladaId) {
        buscar(peladaId);
        List<ObservacaoPelada> lista = observacaoRepository.findByPeladaIdOrderByCriadaEmAsc(peladaId);
        lista.forEach(o -> {
            if (o.getJogador() != null) {
                o.getJogador().getNome();
            }
        });
        return lista;
    }

    @Transactional
    public void removerObservacao(Long peladaId, Long observacaoId) {
        buscar(peladaId);
        ObservacaoPelada obs = observacaoRepository.findByIdAndPeladaId(observacaoId, peladaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Observação não encontrada"));
        observacaoRepository.delete(obs);
    }
}
