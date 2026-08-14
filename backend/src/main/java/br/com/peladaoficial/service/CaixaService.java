package br.com.peladaoficial.service;

import br.com.peladaoficial.dto.CaixaModalidadeRequest;
import br.com.peladaoficial.dto.CaixaPagamentoRequest;
import br.com.peladaoficial.dto.CaixaValoresRequest;
import br.com.peladaoficial.model.CaixaConfig;
import br.com.peladaoficial.model.CaixaJogador;
import br.com.peladaoficial.model.CaixaLancamento;
import br.com.peladaoficial.model.ElencoJogador;
import br.com.peladaoficial.model.Jogador;
import br.com.peladaoficial.model.Pelada;
import br.com.peladaoficial.model.Usuario;
import br.com.peladaoficial.repository.CaixaConfigRepository;
import br.com.peladaoficial.repository.CaixaJogadorRepository;
import br.com.peladaoficial.repository.CaixaLancamentoRepository;
import br.com.peladaoficial.repository.ElencoJogadorRepository;
import br.com.peladaoficial.repository.JogadorRepository;
import br.com.peladaoficial.repository.PeladaRepository;
import br.com.peladaoficial.security.AuthSupport;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class CaixaService {

    private static final ZoneId FUSO = ZoneId.of("America/Sao_Paulo");
    private static final Locale PT = Locale.forLanguageTag("pt-BR");
    private static final BigDecimal TETO = new BigDecimal("99999.99");

    private final AuthSupport authSupport;
    private final AssinaturaService assinaturaService;
    private final CaixaConfigRepository configRepository;
    private final CaixaJogadorRepository jogadorRepository;
    private final CaixaLancamentoRepository lancamentoRepository;
    private final ElencoJogadorRepository elencoRepository;
    private final PeladaRepository peladaRepository;
    private final JogadorRepository peladaJogadorRepository;

    public CaixaService(AuthSupport authSupport,
                        AssinaturaService assinaturaService,
                        CaixaConfigRepository configRepository,
                        CaixaJogadorRepository jogadorRepository,
                        CaixaLancamentoRepository lancamentoRepository,
                        ElencoJogadorRepository elencoRepository,
                        PeladaRepository peladaRepository,
                        JogadorRepository peladaJogadorRepository) {
        this.authSupport = authSupport;
        this.assinaturaService = assinaturaService;
        this.configRepository = configRepository;
        this.jogadorRepository = jogadorRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.elencoRepository = elencoRepository;
        this.peladaRepository = peladaRepository;
        this.peladaJogadorRepository = peladaJogadorRepository;
    }

    @Transactional
    public Map<String, Object> montar(Integer ano, Integer mes) {
        Usuario usuario = exigirPro();
        YearMonth ym = resolverMes(ano, mes);
        String competencia = ym.toString();
        CaixaConfig config = garantirConfig(usuario);
        Set<String> visiveis = sincronizarJogadores(usuario, ym);

        List<CaixaLancamento> lancamentos = lancamentoRepository.findByUsuarioAndCompetencia(usuario, competencia);
        Map<Long, BigDecimal> cobradoExtra = new LinkedHashMap<>();
        Map<Long, BigDecimal> pago = new LinkedHashMap<>();
        for (CaixaLancamento l : lancamentos) {
            Long id = l.getJogador().getId();
            visiveis.add(l.getJogador().getChave());
            if (CaixaLancamento.COBRANCA.equals(l.getTipo())) {
                cobradoExtra.merge(id, l.getValor(), BigDecimal::add);
            } else if (CaixaLancamento.PAGAMENTO.equals(l.getTipo())) {
                pago.merge(id, l.getValor(), BigDecimal::add);
            }
        }

        BigDecimal totalCobrado = BigDecimal.ZERO;
        BigDecimal totalPago = BigDecimal.ZERO;
        BigDecimal totalPendente = BigDecimal.ZERO;
        int quitados = 0;
        int pendentes = 0;
        List<Map<String, Object>> lista = new ArrayList<>();

        for (CaixaJogador j : jogadorRepository.findByUsuarioOrderByNomeAsc(usuario)) {
            if (!visiveis.contains(j.getChave())) continue;
            BigDecimal extra = cobradoExtra.getOrDefault(j.getId(), BigDecimal.ZERO);
            BigDecimal pagoJog = pago.getOrDefault(j.getId(), BigDecimal.ZERO);
            BigDecimal cobrado = cobradoDoMes(j, config, extra);
            BigDecimal pendente = cobrado.subtract(pagoJog).max(BigDecimal.ZERO);
            String status = statusDe(cobrado, pendente);

            if ("PENDENTE".equals(status)) pendentes++;
            if ("QUITADO".equals(status)) quitados++;
            totalCobrado = totalCobrado.add(cobrado);
            totalPago = totalPago.add(pagoJog);
            totalPendente = totalPendente.add(pendente);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", j.getId());
            row.put("nome", j.getNome());
            row.put("goleiro", Boolean.TRUE.equals(j.getGoleiro()));
            row.put("modalidade", j.getModalidade());
            row.put("cobrado", dinheiro(cobrado));
            row.put("pago", dinheiro(pagoJog));
            row.put("pendente", dinheiro(pendente));
            row.put("status", status);
            lista.add(row);
        }

        lista.sort(Comparator
                .comparingInt((Map<String, Object> r) -> ordemStatus(String.valueOf(r.get("status"))))
                .thenComparing((Map<String, Object> r) -> -((Number) r.get("pendente")).doubleValue())
                .thenComparing(r -> String.valueOf(r.get("nome")), String.CASE_INSENSITIVE_ORDER));

        Map<String, Object> totais = new LinkedHashMap<>();
        totais.put("cobrado", dinheiro(totalCobrado));
        totais.put("pago", dinheiro(totalPago));
        totais.put("pendente", dinheiro(totalPendente));
        totais.put("quitados", quitados);
        totais.put("pendentes", pendentes);
        totais.put("jogadores", lista.size());

        String mesNome = ym.getMonth().getDisplayName(TextStyle.FULL, PT);
        mesNome = mesNome.substring(0, 1).toUpperCase(PT) + mesNome.substring(1);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ano", ym.getYear());
        out.put("mes", ym.getMonthValue());
        out.put("competencia", competencia);
        out.put("titulo", mesNome + " " + ym.getYear());
        out.put("valorMensal", dinheiro(config.getValorMensal()));
        out.put("valorAvulso", dinheiro(config.getValorAvulso()));
        out.put("totais", totais);
        out.put("jogadores", lista);
        return out;
    }

    @Transactional
    public Map<String, Object> salvarValores(Integer ano, Integer mes, CaixaValoresRequest req) {
        Usuario usuario = exigirPro();
        CaixaConfig config = garantirConfig(usuario);
        config.setValorMensal(normalizarValor(req == null ? null : req.getValorMensal()));
        config.setValorAvulso(normalizarValor(req == null ? null : req.getValorAvulso()));
        configRepository.save(config);
        return montar(ano, mes);
    }

    @Transactional
    public Map<String, Object> mudarModalidade(Long jogadorId, Integer ano, Integer mes, CaixaModalidadeRequest req) {
        Usuario usuario = exigirPro();
        CaixaJogador jogador = buscarJogador(usuario, jogadorId);
        String mod = req == null ? "" : String.valueOf(req.getModalidade()).trim().toUpperCase(Locale.ROOT);
        if (!CaixaJogador.MENSAL.equals(mod) && !CaixaJogador.AVULSO.equals(mod) && !CaixaJogador.ISENTO.equals(mod)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escolha mensal, avulso ou isento");
        }
        jogador.setModalidade(mod);
        jogadorRepository.save(jogador);
        return montar(ano, mes);
    }

    @Transactional
    public Map<String, Object> cobrarAvulso(Long jogadorId, Integer ano, Integer mes) {
        Usuario usuario = exigirPro();
        YearMonth ym = resolverMes(ano, mes);
        CaixaConfig config = garantirConfig(usuario);
        if (config.getValorAvulso().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Defina o valor avulso primeiro");
        }
        CaixaJogador jogador = buscarJogador(usuario, jogadorId);
        lancar(usuario, jogador, ym.toString(), CaixaLancamento.COBRANCA, config.getValorAvulso(), "pelada");
        return montar(ano, mes);
    }

    @Transactional
    public Map<String, Object> pagar(Long jogadorId, Integer ano, Integer mes, CaixaPagamentoRequest req) {
        Usuario usuario = exigirPro();
        YearMonth ym = resolverMes(ano, mes);
        BigDecimal valor = normalizarValor(req == null ? null : req.getValor());
        if (valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe quanto o jogador pagou");
        }
        CaixaJogador jogador = buscarJogador(usuario, jogadorId);
        lancar(usuario, jogador, ym.toString(), CaixaLancamento.PAGAMENTO, valor, null);
        return montar(ano, mes);
    }

    @Transactional
    public Map<String, Object> quitar(Long jogadorId, Integer ano, Integer mes) {
        Usuario usuario = exigirPro();
        YearMonth ym = resolverMes(ano, mes);
        CaixaJogador jogador = buscarJogador(usuario, jogadorId);
        CaixaConfig config = garantirConfig(usuario);
        BigDecimal extra = somaTipo(usuario, jogador, ym.toString(), CaixaLancamento.COBRANCA);
        BigDecimal pago = somaTipo(usuario, jogador, ym.toString(), CaixaLancamento.PAGAMENTO);
        BigDecimal pendente = cobradoDoMes(jogador, config, extra).subtract(pago).max(BigDecimal.ZERO);
        if (pendente.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Esse jogador não tem pendência");
        }
        lancar(usuario, jogador, ym.toString(), CaixaLancamento.PAGAMENTO, pendente, "quitado");
        return montar(ano, mes);
    }

    @Transactional
    public Map<String, Object> desfazerUltimo(Long jogadorId, Integer ano, Integer mes) {
        Usuario usuario = exigirPro();
        YearMonth ym = resolverMes(ano, mes);
        CaixaJogador jogador = buscarJogador(usuario, jogadorId);
        CaixaLancamento ultimo = lancamentoRepository
                .findFirstByUsuarioAndJogadorAndCompetenciaAndTipoOrderByCriadoEmDesc(
                        usuario, jogador, ym.toString(), CaixaLancamento.PAGAMENTO)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não há pagamento para desfazer"));
        lancamentoRepository.delete(ultimo);
        return montar(ano, mes);
    }

    private Usuario exigirPro() {
        Usuario usuario = authSupport.usuarioAtual();
        assinaturaService.garantirTrialEMap(usuario);
        if (!assinaturaService.proAtivo(usuario)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "A caixa da pelada faz parte do Pelada Pro");
        }
        return usuario;
    }

    private CaixaConfig garantirConfig(Usuario usuario) {
        return configRepository.findByUsuario(usuario).orElseGet(() -> {
            CaixaConfig c = new CaixaConfig(usuario);
            return configRepository.save(c);
        });
    }

    private Set<String> sincronizarJogadores(Usuario usuario, YearMonth ym) {
        Set<String> chaves = new HashSet<>();
        for (ElencoJogador e : elencoRepository.findByUsuarioOrderByGoleiroAscNomeAsc(usuario)) {
            garantirJogador(usuario, e.getNome(), Boolean.TRUE.equals(e.getGoleiro()));
            chaves.add(CaixaJogador.chaveDe(e.getNome(), Boolean.TRUE.equals(e.getGoleiro())));
        }

        LocalDateTime inicio = ym.atDay(1).atStartOfDay();
        LocalDateTime fim = ym.plusMonths(1).atDay(1).atStartOfDay();
        for (Pelada p : peladaRepository.findByUsuarioOrderByCriadaEmDesc(usuario)) {
            LocalDateTime ref = p.getEncerradaEm() != null ? p.getEncerradaEm() : p.getCriadaEm();
            if (ref == null || ref.isBefore(inicio) || !ref.isBefore(fim)) continue;
            for (Jogador j : peladaJogadorRepository.findByPeladaIdOrderByNomeAsc(p.getId())) {
                String chave = CaixaJogador.chaveDe(j.getNome(), Boolean.TRUE.equals(j.getGoleiro()));
                if (chaves.add(chave)) {
                    garantirJogador(usuario, j.getNome(), Boolean.TRUE.equals(j.getGoleiro()));
                }
            }
        }
        return chaves;
    }

    private CaixaJogador garantirJogador(Usuario usuario, String nome, boolean goleiro) {
        String chave = CaixaJogador.chaveDe(nome, goleiro);
        return jogadorRepository.findByUsuarioAndChave(usuario, chave).orElseGet(() -> {
            CaixaJogador j = new CaixaJogador();
            j.setUsuario(usuario);
            j.setChave(chave);
            j.setNome(nome == null ? "" : nome.trim());
            j.setGoleiro(goleiro);
            j.setModalidade(CaixaJogador.AVULSO);
            return jogadorRepository.save(j);
        });
    }

    private CaixaJogador buscarJogador(Usuario usuario, Long id) {
        return jogadorRepository.findByIdAndUsuario(id, usuario)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Jogador não encontrado na caixa"));
    }

    private void lancar(Usuario usuario, CaixaJogador jogador, String competencia, String tipo, BigDecimal valor, String nota) {
        CaixaLancamento l = new CaixaLancamento();
        l.setUsuario(usuario);
        l.setJogador(jogador);
        l.setCompetencia(competencia);
        l.setTipo(tipo);
        l.setValor(valor);
        l.setCriadoEm(LocalDateTime.now());
        l.setNota(nota);
        lancamentoRepository.save(l);
    }

    private BigDecimal somaTipo(Usuario usuario, CaixaJogador jogador, String competencia, String tipo) {
        return lancamentoRepository.findByUsuarioAndJogadorAndCompetencia(usuario, jogador, competencia).stream()
                .filter(l -> tipo.equals(l.getTipo()))
                .map(CaixaLancamento::getValor)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal cobradoDoMes(CaixaJogador j, CaixaConfig config, BigDecimal extra) {
        BigDecimal extras = extra == null ? BigDecimal.ZERO : extra;
        String mod = j.getModalidade() == null ? CaixaJogador.AVULSO : j.getModalidade();
        if (CaixaJogador.ISENTO.equals(mod)) return extras;
        if (CaixaJogador.MENSAL.equals(mod)) return nvl(config.getValorMensal()).add(extras);
        return extras;
    }

    private static String statusDe(BigDecimal cobrado, BigDecimal pendente) {
        if (cobrado.compareTo(BigDecimal.ZERO) <= 0 && pendente.compareTo(BigDecimal.ZERO) <= 0) {
            return "SEM_COBRANCA";
        }
        if (pendente.compareTo(BigDecimal.ZERO) > 0) return "PENDENTE";
        return "QUITADO";
    }

    private static int ordemStatus(String status) {
        if ("PENDENTE".equals(status)) return 0;
        if ("SEM_COBRANCA".equals(status)) return 1;
        return 2;
    }

    private YearMonth resolverMes(Integer ano, Integer mes) {
        LocalDate hoje = LocalDate.now(FUSO);
        int y = ano != null && ano >= 2020 ? ano : hoje.getYear();
        int m = mes != null && mes >= 1 && mes <= 12 ? mes : hoje.getMonthValue();
        return YearMonth.of(y, m);
    }

    private static BigDecimal normalizarValor(BigDecimal v) {
        BigDecimal n = nvl(v).setScale(2, RoundingMode.HALF_UP);
        if (n.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valor não pode ser negativo");
        }
        if (n.compareTo(TETO) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valor grande demais");
        }
        return n;
    }

    private static BigDecimal nvl(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static double dinheiro(BigDecimal v) {
        return nvl(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
