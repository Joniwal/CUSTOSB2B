from __future__ import annotations

import argparse
import hmac
import ipaddress
import json
import logging
import mimetypes
import os
import secrets
import sys
import threading
import webbrowser
from calendar import monthrange
from datetime import date, datetime, timedelta
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from excel_repository import (
    RepositoryError,
    activity_date,
    build_repository,
    summarize_activities,
    summarize_service_categories,
)


APP_NAME = "B2B CTACUSTOS"
ADMIN_SESSION_COOKIE = "b2b_admin_session"


def app_root() -> Path:
    """Return a stable resource path in source and PyInstaller builds."""
    bundle_dir = getattr(sys, "_MEIPASS", None)
    return Path(bundle_dir) if bundle_dir else Path(__file__).resolve().parent


def data_root() -> Path:
    """Keep editable data beside the executable instead of inside its bundle."""
    return Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent


ROOT = app_root()
WEB_ROOT = ROOT / "web"


def load_env(path: Path) -> None:
    """Small .env loader so the app has no runtime dependency on python-dotenv."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            # In this local desktop app, the .env beside the application is
            # the user-facing source of configuration. It must replace stale
            # values inherited from a previously opened terminal.
            os.environ[key] = value


load_env(data_root() / ".env")


def _parse_iso_date(value: str, label: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"{label} inválida.") from exc


def resolve_dashboard_period(query: dict[str, list[str]]) -> dict[str, date | str]:
    mode = query.get("mode", ["month"])[0]
    today = date.today()
    if mode == "custom":
        start_text = query.get("start", [today.replace(day=1).isoformat()])[0]
        end_text = query.get("end", [today.isoformat()])[0]
        start = _parse_iso_date(start_text, "Data inicial")
        end = _parse_iso_date(end_text, "Data final")
        if start > end:
            raise ValueError("A data inicial não pode ser posterior à data final.")
        duration = end - start
        previous_end = start - timedelta(days=1)
        previous_start = previous_end - duration
        label = f"{start.isoformat()} a {end.isoformat()}"
    else:
        mode = "month"
        month_text = query.get("month", [today.strftime("%Y-%m")])[0]
        try:
            selected = datetime.strptime(month_text, "%Y-%m").date()
        except ValueError as exc:
            raise ValueError("Mês de referência inválido.") from exc
        start = selected.replace(day=1)
        end = selected.replace(day=monthrange(selected.year, selected.month)[1])
        previous_end = start - timedelta(days=1)
        previous_start = previous_end.replace(day=1)
        label = month_text
    return {
        "mode": mode,
        "start": start,
        "end": end,
        "previous_start": previous_start,
        "previous_end": previous_end,
        "label": label,
    }


def _period_items(activities: list[dict], start: date, end: date) -> list[dict]:
    result = []
    for item in activities:
        item_date = activity_date(item.get("data") or item.get("atualizado_em"))
        if item_date and start <= item_date <= end:
            result.append(item)
    return result


def _kpi_comparison(current: dict, previous: dict) -> list[dict]:
    definitions = (
        ("custo_mo", "Custo Serviços"),
        ("custo_material", "Custo Material"),
        ("custo_total", "Custo total"),
        ("gap", "GAP"),
    )
    result = []
    for key, label in definitions:
        current_value = float(current.get(key, 0) or 0)
        previous_value = float(previous.get(key, 0) or 0)
        delta = current_value - previous_value
        change = None if previous_value == 0 else round(delta / abs(previous_value) * 100, 1)
        result.append(
            {
                "key": key,
                "label": label,
                "current": round(current_value, 2),
                "previous": round(previous_value, 2),
                "delta": round(delta, 2),
                "change_percent": change,
            }
        )
    return result


def _category_comparison(current: list[dict], previous: list[dict]) -> list[dict]:
    previous_by_key = {item["key"]: item for item in previous}
    labels = {
        "service": "Serviços",
        "material": "Materiais",
        "total": "Custo total",
        "gap": "GAP",
    }
    result = []
    for item in current:
        prior = previous_by_key.get(item["key"], {})
        trends = {}
        for key, label in labels.items():
            current_value = float(item.get(key, 0) or 0)
            previous_value = float(prior.get(key, 0) or 0)
            delta = current_value - previous_value
            trends[key] = {
                "key": key,
                "label": label,
                "previous": round(previous_value, 2),
                "delta": round(delta, 2),
                "change_percent": None if previous_value == 0 else round(delta / abs(previous_value) * 100, 1),
            }
        result.append({**item, "trends": trends})
    return result


class B2BServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def __init__(self, server_address, handler_class):
        super().__init__(server_address, handler_class)
        self.repository = build_repository(data_root())
        self.admin_username = os.getenv("ADMIN_USERNAME", "ADMIN").strip() or "ADMIN"
        self.admin_password = os.getenv("ADMIN_PASSWORD", "ALTERE_ESTA_SENHA")
        self._admin_sessions: set[str] = set()
        self._admin_lock = threading.Lock()

    def authenticate_admin(self, username: str, password: str) -> str | None:
        user_ok = hmac.compare_digest(username.casefold(), self.admin_username.casefold())
        password_ok = hmac.compare_digest(password, self.admin_password)
        if not (user_ok and password_ok):
            return None
        token = secrets.token_urlsafe(32)
        with self._admin_lock:
            self._admin_sessions.add(token)
        return token

    def is_admin_session(self, token: str) -> bool:
        with self._admin_lock:
            return bool(token) and token in self._admin_sessions

    def end_admin_session(self, token: str) -> None:
        with self._admin_lock:
            self._admin_sessions.discard(token)


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "B2BCTACUSTOS/1.0"

    def log_message(self, fmt: str, *args) -> None:
        logging.info("%s - %s", self.address_string(), fmt % args)

    def _json(self, payload, status=HTTPStatus.OK, extra_headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            logging.debug("O navegador encerrou a conexão antes do fim da resposta.")

    def _error(self, message: str, status=HTTPStatus.BAD_REQUEST) -> None:
        self._json({"ok": False, "error": message}, status)

    def _attachment(self, content: bytes, filename: str, content_type: str) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        try:
            self.wfile.write(content)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            logging.debug("O navegador encerrou o download antes do fim da resposta.")

    def _admin_token(self) -> str:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            return ""
        morsel = cookie.get(ADMIN_SESSION_COOKIE)
        return morsel.value if morsel else ""

    def _require_admin(self) -> bool:
        if self.server.is_admin_session(self._admin_token()):
            return True
        self._error("Faça login como administrador para acessar as configurações.", HTTPStatus.UNAUTHORIZED)
        return False

    def _serve_file(self, file_path: Path) -> None:
        try:
            resolved = file_path.resolve(strict=True)
            resolved.relative_to(WEB_ROOT.resolve())
        except (FileNotFoundError, ValueError):
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content = resolved.read_bytes()
        content_type = mimetypes.guess_type(str(resolved))[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/":
            self._serve_file(WEB_ROOT / "index.html")
            return
        if path == "/atividades":
            self._serve_file(WEB_ROOT / "atividades.html")
            return
        if path == "/configuracoes":
            self._serve_file(WEB_ROOT / "configuracoes.html")
            return
        if path.startswith("/static/"):
            self._serve_file(WEB_ROOT / path.lstrip("/"))
            return
        if path == "/favicon.ico":
            self._serve_file(WEB_ROOT / "static" / "favicon.ico")
            return
        if path == "/api/health":
            self._json({"ok": True, "app": APP_NAME, "source": self.server.repository.source_label})
            return
        if path == "/api/dashboard":
            self._dashboard(parse_qs(parsed.query))
            return
        if path == "/api/activities/export":
            self._export_activities()
            return
        if path == "/api/activities":
            self._activities(parse_qs(parsed.query))
            return
        if path == "/api/service-calculation":
            self._service_calculation(parse_qs(parsed.query))
            return
        if path == "/api/settings":
            if self._require_admin():
                self._settings()
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PUT(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        prefix = "/api/activities/"
        if not parsed.path.startswith(prefix):
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        activity_id = unquote(parsed.path[len(prefix) :]).strip()
        if not activity_id:
            self._error("ID da atividade não informado.")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 1_000_000:
                raise ValueError("Corpo da requisição inválido.")
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            updated = self.server.repository.update_activity(activity_id, payload)
            self._json({"ok": True, "activity": updated})
        except (json.JSONDecodeError, ValueError) as exc:
            self._error(str(exc))
        except RepositoryError as exc:
            self._error(str(exc), HTTPStatus.CONFLICT)
        except Exception:
            logging.exception("Falha ao atualizar atividade %s", activity_id)
            self._error("Não foi possível salvar a atividade. Verifique o arquivo e tente novamente.", HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        if path == "/api/shutdown":
            self._shutdown_app()
            return
        if path == "/api/admin/login":
            self._admin_login()
            return
        if path == "/api/admin/logout":
            self._admin_logout()
            return
        if path == "/api/admin/upload":
            if self._require_admin():
                self._upload_reference(parse_qs(parsed.query))
            return
        if path == "/api/activities":
            self._create_activity()
            return
        if path == "/api/service-calculation":
            self._save_service_calculation(parse_qs(parsed.query))
            return
        if path == "/api/settings":
            if self._require_admin():
                self._save_settings()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def _read_json(self) -> dict:
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0 or content_length > 1_000_000:
            raise ValueError("Corpo da requisição inválido.")
        payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("Dados inválidos.")
        return payload

    def _create_activity(self) -> None:
        try:
            created = self.server.repository.create_activity(self._read_json())
            self._json({"ok": True, "activity": created}, HTTPStatus.CREATED)
        except (json.JSONDecodeError, ValueError) as exc:
            self._error(str(exc))
        except RepositoryError as exc:
            self._error(str(exc), HTTPStatus.CONFLICT)

    def _service_calculation(self, query: dict[str, list[str]]) -> None:
        try:
            activity_reference = query.get("activity", [""])[0]
            calculation = self.server.repository.get_service_calculation(activity_reference)
            self._json({"ok": True, **calculation})
        except ValueError as exc:
            self._error(str(exc))
        except RepositoryError as exc:
            self._error(str(exc), HTTPStatus.SERVICE_UNAVAILABLE)

    def _save_service_calculation(self, query: dict[str, list[str]]) -> None:
        try:
            activity_reference = query.get("activity", [""])[0]
            calculation = self.server.repository.save_service_calculation(
                activity_reference,
                self._read_json(),
            )
            self._json({"ok": True, **calculation})
        except (json.JSONDecodeError, ValueError) as exc:
            self._error(str(exc))
        except RepositoryError as exc:
            self._error(str(exc), HTTPStatus.CONFLICT)

    def _admin_login(self) -> None:
        try:
            payload = self._read_json()
            token = self.server.authenticate_admin(
                str(payload.get("username", "")).strip(),
                str(payload.get("password", "")),
            )
            if not token:
                self._error(
                    "Usuário ou senha inválidos. Se alterou o .env, encerre e abra o aplicativo novamente.",
                    HTTPStatus.UNAUTHORIZED,
                )
                return
            self._json(
                {"ok": True, "username": self.server.admin_username},
                extra_headers={
                    "Set-Cookie": f"{ADMIN_SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Strict"
                },
            )
        except (json.JSONDecodeError, ValueError) as exc:
            self._error(str(exc))

    def _admin_logout(self) -> None:
        self.server.end_admin_session(self._admin_token())
        self._json(
            {"ok": True},
            extra_headers={
                "Set-Cookie": f"{ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"
            },
        )

    def _upload_reference(self, query: dict[str, list[str]]) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 25 * 1024 * 1024:
                raise ValueError("A planilha deve ter no máximo 25 MB.")
            kind = query.get("kind", [""])[0]
            filename = query.get("filename", [""])[0]
            uploaded = self.server.repository.save_reference_workbook(
                kind, filename, self.rfile.read(content_length)
            )
            self._json({"ok": True, "upload": uploaded}, HTTPStatus.CREATED)
        except ValueError as exc:
            self._error(str(exc))
        except RepositoryError as exc:
            self._error(str(exc), HTTPStatus.CONFLICT)

    def _settings(self) -> None:
        try:
            self._json({"ok": True, "settings": self.server.repository.get_settings(), "source": self.server.repository.source_label})
        except RepositoryError as exc:
            self._error(str(exc), HTTPStatus.SERVICE_UNAVAILABLE)

    def _save_settings(self) -> None:
        try:
            settings = self.server.repository.save_settings(self._read_json())
            self._json({"ok": True, "settings": settings})
        except (json.JSONDecodeError, ValueError) as exc:
            self._error(str(exc))
        except RepositoryError as exc:
            self._error(str(exc), HTTPStatus.CONFLICT)

    def _shutdown_app(self) -> None:
        try:
            client_ip = ipaddress.ip_address(self.client_address[0])
        except ValueError:
            client_ip = None
        host_header = self.headers.get("Host", "")
        host = (urlparse(f"//{host_header}").hostname or "").casefold()
        origin = self.headers.get("Origin", "")
        parsed_origin = urlparse(origin) if origin else None
        origin_host = (parsed_origin.hostname or "").casefold() if parsed_origin else ""
        local_names = {"127.0.0.1", "localhost", "::1"}
        if not client_ip or not client_ip.is_loopback or host not in local_names:
            self._error("O aplicativo só pode ser encerrado pelo próprio computador.", HTTPStatus.FORBIDDEN)
            return
        if origin_host and origin_host not in local_names:
            self._error("Origem não autorizada para encerrar o aplicativo.", HTTPStatus.FORBIDDEN)
            return

        self._json({"ok": True, "message": "Aplicativo encerrado."})
        threading.Timer(0.15, self.server.shutdown).start()

    def _dashboard(self, query: dict[str, list[str]]) -> None:
        try:
            activities = self.server.repository.list_activities()
            period = resolve_dashboard_period(query)
            technology = query.get("technology", [""])[0].strip()
            technology_key = technology.casefold()
            technology_options = sorted(
                {
                    str(item.get("tecnologia", "")).strip()
                    for item in activities
                    if str(item.get("tecnologia", "")).strip()
                },
                key=str.casefold,
            )
            current_items = _period_items(activities, period["start"], period["end"])
            previous_items = _period_items(activities, period["previous_start"], period["previous_end"])
            if technology_key:
                current_items = [
                    item for item in current_items
                    if str(item.get("tecnologia", "")).strip().casefold() == technology_key
                ]
                previous_items = [
                    item for item in previous_items
                    if str(item.get("tecnologia", "")).strip().casefold() == technology_key
                ]
            payload = summarize_activities(current_items)
            previous = summarize_activities(previous_items)
            settings = self.server.repository.get_settings()
            current_categories = summarize_service_categories(current_items, settings)
            previous_categories = summarize_service_categories(previous_items, settings)
            payload["financial"]["gap"] = round(sum(item["gap"] for item in current_categories), 2)
            previous["financial"]["gap"] = round(sum(item["gap"] for item in previous_categories), 2)
            payload["kpis"] = _kpi_comparison(payload["financial"], previous["financial"])
            payload["category_kpis"] = _category_comparison(current_categories, previous_categories)
            payload["period"] = {
                key: value.isoformat() if isinstance(value, date) else value
                for key, value in period.items()
            }
            payload["filters"] = {"technologies": technology_options, "technology": technology}
            payload["source"] = self.server.repository.source_label
            self._json({"ok": True, **payload})
        except (RepositoryError, ValueError) as exc:
            self._error(str(exc), HTTPStatus.SERVICE_UNAVAILABLE)

    def _activities(self, query: dict[str, list[str]]) -> None:
        try:
            activities = self.server.repository.list_activities()
            text = query.get("q", [""])[0].strip().casefold()
            status = query.get("status", [""])[0].strip().casefold()
            activity_type = query.get("type", [""])[0].strip().casefold()
            technology = query.get("technology", [""])[0].strip().casefold()

            if text:
                activities = [
                    item
                    for item in activities
                    if text in " ".join(
                        str(item.get(key, ""))
                        for key in (
                            "id", "tipo_atividade", "status", "situacao", "material_utilizado", "cod_material",
                            "empresa", "tecnico_nome", "matricula", "eps", "tecnologia", "draft",
                        )
                    ).casefold()
                ]
            if status:
                requested = "".join(char for char in status if char.isalnum()).casefold()
                if requested.startswith("conclu"):
                    activities = [item for item in activities if "conclu" in str(item.get("status", "")).casefold()]
                elif requested.startswith("cancela") or requested.startswith("inativ"):
                    activities = [
                        item for item in activities
                        if any(token in str(item.get("status", "")).casefold() for token in ("cancel", "inativ"))
                    ]
                else:
                    activities = [item for item in activities if str(item.get("status", "")).casefold() == status]
            if activity_type:
                activities = [item for item in activities if str(item.get("tipo_atividade", "")).casefold() == activity_type]
            if technology:
                activities = [item for item in activities if str(item.get("tecnologia", "")).casefold() == technology]

            allowed_sorts = {
                "id", "tipo_atividade", "status", "situacao", "tecnologia", "draft",
                "atualizado_em", "custo_total", "gap",
            }
            sort_key = query.get("sort", ["id"])[0]
            if sort_key not in allowed_sorts:
                sort_key = "id"
            reverse = query.get("direction", ["asc"])[0] == "desc"

            def sortable(item):
                value = item.get(sort_key)
                if isinstance(value, (int, float)):
                    return (0, value)
                return (1, str(value or "").casefold())

            activities.sort(key=sortable, reverse=reverse)
            total = len(activities)
            def safe_int(value: str, default: int) -> int:
                try:
                    return int(value)
                except (TypeError, ValueError):
                    return default

            page = max(1, safe_int(query.get("page", ["1"])[0], 1))
            per_page = min(50, max(1, safe_int(query.get("per_page", ["5"])[0], 5)))
            pages = max(1, (total + per_page - 1) // per_page)
            page = min(page, pages)
            start = (page - 1) * per_page

            options = self.server.repository.get_options()
            self._json(
                {
                    "ok": True,
                    "items": activities[start : start + per_page],
                    "pagination": {"page": page, "per_page": per_page, "pages": pages, "total": total},
                    "filters": options,
                    "source": self.server.repository.source_label,
                }
            )
        except (RepositoryError, ValueError) as exc:
            self._error(str(exc), HTTPStatus.SERVICE_UNAVAILABLE)

    def _export_activities(self) -> None:
        try:
            filename, content = self.server.repository.export_activities()
            self._attachment(
                content,
                filename,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        except RepositoryError as exc:
            self._error(str(exc), HTTPStatus.SERVICE_UNAVAILABLE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Painel local B2B CTACUSTOS")
    parser.add_argument("--host", default=os.getenv("APP_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("APP_PORT", "8765")))
    parser.add_argument("--no-browser", action="store_true", help="Não abrir o navegador automaticamente")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        server = B2BServer((args.host, args.port), RequestHandler)
    except RepositoryError as exc:
        raise SystemExit(f"Configuração inválida: {exc}") from exc
    except OSError as exc:
        raise SystemExit(f"Não foi possível iniciar o aplicativo em {args.host}:{args.port}. A porta pode estar em uso: {exc}") from exc

    url = f"http://{args.host}:{args.port}"
    print(f"{APP_NAME} disponível em {url}")
    print(f"Fonte de dados: {server.repository.source_label}")
    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
