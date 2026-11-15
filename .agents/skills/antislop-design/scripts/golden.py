#!/usr/bin/env python3
"""Semantic snapshot test: the generator's filtered output must not drift.

Structural checks (validate.py) prove the documents agree with each other. This
script proves the *behaviour* agrees with the documents: it runs the research
tool on fixed queries, strips the only non-deterministic field (the generation
timestamp), and compares the result with the committed golden files.

Three stdout fixtures cover the ASCII and markdown views; one persist fixture
covers the artifacts written to disk (MASTER.md plus a page override), including
the OVERRIDE ledger and the button CSS that carries the contrast guarantees.

    python3 scripts/golden.py           # verify (CI)
    python3 scripts/golden.py --write   # regenerate after an intended change
"""
import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GOLDEN_DIR = ROOT / "tests" / "golden"
SEARCH = ROOT / "ui-ux-pro-max" / "scripts" / "search.py"

FIXTURES = [
    # slug, query, project, extra flags, kind
    ("money", "invoicing ledger phone payment", "MoneyApp", ["--design-system"], "stdout"),
    ("health", "healthcare clinic wellness", "HealthApp", ["--design-system"], "stdout"),
    ("dashboard", "saas analytics dashboard", "DashApp", ["--design-system", "-f", "markdown"], "stdout"),
    ("master", "healthcare clinic wellness", "HealthApp", [], "persist"),
    ("page", "saas analytics dashboard", "DashApp", [], "persist-page"),
]

TIMESTAMP = re.compile(r"^.*\*\*Generated:\*\*.*$", re.M)


def _call(args):
    proc = subprocess.run(
        [sys.executable, str(SEARCH)] + args,
        cwd=str(ROOT), capture_output=True, text=True, timeout=120,
    )
    if proc.returncode:
        raise RuntimeError("search.py failed for {!r}: {}".format(
            args, (proc.stdout + proc.stderr)[-800:]))
    return proc.stdout


def capture(query, project, flags, kind):
    if kind == "stdout":
        return _call([query, "-p", project] + flags)

    with tempfile.TemporaryDirectory(prefix="antislop-golden-") as tmp:
        args = [query, "-p", project, "--design-system", "--persist", "-o", tmp]
        if kind == "persist-page":
            args += ["--page", "landing"]
        _call(args)
        produced = sorted(Path(tmp).rglob("*.md"))
        if not produced:
            raise RuntimeError("persist produced no markdown for {!r}".format(query))
        chunks = []
        for path in produced:
            chunks.append("===== {} =====\n{}".format(
                path.relative_to(tmp).as_posix(), path.read_text(encoding="utf-8")))
        return "\n".join(chunks)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    failures = []
    for slug, query, project, flags, kind in FIXTURES:
        current = TIMESTAMP.sub("**Generated:** <timestamp>", capture(query, project, flags, kind))
        path = GOLDEN_DIR / (slug + ".txt")
        if args.write or not path.exists():
            path.write_text(current, encoding="utf-8")
            print("wrote {}".format(path.relative_to(ROOT)))
            continue
        expected = path.read_text(encoding="utf-8")
        if expected != current:
            failures.append(slug)
            print("DRIFT {} ({} lines expected, {} now)".format(
                slug, len(expected.splitlines()), len(current.splitlines())))
    if failures:
        print("golden output drifted: {}. Re-run with --write only if the change is intended.".format(
            ", ".join(failures)))
        raise SystemExit(1)
    print("golden: {} fixtures match".format(len(FIXTURES)))


if __name__ == "__main__":
    main()
