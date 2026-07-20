package br.com.peladaoficial.controller;

import br.com.peladaoficial.dto.IniciarPartidaRequest;
import br.com.peladaoficial.dto.RegistrarEventoRequest;
import br.com.peladaoficial.model.EventoPartida;
import br.com.peladaoficial.model.Jogador;
import br.com.peladaoficial.model.Partida;
import br.com.peladaoficial.model.Time;
import br.com.peladaoficial.service.PartidaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class PartidaController {

    private final PartidaService partidaService;

    public PartidaController(PartidaService partidaService) {
        this.partidaService = partidaService;
    }

    @PostMapping("/peladas/{peladaId}/partidas")
    public Map<String, Object> iniciar(@PathVariable Long peladaId,
                                       @Valid @RequestBody IniciarPartidaRequest request) {
        return toPartidaMap(partidaService.iniciar(peladaId, request));
    }

    @GetMapping("/peladas/{peladaId}/partidas")
    public List<Map<String, Object>> listar(@PathVariable Long peladaId) {
        return partidaService.listarPorPelada(peladaId).stream()
                .map(this::toPartidaResumo)
                .collect(Collectors.toList());
    }

    @GetMapping("/peladas/{peladaId}/goleiros")
    public List<Map<String, Object>> listarGoleiros(@PathVariable Long peladaId) {
        return partidaService.listarGoleirosDaPelada(peladaId).stream()
                .map(this::toJogadorSimples)
                .collect(Collectors.toList());
    }

    @GetMapping("/peladas/{peladaId}/keepers")
    public List<Map<String, Object>> listarKeepers(@PathVariable Long peladaId) {
        return listarGoleiros(peladaId);
    }

    @GetMapping({"/partidas/{id}", "/jogos/{id}"})
    public Map<String, Object> buscar(@PathVariable Long id) {
        return toPartidaMap(partidaService.buscar(id));
    }

    @PostMapping({"/partidas/{id}/eventos", "/jogos/{id}/eventos", "/partidas/{id}/lances"})
    public Map<String, Object> registrarEvento(@PathVariable Long id,
                                               @Valid @RequestBody RegistrarEventoRequest request) {
        partidaService.registrarEvento(id, request);
        // Devolve a partida completa já atualizada (placar + eventos) — 1 round-trip só
        return toPartidaMap(partidaService.buscar(id));
    }

    @PostMapping({"/partidas/{id}/finalizar", "/jogos/{id}/finalizar"})
    public Map<String, Object> finalizar(@PathVariable Long id) {
        Partida partida = partidaService.finalizar(id);
        Map<String, Object> map = new HashMap<>();
        map.put("partida", toPartidaMap(partida));
        Long peladaId = partida.getPelada().getId();
        map.put("times", partidaService.listarTimesDaPelada(peladaId).stream()
                .map(this::toTimeClassificacao)
                .collect(Collectors.toList()));
        // campos da partida no topo (compatível com clientes antigos)
        map.putAll(toPartidaMap(partida));
        return map;
    }

    @PostMapping("/partidas/{id}/desfazer-evento")
    public Map<String, Object> desfazerUltimoEvento(@PathVariable Long id) {
        return toPartidaMap(partidaService.desfazerUltimoEvento(id));
    }

    @DeleteMapping("/partidas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelarPartida(@PathVariable Long id) {
        partidaService.cancelarPartida(id);
    }

    private Map<String, Object> toPartidaResumo(Partida partida) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", partida.getId());
        map.put("numeroRodada", partida.getNumeroRodada());
        map.put("status", partida.getStatus().name());
        map.put("golsTimeA", partida.getGolsTimeA());
        map.put("golsTimeB", partida.getGolsTimeB());
        map.put("timeA", Map.of(
                "id", partida.getTimeA().getId(),
                "nome", partida.getTimeA().getNome(),
                "cor", partida.getTimeA().getCor()
        ));
        map.put("timeB", Map.of(
                "id", partida.getTimeB().getId(),
                "nome", partida.getTimeB().getNome(),
                "cor", partida.getTimeB().getCor()
        ));
        return map;
    }

    private Map<String, Object> toPartidaMap(Partida partida) {
        Map<String, Object> map = toPartidaResumo(partida);
        map.put("eventos", partida.getEventos().stream().map(this::toEventoMap).collect(Collectors.toList()));

        List<Jogador> linhaA = partida.getTimeA().getJogadores().stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro())).collect(Collectors.toList());
        List<Jogador> linhaB = partida.getTimeB().getJogadores().stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro())).collect(Collectors.toList());

        map.put("jogadoresTimeA", linhaA.stream().map(this::toJogadorSimples).collect(Collectors.toList()));
        map.put("jogadoresTimeB", linhaB.stream().map(this::toJogadorSimples).collect(Collectors.toList()));
        map.put("goleirosPelada", partidaService.listarGoleirosDaPelada(partida.getPelada().getId())
                .stream().map(this::toJogadorSimples).collect(Collectors.toList()));
        return map;
    }

    private Map<String, Object> toJogadorSimples(Jogador j) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", j.getId());
        map.put("nome", j.getNome());
        map.put("estrelas", j.getEstrelas());
        map.put("goleiro", Boolean.TRUE.equals(j.getGoleiro()));
        map.put("timeId", j.getTime() != null ? j.getTime().getId() : null);
        return map;
    }

    private Map<String, Object> toEventoMap(EventoPartida evento) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", evento.getId());
        map.put("tipo", evento.getTipo().name());
        map.put("timeId", evento.getTime().getId());
        map.put("timeNome", evento.getTime().getNome());
        map.put("jogadorId", evento.getJogador().getId());
        map.put("jogadorNome", evento.getJogador().getNome());
        map.put("goleiroId", evento.getGoleiro() != null ? evento.getGoleiro().getId() : null);
        map.put("goleiroNome", evento.getGoleiro() != null ? evento.getGoleiro().getNome() : null);
        map.put("ocorridoEm", evento.getOcorridoEm());
        return map;
    }

    private Map<String, Object> toTimeClassificacao(Time t) {
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
        map.put("nomeManual", Boolean.TRUE.equals(t.getNomeManual()));
        map.put("jogadores", t.getJogadores().stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()))
                .map(this::toJogadorSimples)
                .collect(Collectors.toList()));
        t.getGoleiroDoTime().ifPresent(gk -> map.put("goleiro", toJogadorSimples(gk)));
        return map;
    }
}
