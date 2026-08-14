package br.com.peladaoficial.service;

import br.com.peladaoficial.model.Jogador;
import br.com.peladaoficial.model.Pelada;
import br.com.peladaoficial.model.Usuario;
import br.com.peladaoficial.repository.JogadorRepository;
import br.com.peladaoficial.repository.PartidaRepository;
import br.com.peladaoficial.repository.PeladaRepository;
import br.com.peladaoficial.security.AuthSupport;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Ranking do mês por jogador (times mudam a cada pelada).
 */
@Service
public class RelatorioMensalService {

    private static final ZoneId FUSO = ZoneId.of("America/Sao_Paulo");
    private static final Locale PT = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter DIA = DateTimeFormatter.ofPattern("dd/MM");

    private final AuthSupport authSupport;
    private final AssinaturaService assinaturaService;
    private final PeladaRepository peladaRepository;
    private final JogadorRepository jogadorRepository;
    private final PartidaRepository partidaRepository;

    public RelatorioMensalService(AuthSupport authSupport,
                                  AssinaturaService assinaturaService,
                                  PeladaRepository peladaRepository,
                                  JogadorRepository jogadorRepository,
                                  PartidaRepository partidaRepository) {
        this.authSupport = authSupport;
        this.assinaturaService = assinaturaService;
        this.peladaRepository = peladaRepository;
        this.jogadorRepository = jogadorRepository;
        this.partidaRepository = partidaRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> montar(Integer ano, Integer mes) {
        Usuario usuario = authSupport.usuarioAtual();
        assinaturaService.garantirTrialEMap(usuario);
        if (!assinaturaService.proAtivo(usuario)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Relatório do mês faz parte do Pelada Pro");
        }

        YearMonth ym = resolverMes(ano, mes);
        LocalDateTime inicio = ym.atDay(1).atStartOfDay();
        LocalDateTime fim = ym.plusMonths(1).atDay(1).atStartOfDay();

        List<Pelada> todas = peladaRepository.findByUsuarioOrderByCriadaEmDesc(usuario);
        List<Pelada> doMes = new ArrayList<>();
        for (Pelada p : todas) {
            LocalDateTime ref = p.getEncerradaEm() != null ? p.getEncerradaEm() : p.getCriadaEm();
            if (ref == null) continue;
            if (!ref.isBefore(inicio) && ref.isBefore(fim)) {
                doMes.add(p);
            }
        }

        Map<String, Acc> porJogador = new LinkedHashMap<>();
        int totalPartidas = 0;
        List<Map<String, Object>> peladasOut = new ArrayList<>();

        for (Pelada p : doMes) {
            long jogos = partidaRepository.countByPeladaId(p.getId());
            totalPartidas += (int) jogos;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", p.getId());
            item.put("nome", p.getNome());
            item.put("status", p.getStatus() != null ? p.getStatus().name() : "");
            LocalDateTime ref = p.getEncerradaEm() != null ? p.getEncerradaEm() : p.getCriadaEm();
            item.put("data", ref != null ? DIA.format(ref) : "");
            item.put("partidas", jogos);
            peladasOut.add(item);

            List<Jogador> jogadores = jogadorRepository.findByPeladaIdOrderByNomeAsc(p.getId());
            for (Jogador j : jogadores) {
                if (Boolean.FALSE.equals(j.getApto())) continue;
                Acc acc = porJogador.computeIfAbsent(chave(j.getNome()), k -> new Acc(j.getNome().trim()));
                acc.nome = j.getNome().trim();
                acc.peladas += 1;
                acc.gols += n(j.getGols());
                acc.assistencias += n(j.getAssistencias());
                acc.golsContra += n(j.getGolsContra());
                acc.amarelos += n(j.getCartoesAmarelos());
                acc.vermelhos += n(j.getCartoesVermelhos());
                if (Boolean.TRUE.equals(j.getGoleiro())) {
                    acc.peladasGk += 1;
                    acc.golsSofridos += n(j.getGolsSofridos());
                }
            }
        }

        List<Acc> lista = new ArrayList<>(porJogador.values());
        int totalGols = lista.stream().mapToInt(a -> a.gols).sum();
        int totalAss = lista.stream().mapToInt(a -> a.assistencias).sum();
        int totalAm = lista.stream().mapToInt(a -> a.amarelos).sum();
        int totalVm = lista.stream().mapToInt(a -> a.vermelhos).sum();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ano", ym.getYear());
        body.put("mes", ym.getMonthValue());
        body.put("titulo", "Relatório de " + ym.getMonth().getDisplayName(TextStyle.FULL, PT) + " de " + ym.getYear());
        body.put("peladasNoMes", doMes.size());
        body.put("partidasNoMes", totalPartidas);
        body.put("totalGols", totalGols);
        body.put("totalAssistencias", totalAss);
        body.put("totalAmarelos", totalAm);
        body.put("totalVermelhos", totalVm);
        body.put("peladas", peladasOut);
        body.put("artilharia", ranking(lista, a -> a.gols, false, "gols"));
        body.put("garcons", ranking(lista, a -> a.assistencias, false, "quantidade"));
        body.put("amarelos", ranking(lista, a -> a.amarelos, false, "quantidade"));
        body.put("vermelhos", ranking(lista, a -> a.vermelhos, false, "quantidade"));
        body.put("golsContra", ranking(lista, a -> a.golsContra, false, "quantidade"));
        body.put("goleiros", rankingGk(lista));
        body.put("premios", premios(lista));
        return body;
    }

    private YearMonth resolverMes(Integer ano, Integer mes) {
        LocalDate hoje = LocalDate.now(FUSO);
        int y = ano != null && ano >= 2020 ? ano : hoje.getYear();
        int m = mes != null && mes >= 1 && mes <= 12 ? mes : hoje.getMonthValue();
        return YearMonth.of(y, m);
    }

    private Map<String, Object> premios(List<Acc> lista) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("artilheiro", lider(lista, a -> a.gols, false, "gol"));
        p.put("garcom", lider(lista, a -> a.assistencias, false, "assistência"));
        p.put("craque", lider(lista, a -> a.gols * 2 + a.assistencias - a.amarelos - a.vermelhos * 2, false, "pts"));
        p.put("fairPlay", liderFairPlay(lista));
        p.put("cartolaAmarela", lider(lista, a -> a.amarelos, false, "amarelo"));
        p.put("expulsoes", lider(lista, a -> a.vermelhos, false, "vermelho"));
        p.put("luvaDeOuro", liderLuva(lista));
        return p;
    }

    private List<Map<String, Object>> ranking(List<Acc> lista, java.util.function.ToIntFunction<Acc> get, boolean asc, String campo) {
        return lista.stream()
                .filter(a -> get.applyAsInt(a) > 0)
                .sorted((a, b) -> {
                    int c = Integer.compare(get.applyAsInt(a), get.applyAsInt(b));
                    return (asc ? c : -c) != 0 ? (asc ? c : -c) : a.nome.compareToIgnoreCase(b.nome);
                })
                .map(a -> linha(a.nome, get.applyAsInt(a), campo))
                .toList();
    }

    private List<Map<String, Object>> rankingGk(List<Acc> lista) {
        return lista.stream()
                .filter(a -> a.peladasGk > 0)
                .sorted(Comparator
                        .comparingDouble((Acc a) -> a.golsSofridos / (double) a.peladasGk)
                        .thenComparingInt(a -> a.golsSofridos)
                        .thenComparing(a -> a.nome, String.CASE_INSENSITIVE_ORDER))
                .map(a -> {
                    Map<String, Object> m = linha(a.nome, a.golsSofridos, "quantidade");
                    m.put("peladas", a.peladasGk);
                    m.put("media", Math.round((a.golsSofridos * 10.0 / a.peladasGk)) / 10.0);
                    return m;
                })
                .toList();
    }

    private Map<String, Object> lider(List<Acc> lista, java.util.function.ToIntFunction<Acc> get, boolean incluirZero, String unidade) {
        List<Acc> cand = lista.stream()
                .filter(a -> incluirZero || get.applyAsInt(a) > 0)
                .toList();
        if (cand.isEmpty()) return null;
        int max = cand.stream().mapToInt(get).max().orElse(0);
        List<Acc> tops = cand.stream().filter(a -> get.applyAsInt(a) == max).toList();
        return premioNomes(tops, max + " " + plural(unidade, max));
    }

    private Map<String, Object> liderLuva(List<Acc> lista) {
        List<Acc> gks = lista.stream().filter(a -> a.peladasGk > 0).toList();
        if (gks.isEmpty()) return null;
        double min = gks.stream().mapToDouble(a -> a.golsSofridos / (double) a.peladasGk).min().orElse(0);
        List<Acc> tops = gks.stream()
                .filter(a -> Math.abs(a.golsSofridos / (double) a.peladasGk - min) < 0.0001)
                .toList();
        String det = (Math.round(min * 10) / 10.0) + " sofridos/pelada";
        return premioNomes(tops, det);
    }

    private Map<String, Object> liderFairPlay(List<Acc> lista) {
        List<Acc> cand = lista.stream()
                .filter(a -> a.peladas > 0 && a.amarelos + a.vermelhos == 0)
                .toList();
        if (cand.isEmpty()) return null;
        return premioNomes(cand, "sem cartão no mês");
    }

    private Map<String, Object> premioNomes(List<Acc> tops, String detalhe) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nome", tops.get(0).nome);
        m.put("nomes", tops.stream().map(a -> a.nome).toList());
        m.put("detalhe", detalhe);
        return m;
    }

    private Map<String, Object> linha(String nome, int qtd, String campo) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nome", nome);
        m.put(campo, qtd);
        m.put("quantidade", qtd);
        m.put("gols", qtd);
        return m;
    }

    private static String chave(String nome) {
        return nome == null ? "" : nome.trim().toLowerCase(Locale.ROOT);
    }

    private static int n(Integer v) {
        return v == null ? 0 : v;
    }

    private static String plural(String unidade, int n) {
        if (n == 1) return unidade;
        if ("gol".equals(unidade)) return "gols";
        if ("assistência".equals(unidade)) return "assistências";
        if ("amarelo".equals(unidade)) return "amarelos";
        if ("vermelho".equals(unidade)) return "vermelhos";
        if ("pts".equals(unidade)) return "pts";
        return unidade + "s";
    }

    private static class Acc {
        String nome;
        int peladas;
        int peladasGk;
        int gols;
        int assistencias;
        int golsContra;
        int amarelos;
        int vermelhos;
        int golsSofridos;

        Acc(String nome) {
            this.nome = nome;
        }
    }
}
