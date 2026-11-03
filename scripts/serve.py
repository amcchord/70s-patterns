#!/usr/bin/env python3
"""Local preview server for site/ that tells the browser never to cache.

Plain `python3 -m http.server` lets browsers reuse a module for a while after
it changes, so edits to the JS can seem not to take. Usage:

    python3 scripts/serve.py [port]    # default 8771
"""
import functools
import http.server
import pathlib
import sys

SITE = pathlib.Path(__file__).resolve().parent.parent / "site"


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8771
handler = functools.partial(NoCache, directory=str(SITE))
with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
    print(f"Serving {SITE} at http://127.0.0.1:{port}/")
    httpd.serve_forever()
