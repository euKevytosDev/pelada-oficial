package br.com.peladaoficial.service;

import br.com.peladaoficial.model.Jogador;
import br.com.peladaoficial.model.Pelada;
import br.com.peladaoficial.model.StatusPelada;
import br.com.peladaoficial.model.Time;
import br.com.peladaoficial.model.Usuario;
import br.com.peladaoficial.repository.JogadorRepository;
import br.com.peladaoficial.repository.PartidaRepository;
import br.com.peladaoficial.repository.PeladaRepository;
import br.com.peladaoficial.repository.TimeRepository;
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
import java.time.format.DateTimeParseException;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Relatório por período (mês, ano ou intervalo livre).
 * Times mudam a cada pelada — ranking por jogador.
 * Vitória = estar no time que fechou em 1º na tabela daquela pelada.
 */
@Service
public class RelatorioMensalService {

    private static final ZoneId FUSO = ZoneId.of("America/Sao_Paulo");
    private static final Locale PT = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter DIA = DateTimeFormatter.ofPattern("dd/MM");
    private static final DateTimeFormatter DIA_ANO = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final AuthSupport authSupport;
    private final AssinaturaService assinaturaService;
    private final PeladaRepository peladaRepository;
    private final JogadorRepository jogadorRepository;
    private final PartidaRepository partidaRepository;
    private final TimeRepository timeRepository;

    public RelatorioMensalService(AuthSupport authSupport,
                                  AssinaturaService assinaturaService,
                                  PeladaRepository peladaRepository,
                                  JogadorRepository jogadorRepository,
                                  PartidaRepository partidaRepository,
                                  TimeRepository timeRepository) {
        this.authSupport = authSupport;
        this.assinaturaService = assinaturaService;
        this.peladaRepository = peladaRepository;
        this.jogadorRepository = jogadorRepository;
        this.partidaRepository = partidaRepository;
        this.timeRepository = timeRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> montar(Integer ano, Integer mes) {
        return montar("mes", ano, mes, null, null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> montar(String modo, Integer ano, Integer mes, String de, String ate) {
        Usuario usuario = authSupport.usuarioAtual();
        assinaturaService.garantirTrialEMap(usuario);
        if (!assinaturaService.proAtivo(usuario)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Relatório do mês faz parte do Pelada Pro");
        }

        Periodo periodo = resolverPeriodo(modo, ano, mes, de, ate);
        List<Pelada> doPeriodo = peladaRepository.findByUsuarioNoPeriodo(usuario, periodo.inicio, periodo.fim);

        Map<String, Acc> porJogador = new LinkedHashMap<>();
        int totalPartidas = 0;
        List<Map<String, Object>> peladasOut = new ArrayList<>();

        for (Pelada p : doPeriodo) {
            long jogos = partidaRepository.countByPeladaId(p.getId());
            totalPartidas += (int) jogos;
            List<Jogador> jogadores = jogadorRepository.findByPeladaIdOrderByNomeAsc(p.getId());
            Time campeao = escolherCampeao(p);
            List<String> campeoesNomes = new ArrayList<>();

            if (campeao != null) {
                for (Jogador j : jogadores) {
                    if (Boolean.FALSE.equals(j.getApto())) continue;
                    if (j.getTime() == null || !Objects.equals(j.getTime().getId(), campeao.getId())) continue;
                    Acc acc = porJogador.computeIfAbsent(chave(j.getNome()), k -> new Acc(j.getNome().trim()));
                    acc.nome = j.getNome().trim();
                    acc.vitorias += 1;
                    // Goleiro do time campeão também leva a vitória (título da pelada).
                    if (Boolean.TRUE.equals(j.getGoleiro())) {
                        acc.vitoriasGk += 1;
                    }
                    campeoesNomes.add(j.getNome().trim());
                }
                campeoesNomes.sort(String.CASE_INSENSITIVE_ORDER);
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", p.getId());
            item.put("nome", p.getNome());
            item.put("status", p.getStatus() != null ? p.getStatus().name() : "");
            LocalDateTime ref = p.getEncerradaEm() != null ? p.getEncerradaEm() : p.getCriadaEm();
            item.put("data", ref != null ? DIA.format(ref) : "");
            item.put("partidas", jogos);
            item.put("campeaoTime", campeao != null ? campeao.getNome() : null);
            item.put("campeoes", campeoesNomes);
            peladasOut.add(item);

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
        int totalVit = lista.stream().mapToInt(a -> a.vitorias).sum();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("modo", periodo.modo);
        body.put("ano", periodo.ano);
        body.put("mes", periodo.mes);
        body.put("de", periodo.deIso);
        body.put("ate", periodo.ateIso);
        body.put("titulo", periodo.titulo);
        body.put("subtitulo", periodo.subtitulo);
        body.put("peladasNoMes", doPeriodo.size());
        body.put("peladasNoPeriodo", doPeriodo.size());
        body.put("partidasNoMes", totalPartidas);
        body.put("partidasNoPeriodo", totalPartidas);
        body.put("totalGols", totalGols);
        body.put("totalAssistencias", totalAss);
        body.put("totalAmarelos", totalAm);
        body.put("totalVermelhos", totalVm);
        body.put("totalVitorias", totalVit);
        body.put("peladas", peladasOut);
        body.put("campeoes", ranking(lista, a -> a.vitorias, false, "vitorias"));
        body.put("artilharia", ranking(lista, a -> a.gols, false, "gols"));
        body.put("garcons", ranking(lista, a -> a.assistencias, false, "quantidade"));
        body.put("amarelos", ranking(lista, a -> a.amarelos, false, "quantidade"));
        body.put("vermelhos", ranking(lista, a -> a.vermelhos, false, "quantidade"));
        body.put("golsContra", ranking(lista, a -> a.golsContra, false, "quantidade"));
        body.put("goleiros", rankingGk(lista));
        body.put("premios", premios(lista));
        return body;
    }

    /**
     * Time em 1º na tabela (pontos → saldo → gols pró → nome).
     * Só conta pelada encerrada que já teve jogo.
     */
    private Time escolherCampeao(Pelada pelada) {
        if (pelada.getStatus() != StatusPelada.ENCERRADA) return null;
        List<Time> times = timeRepository.findByPeladaIdOrderByPontosDescIdAsc(pelada.getId());
        if (times.isEmpty()) return null;
        boolean teveJogo = times.stream().anyMatch(t ->
                n(t.getVitorias()) + n(t.getEmpates()) + n(t.getDerrotas()) > 0 || n(t.getPontos()) > 0);
        if (!teveJogo) return null;
        List<Time> ordenados = new ArrayList<>(times);
        ordenados.sort((a, b) -> {
            if (!Objects.equals(b.getPontos(), a.getPontos())) {
                return Integer.compare(n(b.getPontos()), n(a.getPontos()));
            }
            int sgA = n(a.getGolsPro()) - n(a.getGolsContra());
            int sgB = n(b.getGolsPro()) - n(b.getGolsContra());
            if (sgB != sgA) return Integer.compare(sgB, sgA);
            if (!Objects.equals(b.getGolsPro(), a.getGolsPro())) {
                return Integer.compare(n(b.getGolsPro()), n(a.getGolsPro()));
            }
            String na = a.getNome() == null ? "" : a.getNome();
            String nb = b.getNome() == null ? "" : b.getNome();
            return na.compareToIgnoreCase(nb);
        });
        return ordenados.get(0);
    }

    private Periodo resolverPeriodo(String modoRaw, Integer ano, Integer mes, String de, String ate) {
        String modo = modoRaw == null || modoRaw.isBlank() ? "mes" : modoRaw.trim().toLowerCase(Locale.ROOT);
        LocalDate hoje = LocalDate.now(FUSO);

        if ("ano".equals(modo) || "anual".equals(modo)) {
            int y = ano != null && ano >= 2020 ? ano : hoje.getYear();
            LocalDateTime inicio = LocalDate.of(y, 1, 1).atStartOfDay();
            LocalDateTime fim = LocalDate.of(y + 1, 1, 1).atStartOfDay();
            return new Periodo("ano", y, null, inicio, fim,
                    "Relatório anual de " + y,
                    "1º de janeiro a 31 de dezembro de " + y,
                    inicio.toLocalDate().toString(),
                    LocalDate.of(y, 12, 31).toString());
        }

        if ("periodo".equals(modo) || "personalizado".equals(modo) || "intervalo".equals(modo)) {
            LocalDate ini = parseData(de, "Informe a data inicial");
            LocalDate fimDia = parseData(ate, "Informe a data final");
            if (fimDia.isBefore(ini)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A data final não pode ser antes da inicial");
            }
            if (ini.plusYears(2).isBefore(fimDia)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Período máximo de 2 anos");
            }
            LocalDateTime inicio = ini.atStartOfDay();
            LocalDateTime fim = fimDia.plusDays(1).atStartOfDay();
            String titulo = "Relatório de " + DIA_ANO.format(ini) + " a " + DIA_ANO.format(fimDia);
            return new Periodo("periodo", ini.getYear(), ini.getMonthValue(), inicio, fim,
                    titulo,
                    "Período personalizado",
                    ini.toString(),
                    fimDia.toString());
        }

        YearMonth ym = resolverMes(ano, mes);
        LocalDateTime inicio = ym.atDay(1).atStartOfDay();
        LocalDateTime fim = ym.plusMonths(1).atDay(1).atStartOfDay();
        String mesNome = ym.getMonth().getDisplayName(TextStyle.FULL, PT);
        mesNome = mesNome.substring(0, 1).toUpperCase(PT) + mesNome.substring(1);
        return new Periodo("mes", ym.getYear(), ym.getMonthValue(), inicio, fim,
                "Relatório de " + mesNome + " de " + ym.getYear(),
                "Só peladas de " + mesNome,
                ym.atDay(1).toString(),
                ym.atEndOfMonth().toString());
    }

    private LocalDate parseData(String raw, String erro) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, erro);
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data inválida. Use AAAA-MM-DD");
        }
    }

    private YearMonth resolverMes(Integer ano, Integer mes) {
        LocalDate hoje = LocalDate.now(FUSO);
        int y = ano != null && ano >= 2020 ? ano : hoje.getYear();
        int m = mes != null && mes >= 1 && mes <= 12 ? mes : hoje.getMonthValue();
        return YearMonth.of(y, m);
    }

    private Map<String, Object> premios(List<Acc> lista) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("campeao", lider(lista, a -> a.vitorias, false, "vitória"));
        p.put("artilheiro", lider(lista, a -> a.gols, false, "gol"));
        p.put("garcom", lider(lista, a -> a.assistencias, false, "assistência"));
        p.put("craque", lider(lista, a -> a.gols * 2 + a.assistencias - a.amarelos - a.vermelhos * 2, false, "pts"));
        p.put("fairPlay", liderFairPlay(lista));
        p.put("cartolaAmarela", lider(lista, a -> a.amarelos, false, "amarelo"));
        p.put("expulsoes", lider(lista, a -> a.vermelhos, false, "vermelho"));
        p.put("luvaDeOuro", lider(lista, a -> a.vitoriasGk, false, "vitória"));
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

    /** Goleiros pelo número de vezes campeão (time em 1º), não por gols sofridos. */
    private List<Map<String, Object>> rankingGk(List<Acc> lista) {
        return lista.stream()
                .filter(a -> a.vitoriasGk > 0)
                .sorted((a, b) -> {
                    int c = Integer.compare(b.vitoriasGk, a.vitoriasGk);
                    if (c != 0) return c;
                    return a.nome.compareToIgnoreCase(b.nome);
                })
                .map(a -> {
                    Map<String, Object> m = linha(a.nome, a.vitoriasGk, "vitorias");
                    m.put("peladas", a.peladasGk);
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

    private Map<String, Object> liderFairPlay(List<Acc> lista) {
        List<Acc> cand = lista.stream()
                .filter(a -> a.peladas > 0 && a.amarelos + a.vermelhos == 0)
                .toList();
        if (cand.isEmpty()) return null;
        return premioNomes(cand, "sem cartão no período");
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
        m.put("vitorias", qtd);
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
        if ("vitória".equals(unidade)) return "vitórias";
        if ("pts".equals(unidade)) return "pts";
        return unidade + "s";
    }

    private record Periodo(
            String modo,
            Integer ano,
            Integer mes,
            LocalDateTime inicio,
            LocalDateTime fim,
            String titulo,
            String subtitulo,
            String deIso,
            String ateIso
    ) {}

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
        int vitorias;
        int vitoriasGk;

        Acc(String nome) {
            this.nome = nome;
        }
    }
}
