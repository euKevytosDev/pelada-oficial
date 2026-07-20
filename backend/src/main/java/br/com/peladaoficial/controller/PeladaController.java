package br.com.peladaoficial.controller;

import br.com.peladaoficial.dto.AdicionarJogadorRequest;
import br.com.peladaoficial.dto.AtualizarTimeRequest;
import br.com.peladaoficial.dto.CriarPeladaRequest;
import br.com.peladaoficial.model.Jogador;
import br.com.peladaoficial.model.Pelada;
import br.com.peladaoficial.model.Time;
import br.com.peladaoficial.service.PeladaService;
import br.com.peladaoficial.service.ResumoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/peladas")
public class PeladaController {

    private final PeladaService peladaService;
    private final ResumoService resumoService;

    public PeladaController(PeladaService peladaService, ResumoService resumoService) {
        this.peladaService = peladaService;
        this.resumoService = resumoService;
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

    @DeleteMapping("/{id}/jogadores/{jogadorId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerJogador(@PathVariable Long id, @PathVariable Long jogadorId) {
        peladaService.removerJogador(id, jogadorId);
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

    @PatchMapping("/{id}/times/{timeId}")
    public Map<String, Object> atualizarTime(@PathVariable Long id,
                                             @PathVariable Long timeId,
                                             @Valid @RequestBody AtualizarTimeRequest request) {
        return toTimeMap(peladaService.atualizarTime(id, timeId, request));
    }

    @PostMapping("/{id}/encerrar")
    public Map<String, Object> encerrar(@PathVariable Long id) {
        peladaService.encerrar(id);
        return resumoService.montar(id);
    }

    @GetMapping("/{id}/resumo")
    public Map<String, Object> resumo(@PathVariable Long id) {
        return resumoService.montar(id);
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
        map.put("goleiro", Boolean.TRUE.equals(jogador.getGoleiro()));
        map.put("pontos", jogador.getPontos());
        map.put("gols", jogador.getGols());
        map.put("golsContra", jogador.getGolsContra());
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
        map.put("nomeManual", Boolean.TRUE.equals(time.getNomeManual()));
        map.put("cor", time.getCor());
        map.put("pontos", time.getPontos());
        map.put("vitorias", time.getVitorias());
        map.put("empates", time.getEmpates());
        map.put("derrotas", time.getDerrotas());
        map.put("golsPro", time.getGolsPro());
        map.put("golsContra", time.getGolsContra());
        map.put("totalEstrelas", time.getTotalEstrelas());

        List<Jogador> linha = time.getJogadores().stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()))
                .collect(Collectors.toList());
        List<Jogador> goleiros = time.getJogadores().stream()
                .filter(j -> Boolean.TRUE.equals(j.getGoleiro()))
                .collect(Collectors.toList());

        map.put("jogadores", linha.stream().map(this::toJogadorMap).collect(Collectors.toList()));
        map.put("goleiros", goleiros.stream().map(this::toJogadorMap).collect(Collectors.toList()));
        map.put("goleiro", goleiros.isEmpty() ? null : toJogadorMap(goleiros.get(0)));
        return map;
    }
}
