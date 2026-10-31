"""HTTP request handler for the local browser game."""

from http.server import BaseHTTPRequestHandler
import json
from pathlib import Path
from urllib.parse import urlparse
from .game import Game
from .errors import GameError
from .ship import validate_ship_style

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
WEB_MAP = WEB / "map"
SAVE = ROOT / "savegame.json"


class Handler(BaseHTTPRequestHandler):
    game = Game()

    def _json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/state":
            self._json(self.game.public_state()); return
        if path == "/map":
            self.send_response(302)
            self.send_header("Location", "/map/")
            self.end_headers()
            return
        directory = WEB_MAP if path.startswith("/map/") else WEB
        filename = (path.removeprefix("/map/") or "index.html") if directory == WEB_MAP else ("index.html" if path == "/" else path.lstrip("/"))
        file = (directory / filename).resolve()
        if not file.is_relative_to(directory) or not file.is_file():
            self.send_error(404); return
        mime = {".html": "text/html", ".css": "text/css", ".js": "text/javascript",
                ".png": "image/png", ".svg": "image/svg+xml"}.get(file.suffix, "application/octet-stream")
        data = file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime + ("; charset=utf-8" if mime.startswith("text") else ""))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/action":
            self.send_error(404); return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 4096:
                raise GameError("Invalid request size.")
            request = json.loads(self.rfile.read(length))
            action = request.get("action")
            if action == "new":
                self.__class__.game = Game(ship_style=validate_ship_style(request.get("ship_style")))
                message = "A new voyage begins!"
            elif action == "style":
                message = self.game.customize_ship(request.get("ship_style"))
            elif action == "load":
                self.__class__.game = Game.load(SAVE); message = "Saved voyage loaded."
            elif action == "save":
                self.game.save(SAVE); message = "Voyage saved."
            elif action in ("buy", "sell"):
                message = getattr(self.game, action)(request.get("good"), request.get("quantity"))
            elif action == "travel":
                message = self.game.travel(request.get("destination"))
            elif action == "wait":
                message = self.game.wait()
            elif action == "upgrade":
                message = self.game.upgrade()
            elif action == "contract":
                message = self.game.accept_contract()
            else:
                raise GameError("Unknown action.")
            self._json({"ok": True, "message": message, "state": self.game.public_state()})
        except (GameError, ValueError, TypeError, json.JSONDecodeError) as exc:
            self._json({"ok": False, "message": str(exc), "state": self.game.public_state()}, 400)


