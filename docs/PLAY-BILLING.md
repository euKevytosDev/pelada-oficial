# Play Billing — Rei da Pelada Pro

Assinatura nativa no Android (`com.rkds.reidapelada`).

## IDs na Play Console

**Uma** assinatura com **dois** planos básicos (não crie assinatura separada para anual):

| Campo | Valor |
|--------|--------|
| Product ID | `reidapelada_pro` |
| Base plan mensal | `mensal` · R$ 39,90 / mês |
| Base plan anual | `anual` · R$ 299,90 / ano |

App ID: `com.rkds.reidapelada`

Oferta opcional: teste grátis de **7 dias** em cada plano (ou no produto).

## Credenciais no servidor Oracle (obrigatório)

Sem isso a compra na Play abre, mas o Pro **não ativa** (`checkoutPlay: false`).

Há **duas** formas. Se a criação de chave de service account estiver bloqueada pela política
`iam.disableServiceAccountKeyCreation`, use o **caminho OAuth** (recomendado neste projeto).

### Caminho A — OAuth do dono do Play (sem service account key)

1. Google Cloud → ative a API **Google Play Android Developer API**
2. Crie um cliente OAuth tipo **Aplicativo para computador**
3. No cliente, adicione URI de redirecionamento: `http://127.0.0.1:8765`
4. No Mac, gere o refresh token (conta **dona** do Play Console):

```bash
python3 backend/scripts/obter-play-refresh-token.py \
  ~/Downloads/client_secret_....json
```

5. Play Console → **Configuração → Acesso à API** → vincule o mesmo projeto Cloud
6. No servidor, `/home/ubuntu/pelada/play.env`:

```bash
APP_PLAY_PACKAGE_NAME=com.rkds.reidapelada
APP_PLAY_OAUTH_CLIENT_ID=....apps.googleusercontent.com
APP_PLAY_OAUTH_CLIENT_SECRET=GOCSPX-....
APP_PLAY_OAUTH_REFRESH_TOKEN=1//....
```

7. Recrie o container com `--env-file play.env` (script `aplicar-play-billing-oracle.sh`).

### Caminho B — Service account (se a política permitir chave JSON)

1. Conta de serviço + chave JSON
2. Play Console → Acesso à API → conceder acesso à service account
3. `APP_PLAY_CREDENTIALS_PATH=/secrets/play-service-account.json` no `play.env`

## Teste

1. Conta de **licenciados** / testadores na Play Console  
2. Instalar o AAB pelo teste interno/fechado (não sideload solto)  
3. Login Google no app → recurso Pro → Assinar na Play  
4. Confirmar que `/api/me` volta `proAtivo: true` e `origem: PLAY_BILLING`

## Web

Mercado Pago no site continua igual. Contas Pro (Play ou web) usam o mesmo login.

## Checklist de estrutura (evitar erro comum)

- [ ] Só existe a assinatura `reidapelada_pro`
- [ ] Dentro dela: planos `mensal` e `anual` **Ativos**
- [ ] Não existe assinatura product-id `anual` solta
- [ ] Service account vinculada na Play + JSON na VM
- [ ] Container com `APP_PLAY_CREDENTIALS_PATH` e volume `/secrets`
