#!/usr/bin/env bash
# Aplica Play Billing no container pelada-api (Oracle VM).
# Pré-requisito: /home/ubuntu/pelada/play.env com OAuth OU secrets/play-service-account.json
# Uso (na VM): bash ~/pelada/aplicar-play-billing-oracle.sh
set -euo pipefail

ROOT=/home/ubuntu/pelada
JSON="$ROOT/secrets/play-service-account.json"
PLAY_ENV="$ROOT/play.env"
MP_ENV="$ROOT/mp.env"
NEON_ENV="$ROOT/neon.env"
JAR="$ROOT/app.jar"
NAME=pelada-api
IMAGE=eclipse-temurin:17-jre-alpine

if [[ ! -f "$JAR" ]]; then
  echo "Falta $JAR"
  exit 1
fi

if [[ ! -f "$PLAY_ENV" ]]; then
  echo "Falta $PLAY_ENV — crie com APP_PLAY_OAUTH_* ou APP_PLAY_CREDENTIALS_PATH"
  exit 1
fi

# Se usa arquivo de service account, exige o JSON
if grep -q '^APP_PLAY_CREDENTIALS_PATH=' "$PLAY_ENV"; then
  if [[ ! -f "$JSON" ]]; then
    echo "play.env aponta credentials-path, mas falta $JSON"
    exit 1
  fi
  chmod 700 "$ROOT/secrets" 2>/dev/null || true
  chmod 600 "$JSON"
fi
chmod 600 "$PLAY_ENV"

TMP_ENV=$(mktemp)
trap 'rm -f "$TMP_ENV"' EXIT
sudo docker inspect "$NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E '^(SPRING_|APP_|MERCADOPAGO_|GOOGLE_|JAVA_OPTS)=' \
  | grep -v '^APP_PLAY_' > "$TMP_ENV" || true

grep -q '^SPRING_PROFILES_ACTIVE=' "$TMP_ENV" || echo 'SPRING_PROFILES_ACTIVE=postgres' >> "$TMP_ENV"

ENV_ARGS=(--env-file "$TMP_ENV" --env-file "$PLAY_ENV")
[[ -f "$MP_ENV" ]] && ENV_ARGS+=(--env-file "$MP_ENV")
[[ -f "$NEON_ENV" ]] && ENV_ARGS+=(--env-file "$NEON_ENV")

VOLUME_ARGS=(-v "$JAR:/app.jar:ro")
[[ -f "$JSON" ]] && VOLUME_ARGS+=(-v "$ROOT/secrets:/secrets:ro")

sudo docker rm -f "$NAME" 2>/dev/null || true
sudo docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  -p 8080:8080 \
  "${VOLUME_ARGS[@]}" \
  "${ENV_ARGS[@]}" \
  "$IMAGE" \
  java -jar /app.jar

echo "Aguardando health..."
for i in $(seq 1 30); do
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
