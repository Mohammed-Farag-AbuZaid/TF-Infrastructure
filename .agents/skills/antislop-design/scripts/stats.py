#!/usr/bin/env python3
"""Compute and optionally refresh the README statistics block."""
import argparse
import csv
from pathlib import Path

# Directories that hold generated artifacts, never documentation.
_EXCLUDED_PARTS = {".git", "__pycache__", "design-system", "design", "node_modules"}


def _excluded(path):
    return any(part in _EXCLUDED_PARTS for part in path.parts)

import re

ROOT = Path(__file__).resolve().parent.parent
MARKERS = ("<!-- stats:begin -->", "<!-- stats:end -->")


def compute(root=ROOT):
    root = Path(root)
    rows = lambda path: sum(1 for _ in csv.reader((root / path).open(encoding="utf-8"))) - 1
    values = [
        ("Skills", int((root / "SKILL.md").is_file()) + sum(1 for p in root.glob("*/SKILL.md") if p.is_file())),
        ("Markdown files", sum(1 for p in root.rglob("*.md") if not _excluded(p))),
        ("Reference files", sum(1 for p in (root / "references").glob("*.md") if not _excluded(p))),
        ("Reasoning rules", rows("ui-ux-pro-max/data/ui-reasoning.csv")),
        ("UI styles", rows("ui-ux-pro-max/data/styles.csv")),
        ("Color palettes", rows("ui-ux-pro-max/data/colors.csv")),
        ("Font pairings", rows("ui-ux-pro-max/data/typography.csv")),
        ("UX guidelines", rows("ui-ux-pro-max/data/ux-guidelines.csv")),
        ("Chart types", rows("ui-ux-pro-max/data/charts.csv")),
        ("Tech stacks", sum(1 for p in (root / "ui-ux-pro-max/data/stacks").glob("*.csv"))),
    ]
    return values


def block(root=ROOT):
    lines = ["| Metric | Value |", "| --- | ---: |"]
    lines.extend("| {} | {} |".format(label, value) for label, value in compute(root))
    return MARKERS[0] + "\n" + "\n".join(lines) + "\n" + MARKERS[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="refresh the README block")
    parser.add_argument("--readme", type=Path, default=ROOT / "README.md", help="README path (defaults to repository README)")
    parser.add_argument("--root", type=Path, default=ROOT, help="repository root used to compute values")
    args = parser.parse_args()
    generated = block(args.root)
    if not args.write:
        print(generated)
        return
    text = args.readme.read_text(encoding="utf-8")
    pattern = re.escape(MARKERS[0]) + r".*?" + re.escape(MARKERS[1])
    replacement, count = re.subn(pattern, lambda _: generated, text, count=1, flags=re.S)
    if not count:
        raise SystemExit("README missing stats markers")
    args.readme.write_text(replacement, encoding="utf-8")


if __name__ == "__main__":
    main()
