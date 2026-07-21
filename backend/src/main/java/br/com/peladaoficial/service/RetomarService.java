package br.com.peladaoficial.service;

import br.com.peladaoficial.model.Partida;
import br.com.peladaoficial.model.Pelada;
import br.com.peladaoficial.model.StatusPartida;
import br.com.peladaoficial.model.StatusPelada;
import br.com.peladaoficial.model.Time;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Monta num único response tudo que o Continuar precisa
 * (evita várias chamadas que falham no meio no celular).
 */
@Service
public class RetomarService {

    private final PeladaService peladaService;
    private final PartidaService partidaService;

    public RetomarService(PeladaService peladaService, PartidaService partidaService) {
        this.peladaService = peladaService;
        this.partidaService = partidaService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> montar() {
        Optional<Pelada> opt = peladaService.buscarAtiva();
        if (opt.isEmpty()) {
            Map<String, Object> out = new HashMap<>();
            out.put("pelada", null);
            return out;
        }
        return montarDaPelada(opt.get());
    }

    /** Retoma uma pelada específica (ex.: depois de reabrir). */
    @Transactional(readOnly = true)
    public Map<String, Object> montarPorId(Long peladaId) {
        return montarDaPelada(peladaService.buscar(peladaId));
    }

    private Map<String, Object> montarDaPelada(Pelada pelada) {
        Map<String, Object> out = new HashMap<>();
        out.put("pelada", toPelada(pelada));

        if (pelada.getStatus() == StatusPelada.AGUARDANDO) {
            out.put("jogadores", peladaService.listarJogadores(pelada.getId()).stream()
                    .map(this::toJogador)
                    .collect(Collectors.toList()));
            return out;
        }

        if (pelada.getStatus() == StatusPelada.EM_ANDAMENTO) {
            List<Time> times = peladaService.listarTimes(pelada.getId());
            out.put("times", times.stream().map(this::toTimeResumo).collect(Collectors.toList()));

            List<Partida> partidas = partidaService.listarPorPelada(pelada.getId());
            out.put("partidas", partidas.stream().map(this::toPartidaResumo).collect(Collectors.toList()));

            Partida aberta = partidas.stream()
                    .filter(p -> p.getStatus() == StatusPartida.EM_ANDAMENTO)
                    .findFirst()
                    .orElse(null);
            if (aberta != null) {
                Partida completa = partidaService.buscar(aberta.getId());
                out.put("partidaAberta", toPartidaCompleta(completa));
            }
        }

        return out;
    }

    private Map<String, Object> toPelada(Pelada p) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", p.getId());
        map.put("nome", p.getNome());
        map.put("quantidadeTimes", p.getQuantidadeTimes());
        map.put("status", p.getStatus().name());
        map.put("criadaEm", p.getCriadaEm());
        map.put("encerradaEm", p.getEncerradaEm());
        return map;
    }

    private Map<String, Object> toJogador(br.com.peladaoficial.model.Jogador j) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", j.getId());
        map.put("nome", j.getNome());
        map.put("estrelas", j.getEstrelas());
        map.put("goleiro", Boolean.TRUE.equals(j.getGoleiro()));
        map.put("apto", j.getApto() == null || Boolean.TRUE.equals(j.getApto()));
        map.put("timeId", j.getTime() != null ? j.getTime().getId() : null);
        return map;
    }

    private Map<String, Object> toTimeResumo(Time t) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", t.getId());
        map.put("nome", t.getNome());
        map.put("cor", t.getCor());
        map.put("pontos", t.getPontos());
        map.put("vitorias", t.getVitorias());
        map.put("empates", t.getEmpates());
        map.put("derrotas", t.getDerrotas());
        map.put("golsPro", t.getGolsPro());
        map.put("golsContra", t.getGolsContra());
        map.put("jogadores", t.getJogadores().stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()))
                .map(this::toJogador)
                .collect(Collectors.toList()));
        t.getGoleiroDoTime().ifPresent(gk -> map.put("goleiro", toJogador(gk)));
        return map;
    }

    private Map<String, Object> toPartidaResumo(Partida p) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", p.getId());
        map.put("numeroRodada", p.getNumeroRodada());
        map.put("status", p.getStatus().name());
        map.put("golsTimeA", p.getGolsTimeA());
        map.put("golsTimeB", p.getGolsTimeB());
        map.put("timeA", Map.of("id", p.getTimeA().getId(), "nome", p.getTimeA().getNome(), "cor", p.getTimeA().getCor()));
        map.put("timeB", Map.of("id", p.getTimeB().getId(), "nome", p.getTimeB().getNome(), "cor", p.getTimeB().getCor()));
        return map;
    }

    private Map<String, Object> toPartidaCompleta(Partida p) {
        Map<String, Object> map = toPartidaResumo(p);
        map.put("eventos", p.getEventos().stream().map(e -> {
            Map<String, Object> ev = new HashMap<>();
            ev.put("id", e.getId());
            ev.put("tipo", e.getTipo().name());
            ev.put("timeId", e.getTime().getId());
            ev.put("timeNome", e.getTime().getNome());
            ev.put("jogadorId", e.getJogador().getId());
            ev.put("jogadorNome", e.getJogador().getNome());
            ev.put("goleiroId", e.getGoleiro() != null ? e.getGoleiro().getId() : null);
            ev.put("goleiroNome", e.getGoleiro() != null ? e.getGoleiro().getNome() : null);
            ev.put("ocorridoEm", e.getOcorridoEm());
            return ev;
        }).collect(Collectors.toList()));

        map.put("jogadoresTimeA", p.getTimeA().getJogadores().stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()))
                .map(this::toJogador)
                .collect(Collectors.toList()));
        map.put("jogadoresTimeB", p.getTimeB().getJogadores().stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()))
                .map(this::toJogador)
                .collect(Collectors.toList()));
        map.put("goleirosPelada", partidaService.listarGoleirosDaPelada(p.getPelada().getId()).stream()
                .map(this::toJogador)
                .collect(Collectors.toList()));
        return map;
    }
}
