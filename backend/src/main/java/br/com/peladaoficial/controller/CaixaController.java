package br.com.peladaoficial.controller;

import br.com.peladaoficial.dto.CaixaModalidadeRequest;
import br.com.peladaoficial.dto.CaixaPagamentoRequest;
import br.com.peladaoficial.dto.CaixaPresencaRequest;
import br.com.peladaoficial.dto.CaixaValoresRequest;
import br.com.peladaoficial.service.CaixaService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/caixa")
public class CaixaController {

    private final CaixaService caixaService;

    public CaixaController(CaixaService caixaService) {
        this.caixaService = caixaService;
    }

    @GetMapping
    public Map<String, Object> ver(@RequestParam(required = false) Integer ano,
                                   @RequestParam(required = false) Integer mes) {
        return caixaService.montar(ano, mes);
    }

    @PutMapping("/valores")
    public Map<String, Object> valores(@RequestParam(required = false) Integer ano,
                                       @RequestParam(required = false) Integer mes,
                                       @RequestBody(required = false) CaixaValoresRequest req) {
        return caixaService.salvarValores(ano, mes, req);
    }

    @PutMapping("/jogadores/{id}/modalidade")
    public Map<String, Object> modalidade(@PathVariable Long id,
                                          @RequestParam(required = false) Integer ano,
                                          @RequestParam(required = false) Integer mes,
                                          @RequestBody(required = false) CaixaModalidadeRequest req) {
        return caixaService.mudarModalidade(id, ano, mes, req);
    }

    @PostMapping("/jogadores/{id}/cobrar")
    public Map<String, Object> cobrar(@PathVariable Long id,
                                      @RequestParam(required = false) Integer ano,
                                      @RequestParam(required = false) Integer mes) {
        return caixaService.cobrarAvulso(id, ano, mes);
    }

    @PostMapping("/jogadores/{id}/pagar")
    public Map<String, Object> pagar(@PathVariable Long id,
                                     @RequestParam(required = false) Integer ano,
                                     @RequestParam(required = false) Integer mes,
                                     @RequestBody(required = false) CaixaPagamentoRequest req) {
        return caixaService.pagar(id, ano, mes, req);
    }

    @PostMapping("/jogadores/{id}/quitar")
    public Map<String, Object> quitar(@PathVariable Long id,
                                      @RequestParam(required = false) Integer ano,
                                      @RequestParam(required = false) Integer mes) {
        return caixaService.quitar(id, ano, mes);
    }

    @PostMapping("/jogadores/{id}/desfazer")
    public Map<String, Object> desfazer(@PathVariable Long id,
                                        @RequestParam(required = false) Integer ano,
                                        @RequestParam(required = false) Integer mes) {
        return caixaService.desfazerUltimo(id, ano, mes);
    }

    @PostMapping("/jogadores/{id}/desfazer-cobranca")
    public Map<String, Object> desfazerCobranca(@PathVariable Long id,
                                                @RequestParam(required = false) Integer ano,
                                                @RequestParam(required = false) Integer mes) {
        return caixaService.desfazerCobranca(id, ano, mes);
    }

    @PostMapping("/cobrar-jogo")
    public Map<String, Object> cobrarJogo(@RequestParam(required = false) Integer ano,
                                          @RequestParam(required = false) Integer mes,
                                          @RequestParam(required = false) Long peladaId,
                                          @RequestBody(required = false) CaixaPresencaRequest req) {
        return caixaService.cobrarJogo(ano, mes, peladaId, req);
    }

    @PostMapping("/cancelar-jogo")
    public Map<String, Object> cancelarJogo(@RequestParam(required = false) Integer ano,
                                            @RequestParam(required = false) Integer mes,
                                            @RequestParam Long peladaId) {
        return caixaService.cancelarJogo(ano, mes, peladaId);
    }
}
