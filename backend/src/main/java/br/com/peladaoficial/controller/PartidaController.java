package br.com.peladaoficial.controller;

import br.com.peladaoficial.dto.IniciarPartidaRequest;
import br.com.peladaoficial.dto.RegistrarEventoRequest;
import br.com.peladaoficial.model.EventoPartida;
import br.com.peladaoficial.model.Partida;
import br.com.peladaoficial.service.PartidaService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Endpoints das partidas ao vivo.
 */
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

    @GetMapping("/partidas/{id}")
    public Map<String, Object> buscar(@PathVariable Long id) {
        return toPartidaMap(partidaService.buscar(id));
    }

    @PostMapping("/partidas/{id}/eventos")
    public Map<String, Object> registrarEvento(@PathVariable Long id,
                                               @Valid @RequestBody RegistrarEventoRequest request) {
        return toEventoMap(partidaService.registrarEvento(id, request));
    }

    @PostMapping("/partidas/{id}/finalizar")
    public Map<String, Object> finalizar(@PathVariable Long id) {
        return toPartidaMap(partidaService.finalizar(id));
    }

    private Map<String, Object> toPartidaResumo(Partida partida) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", partida.getId());
        map.put("numeroRodada", partida.getNumeroRodada());
        map.put("status", partida.getStatus().name());
        map.put("golsTimeA", partida.getGolsTimeA());
        map.put("golsTimeB", partida.getGolsTimeB());
        map.put("timeA", Map.of("id", partida.getTimeA().getId(), "nome", partida.getTimeA().getNome(), "cor", partida.getTimeA().getCor()));
        map.put("timeB", Map.of("id", partida.getTimeB().getId(), "nome", partida.getTimeB().getNome(), "cor", partida.getTimeB().getCor()));
        return map;
    }

    private Map<String, Object> toPartidaMap(Partida partida) {
        Map<String, Object> map = toPartidaResumo(partida);
        map.put("eventos", partida.getEventos().stream().map(this::toEventoMap).collect(Collectors.toList()));
        map.put("jogadoresTimeA", partida.getTimeA().getJogadores().stream()
                .map(j -> Map.of("id", j.getId(), "nome", j.getNome(), "estrelas", j.getEstrelas()))
                .collect(Collectors.toList()));
        map.put("jogadoresTimeB", partida.getTimeB().getJogadores().stream()
                .map(j -> Map.of("id", j.getId(), "nome", j.getNome(), "estrelas", j.getEstrelas()))
                .collect(Collectors.toList()));
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
}
