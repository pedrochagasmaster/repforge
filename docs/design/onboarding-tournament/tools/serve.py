#!/usr/bin/env python3
"""Serve the tournament harness (this folder only) with short fullscreen paths.

    python3 docs/design/onboarding-tournament/tools/serve.py [port]   # default 8190

  /                        the review page (index.html)
  /h                       H fullscreen at landing        -> /#h
  /h/rec-result            H fullscreen at a state        -> /#h/rec-result
  /h/rec-result?lang=en    options carry over            -> /#h/rec-result?lang=en
  /4/h, /r4/h              a leading round is accepted

Every candidate of every round (a–l) works the same way. Nothing above this
folder is served. To share it through a Cloudflare quick tunnel:

    cloudflared tunnel --url http://127.0.0.1:8190
"""
import functools
import http.server
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
SHORT = re.compile(r"^/(?:r?\d/)?([a-l])(?:/([a-z0-9-]+))?/?$", re.I)


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        m = SHORT.match(url.path)
        if m:
            target = "/#" + m.group(1).lower() + ("/" + m.group(2) if m.group(2) else "")
            if url.query:
                target += "?" + url.query
            self.send_response(302)
            self.send_header("Location", target)
            self.end_headers()
            return
        super().do_GET()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8190
    handler = functools.partial(Handler, directory=str(ROOT))
    http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
