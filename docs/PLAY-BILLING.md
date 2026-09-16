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

### 1) Google Cloud — Service Account

1. [Google Cloud Console](https://console.cloud.google.com/) → projeto ligado ao Play (ou crie um)
2. **IAM e administrador** → **Contas de serviço** → **Criar**
   - Nome: `pelada-play-billing`
3. Em **Chaves** → **Adicionar chave** → **JSON** → baixe o arquivo
4. IAM da conta: permissão **não** precisa no GCP além da chave; o vínculo é na Play

### 2) Play Console — liberar a API

1. Play Console → **Configuração** → **Acesso à API**
2. Vincule o projeto Google Cloud (se ainda não)
3. Em **Contas de serviço**, conceda acesso à e-mail da service account
   - Permissão mínima: **Ver dados financeiros** / gerenciar pedidos e assinaturas  
     (ou o papel “Admin” de contas de serviço, se a UI for essa)

Aguarde alguns minutos após vincular (às vezes até algumas horas).

### 3) Subir o JSON na VM

No Mac (ajuste o caminho do JSON baixado e da chave SSH):

```bash
scp -i ~/Downloads/ssh-key-2026-08-12.key \
  ~/Downloads/seu-arquivo-service-account.json \
  ubuntu@147.15.38.121:/home/ubuntu/pelada/secrets/play-service-account.json
```

Na VM:

```bash
ssh -i ~/Downloads/ssh-key-2026-08-12.key ubuntu@147.15.38.121
sudo mkdir -p /home/ubuntu/pelada/secrets
sudo chmod 700 /home/ubuntu/pelada/secrets
sudo chmod 600 /home/ubuntu/pelada/secrets/play-service-account.json
```

Crie `/home/ubuntu/pelada/play.env` (só o caminho; **não** cole o JSON no chat):

```bash
APP_PLAY_PACKAGE_NAME=com.rkds.reidapelada
APP_PLAY_CREDENTIALS_PATH=/secrets/play-service-account.json
```

### 4) Recriar o container com o volume

O container `pelada-api` precisa montar o JSON e carregar `play.env`.
Use o script `backend/scripts/aplicar-play-billing-oracle.sh` (roda na VM) ou peça ao assistente depois que o JSON estiver em `~/pelada/secrets/`.

Reinicie o backend. Confirme no app (logado) que `/api/me` traz `checkoutPlay: true`.

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
