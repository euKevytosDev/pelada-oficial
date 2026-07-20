package br.com.peladaoficial.controller;

import br.com.peladaoficial.dto.AdicionarJogadorRequest;
import br.com.peladaoficial.dto.CriarPeladaRequest;
import br.com.peladaoficial.model.Jogador;
import br.com.peladaoficial.model.Pelada;
import br.com.peladaoficial.model.Time;
import br.com.peladaoficial.service.PeladaService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Endpoints da pelada (criar, jogadores, sorteio, encerrar).
 * Base: http://localhost:8080/api/peladas
 */
@RestController
@RequestMapping("/api/peladas")
public class PeladaController {

    private final PeladaService peladaService;

    public PeladaController(PeladaService peladaService) {
        this.peladaService = peladaService;
    }

    @PostMapping
    public Map<String, Object> criar(@Valid @RequestBody CriarPeladaRequest request) {
        return toPeladaMap(peladaService.criar(request));
    }

    @GetMapping("/{id}")
    public Map<String, Object> buscar(@PathVariable Long id) {
        return toPeladaMap(peladaService.buscar(id));
    }

    @PostMapping("/{id}/jogadores")
    public Map<String, Object> adicionarJogador(@PathVariable Long id,
                                                @Valid @RequestBody AdicionarJogadorRequest request) {
        return toJogadorMap(peladaService.adicionarJogador(id, request));
    }

    @GetMapping("/{id}/jogadores")
    public List<Map<String, Object>> listarJogadores(@PathVariable Long id) {
        return peladaService.listarJogadores(id).stream()
                .map(this::toJogadorMap)
                .collect(Collectors.toList());
    }

    @PostMapping("/{id}/sortear")
    public List<Map<String, Object>> sortear(@PathVariable Long id) {
        return peladaService.sortearTimes(id).stream()
                .map(this::toTimeMap)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}/times")
    public List<Map<String, Object>> listarTimes(@PathVariable Long id) {
        return peladaService.listarTimes(id).stream()
                .map(this::toTimeMap)
                .collect(Collectors.toList());
    }

    @PostMapping("/{id}/encerrar")
    public Map<String, Object> encerrar(@PathVariable Long id) {
        return toPeladaMap(peladaService.encerrar(id));
    }

    private Map<String, Object> toPeladaMap(Pelada pelada) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", pelada.getId());
        map.put("nome", pelada.getNome());
        map.put("status", pelada.getStatus().name());
        map.put("quantidadeTimes", pelada.getQuantidadeTimes());
        map.put("criadaEm", pelada.getCriadaEm());
        map.put("encerradaEm", pelada.getEncerradaEm());
        return map;
    }

    private Map<String, Object> toJogadorMap(Jogador jogador) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", jogador.getId());
        map.put("nome", jogador.getNome());
        map.put("estrelas", jogador.getEstrelas());
        map.put("pontos", jogador.getPontos());
        map.put("gols", jogador.getGols());
        map.put("cartoesAmarelos", jogador.getCartoesAmarelos());
        map.put("cartoesVermelhos", jogador.getCartoesVermelhos());
        map.put("golsSofridos", jogador.getGolsSofridos());
        map.put("timeId", jogador.getTime() != null ? jogador.getTime().getId() : null);
        return map;
    }

    private Map<String, Object> toTimeMap(Time time) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", time.getId());
        map.put("nome", time.getNome());
        map.put("cor", time.getCor());
        map.put("pontos", time.getPontos());
        map.put("vitorias", time.getVitorias());
        map.put("empates", time.getEmpates());
        map.put("derrotas", time.getDerrotas());
        map.put("golsPro", time.getGolsPro());
        map.put("golsContra", time.getGolsContra());
        map.put("totalEstrelas", time.getTotalEstrelas());
        map.put("jogadores", time.getJogadores().stream().map(this::toJogadorMap).collect(Collectors.toList()));
        return map;
    }
}
