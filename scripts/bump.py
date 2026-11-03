#!/usr/bin/env python3
"""Bump the ?v=N cache-busting query strings across the site together.

Browsers cache the ES modules by URL, so after changing any CSS or JS, run this
before deploying. Every reference moves to one new version number.

    python3 scripts/bump.py
"""
import pathlib
import re

SITE = pathlib.Path(__file__).resolve().parent.parent / "site"
FILES = [SITE / "index.html", SITE / "sheet.html", *sorted((SITE / "js").glob("*.js"))]
PATTERN = re.compile(r"(\.(?:js|css)\?v=)(\d+)")

current = max(int(m.group(2)) for f in FILES for m in PATTERN.finditer(f.read_text()))
new = current + 1
for f in FILES:
    text = f.read_text()
    updated = PATTERN.sub(lambda m: f"{m.group(1)}{new}", text)
    if updated != text:
        f.write_text(updated)
        print(f"{f.relative_to(SITE.parent)}: v={new}")
