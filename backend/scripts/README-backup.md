# Backup semanal — Postgres de produção (Supabase)

Automatiza dump do banco apontado por `/home/ubuntu/pelada/spring.env`
(`SPRING_DATASOURCE_*`), hoje o pooler Supabase.

## O que faz

- Roda `pg_dump` via Docker (`postgres:16-alpine` + `--network host`)
- Comprime em `.gz` e salva em `/home/ubuntu/pelada/backups/`
- Mantém os **8 backups mais recentes**
- Registra em `backups/backup.log`

> Não usa mais o container local `pelada-db` (legado / vazio).

## Agendamento

Domingo **06:00 UTC** (= 03:00 horário de Brasília):

```cron
0 6 * * 0 /home/ubuntu/pelada/backup-postgres-semanal.sh >> /home/ubuntu/pelada/backups/cron.log 2>&1
```

## Comandos úteis na VM

```bash
# Backup manual agora
/home/ubuntu/pelada/backup-postgres-semanal.sh

# Ver histórico
tail -20 /home/ubuntu/pelada/backups/backup.log

# Listar backups
ls -lh /home/ubuntu/pelada/backups/pelada_oficial-*.sql.gz
```

## Copiar backup pro Mac (opcional)

```bash
scp -i ~/Downloads/ssh-key-2026-08-12.key \
  ubuntu@147.15.38.121:/home/ubuntu/pelada/backups/pelada_oficial-*.sql.gz \
  ~/Backups/pelada/
```

Recomendado: baixar 1 backup por mês pro computador ou nuvem (Drive/iCloud).
