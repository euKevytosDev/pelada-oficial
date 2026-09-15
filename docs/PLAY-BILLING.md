# Play Billing — Rei da Pelada Pro

Assinatura nativa no Android (`com.rkds.reidapelada`).

## IDs na Play Console

Crie **uma assinatura** com dois base plans:

| Campo | Valor |
|--------|--------|
| Product ID | `reidapelada_pro` |
| Base plan mensal | `mensal` · R$ 49,90 / mês |
| Base plan anual | `anual` · R$ 349,90 / ano |

App ID: `com.rkds.reidapelada`

## No servidor Oracle

1. Google Cloud → Service Account com permissão **Android Publisher**
2. Play Console → Configuração da API → vincular essa conta
3. Baixe o JSON da service account e no servidor:

```bash
export APP_PLAY_CREDENTIALS_PATH=/caminho/seguro/play-service-account.json
# ou
export APP_PLAY_CREDENTIALS_JSON='{ ... json inteiro ... }'
```

Reinicie o backend. Sem isso, a compra na Play abre, mas o Pro **não ativa** (validação falha).

## Teste

1. Conta de **licenciados** / testadores na Play Console  
2. Instalar o AAB/APK pelo teste interno/fechado (não sideload solto)  
3. Login Google no app → recurso Pro → Assinar na Play  
4. Confirmar que `/api/me` volta `proAtivo: true` e `origem: PLAY_BILLING`

## Web

Mercado Pago no site continua igual. Contas Pro (Play ou web) usam o mesmo login.
