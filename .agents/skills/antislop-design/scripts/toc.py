#!/usr/bin/env python3
"""Generate or verify the `## Contents` index of every reference file.

The index is derived from the headings, so it cannot silently lie: `--write`
rebuilds it, and validate.py compares the checked-in index against the computed
one. Plain-text entries (no links) keep the index greppable.
"""
import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEADING = re.compile(r"^(#{1,2})\s+(.+?)\s*$")
CONTENTS = "## Contents"


def reference_files(root=ROOT):
    return sorted((root / "references").glob("*.md"))


def remove_contents(lines):
    """Drop an existing Contents block (heading plus its list lines)."""
    out, i = [], 0
    while i < len(lines):
        if lines[i].strip() == CONTENTS:
            i += 1
            # skip only blank lines and list items: anything else is body text
            while i < len(lines) and (not lines[i].strip() or lines[i].lstrip().startswith(("-", "*"))):
                i += 1
            continue
        out.append(lines[i])
        i += 1
    return out


def entries(lines):
    """Section headings in order, excluding the document title and fenced code."""
    found, seen_first, fenced = [], False, False
    for line in lines:
        if line.lstrip().startswith("```"):
            fenced = not fenced
            continue
        if fenced:
            continue
        match = HEADING.match(line)
        if not match:
            continue
        title = match.group(2).strip()
        if title == "Contents":
            continue
        if not seen_first:
            seen_first = True
            if match.group(1) == "#":
                continue
        found.append(title)
    return found


def insertion_point(lines):
    """After frontmatter, the title and its companion / quality-bar lines."""
    start = 0
    if lines and lines[0].strip() == "---":
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                start = i + 1
                break
    if start >= len(lines) or not lines[start].startswith("# "):
        return start
    idx = start + 1
    while idx < len(lines) and not HEADING.match(lines[idx]):
        idx += 1
    while idx > 0 and not lines[idx - 1].strip():
        idx -= 1
    return idx


def rebuild(text):
    lines = remove_contents(text.splitlines())
    titles = entries(lines)
    if not titles:
        return text
    index = [CONTENTS, ""] + ["- {}".format(t) for t in titles]
    idx = insertion_point(lines)
    rest = list(lines[idx:])
    while rest and not rest[0].strip():
        rest.pop(0)
    out = lines[:idx] + ([""] if idx else []) + index + ([""] + rest if rest else [""])
    result = "\n".join(out)
    return result if result.endswith("\n") else result + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    root = Path(args.root)
    stale = 0
    for path in reference_files(root):
        original = path.read_text(encoding="utf-8")
        rebuilt = rebuild(original)
        if original == rebuilt:
            continue
        if args.write:
            path.write_text(rebuilt, encoding="utf-8")
            print("updated " + str(path.relative_to(root)))
        else:
            print("STALE   " + str(path.relative_to(root)))
            stale += 1
    raise SystemExit(1 if stale else 0)


if __name__ == "__main__":
    main()
