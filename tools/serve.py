#!/usr/bin/env python3
"""로컬 QA 서버 — 브라우저가 ES 모듈을 휴리스틱 캐시하지 않도록 no-store로 서빙한다."""
import http.server
import functools

class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

if __name__ == "__main__":
    import os
    root = os.path.join(os.path.dirname(__file__), "..")
    handler = functools.partial(NoStoreHandler, directory=root)
    http.server.ThreadingHTTPServer(("127.0.0.1", 4173), handler).serve_forever()
