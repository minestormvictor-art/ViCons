#!/usr/bin/env python3
"""ViCons 設計原型 — 本地預覽伺服器

原型只用相對路徑（無 ES module、無 fetch），file:// 直接開也可以。
起這個 server 只是為了讓預覽面板能以 http 開啟，並避免某些瀏覽器
對 file:// 的 CSS/JS 載入限制。

    python serve.py            # → http://127.0.0.1:4190/
    python serve.py --port N
"""
from __future__ import annotations

import argparse
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if args and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("  %s\n" % (fmt % args))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=4190)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()

    handler = partial(Handler, directory=str(HERE))
    httpd = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"+  ViCons 設計原型   http://{args.host}:{args.port}/")
    print("   9 個畫面以頂部「原型導覽」列切換")
    print("   (Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n   stopped")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
