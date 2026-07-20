# Pelada Oficial

Site **mobile-first** para controlar pelada entre amigos: cadastrar jogadores, sortear times equilibrados, marcar gols/cartões ao vivo e pontuar até encerrar a pelada.

> Futuro: virar app na Play Store (base web mobile já pensada para isso).

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

- Cada jogador tem **estrelas (nível 1 a 5)**
- Sorteio **aleatório + equilibrado** (distribui os mais fortes entre os times)
- Durante a partida: **gol**, **cartão amarelo**, **cartão vermelho**
- No gol: quem fez + **goleiro que sofreu**
- Pontos: **vitória 3** · **empate 1** · **derrota 0**
- Rodadas continuam até clicar em **Encerrar pelada**

---

## Passo a passo para rodar

### 1) Subir o banco (PostgreSQL)

No terminal, na pasta do projeto:

```bash
docker compose up -d
```

Dados do banco:
- Host: `localhost`
- Porta: `5432`
- Banco: `pelada_oficial`
- Usuário: `pelada`
- Senha: `pelada123`

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
