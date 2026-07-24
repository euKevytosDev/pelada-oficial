# Pelada Oficial

App web mobile-first pra organizar pelada entre amigos: cadastra jogadores, sorteia times equilibrados, marca gol/cartão ao vivo e fecha a classificação no fim.

A ideia no longo prazo é empacotar pra Play Store (Capacitor). Por enquanto roda no navegador, com cara de app de celular.

**Front no GitHub Pages:** https://eukevytosdev.github.io/pelada-oficial/

> O Pages só serve o visual. Cadastro, login e sorteio dependem do backend Spring Boot (hoje o front aponta pra `localhost:8080`).

## Como está dividido

```text
pelada-oficial/
├── frontend/           # HTML + CSS + JS
├── backend/            # Spring Boot
├── docker-compose.yml  # PostgreSQL (opcional)
└── README.md
```

| Pasta | Abre no | Função |
|-------|---------|--------|
| `frontend/` | VS Code / Cursor | Telas |
| `backend/` | IntelliJ (ou terminal) | API e regras |
| `docker-compose.yml` | Docker | Postgres |

Monorepo de propósito: front e back andam juntos no mesmo fluxo do jogo.

## Conta e sessão

1. Cria conta (e-mail + senha)  
2. Login — a pelada fica ligada ao usuário  
3. Se fechar no meio, entra de novo e usa **Continuar pelada**  

No dia a dia de desenvolvimento uso H2 em arquivo: reinicia o Spring e os dados ainda estão lá. Postgres fica pra quando for sério.

## Regras que já estão no código

- Jogador de linha tem nível de **1 a 10 estrelas**
- **Goleiro** cadastra separado e fica fixo no time (dá pra emprestar se faltar)
- Sorteio aleatório, mas equilibrado — só linha, sem misturar goleiro no algoritmo
- Nome do time editável; se vazio, usa o jogador com mais estrelas
- Na partida: gol, gol contra, amarelo, vermelho
- Gol contra: escolhe quem sofreu; o placar sobe pro adversário
- Pontos: vitória 3 · empate 1 · derrota 0
- Rodadas seguem até **Encerrar pelada**

## Subir o projeto

### 1. Banco

**Mais fácil agora:** não configura nada — o profile padrão usa H2.

**PostgreSQL depois:**

1. Roda `backend/scripts/criar-banco-postgres.sql` no pgAdmin  
2. Em `application.properties`:

```properties
spring.profiles.active=postgres
```

Ou sobe com Docker:

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
./mvnw spring-boot:run
```

API em `http://localhost:8080`.

No IntelliJ: abre a pasta `backend` e roda `PeladaOficialApplication`.

### 3. Frontend

Abre `frontend/index.html` com Live Server (ou no Chrome). As chamadas vão pra `http://localhost:8080/api`.

## Fluxo no celular

1. Começar pelada → quantos times  
2. Adicionar jogadores (nome + estrelas)  
3. Sortear times  
4. Partida ao vivo (gol / cartão)  
5. Finalizar → classificação atualiza  
6. Nova rodada ou encerrar  

## Arquivos pra olhar primeiro

**Front:** `frontend/js/app.js` (telas), `frontend/js/api.js` (HTTP), `frontend/css/estilo.css`

**Back:** `service/` (sorteio, pontos, eventos), `controller/` (`/api/...`), `model/` (Jogador, Pelada, Time, Partida, Evento)

## Próximo

- Ajustar regras com o pessoal da pelada  
- Estatísticas por jogador  
- Publicar a API (hoje o Pages fica “bonito, mas offline”)  
- Capacitor → Play Store  

## Autor

Raian Kevin — [@euKevytosDev](https://github.com/euKevytosDev)
