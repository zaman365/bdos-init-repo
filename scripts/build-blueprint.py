#!/usr/bin/env python3
"""Wrap the canonical blueprint (bdos-ecosystem.html, authored as an Artifact
fragment) into a standalone page at site/blueprint/index.html.

Run this after editing bdos-ecosystem.html, then commit both:
    python3 scripts/build-blueprint.py

The route is protected by Cloudflare Access; the noindex meta and the
/blueprint rule in site/_headers are belt-and-braces on top of that.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "bdos-ecosystem.html"
OUT = ROOT / "site" / "blueprint" / "index.html"

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
.internal-bar{
  position:sticky; top:0; z-index:99; display:flex; flex-wrap:wrap; gap:4px 14px;
  align-items:baseline; justify-content:space-between;
  background:#FFC24B; color:#0A0C0B; padding:7px 28px;
  font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:11px;
  letter-spacing:.14em; text-transform:uppercase;
}
.internal-bar a{color:#0A0C0B}
</style>
"""

BAR = """<div class="internal-bar">
  <span>Internal &middot; not for distribution</span>
  <span>BDOS ecosystem blueprint &middot; <a href="/">bdos.io</a></span>
</div>
"""


def main() -> int:
    if not SRC.exists():
        print(f"missing source: {SRC}", file=sys.stderr)
        return 1
    body = SRC.read_text(encoding="utf-8")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(f"{HEAD}</head>\n<body>\n{BAR}{body}\n</body>\n</html>\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
