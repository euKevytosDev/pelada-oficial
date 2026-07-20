package br.com.peladaoficial.controller;

import br.com.peladaoficial.dto.AdicionarJogadorRequest;
import br.com.peladaoficial.dto.AtualizarJogadorRequest;
import br.com.peladaoficial.dto.AtualizarTimeRequest;
import br.com.peladaoficial.dto.CriarPeladaRequest;
import br.com.peladaoficial.dto.MoverJogadorRequest;
import br.com.peladaoficial.dto.ObservacaoRequest;
import br.com.peladaoficial.model.ElencoJogador;
import br.com.peladaoficial.model.Jogador;
import br.com.peladaoficial.model.ObservacaoPelada;
import br.com.peladaoficial.model.Pelada;
import br.com.peladaoficial.model.Time;
import br.com.peladaoficial.service.PeladaService;
import br.com.peladaoficial.service.ResumoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.Comparator;
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

    @GetMapping
    public List<Map<String, Object>> listarMinhas() {
        return peladaService.listarMinhas().stream()
                .map(this::toPeladaMap)
                .collect(Collectors.toList());
    }

    @GetMapping("/ativa")
    public Map<String, Object> ativa() {
        return peladaService.buscarAtiva()
                .map(this::toPeladaMap)
                .orElseGet(HashMap::new);
    }

    /** Elenco permanente da conta (nomes/estrelas da última pelada encerrada). */
    @GetMapping("/elenco")
    public List<Map<String, Object>> listarElenco() {
        return peladaService.listarElenco().stream()
                .map(this::toElencoMap)
                .collect(Collectors.toList());
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

    /** Alias sem a palavra "jogadores" (alguns proxies bloqueiam essa URL e devolvem 401). */
    @PostMapping("/{id}/atletas")
    public Map<String, Object> adicionarAtleta(@PathVariable Long id,
                                               @Valid @RequestBody AdicionarJogadorRequest request) {
        return adicionarJogador(id, request);
    }

    @PatchMapping("/{id}/jogadores/{jogadorId}")
    public Map<String, Object> atualizarJogador(@PathVariable Long id,
                                                @PathVariable Long jogadorId,
                                                @Valid @RequestBody AtualizarJogadorRequest request) {
        return toJogadorMap(peladaService.atualizarJogador(id, jogadorId, request));
    }

    @PatchMapping("/{id}/atletas/{jogadorId}")
    public Map<String, Object> atualizarAtleta(@PathVariable Long id,
                                               @PathVariable Long jogadorId,
                                               @Valid @RequestBody AtualizarJogadorRequest request) {
        return atualizarJogador(id, jogadorId, request);
    }

    @GetMapping("/{id}/jogadores")
    public List<Map<String, Object>> listarJogadores(@PathVariable Long id) {
        return peladaService.listarJogadores(id).stream()
                .map(this::toJogadorMap)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}/atletas")
    public List<Map<String, Object>> listarAtletas(@PathVariable Long id) {
        return listarJogadores(id);
    }

    @DeleteMapping("/{id}/jogadores/{jogadorId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerJogador(@PathVariable Long id, @PathVariable Long jogadorId) {
        peladaService.removerJogador(id, jogadorId);
    }

    @DeleteMapping("/{id}/atletas/{jogadorId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerAtleta(@PathVariable Long id, @PathVariable Long jogadorId) {
        removerJogador(id, jogadorId);
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

    @PostMapping("/{id}/jogadores/{jogadorId}/mover")
    public List<Map<String, Object>> moverJogador(@PathVariable Long id,
                                                  @PathVariable Long jogadorId,
                                                  @Valid @RequestBody MoverJogadorRequest request) {
        return peladaService.moverJogador(id, jogadorId, request).stream()
                .map(this::toTimeMap)
                .collect(Collectors.toList());
    }

    @PostMapping("/{id}/atletas/{jogadorId}/mover")
    public List<Map<String, Object>> moverAtleta(@PathVariable Long id,
                                                 @PathVariable Long jogadorId,
                                                 @Valid @RequestBody MoverJogadorRequest request) {
        return moverJogador(id, jogadorId, request);
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

    @PostMapping("/{id}/observacoes")
    public Map<String, Object> adicionarObservacao(@PathVariable Long id,
                                                   @Valid @RequestBody ObservacaoRequest request) {
        return toObservacaoMap(peladaService.adicionarObservacao(id, request));
    }

    @GetMapping("/{id}/observacoes")
    public List<Map<String, Object>> listarObservacoes(@PathVariable Long id) {
        return peladaService.listarObservacoes(id).stream()
                .map(this::toObservacaoMap)
                .collect(Collectors.toList());
    }

    @DeleteMapping("/{id}/observacoes/{observacaoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerObservacao(@PathVariable Long id, @PathVariable Long observacaoId) {
        peladaService.removerObservacao(id, observacaoId);
    }

    private Map<String, Object> toObservacaoMap(ObservacaoPelada o) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", o.getId());
        map.put("tipo", o.getTipo());
        map.put("horario", o.getHorario());
        map.put("texto", o.getTexto());
        map.put("jogadorId", o.getJogador() != null ? o.getJogador().getId() : null);
        map.put("jogadorNome", o.getJogador() != null ? o.getJogador().getNome() : null);
        return map;
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
        map.put("apto", !Boolean.FALSE.equals(jogador.getApto()));
        map.put("timeId", jogador.getTime() != null ? jogador.getTime().getId() : null);
        return map;
    }

    private Map<String, Object> toElencoMap(ElencoJogador e) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", e.getId());
        map.put("nome", e.getNome());
        map.put("estrelas", e.getEstrelas());
        map.put("goleiro", Boolean.TRUE.equals(e.getGoleiro()));
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
                .sorted(Comparator.comparingInt(Jogador::getEstrelas)
                        .thenComparing(Jogador::getNome, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
        List<Jogador> goleiros = time.getJogadores().stream()
                .filter(j -> Boolean.TRUE.equals(j.getGoleiro()))
                .sorted(Comparator.comparing(Jogador::getNome, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());

        map.put("jogadores", linha.stream().map(this::toJogadorMap).collect(Collectors.toList()));
        map.put("goleiros", goleiros.stream().map(this::toJogadorMap).collect(Collectors.toList()));
        map.put("goleiro", goleiros.isEmpty() ? null : toJogadorMap(goleiros.get(0)));
        return map;
    }
}
