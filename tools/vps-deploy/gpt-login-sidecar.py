#!/usr/bin/env python3
"""Local GoTrue password-grant for gptplus-store.ru. Never logs secrets."""
from __future__ import annotations

import base64
import json
import os
import socket
import ssl
import time
import urllib.parse
from http.client import HTTPSConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

GOTRUE_HOST = os.environ.get("GOTRUE_HOST", "cgamktdrqkxnnmnruvvq.supabase.co").strip()
ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "").strip()
BIND = os.environ.get("BIND", "127.0.0.1")
PORT = int(os.environ.get("PORT", "3099"))
IPS = [
    ip.strip()
    for ip in os.environ.get("GOTRUE_IPS", "8.6.112.0,8.47.69.0").split(",")
    if ip.strip()
]
ORIGIN = os.environ.get("SITE_ORIGIN", "https://gptplus-store.ru").rstrip("/")
COOKIE_REF = GOTRUE_HOST.split(".")[0] or "gpt"
COOKIE_NAME = "sb-%s-auth-token" % COOKIE_REF
CHUNK = 3180
ADMINS = {
    "karvanenigor98@gmail.com",
    "nbuzanov0@mail.ru",
    "nbuzanov@mail.ru",
}
OPERATORS = {
    "a.havronicheff@yandex.ru",
    "andreihavronicheff@yandex.ru",
}


def b64url(raw: str) -> str:
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii").rstrip("=")


def jwt_user(token: str, email: str) -> dict | None:
    parts = token.split(".")
    if len(parts) < 2:
        return None
    pad = "=" * (-len(parts[1]) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + pad))
    except Exception:
        return None
    uid = payload.get("sub")
    if not uid:
        return None
    mail = (payload.get("email") or email or "").strip().lower()
    return {
        "id": uid,
        "email": mail or None,
        "aud": payload.get("aud") or "authenticated",
        "role": payload.get("role") or "authenticated",
    }


def role_of(email: str) -> str:
    n = (email or "").strip().lower()
    if n in ADMINS:
        return "admin"
    if n in OPERATORS:
        return "operator"
    return "client"


def post_login_path(return_url: str, role: str) -> str:
    safe = return_url if return_url.startswith("/") and not return_url.startswith("//") else "/cabinet"
    if safe in ("/cabinet", "/", "/spotify") or safe.startswith("/spotify/"):
        safe = "/dashboard/orders?site=gpt-store"
    if role in ("admin", "operator"):
        base = "/admin" if role == "admin" else "/operator"
        if safe.startswith("/dashboard/chat"):
            return base + "/chat"
        if safe.startswith("/dashboard") or safe.startswith("/cabinet"):
            if "view=client" in safe:
                return safe
            return base
        if safe in ("/",) or safe.startswith("/support") or safe.startswith("/login") or safe.startswith("/register"):
            return base
    return safe


class HttpsIp(HTTPSConnection):
    def __init__(self, ip: str, timeout: float):
        self._ip = ip
        ctx = ssl.create_default_context()
        super().__init__(GOTRUE_HOST, timeout=timeout, context=ctx)

    def connect(self):
        sock = socket.create_connection((self._ip, 443), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=GOTRUE_HOST)


def grant(email: str, password: str) -> tuple[int, dict]:
    body = json.dumps({"email": email, "password": password}).encode("utf-8")
    headers = {
        "apikey": ANON_KEY,
        "Authorization": "Bearer " + ANON_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Connection": "close",
        "Host": GOTRUE_HOST,
    }
    last_status = 503
    last_json: dict = {"error": "auth_network"}
    for ip in IPS:
        conn = None
        try:
            conn = HttpsIp(ip, timeout=8)
            conn.request("POST", "/auth/v1/token?grant_type=password", body, headers)
            resp = conn.getresponse()
            raw = resp.read().decode("utf-8", "replace")
            last_status = resp.status
            try:
                last_json = json.loads(raw or "{}")
            except Exception:
                last_json = {"error": "auth_parse"}
            if last_status < 500:
                return last_status, last_json
        except (TimeoutError, socket.timeout, OSError):
            last_status = 504
            last_json = {"error": "timeout"}
            continue
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass
    return last_status, last_json


def cookie_header(name: str, value: str, max_age: int, http_only: bool = True, secure: bool = True) -> str:
    parts = [
        "%s=%s" % (name, value),
        "Path=/",
        "Max-Age=%d" % max_age,
        "SameSite=Lax",
    ]
    if http_only:
        parts.append("HttpOnly")
    if secure:
        parts.append("Secure")
    return "; ".join(parts)


def session_cookies(access: str, refresh: str, user: dict, expires_at: int | None) -> list[str]:
    now = int(time.time())
    exp = expires_at if isinstance(expires_at, int) else now + 3600
    payload = json.dumps(
        {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "expires_in": max(60, exp - now),
            "expires_at": exp,
            "user": {
                "id": user["id"],
                "email": user.get("email"),
                "aud": user.get("aud") or "authenticated",
                "role": user.get("role") or "authenticated",
                "app_metadata": {},
                "user_metadata": {},
            },
        },
        separators=(",", ":"),
    )
    encoded = "base64-" + b64url(payload)
    out = []
    for i in range(8):
        n = COOKIE_NAME if i == 0 else "%s.%d" % (COOKIE_NAME, i)
        out.append(cookie_header(n, "", 0))
    if len(encoded) <= CHUNK:
        out.append(cookie_header(COOKIE_NAME, encoded, 60 * 60 * 24 * 7))
    else:
        chunk = 0
        for offset in range(0, len(encoded), CHUNK):
            n = "%s.%d" % (COOKIE_NAME, chunk)
            out.append(cookie_header(n, encoded[offset : offset + CHUNK], 60 * 60 * 24 * 7))
            chunk += 1
    out.append(cookie_header("site_ui_logout_gpt", "", 0))
    out.append(cookie_header("current_site", "gpt-store", 60 * 60 * 24 * 30, http_only=False))
    return out


def parse_body(raw: bytes, ctype: str) -> dict:
    if "application/json" in ctype:
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}
    q = urllib.parse.parse_qs(raw.decode("utf-8", "replace"), keep_blank_values=True)
    return {k: (v[0] if v else "") for k, v in q.items()}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        sys_stderr = __import__("sys").stderr
        msg = fmt % args
        if "password" in msg.lower() or "apikey" in msg.lower() or "bearer" in msg.lower():
            return
        sys_stderr.write("%s - %s\n" % (self.address_string(), msg[:200]))

    def _send(self, code: int, headers: list[tuple[str, str]], body: bytes) -> None:
        self.send_response(code)
        self.send_header("X-Gpt-Auth", "sidecar")
        for k, v in headers:
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path in ("/health", "/api/auth/gpt-login"):
            body = b'{"ok":true,"sidecar":"gpt-login"}\n'
            self._send(200, [("Content-Type", "application/json")], body)
            return
        self._send(404, [("Content-Type", "text/plain")], b"not found\n")

    def do_HEAD(self) -> None:
        self.do_GET()

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path != "/api/auth/gpt-login":
            self._send(404, [("Content-Type", "text/plain")], b"not found\n")
            return
        length = int(self.headers.get("Content-Length") or "0")
        raw = self.rfile.read(length) if length else b""
        ctype = (self.headers.get("Content-Type") or "").lower()
        accept = (self.headers.get("Accept") or "").lower()
        html = ("application/x-www-form-urlencoded" in ctype) or (
            "text/html" in accept and "application/json" not in accept
        )
        data = parse_body(raw, ctype)
        email = str(data.get("email") or "").strip().lower()
        password = str(data.get("password") or "")
        return_url = str(data.get("returnUrl") or "/cabinet")

        def fail(code: str, status: int, json_body: dict) -> None:
            if html:
                loc = ORIGIN + "/login?error=%s&site=gpt-store" % code
                if email:
                    loc += "&email=" + urllib.parse.quote(email)
                self._send(303, [("Location", loc), ("Cache-Control", "no-store")], b"")
                return
            raw_json = json.dumps(json_body).encode("utf-8")
            self._send(status, [("Content-Type", "application/json"), ("Cache-Control", "no-store")], raw_json)

        if not ANON_KEY:
            fail("timeout", 503, {"error": "sidecar_misconfigured", "code": "auth_timeout"})
            return
        if not email or len(password) < 6:
            fail("invalid", 400, {"error": "Укажите email и пароль.", "code": "invalid_credentials"})
            return

        status, payload = grant(email, password)
        access = payload.get("access_token") if isinstance(payload, dict) else None
        refresh = payload.get("refresh_token") if isinstance(payload, dict) else None
        user = None
        if isinstance(payload.get("user"), dict) and payload["user"].get("id"):
            user = payload["user"]
        elif isinstance(access, str):
            user = jwt_user(access, email)

        if status in (401, 400, 422) or not access or not refresh or not user:
            msg = ""
            if isinstance(payload, dict):
                msg = str(payload.get("error_description") or payload.get("msg") or payload.get("error") or "")
            if "rate" in msg.lower():
                fail("rate", 429, {"error": "Слишком много попыток.", "code": "rate_limited"})
                return
            if status >= 500 or payload.get("error") in ("timeout", "auth_network", "auth_parse"):
                fail("timeout", 503, {"error": "Сервер входа не ответил. Повторите попытку.", "code": "auth_timeout"})
                return
            fail("invalid", 401, {"error": "Неверный email или пароль.", "code": "invalid_credentials"})
            return

        expires_at = payload.get("expires_at")
        if not isinstance(expires_at, int) and isinstance(payload.get("expires_in"), int):
            expires_at = int(time.time()) + int(payload["expires_in"])
        role = role_of(user.get("email") or email)
        path_out = post_login_path(return_url, role)
        cookies = session_cookies(access, refresh, user, expires_at if isinstance(expires_at, int) else None)
        headers = [("Cache-Control", "no-store")]
        for c in cookies:
            headers.append(("Set-Cookie", c))
        if html:
            headers.append(("Location", ORIGIN + path_out))
            self._send(303, headers, b"")
            return
        body = json.dumps({"ok": True, "path": path_out, "role": role}).encode("utf-8")
        headers.append(("Content-Type", "application/json"))
        self._send(200, headers, body)


def main() -> None:
    if not ANON_KEY:
        raise SystemExit("SUPABASE_ANON_KEY missing")
    httpd = ThreadingHTTPServer((BIND, PORT), Handler)
    httpd.daemon_threads = True
    print("gpt-login-sidecar %s:%s gotrue=%s" % (BIND, PORT, GOTRUE_HOST), flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
