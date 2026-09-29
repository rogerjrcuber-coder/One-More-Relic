"""Serve the local prototype using only Python's standard library."""
import argparse
import functools
import http.server
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Run One More Relic locally")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent

    class Handler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header("Cache-Control", "no-cache")
            self.send_header("X-Content-Type-Options", "nosniff")
            super().end_headers()

        def do_GET(self):
            if self.path.split("?", 1)[0] not in ("/", "/index.html", "/style.css", "/game.js", "/v11.js", "/favicon.ico"):
                self.send_error(404)
                return
            super().do_GET()

    with http.server.ThreadingHTTPServer(
        (args.host, args.port), functools.partial(Handler, directory=str(root))
    ) as server:
        print(f"One More Relic is ready at http://{args.host}:{args.port}", flush=True)
        print("Press Ctrl+C to stop. Saves stay in this browser at this address.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
