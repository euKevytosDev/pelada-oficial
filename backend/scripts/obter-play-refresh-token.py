#!/usr/bin/env python3
"""Gera refresh token OAuth para Android Publisher API (Play Billing).

Uso:
  python3 obter-play-refresh-token.py /caminho/client_secret_....json

Abre o navegador, autorize com a conta dona do Play Console.
Salva o refresh token em stdout e em /tmp/play-refresh-token.txt
"""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

SCOPE = "https://www.googleapis.com/auth/androidpublisher"
PORT = 8765
# Cliente tipo "Computador" aceita loopback; não precisa cadastrar URI na Console.
REDIRECT = f"http://localhost:{PORT}"


def main() -> int:
    if len(sys.argv) < 2:
        print("Uso: python3 obter-play-refresh-token.py client_secret.json", file=sys.stderr)
        return 1
    with open(sys.argv[1], encoding="utf-8") as f:
        data = json.load(f)
    cfg = data.get("installed") or data.get("web") or data
    client_id = cfg["client_id"]
    client_secret = cfg["client_secret"]

    params = {
        "client_id": client_id,
        "redirect_uri": REDIRECT,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    code_holder: dict[str, str] = {}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            qs = urllib.parse.urlparse(self.path).query
            q = urllib.parse.parse_qs(qs)
            if "code" in q:
                code_holder["code"] = q["code"][0]
                body = b"<html><body><h2>Ok! Pode fechar esta aba e voltar ao terminal.</h2></body></html>"
                self.send_response(200)
            else:
                body = b"<html><body><h2>Falha no OAuth.</h2></body></html>"
                self.send_response(400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *args):  # noqa: A003
            return

    print("Abrindo o navegador para autorizar (conta dona do Play Console)...")
    print(auth_url)
    webbrowser.open(auth_url)
    httpd = HTTPServer(("127.0.0.1", PORT), Handler)
    while "code" not in code_holder:
        httpd.handle_request()
    httpd.server_close()

    token_body = urllib.parse.urlencode(
        {
            "code": code_holder["code"],
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": REDIRECT,
            "grant_type": "authorization_code",
        }
    ).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=token_body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req) as res:
        tokens = json.loads(res.read().decode())

    refresh = tokens.get("refresh_token")
    if not refresh:
        print("Google nao devolveu refresh_token. Resposta:", tokens, file=sys.stderr)
        return 2

    out = "/tmp/play-refresh-token.txt"
    with open(out, "w", encoding="utf-8") as f:
        f.write(refresh + "\n")
    print("\nREFRESH_TOKEN salvo em", out)
    print(refresh)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
