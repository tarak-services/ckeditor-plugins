#!/usr/bin/env python3
"""Build overlay fonts with *designed* upright Computer Modern integrals.

Shearing the KaTeX Size1/Size2 ∫ outlines makes a stubby, thick sign and
leaves MathLive's italic-correction metrics (limit tucked left) looking
wrong. New Computer Modern Math ships real upright integrals in stylistic
set ss02, at the same optical sizes KaTeX uses:

  integral.up       — text style  (KaTeX_Size1, height 1111/1000em)
  integral.v1.up    — display     (KaTeX_Size2, height 2222/1000em)

This script downloads NewCMMath-Regular.otf if needed, remaps U+222B–U+222E
to those upright glyphs, and writes tiny overlay woff2 files.

Regenerate:
  setmaker/venv/bin/python ckeditor-plugins/scripts/build_upright_integrals.py
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

REPO = Path(__file__).resolve().parents[2]
CACHE = Path("/tmp/newcm/NewCMMath-Regular.otf")
NEWCM_URL = "https://mirrors.ctan.org/fonts/newcomputermodern/otf/NewCMMath-Regular.otf"
OUT_DIR = REPO / "setmaker/web/public/math-fonts"
PUBLIC_DIR = OUT_DIR

# cmap codepoint -> NewCM upright glyph (ss02), text vs display optical size
SIZE1_MAP = {  # KaTeX_Size1 / small-op
  0x222B: "integral.up",
  0x222C: "uni222C.up",
  0x222D: "uni222D.up",
  0x222E: "uni222E.up",
}
SIZE2_MAP = {  # KaTeX_Size2 / large-op
  0x222B: "integral.v1.up",
  0x222C: "uni222C.v1.up",
  0x222D: "uni222D.v1.up",
  0x222E: "uni222E.v1.up",
}

SOURCES = (
  ("KaTeX_UprightInt_Size1", SIZE1_MAP),
  ("KaTeX_UprightInt_Size2", SIZE2_MAP),
)


def _ensure_newcm() -> Path:
  if CACHE.exists() and CACHE.stat().st_size > 100_000:
    return CACHE
  CACHE.parent.mkdir(parents=True, exist_ok=True)
  print(f"downloading {NEWCM_URL}")
  urllib.request.urlretrieve(NEWCM_URL, CACHE)
  return CACHE


def _set_family_name(font: TTFont, family: str) -> None:
  name = font["name"]
  for rec in name.names:
    if rec.nameID in (1, 4, 6, 16):
      rec.string = family if rec.nameID != 6 else family.replace(" ", "")
    elif rec.nameID == 2:
      rec.string = "Regular"


def _remap_cmap(font: TTFont, mapping: dict[int, str]) -> None:
  for table in font["cmap"].tables:
    if not table.isUnicode():
      continue
    for cp, glyph in mapping.items():
      table.cmap[cp] = glyph


def build_one(family: str, mapping: dict[int, str], src: Path) -> Path:
  font = TTFont(src, recalcBBoxes=False)
  missing = [g for g in mapping.values() if g not in font.getGlyphOrder()]
  if missing:
    raise SystemExit(f"{family}: missing glyphs {missing}")

  _remap_cmap(font, mapping)

  options = Options()
  options.glyph_names = True
  options.layout_features = []
  options.notdef_outline = True
  subsetter = Subsetter(options=options)
  subsetter.populate(glyphs=[".notdef", "space", *mapping.values()])
  subsetter.subset(font)

  # Drop leftover layout tables so the overlay is just the glyphs.
  for tag in ("GSUB", "GPOS", "MATH", "GDEF"):
    if tag in font:
      del font[tag]

  _set_family_name(font, family)

  OUT_DIR.mkdir(parents=True, exist_ok=True)
  out_woff2 = OUT_DIR / f"{family}.woff2"
  font.flavor = "woff2"
  font.save(out_woff2)
  return out_woff2


def main() -> None:
  src = _ensure_newcm()
  PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
  for family, mapping in SOURCES:
    out = build_one(family, mapping, src)
    print(f"wrote {out}")


if __name__ == "__main__":
  main()
