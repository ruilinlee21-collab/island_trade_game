"""Small localhost-only HTTP adapter for the same Python game engine."""

from http.server import HTTPServer
import errno
from threading import Timer
import webbrowser
from .web_handler import Handler


def serve(port: int, open_browser: bool = False, map_view: bool = False,
          shipyard: bool = False) -> None:
    if not 1 <= port <= 65535:
        raise ValueError("Port must be between 1 and 65535.")
    try:
        server = HTTPServer(("127.0.0.1", port), Handler)
    except OSError as exc:
        if exc.errno != errno.EADDRINUSE:
            raise
        # Another program uses the default port; ask the OS for a free local port.
        server = HTTPServer(("127.0.0.1", 0), Handler)
        print(f"Port {port} is busy; using another local port.")
    start = (f"/shipyard.html?view={'map' if map_view else 'harbor'}" if shipyard
             else "/map/" if map_view else "/")
    url = f"http://127.0.0.1:{server.server_port}{start}"
    print(f"Island Trade Tycoon: {url}", flush=True)
    print("Keep this terminal open while playing. Press Ctrl+C to stop.", flush=True)
    if open_browser:
        Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()
