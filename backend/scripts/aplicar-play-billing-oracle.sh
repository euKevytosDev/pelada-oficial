#!/usr/bin/env bash
# Aplica Play Billing no container pelada-api (Oracle VM).
# Pré-requisito: /home/ubuntu/pelada/play.env com OAuth OU secrets/play-service-account.json
# Também usa neon.env (NEON_*) ou spring.env (SPRING_DATASOURCE_*).
# Uso (na VM): bash ~/pelada/aplicar-play-billing-oracle.sh
set -euo pipefail

ROOT=/home/ubuntu/pelada
JSON="$ROOT/secrets/play-service-account.json"
PLAY_ENV="$ROOT/play.env"
MP_ENV="$ROOT/mp.env"
NEON_ENV="$ROOT/neon.env"
SPRING_ENV="$ROOT/spring.env"
JAR="$ROOT/app.jar"
NAME=pelada-api
IMAGE=eclipse-temurin:17-jre-alpine

if [[ ! -f "$JAR" ]]; then
  echo "Falta $JAR"
  exit 1
fi
if [[ ! -f "$PLAY_ENV" ]]; then
  echo "Falta $PLAY_ENV"
  exit 1
fi

if grep -q '^APP_PLAY_CREDENTIALS_PATH=' "$PLAY_ENV"; then
  if [[ ! -f "$JSON" ]]; then
    echo "play.env aponta credentials-path, mas falta $JSON"
    exit 1
  fi
  chmod 700 "$ROOT/secrets" 2>/dev/null || true
  chmod 600 "$JSON"
fi
chmod 600 "$PLAY_ENV"

# Garante spring.env a partir do neon.env se necessário
if [[ ! -f "$SPRING_ENV" && -f "$NEON_ENV" ]]; then
  python3 - <<PY
from pathlib import Path
raw = {}
for line in Path("$NEON_ENV").read_text().splitlines():
    if not line.strip() or line.strip().startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    raw[k.strip()] = v.strip().strip('"').strip("'")
url = raw.get("NEON_URL") or raw.get("SPRING_DATASOURCE_URL")
user = raw.get("NEON_USER") or raw.get("SPRING_DATASOURCE_USERNAME")
pwd = raw.get("NEON_PASS") or raw.get("SPRING_DATASOURCE_PASSWORD")
if not (url and user and pwd):
    raise SystemExit("neon.env incompleto")
if url.startswith("postgresql://"):
    url = "jdbc:" + url
elif not url.startswith("jdbc:"):
    url = "jdbc:postgresql://" + url
Path("$SPRING_ENV").write_text(
    "SPRING_PROFILES_ACTIVE=postgres\n"
    f"SPRING_DATASOURCE_URL={url}\n"
    f"SPRING_DATASOURCE_USERNAME={user}\n"
    f"SPRING_DATASOURCE_PASSWORD={pwd}\n"
)
PY
  chmod 600 "$SPRING_ENV"
fi

if [[ ! -f "$SPRING_ENV" ]]; then
  echo "Falta $SPRING_ENV (ou neon.env para gerar)"
  exit 1
fi

ENV_ARGS=(--env-file "$SPRING_ENV" --env-file "$PLAY_ENV")
[[ -f "$MP_ENV" ]] && ENV_ARGS+=(--env-file "$MP_ENV")

VOLUME_ARGS=(-v "$JAR:/app.jar:ro")
[[ -f "$JSON" ]] && VOLUME_ARGS+=(-v "$ROOT/secrets:/secrets:ro")

sudo docker rm -f "$NAME" 2>/dev/null || true
sudo docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  -p 8080:8080 \
  "${VOLUME_ARGS[@]}" \
  "${ENV_ARGS[@]}" \
  -e GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-14692725836-8n7a4aisfk1sjmvadnn400joq1j6rjdi.apps.googleusercontent.com}" \
  "$IMAGE" \
  java -jar /app.jar

echo "Aguardando health..."
for i in $(seq 1 40); do
  if curl -fsS -m 3 http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
    echo "OK — API no ar"
    sudo docker inspect "$NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^APP_PLAY_' | sed 's/=.*/=***/' || true
    exit 0
  fi
  sleep 2
done
echo "Container subiu, mas health ainda não respondeu. Logs:"
sudo docker logs --tail 40 "$NAME"
exit 1
