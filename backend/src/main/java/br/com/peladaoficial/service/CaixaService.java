package br.com.peladaoficial.service;

import br.com.peladaoficial.dto.CaixaModalidadeRequest;
import br.com.peladaoficial.dto.CaixaPagamentoRequest;
import br.com.peladaoficial.dto.CaixaPresencaRequest;
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
        MesDados mesDados = sincronizarJogadores(usuario, ym);
        Set<String> visiveis = mesDados.visiveis;

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
            row.put("jogos", mesDados.jogos.getOrDefault(j.getChave(), 0));
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
        totais.put("peladas", mesDados.peladas.size());
        int pct = totalCobrado.compareTo(BigDecimal.ZERO) <= 0
                ? 0
                : totalPago.multiply(BigDecimal.valueOf(100)).divide(totalCobrado, 0, RoundingMode.HALF_UP).intValue();
        totais.put("percentual", Math.min(100, pct));

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
        out.put("ultimaPelada", montarUltimaPelada(usuario, config, mesDados));
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

    @Transactional
    public Map<String, Object> desfazerCobranca(Long jogadorId, Integer ano, Integer mes) {
        Usuario usuario = exigirPro();
        YearMonth ym = resolverMes(ano, mes);
        CaixaJogador jogador = buscarJogador(usuario, jogadorId);
        CaixaLancamento ultimo = lancamentoRepository
                .findFirstByUsuarioAndJogadorAndCompetenciaAndTipoOrderByCriadoEmDesc(
                        usuario, jogador, ym.toString(), CaixaLancamento.COBRANCA)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não há cobrança para cancelar"));
        lancamentoRepository.delete(ultimo);
        return montar(ano, mes);
    }

    @Transactional
    public Map<String, Object> cancelarJogo(Integer ano, Integer mes, Long peladaId) {
        Usuario usuario = exigirPro();
        if (peladaId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a pelada");
        }
        peladaRepository.findByIdAndUsuario(peladaId, usuario)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pelada não encontrada"));
        String nota = "pelada:" + peladaId;
        List<CaixaLancamento> lista = lancamentoRepository.findByUsuarioAndNota(usuario, nota);
        int apagados = 0;
        for (CaixaLancamento l : lista) {
            if (CaixaLancamento.COBRANCA.equals(l.getTipo())) {
                lancamentoRepository.delete(l);
                apagados++;
            }
        }
        if (apagados == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não tem cobrança automática deste jogo para cancelar");
        }
        Map<String, Object> out = montar(ano, mes);
        out.put("canceladosAgora", apagados);
        return out;
    }

    @Transactional
    public Map<String, Object> cobrarJogo(Integer ano, Integer mes, Long peladaId, CaixaPresencaRequest req) {
        Usuario usuario = exigirPro();
        YearMonth ym = resolverMes(ano, mes);
        CaixaConfig config = garantirConfig(usuario);
        if (config.getValorAvulso().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Defina o valor avulso primeiro");
        }

        Long idPelada = peladaId != null ? peladaId : (req != null ? req.getPeladaId() : null);
        List<CaixaPresencaRequest.Item> itens = new ArrayList<>();
        String nota;

        if (idPelada != null) {
            Pelada pelada = peladaRepository.findByIdAndUsuario(idPelada, usuario)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pelada não encontrada"));
            nota = "pelada:" + pelada.getId();
            for (Jogador j : peladaJogadorRepository.findByPeladaIdOrderByNomeAsc(pelada.getId())) {
                if (Boolean.FALSE.equals(j.getApto())) continue;
                CaixaPresencaRequest.Item item = new CaixaPresencaRequest.Item();
                item.setNome(j.getNome());
                item.setGoleiro(Boolean.TRUE.equals(j.getGoleiro()));
                item.setApto(true);
                itens.add(item);
            }
        } else if (req != null && req.getJogadores() != null && !req.getJogadores().isEmpty()) {
            itens.addAll(req.getJogadores());
            nota = "lista:" + Integer.toUnsignedString(chaveLista(itens).hashCode(), 16);
        } else {
            MesDados mesDados = sincronizarJogadores(usuario, ym);
            if (mesDados.peladas.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não tem pelada neste mês para cobrar");
            }
            Pelada ultima = mesDados.peladas.get(0);
            return cobrarJogo(ano, mes, ultima.getId(), null);
        }

        int cobrados = 0;
        int pulados = 0;
        Map<String, Boolean> aptoElenco = mapaAptoElenco(usuario);
        for (CaixaPresencaRequest.Item item : itens) {
            if (item.getNome() == null || item.getNome().isBlank()) continue;
            boolean goleiro = Boolean.TRUE.equals(item.getGoleiro());
            String chave = CaixaJogador.chaveDe(item.getNome(), goleiro);
            boolean apto = !Boolean.FALSE.equals(item.getApto());
            if (item.getApto() == null) {
                apto = aptoElenco.getOrDefault(chave, true);
            }
            if (!apto) {
                pulados++;
                continue;
            }
            CaixaJogador jogador = garantirJogador(usuario, item.getNome(), goleiro);
            if (CaixaJogador.ISENTO.equals(jogador.getModalidade()) || CaixaJogador.MENSAL.equals(jogador.getModalidade())) {
                pulados++;
                continue;
            }
            if (lancamentoRepository.existsByUsuarioAndJogadorAndNota(usuario, jogador, nota)) {
                pulados++;
                continue;
            }
            lancar(usuario, jogador, ym.toString(), CaixaLancamento.COBRANCA, config.getValorAvulso(), nota);
            cobrados++;
        }
        if (cobrados == 0 && pulados == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ninguém para cobrar neste jogo");
        }
        Map<String, Object> out = montar(ano, mes);
        out.put("cobradosAgora", cobrados);
        out.put("jaEstavam", pulados);
        return out;
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

    private MesDados sincronizarJogadores(Usuario usuario, YearMonth ym) {
        Set<String> chaves = new HashSet<>();
        Map<String, Integer> jogos = new LinkedHashMap<>();
        List<Pelada> peladasMes = new ArrayList<>();

        for (ElencoJogador e : elencoRepository.findByUsuarioOrderByGoleiroAscNomeAsc(usuario)) {
            garantirJogador(usuario, e.getNome(), Boolean.TRUE.equals(e.getGoleiro()));
            chaves.add(CaixaJogador.chaveDe(e.getNome(), Boolean.TRUE.equals(e.getGoleiro())));
        }

        LocalDateTime inicio = ym.atDay(1).atStartOfDay();
        LocalDateTime fim = ym.plusMonths(1).atDay(1).atStartOfDay();
        for (Pelada p : peladaRepository.findByUsuarioOrderByCriadaEmDesc(usuario)) {
            LocalDateTime ref = p.getEncerradaEm() != null ? p.getEncerradaEm() : p.getCriadaEm();
            if (ref == null || ref.isBefore(inicio) || !ref.isBefore(fim)) continue;
            peladasMes.add(p);
            Set<String> naPelada = new HashSet<>();
            for (Jogador j : peladaJogadorRepository.findByPeladaIdOrderByNomeAsc(p.getId())) {
                String chave = CaixaJogador.chaveDe(j.getNome(), Boolean.TRUE.equals(j.getGoleiro()));
                naPelada.add(chave);
                if (chaves.add(chave)) {
                    garantirJogador(usuario, j.getNome(), Boolean.TRUE.equals(j.getGoleiro()));
                }
            }
            for (String chave : naPelada) {
                jogos.merge(chave, 1, Integer::sum);
            }
        }
        peladasMes.sort((a, b) -> {
            LocalDateTime ra = a.getEncerradaEm() != null ? a.getEncerradaEm() : a.getCriadaEm();
            LocalDateTime rb = b.getEncerradaEm() != null ? b.getEncerradaEm() : b.getCriadaEm();
            if (ra == null && rb == null) return 0;
            if (ra == null) return 1;
            if (rb == null) return -1;
            return rb.compareTo(ra);
        });
        return new MesDados(chaves, peladasMes, jogos);
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
        if (CaixaJogador.ISENTO.equals(mod)) return BigDecimal.ZERO;
        // Mensalista: só o valor fixo do mês — não soma pelada avulsa em cima.
        if (CaixaJogador.MENSAL.equals(mod)) return nvl(config.getValorMensal());
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

    private Map<String, Object> montarUltimaPelada(Usuario usuario,
                                                   CaixaConfig config,
                                                   MesDados mesDados) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (mesDados.peladas.isEmpty()) {
            out.put("tem", false);
            return out;
        }
        Pelada ultima = mesDados.peladas.get(0);
        String nota = "pelada:" + ultima.getId();
        List<Map<String, Object>> avulsos = new ArrayList<>();
        int cobradosNesteJogo = 0;
        for (Jogador j : peladaJogadorRepository.findByPeladaIdOrderByNomeAsc(ultima.getId())) {
            if (Boolean.FALSE.equals(j.getApto())) continue;
            CaixaJogador cj = garantirJogador(usuario, j.getNome(), Boolean.TRUE.equals(j.getGoleiro()));
            if (!CaixaJogador.AVULSO.equals(cj.getModalidade())) continue;
            if (lancamentoRepository.existsByUsuarioAndJogadorAndNota(usuario, cj, nota)) {
                cobradosNesteJogo++;
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", cj.getId());
            row.put("nome", cj.getNome());
            avulsos.add(row);
        }
        LocalDateTime ref = ultima.getEncerradaEm() != null ? ultima.getEncerradaEm() : ultima.getCriadaEm();
        out.put("tem", true);
        out.put("id", ultima.getId());
        out.put("nome", ultima.getNome());
        out.put("quando", ref != null ? ref.toString() : "");
        out.put("quandoTexto", ref != null ? ref.toLocalDate().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM")) : "");
        out.put("avulsosParaCobrar", avulsos);
        out.put("podeCobrar", config.getValorAvulso().compareTo(BigDecimal.ZERO) > 0 && !avulsos.isEmpty());
        out.put("podeCancelar", cobradosNesteJogo > 0 || lancamentoRepository.findByUsuarioAndNota(usuario, nota).stream()
                .anyMatch(l -> CaixaLancamento.COBRANCA.equals(l.getTipo())));
        return out;
    }

    private Map<String, Boolean> mapaAptoElenco(Usuario usuario) {
        Map<String, Boolean> mapa = new LinkedHashMap<>();
        for (ElencoJogador e : elencoRepository.findByUsuarioOrderByGoleiroAscNomeAsc(usuario)) {
            mapa.put(
                    CaixaJogador.chaveDe(e.getNome(), Boolean.TRUE.equals(e.getGoleiro())),
                    !Boolean.FALSE.equals(e.getApto())
            );
        }
        return mapa;
    }

    private static String chaveLista(List<CaixaPresencaRequest.Item> itens) {
        return itens.stream()
                .map(i -> CaixaJogador.chaveDe(i.getNome(), Boolean.TRUE.equals(i.getGoleiro())))
                .sorted()
                .reduce("", (a, b) -> a + ";" + b);
    }

    private record MesDados(Set<String> visiveis, List<Pelada> peladas, Map<String, Integer> jogos) {}

    private static BigDecimal nvl(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static double dinheiro(BigDecimal v) {
        return nvl(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
