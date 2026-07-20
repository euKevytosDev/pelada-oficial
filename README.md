# Pelada Oficial

Site **mobile-first** para controlar pelada entre amigos: cadastrar jogadores, sortear times equilibrados, marcar gols/cartões ao vivo e pontuar até encerrar a pelada.

> Futuro: virar app na Play Store (base web mobile já pensada para isso).

**GitHub Pages (frontend):** https://eukevytosdev.github.io/pelada-oficial/

> O site no Pages é só a parte visual (HTML/CSS/JS). Para cadastrar jogadores e sortear de verdade, o backend Spring Boot precisa estar rodando (hoje a API aponta para `localhost:8080`).

---

## Como o projeto está organizado

```
pelada-oficial/
├── frontend/          ← HTML + CSS + JavaScript (abra no VS Code)
├── backend/           ← Java Spring Boot (abra no IntelliJ)
├── docker-compose.yml ← Sobe o PostgreSQL
└── README.md
```

| Pasta | Ferramenta | O que faz |
|-------|------------|-----------|
| `frontend/` | VS Code | Telas do celular |
| `backend/` | IntelliJ | API e regras do jogo |
| `docker-compose.yml` | Docker | Banco PostgreSQL |

---

## Regras do jogo (já no código)

- Cada jogador de linha tem **estrelas (nível 1 a 10)**
- **Goleiros** são cadastrados à parte e ficam fixos no time (podem ser emprestados se o time não tiver)
- Sorteio **aleatório + equilibrado** só com jogadores de linha
- Nome do time: editável; se ficar vazio, usa o **jogador com mais estrelas**
- Durante a partida: **gol**, **gol contra**, **cartão amarelo/vermelho**
- Gol contra: escolhe o time que sofreu e o jogador desse time (placar sobe para o adversário)
- Pontos: **vitória 3** · **empate 1** · **derrota 0**
- Rodadas continuam até clicar em **Encerrar pelada**

---

## Passo a passo para rodar

### 1) Banco de dados

**Agora (mais fácil):** o backend sobe com **H2** (banco em memória). Não precisa configurar nada.

**Depois (PostgreSQL 18 que você já tem):**
1. Abra o **pgAdmin 4**
2. Rode o script `backend/scripts/criar-banco-postgres.sql`
3. Em `backend/src/main/resources/application.properties`, troque para:
   ```properties
   spring.profiles.active=postgres
   ```

Ou use Docker (se instalar o Docker Desktop):

```bash
docker compose up -d
```

### 2) Rodar o backend (IntelliJ)

1. Abra a pasta `backend` no IntelliJ
2. Espere o Maven baixar as dependências
3. Rode a classe `PeladaOficialApplication`
4. API fica em: `http://localhost:8080`

Ou pelo terminal:

```bash
cd backend
./mvnw spring-boot:run
```

### 3) Abrir o frontend (VS Code)

1. Abra a pasta `frontend` no VS Code
2. Abra o arquivo `index.html`
3. Use a extensão **Live Server** (ou abra o arquivo no Chrome do celular na mesma rede depois)

O frontend chama a API em `http://localhost:8080/api`.

---

## Fluxo no celular

1. **Começar pelada** → escolhe quantos times  
2. **Adicionar jogadores** → nome + estrelas  
3. **Sortear times** → times equilibrados  
4. **Iniciar partida** → marca gol/cartões ao vivo  
5. **Finalizar partida** → atualiza classificação  
6. **Nova rodada** ou **Encerrar pelada**

---

## Principais arquivos para você estudar

### Frontend
- `frontend/index.html` → estrutura das telas
- `frontend/css/estilo.css` → visual mobile
- `frontend/js/api.js` → chamadas para o Spring Boot
- `frontend/js/app.js` → lógica das telas

### Backend
- `model/` → tabelas (Jogador, Pelada, Time, Partida, Evento)
- `controller/` → URLs da API (`/api/...`)
- `service/` → regras (sorteio, pontos, eventos)
- `repository/` → acesso ao PostgreSQL

---

## Próximos passos (quando você passar as orientações)

- Ajustar telas e regras do jeito que você quiser
- Login / várias peladas salvas
- Estatísticas por jogador
- Empacotar com Capacitor para Play Store
