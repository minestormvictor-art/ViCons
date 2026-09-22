#!/usr/bin/env python3
"""ViCons — 靜態投放包產生器（GitHub ＋ Cloudflare Drop 共用）

產出：
  _cf_drop/vicons/                  可直接 Browse folders 上傳的目錄
  _cf_drop/vicons-cloudflare.zip    index.html 在 zip 根，拖去 cloudflare.com/drop 即用

設計要點：
  · 只收「原型真的載入的檔案」——index.html 內 src= / href= 相對路徑所列者
  · 用 zipfile 逐檔寫入（不用 `zip -r 資料夾`），保證 index.html 在根、斜線為正斜線
  · _headers 一併放根，供 Cloudflare Pages 套用安全標頭

用法：
    python build-drop.py
    python build-drop.py --check      # 只驗證來源引用是否存在，不產包
"""
from __future__ import annotations

import argparse
import re
import sys
import zipfile
from pathlib import Path

# Windows cp950 / legacy consoles cannot print ✓ — force UTF-8 when possible.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = Path(__file__).resolve().parent
ENTRY = "index.html"
DROP_DIR = HERE / "_cf_drop" / "vicons"
DROP_ZIP = HERE / "_cf_drop" / "vicons-cloudflare.zip"

HEADERS = """/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()

/app/*
  Cache-Control: public, max-age=3600

/tokens/*
  Cache-Control: public, max-age=3600
"""


def referenced(html: str) -> list[str]:
    """抽出 index.html 內相對的 src= / href=（略過 #錨點、http(s)、data:）"""
    out: list[str] = []
    for attr in ("src", "href"):
        for m in re.finditer(r'%s="([^"]+)"' % attr, html):
            v = m.group(1).strip()
            if not v or v.startswith(("#", "http://", "https://", "data:", "mailto:", "//")):
                continue
            out.append(v)
    # 去重且保序
    seen: set[str] = set()
    return [p for p in out if not (p in seen or seen.add(p))]


def collect() -> list[str]:
    """回傳要打包的相對路徑（含 index.html 與 _headers 在根）"""
    entry = HERE / ENTRY
    if not entry.is_file():
        sys.exit("✗ 找唔到 %s" % ENTRY)
    html = entry.read_text(encoding="utf-8")
    files = [ENTRY]
    missing: list[str] = []
    for rel in referenced(html):
        if (HERE / rel).is_file():
            files.append(rel)
        else:
            missing.append(rel)
    if missing:
        sys.exit("✗ index.html 引用了不存在的檔案：\n    " + "\n    ".join(missing))
    # 補上 app/ 與 tokens/ 內未被 index.html 直接引用者（例如未來新增的 view）
    for sub in ("app", "tokens"):
        for p in sorted((HERE / sub).rglob("*")):
            if p.is_file():
                rel = p.relative_to(HERE).as_posix()
                if rel not in files:
                    files.append(rel)
    return files


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只驗證引用，不產包")
    args = ap.parse_args()

    files = collect()
    print("── 收集到 %d 個檔案 ──" % len(files))
    if args.check:
        for f in files:
            print("   ·", f)
        print("\n✓ 引用完整性 OK（index.html 內所有相對路徑都存在）")
        return 0

    # 1. 目錄（供 Browse folders）
    DROP_DIR.mkdir(parents=True, exist_ok=True)
    for rel in files:
        dst = DROP_DIR / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes((HERE / rel).read_bytes())
    (DROP_DIR / "_headers").write_text(HEADERS, encoding="utf-8", newline="\n")

    # 2. zip（index.html 與 _headers 在根）
    DROP_ZIP.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(DROP_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in files:
            z.write(HERE / rel, arcname=rel)          # arcname 用正斜線，無前綴
        z.writestr("_headers", HEADERS)
        # 明確標記由 Python 產生（Windows 打包器會寫反斜線路徑，CF 會拒收）
        for info in z.infolist():
            info.create_system = 3                     # 3 = Unix
            info.external_attr = 0o644 << 16

    entries = len(zipfile.ZipFile(DROP_ZIP).namelist())
    print("\n── 產物 ──")
    print("   目錄：%s" % DROP_DIR)
    print("   zip ：%s（%s B，%d entries）" % (DROP_ZIP, f"{DROP_ZIP.stat().st_size:,}", entries))
    print("   入口：index.html 在 zip 根 ✓")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
