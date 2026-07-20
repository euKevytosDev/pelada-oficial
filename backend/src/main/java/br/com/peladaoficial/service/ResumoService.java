package br.com.peladaoficial.service;

import br.com.peladaoficial.model.*;
import br.com.peladaoficial.repository.JogadorRepository;
import br.com.peladaoficial.repository.PartidaRepository;
import br.com.peladaoficial.repository.PeladaRepository;
import br.com.peladaoficial.repository.TimeRepository;
import br.com.peladaoficial.security.AuthSupport;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Monta o resumo final da pelada (estilo súmula profissional).
 */
@Service
public class ResumoService {

    private final PeladaRepository peladaRepository;
    private final TimeRepository timeRepository;
    private final JogadorRepository jogadorRepository;
    private final PartidaRepository partidaRepository;
    private final AuthSupport authSupport;

    public ResumoService(PeladaRepository peladaRepository,
                         TimeRepository timeRepository,
                         JogadorRepository jogadorRepository,
                         PartidaRepository partidaRepository,
                         AuthSupport authSupport) {
        this.peladaRepository = peladaRepository;
        this.timeRepository = timeRepository;
        this.jogadorRepository = jogadorRepository;
        this.partidaRepository = partidaRepository;
        this.authSupport = authSupport;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> montar(Long peladaId) {
        Pelada pelada = peladaRepository.findByIdAndUsuario(peladaId, authSupport.usuarioAtual())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pelada não encontrada"));

        List<Time> times = timeRepository.findByPeladaIdOrderByPontosDescIdAsc(peladaId);
        times.forEach(t -> t.getJogadores().size());

        List<Jogador> jogadores = jogadorRepository.findByPeladaIdOrderByNomeAsc(peladaId);
        jogadores.forEach(j -> {
            if (j.getTime() != null) {
                j.getTime().getId();
            }
        });

        List<Partida> partidas = partidaRepository.findByPeladaIdOrderByNumeroRodadaDesc(peladaId);
        // ordem cronológica para o histórico
        List<Partida> partidasAsc = new ArrayList<>(partidas);
        Collections.reverse(partidasAsc);
        partidasAsc.forEach(p -> {
            p.getTimeA().getNome();
            p.getTimeB().getNome();
        });

        List<Map<String, Object>> classificacao = montarClassificacao(times);
        List<Map<String, Object>> timesDetalhe = times.stream().map(this::toTimeResumo).collect(Collectors.toList());
        List<Map<String, Object>> historico = partidasAsc.stream().map(this::toPartidaResumo).collect(Collectors.toList());

        List<Map<String, Object>> amarelos = jogadores.stream()
                .filter(j -> j.getCartoesAmarelos() != null && j.getCartoesAmarelos() > 0)
                .sorted((a, b) -> Integer.compare(b.getCartoesAmarelos(), a.getCartoesAmarelos()))
                .map(j -> cartaoMap(j, j.getCartoesAmarelos()))
                .collect(Collectors.toList());

        List<Map<String, Object>> vermelhos = jogadores.stream()
                .filter(j -> j.getCartoesVermelhos() != null && j.getCartoesVermelhos() > 0)
                .sorted((a, b) -> Integer.compare(b.getCartoesVermelhos(), a.getCartoesVermelhos()))
                .map(j -> cartaoMap(j, j.getCartoesVermelhos()))
                .collect(Collectors.toList());

        List<Map<String, Object>> golsContra = jogadores.stream()
                .filter(j -> j.getGolsContra() != null && j.getGolsContra() > 0)
                .sorted((a, b) -> Integer.compare(b.getGolsContra(), a.getGolsContra()))
                .map(j -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("nome", j.getNome());
                    m.put("quantidade", j.getGolsContra());
                    m.put("time", j.getTime() != null ? j.getTime().getNome() : "-");
                    return m;
                })
                .collect(Collectors.toList());

        List<Map<String, Object>> artilharia = jogadores.stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()) && j.getGols() > 0)
                .sorted((a, b) -> Integer.compare(b.getGols(), a.getGols()))
                .map(j -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("nome", j.getNome());
                    m.put("gols", j.getGols());
                    m.put("quantidade", j.getGols());
                    m.put("time", j.getTime() != null ? j.getTime().getNome() : "-");
                    return m;
                })
                .collect(Collectors.toList());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("pelada", Map.of(
                "id", pelada.getId(),
                "nome", pelada.getNome(),
                "status", pelada.getStatus().name(),
                "criadaEm", pelada.getCriadaEm() != null ? pelada.getCriadaEm().toString() : null,
                "encerradaEm", pelada.getEncerradaEm() != null ? pelada.getEncerradaEm().toString() : null,
                "quantidadeTimes", pelada.getQuantidadeTimes()
        ));
        body.put("classificacao", classificacao);
        body.put("times", timesDetalhe);
        body.put("partidas", historico);
        body.put("artilharia", artilharia);
        body.put("cartoesAmarelos", amarelos);
        body.put("cartoesVermelhos", vermelhos);
        body.put("totalAmarelos", amarelos.stream().mapToInt(m -> (Integer) m.get("quantidade")).sum());
        body.put("totalVermelhos", vermelhos.stream().mapToInt(m -> (Integer) m.get("quantidade")).sum());
        body.put("golsContra", golsContra);
        body.put("premios", montarPremios(classificacao, jogadores));
        return body;
    }

    private List<Map<String, Object>> montarClassificacao(List<Time> times) {
        List<Time> ordenados = new ArrayList<>(times);
        ordenados.sort((a, b) -> {
            if (!Objects.equals(b.getPontos(), a.getPontos())) {
                return Integer.compare(b.getPontos(), a.getPontos());
            }
            int sgA = a.getGolsPro() - a.getGolsContra();
            int sgB = b.getGolsPro() - b.getGolsContra();
            if (sgB != sgA) {
                return Integer.compare(sgB, sgA);
            }
            if (!Objects.equals(b.getGolsPro(), a.getGolsPro())) {
                return Integer.compare(b.getGolsPro(), a.getGolsPro());
            }
            return a.getNome().compareToIgnoreCase(b.getNome());
        });

        List<Map<String, Object>> lista = new ArrayList<>();
        int pos = 1;
        for (Time t : ordenados) {
            int jogos = t.getVitorias() + t.getEmpates() + t.getDerrotas();
            int sg = t.getGolsPro() - t.getGolsContra();
            double aproveitamento = jogos == 0 ? 0.0 : (t.getPontos() * 100.0) / (jogos * 3.0);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("posicao", pos++);
            row.put("id", t.getId());
            row.put("nome", t.getNome());
            row.put("cor", t.getCor());
            row.put("pontos", t.getPontos());
            row.put("jogos", jogos);
            row.put("vitorias", t.getVitorias());
            row.put("empates", t.getEmpates());
            row.put("derrotas", t.getDerrotas());
            row.put("golsPro", t.getGolsPro());
            row.put("golsContra", t.getGolsContra());
            row.put("saldo", sg);
            row.put("aproveitamento", Math.round(aproveitamento * 10.0) / 10.0);
            lista.add(row);
        }
        return lista;
    }

    private Map<String, Object> toTimeResumo(Time time) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", time.getId());
        map.put("nome", time.getNome());
        map.put("cor", time.getCor());

        Optional<Jogador> gk = time.getGoleiroDoTime();
        map.put("goleiro", gk.map(g -> Map.of(
                "nome", g.getNome(),
                "golsSofridos", g.getGolsSofridos()
        )).orElse(null));

        List<Map<String, Object>> jogadores = time.getJogadores().stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()))
                .sorted((a, b) -> Integer.compare(b.getGols(), a.getGols()))
                .map(j -> {
                    Map<String, Object> jm = new LinkedHashMap<>();
                    jm.put("nome", j.getNome());
                    jm.put("estrelas", j.getEstrelas());
                    jm.put("gols", j.getGols());
                    jm.put("golsContra", j.getGolsContra());
                    jm.put("amarelos", j.getCartoesAmarelos());
                    jm.put("vermelhos", j.getCartoesVermelhos());
                    return jm;
                })
                .collect(Collectors.toList());
        map.put("jogadores", jogadores);
        return map;
    }

    private Map<String, Object> toPartidaResumo(Partida p) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("numero", p.getNumeroRodada());
        map.put("status", p.getStatus().name());
        map.put("timeA", p.getTimeA().getNome());
        map.put("timeB", p.getTimeB().getNome());
        map.put("golsA", p.getGolsTimeA());
        map.put("golsB", p.getGolsTimeB());
        map.put("corA", p.getTimeA().getCor());
        map.put("corB", p.getTimeB().getCor());
        return map;
    }

    private Map<String, Object> cartaoMap(Jogador j, int qtd) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("nome", j.getNome());
        map.put("quantidade", qtd);
        map.put("time", j.getTime() != null ? j.getTime().getNome() : "-");
        return map;
    }

    private Map<String, Object> montarPremios(List<Map<String, Object>> classificacao, List<Jogador> jogadores) {
        Map<String, Object> premios = new LinkedHashMap<>();

        if (!classificacao.isEmpty()) {
            Map<String, Object> top = classificacao.get(0);
            Map<String, Object> campeao = new LinkedHashMap<>();
            campeao.put("nome", top.get("nome"));
            campeao.put("detalhe", top.get("pontos") + " pts");
            premios.put("campeao", campeao);
        } else {
            premios.put("campeao", null);
        }

        Optional<Jogador> bolaOuro = jogadores.stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()))
                .max(Comparator.comparingInt(Jogador::getGols)
                        .thenComparingInt(Jogador::getPontos));
        if (bolaOuro.isPresent() && bolaOuro.get().getGols() > 0) {
            Jogador j = bolaOuro.get();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("nome", j.getNome());
            m.put("detalhe", j.getGols() + " gols");
            premios.put("bolaDeOuro", m);
        } else {
            premios.put("bolaDeOuro", null);
        }

        Optional<Jogador> luva = jogadores.stream()
                .filter(j -> Boolean.TRUE.equals(j.getGoleiro()))
                .min(Comparator.comparingInt(Jogador::getGolsSofridos)
                        .thenComparing(Jogador::getNome));
        if (luva.isPresent()) {
            Jogador j = luva.get();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("nome", j.getNome());
            m.put("detalhe", j.getGolsSofridos() + " sofridos");
            premios.put("luvaDeOuro", m);
        } else {
            premios.put("luvaDeOuro", null);
        }

        Optional<Jogador> murcha = jogadores.stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()))
                .filter(j -> j.getGolsContra() > 0)
                .max(Comparator.comparingInt(Jogador::getGolsContra));
        if (murcha.isEmpty()) {
            murcha = jogadores.stream()
                    .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()) && j.getTime() != null)
                    .min(Comparator.comparingInt(Jogador::getPontos)
                            .thenComparingInt(Jogador::getGols)
                            .thenComparing(Jogador::getNome));
        }
        if (murcha.isPresent()) {
            Jogador j = murcha.get();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("nome", j.getNome());
            m.put("detalhe", j.getGolsContra() > 0
                    ? j.getGolsContra() + " gol(s) contra"
                    : j.getPontos() + " pts");
            premios.put("bolaMurcha", m);
        } else {
            premios.put("bolaMurcha", null);
        }

        return premios;
    }
}
