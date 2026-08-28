# Backup semanal — Postgres (VM Oracle)

Automatiza dump do banco `pelada_oficial` no container `pelada-db`.

## O que faz

- Roda `pg_dump` via Docker, comprime com `.gz`
- Salva em `/home/ubuntu/pelada/backups/`
- Mantém os **8 backups mais recentes** (~2 meses)
- Registra em `backups/backup.log`

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

# Restaurar (cuidado: sobrescreve dados atuais)
gunzip -c /home/ubuntu/pelada/backups/pelada_oficial-YYYYMMDD-HHMMSS.sql.gz | \
  docker exec -i -e PGPASSWORD="$(cat /home/ubuntu/pelada/.dbpass)" pelada-db \
  psql -U pelada -d pelada_oficial
```

## Copiar backup pro Mac (opcional)

```bash
scp -i ~/Downloads/ssh-key-2026-08-12.key \
  ubuntu@147.15.38.121:/home/ubuntu/pelada/backups/pelada_oficial-*.sql.gz \
  ~/Backups/pelada/
```

Recomendado: baixar 1 backup por mês pro seu computador ou nuvem (Drive/iCloud).
