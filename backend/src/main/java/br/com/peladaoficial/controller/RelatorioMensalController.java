package br.com.peladaoficial.controller;

import br.com.peladaoficial.service.RelatorioMensalService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class RelatorioMensalController {

    private final RelatorioMensalService relatorioMensalService;

    public RelatorioMensalController(RelatorioMensalService relatorioMensalService) {
        this.relatorioMensalService = relatorioMensalService;
    }

    /**
     * modo=mes (padrão) · ano · periodo
     * mes: ?ano=&mes=
     * ano: ?modo=ano&ano=
     * periodo: ?modo=periodo&de=AAAA-MM-DD&ate=AAAA-MM-DD
     */
    @GetMapping("/relatorio-mensal")
    public Map<String, Object> mensal(@RequestParam(required = false) String modo,
                                      @RequestParam(required = false) Integer ano,
                                      @RequestParam(required = false) Integer mes,
                                      @RequestParam(required = false) String de,
                                      @RequestParam(required = false) String ate) {
        return relatorioMensalService.montar(modo, ano, mes, de, ate);
    }
}
