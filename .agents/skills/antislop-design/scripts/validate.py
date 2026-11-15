#!/usr/bin/env python3
"""Repository structural checks; intentionally uses only stdlib + optional PyYAML."""
import csv
import shlex
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from stats import block as stats_block, compute


def frontmatter(path):
    text = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\s*\n(.*?)\n---(?:\s*\n|$)", text, re.S)
    if not match:
        raise ValueError("missing opening/closing YAML frontmatter")
    raw = match.group(1)
    try:
        import yaml
        data = yaml.safe_load(raw) or {}
        return data, raw
    except ImportError:
        data, section = {}, None
        lines = raw.splitlines()
        i = 0
        while i < len(lines):
            line = lines[i]
            key = re.match(r"^(\w[\w-]*):\s*(.*)$", line)
            nested = re.match(r"^\s{2}([\w-]+):\s*(.*)$", line)
            if key:
                k, value = key.groups()
                section = k if not value else None
                if value in ("|", ">", "|-", ">-"):
                    chunks, i = [], i + 1
                    while i < len(lines) and (lines[i].startswith("  ") or not lines[i].strip()):
                        chunks.append(lines[i].strip())
                        i += 1
                    data[k] = " ".join(x for x in chunks if x)
                    continue
                data[k] = value.strip().strip("\"'")
            elif nested and section:
                k, value = nested.groups()
                if k == "references":
                    refs = []
                    i += 1
                    while i < len(lines):
                        item = re.match(r"^\s{4}-\s*(.+?)\s*$", lines[i])
                        if item:
                            refs.append(item.group(1).strip("\"'"))
                        elif lines[i].strip() and not lines[i].startswith("    "):
                            break
                        i += 1
                    data.setdefault(section, {})[k] = refs
                    continue
                data.setdefault(section, {})[k] = value.strip().strip("\"'")
            elif section == "metadata" and re.match(r"^\s{2}references:\s*$", line):
                data.setdefault("metadata", {})["references"] = []
            i += 1
        return data, raw


def check(name, failures):
    if failures:
        print("FAIL {}: {}".format(name, "; ".join(str(x) for x in failures)))
        return False
    print("PASS {}".format(name))
    return True


def run_check(results, name, fn):
    try:
        failures = fn()
    except Exception as exc:
        failures = ["{}: {}".format(type(exc).__name__, exc)]
    results.append(check(name, failures))


_PROBE_CACHE = {}


def get_probe():
    """Run the persist probe once and cache (out_dir, master_file)."""
    if not _PROBE_CACHE:
        out, master = persisted_probe()
        _PROBE_CACHE["out"] = out
        _PROBE_CACHE["master"] = master
    return _PROBE_CACHE


def persisted_probe():
    out = Path(tempfile.mkdtemp(prefix="persist-", dir="/tmp/opencode" if Path("/tmp/opencode").exists() else None))
    cmd = [sys.executable, str(ROOT / "ui-ux-pro-max/scripts/search.py"), "saas dashboard", "--design-system", "--persist", "-p", "ValidateProbe", "--page", "dashboard", "-o", str(out)]
    proc = subprocess.run(cmd, cwd=_probe_cwd(), capture_output=True, text=True, timeout=90)
    if proc.returncode:
        raise RuntimeError("persist probe exit {}: {}".format(proc.returncode, (proc.stdout + proc.stderr)[-1500:]))
    master = out / "design-system/validateprobe/MASTER.md"
    if not master.is_file():
        raise RuntimeError("persist probe did not create promised {}".format(master))
    return out, master


def _probe_cwd():
    """Isolated scratch dir so validation never writes into the repo."""
    import tempfile
    path = Path(tempfile.mkdtemp(prefix="antislop-validate-"))
    return str(path)


def main():
    results = []
    skills = sorted(([ROOT / "SKILL.md"] if (ROOT / "SKILL.md").is_file() else []) +
                    [p for p in ROOT.glob("*/SKILL.md") if p.is_file()])
    md_files = sorted(p for p in ROOT.rglob("*.md") if ".git" not in p.parts)

    failures = []
    parsed = {}
    for path in skills:
        try:
            data, _ = frontmatter(path)
            parsed[path] = data
            name, desc = data.get("name"), data.get("description")
            normalized_name = re.sub(r"[^a-z0-9]", "", name.lower()) if isinstance(name, str) else ""
            expected_name = re.sub(r"[^a-z0-9]", "", path.parent.name.lower())
            # The root skill's id is a publishing id; the repository name is not required to match it.
            name_matches = True if path.parent == ROOT else name == path.parent.name
            if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", name) or not name_matches:
                failures.append("{}: invalid/mismatched name {!r}".format(path.relative_to(ROOT), name))
            if not isinstance(desc, str) or len(desc.strip()) < 60:
                failures.append("{}: description must be at least 60 characters".format(path.relative_to(ROOT)))
            if isinstance(desc, str) and len(desc.strip()) > 1024:
                failures.append("{}: description exceeds the 1024-character platform limit".format(path.relative_to(ROOT)))
        except Exception as exc:
            failures.append("{}: {}".format(path.relative_to(ROOT), exc))
    results.append(check("1 FRONTMATTER SPEC", failures))

    failures = []
    for path, data in parsed.items():
        refs = ((data.get("metadata") or {}).get("references") or [])
        # The Agent Skills spec requires metadata to be string->string, so reference
        # lists are stored as a comma-separated string. Accept both forms.
        if isinstance(refs, str):
            refs = [part.strip() for part in refs.split(",") if part.strip()]
        elif isinstance(refs, list):
            pass
        for ref in refs:
            if isinstance(ref, dict):
                ref = ref.get("path", "")
            if not isinstance(ref, str) or not ((path.parent / ref).exists() or (ROOT / ref).exists()):
                failures.append("{}: missing reference {!r}".format(path.relative_to(ROOT), ref))
    results.append(check("2 REFERENCE INTEGRITY", failures))

    failures = []
    link_re = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
    for path in md_files:
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for target in link_re.findall(text):
            target = target.strip().split(maxsplit=1)[0].strip("<>")
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            parsed_url = urlsplit(target)
            local = unquote(parsed_url.path)
            if local and not (path.parent / local).exists():
                failures.append("{}: missing link target {!r}".format(path.relative_to(ROOT), target))
    results.append(check("3 LINK INTEGRITY", failures))

    retired = re.compile(
        r"steering/ui-ux-pro-max"
        r"|anti-ai-slop-ui-ux[\w/]*"
        r"|component-reference-design[\w/]*"
        r"|ui-ux-pro-max/(?:SKILL\.md|POST-FILTER\.md)"
        r"|POST-FILTER\.md")
    failures = []
    stale_targets = (list(ROOT.glob("*.md")) + list(ROOT.glob("references/*.md"))
                     + list(ROOT.glob("scripts/*.py")) + list(ROOT.glob("ui-ux-pro-max/scripts/*.py"))
                     + list(ROOT.glob(".github/workflows/*.yml")) + list(ROOT.glob(".github/workflows/*.yaml"))
                     + list(ROOT.glob("ui-ux-pro-max/data/*.csv")) + list(ROOT.glob("ui-ux-pro-max/data/stacks/*.csv")))
    for doc in stale_targets:
        if doc.name in ("README.md", "validate.py"):
            continue  # README documents the migration; validate.py holds this list
        for i, line in enumerate(doc.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            match = retired.search(line)
            if match:
                failures.append("{}:{} references retired path {!r}".format(
                    doc.relative_to(ROOT), i, match.group(0)))
    results.append(check("4 NO STALE PATHS", failures))

    failures = []
    codepath = re.compile(r"(?<![\w./-])(?:[\w.-]+/)+[\w.-]+\.(?:md|py|csv)")
    readme = ROOT / "README.md"
    if readme.exists():
        for line_no, line in enumerate(readme.read_text(encoding="utf-8").splitlines(), 1):
            for target in re.findall(r"`([^`]+)`", line):
                if " " not in target and not re.search(r"[*?\[\]{}]", target) and codepath.fullmatch(target):
                    if not (ROOT / target).exists():
                        failures.append("README.md:{} missing `{}`".format(line_no, target))
    results.append(check("5 NO BANNED-FILE-DRIFT", failures))

    labels = [label for label, _ in compute(ROOT)]
    failures = []
    if not readme.exists():
        failures.append("README.md missing")
    else:
        text = readme.read_text(encoding="utf-8")
        match = re.search(r"<!-- stats:begin -->(.*?)<!-- stats:end -->", text, re.S)
        if not match:
            print("FAIL 6 STATS SYNC: missing block; paste this exact block:\n{}".format(stats_block(ROOT)))
            results.append(False)
        else:
            found = {}
            table = match.group(1)
            if not re.search(r"(?m)^\s*\|\s*Metric\s*\|\s*Value\s*\|\s*$", table):
                failures.append("table header must be `| Metric | Value |`")
            for line in table.splitlines():
                m = re.match(r"\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$", line)
                if m and m.group(1).strip() != "Metric" and not set(m.group(2).strip()) <= set(":- "):
                    label, value = m.group(1).strip(), m.group(2).strip()
                    if label not in labels or not value.isdigit():
                        failures.append("invalid stats row {!r}: {!r}".format(label, value))
                    else:
                        if label in found:
                            failures.append("duplicate stats row {!r}".format(label))
                        found[label] = int(value)
            if set(found) != set(labels):
                failures.append("table must contain exactly these metric rows: {}".format(", ".join(labels)))
            for label, value in compute(ROOT):
                if found.get(label) != value:
                    failures.append("{}: expected {}, found {}".format(label, value, found.get(label)))
            results.append(check("6 STATS SYNC", failures))

    failures = []
    skill = ROOT / "SKILL.md"
    if skill.exists():
        text = skill.read_text(encoding="utf-8").casefold().replace("-", "").replace("_", "")
        research_text = (ROOT / "references/research.md").read_text(encoding="utf-8").casefold().replace("-", "").replace("_", "")
        for stack in sorted((ROOT / "ui-ux-pro-max/data/stacks").glob("*.csv")):
            slug = stack.stem.casefold().replace("-", "").replace("_", "")
            if slug not in text and slug not in research_text:
                failures.append("available stacks listing missing {}".format(stack.stem))
    results.append(check("7 STACK COVERAGE", failures))

    try:
        proc = subprocess.run([sys.executable, "ui-ux-pro-max/scripts/search.py", "saas dashboard", "--design-system"],
                              cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60, text=True)
        if proc.returncode or not proc.stdout.strip():
            failures = ["exit {}; output {}".format(proc.returncode, (proc.stdout + proc.stderr).strip()[:500])]
        else:
            failures = []
    except Exception as exc:
        failures = [str(exc)]
    results.append(check("8 TOOL SANITY", failures))

    allowlist = []
    allow_path = ROOT / "scripts/conflict-allowlist.txt"
    if allow_path.exists():
        allowlist = [line.strip() for line in allow_path.read_text(encoding="utf-8").splitlines()
                     if line.strip() and not line.lstrip().startswith("#")]
    banned = ("#6366F1", "indigo-500", "max-w-7xl", "hover:scale-105", "backdrop-blur-lg", "transition-all")
    allowed_words = ("❌", "BAN", "ban", "never", "Never", "avoid", "Avoid", "P0", "slop", "Slop", "→", "don't", "Don't", "instead", "Instead", "FAIL", "⚠", "OVERRIDE", "vendor", "Vendor", "substitut")
    # Reviewed exemptions: these files exist to *catalogue* banned values. Scanning them
    # for banned literals is a category error, so they are excluded rather than allowlisted.
    exempt_prefixes = ("references/slop-", "ui-ux-pro-max/data/")
    exempt_files = ("references/research.md", "README.md", "SKILL.md", "scripts/validate.py")
    failures = []
    for path in (p for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts and p.suffix not in (".pyc",)):
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith(exempt_prefixes) or rel in exempt_files or rel == "scripts/audit.py":
            continue
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except (UnicodeDecodeError, OSError):
            continue
        for line_no, line in enumerate(lines, 1):
            hits = [word for word in banned if word in line]
            if hits and not any(word in line for word in allowed_words) and not any(
                    entry.startswith(rel + ":") and entry.split(":", 1)[1] in line for entry in allowlist):
                failures.append("{}:{} {} | {}".format(rel, line_no, ", ".join(hits), line.strip()))
    results.append(check("9 CONFLICT GUARD", failures))

    # 10 RUBRIC INTEGRITY: the opt-in craft tier must keep the published weights.
    failures = []
    craft = ROOT / "references/awards-craft.md"
    if not craft.exists():
        failures.append("missing awards-craft.md")
    else:
        text = craft.read_text(encoding="utf-8")
        expected = {"Design": 40, "Usability": 30, "Creativity": 20, "Content": 10}
        row_re = re.compile(r"(?m)^\|\s*\*\*?([A-Za-z]+)\*\*?\s*\|\s*(\d{1,3})\b")
        found = {name: int(weight) for name, weight in row_re.findall(text)}
        if not found:
            failures.append("no rubric rows found (expected **Design** | 40 style rows)")
        else:
            if found != expected:
                failures.append("weights must be exactly {} (found {})".format(expected, found))
            if sum(found.values()) != 100:
                failures.append("weights must sum to 100 (found {})".format(sum(found.values())))
        for label in ("Hard gates", "prefers-reduced-motion", "OVERRIDE:"):
            if label not in text:
                failures.append("missing required section/term {!r}".format(label))
    results.append(check("10 RUBRIC INTEGRITY", failures))

    def csv_structure():
        problems = []
        csv_paths = sorted(set((ROOT / "ui-ux-pro-max/data").glob("*.csv")) | set((ROOT / "ui-ux-pro-max/data/stacks").glob("*.csv")))
        for path in csv_paths:
            with path.open(encoding="utf-8-sig", newline="") as stream:
                rows = list(csv.reader(stream, strict=True))
            if not rows:
                problems.append("{}: empty CSV".format(path.relative_to(ROOT)))
                continue
            width = len(rows[0])
            ids = [row[0] for row in rows[1:] if row]
            if any(len(row) != width for row in rows[1:]):
                problems.append("{}: row field count differs from header ({})".format(path.relative_to(ROOT), width))
            if len(ids) != len(set(ids)):
                problems.append("{}: duplicate first-column IDs".format(path.relative_to(ROOT)))
            sev_idx = None
            if rows and rows[0]:
                for i, name in enumerate(rows[0]):
                    if name.strip().lower() == "severity":
                        sev_idx = i
                        break
            for row in (rows[1:] if sev_idx is not None else []):
                if len(row) != width:
                    continue
                value = row[sev_idx].strip()
                if not value:
                    problems.append("{}: row {} has no severity".format(path.relative_to(ROOT), row[0]))
                elif value.lower() not in ("critical", "high", "medium", "low"):
                    problems.append("{}: severity column holds {!r}".format(path.relative_to(ROOT), value))
            nums = sorted(int(value) for value in ids if value.isdigit())
            if nums and nums != list(range(nums[0], nums[-1] + 1)):
                problems.append("{}: numeric ID gaps".format(path.relative_to(ROOT)))
            # a shifted row keeps the field count but moves content: the classic
            # signature is a cell that repeats another column's header name, or an
            # empty cell in a column the header declares.
            headers = [name.strip().casefold() for name in rows[0]]
            optional = {"docs url", "don't"}  # columns that may legitimately be blank
            for row in (r for r in rows[1:] if len(r) == width):
                for index, cell in enumerate(row):
                    value = cell.strip()
                    if not value:
                        if headers[index] not in optional:
                            problems.append("{}: row {} has an empty {!r} cell".format(
                                path.relative_to(ROOT), row[0], rows[0][index].strip()))
                        continue
                    lowered = value.casefold()
                    if lowered in headers and lowered != headers[index]:
                        problems.append("{}: row {} has header text {!r} in column {!r} (shifted?)".format(
                            path.relative_to(ROOT), row[0], value, rows[0][index].strip()))
        return problems
    run_check(results, "11 CSV STRUCTURE", csv_structure)

    def documented_cli():
        problems = []
        script = ROOT / "ui-ux-pro-max/scripts/search.py"
        source = script.read_text(encoding="utf-8")
        sys.path.insert(0, str(script.parent))
        try:
            from core import CSV_CONFIG, AVAILABLE_STACKS
            domain_choices, stack_choices = set(CSV_CONFIG), set(AVAILABLE_STACKS)
        finally:
            sys.path.pop(0)
        # the documented domain table must match argparse, not just the examples
        research_doc = ROOT / "references/research.md"
        skill_doc = ROOT / "SKILL.md"
        if research_doc.exists():
            research_text = research_doc.read_text(encoding="utf-8")
            section = re.search(r"(?s)### Available Domains(.*?)(?=\n### |\Z)", research_text)
            table_domains = set(re.findall(r"(?m)^\|\s*`([a-z-]+)`\s*\|", section.group(1))) if section else set()
            if table_domains != domain_choices:
                problems.append("domain table mismatch: documented {} vs CSV_CONFIG {}".format(sorted(table_domains), sorted(domain_choices)))
            stack_section = re.search(r"(?s)### Available Stacks(.*?)(?=\n### |\Z)", research_text)
            table_stacks = set(re.findall(r"(?m)^\|\s*`([a-z-]+)`\s*\|", stack_section.group(1))) if stack_section else set()
            if table_stacks != stack_choices:
                problems.append("stack table mismatch: documented {} vs AVAILABLE_STACKS {}".format(sorted(table_stacks), sorted(stack_choices)))

        # the brand-hue table must match the generator, and -p must not change the hue
        try:
            import importlib.util as _ilu
            spec = _ilu.spec_from_file_location("ds_mod", str(ROOT / "ui-ux-pro-max/scripts/design_system.py"))
            ds = _ilu.module_from_spec(spec); spec.loader.exec_module(ds)
            code_hues = {hue.upper() for _, hue in ds._DOMAIN_HUES} | {"#0F766E"}
            filter_doc = skill_doc.read_text(encoding="utf-8")
            palette = re.search(r"(?s)\| Product domain \| Brand hue \|(.*?)(?=\n\n|\Z)", filter_doc)
            table_hues = {h.upper() for h in re.findall(r"`(#[0-9A-Fa-f]{6})`", palette.group(1) if palette else "")}
            if not table_hues:
                problems.append("brand-hue table not found in SKILL.md")
            missing = code_hues - table_hues
            # the generator's money hue must be the Money row, not merely present somewhere
            money = re.search(r"Money, invoicing[^\n]*?(#[0-9A-Fa-f]{6})", palette.group(1) if palette else "")
            if not money:
                problems.append("palette table has no Money row to verify")
            catch_all = re.search(r"Anything not listed[^\n]*?(#[0-9A-Fa-f]{6})", palette.group(1) if palette else "")
            source = (ROOT / "ui-ux-pro-max/scripts/design_system.py").read_text(encoding="utf-8")
            fallback = re.search(r"def domain_hue[\s\S]*?return\s+\"(#[0-9A-Fa-f]{6})\"", source)
            if catch_all and fallback and catch_all.group(1).upper() != fallback.group(1).upper():
                problems.append("catch-all drift: table {} vs generator fallback {}".format(catch_all.group(1), fallback.group(1)))
            if not catch_all or not fallback:
                problems.append("cannot locate the catch-all hue in the table or the generator")
            proc = subprocess.run([sys.executable, str(script), "invoicing ledger", "--design-system"],
                                  cwd=_probe_cwd(), capture_output=True, text=True, timeout=60)
            found_money = re.search(r"Primary:\s+(#[0-9A-Fa-f]{6})", proc.stdout)
            if not found_money:
                problems.append("generator printed no Primary: line for the money query")
            if money and found_money and money.group(1).upper() != found_money.group(1).upper():
                problems.append("money hue drift: table {} vs generator {}".format(money.group(1), found_money.group(1)))
            if missing:
                problems.append("hue table out of sync: generator uses {} not documented in the filter".format(sorted(missing)))
            script = ROOT / "ui-ux-pro-max/scripts/search.py"
            outs = []
            for name in ("Alpha", "Omega"):
                proc = subprocess.run([sys.executable, str(script), "healthcare clinic", "--design-system", "-p", name],
                                      cwd=_probe_cwd(), capture_output=True, text=True, timeout=60)
                found = re.search(r"Primary:\s+(#[0-9A-Fa-f]{6})", proc.stdout)
                outs.append(found.group(1).upper() if found else "none")
            if len(set(outs)) != 1:
                problems.append("primary hue depends on -p: {} vs {}".format(outs[0], outs[1]))
            expected = "#0E7490"  # healthcare row of the filter table; hardcoded so a wrong mapping fails
            if outs[0] != expected:
                problems.append("primary hue does not follow the domain table: got {}, expected {}".format(outs[0], expected))
        except Exception as exc:
            problems.append("cannot verify hue table: {}".format(exc))

        for doc in (ROOT / "SKILL.md", ROOT / "references/research.md", ROOT / "README.md"):
            if not doc.exists():
                continue
            text = doc.read_text(encoding="utf-8")
            for line_no, line in enumerate(text.splitlines(), 1):
                if "search.py" not in line:
                    continue
                for value in re.findall(r"--domain\s+([\w-]+)", line):
                    if value not in domain_choices:
                        problems.append("{}:{} undocumented domain {}".format(doc.relative_to(ROOT), line_no, value))
                for value in re.findall(r"--stack\s+([\w-]+)", line):
                    if value not in stack_choices:
                        problems.append("{}:{} undocumented stack {}".format(doc.relative_to(ROOT), line_no, value))
                match = re.search(r"(?:python3?\s+)?(?:[\w./-]*search\.py\s+.+)", line)
                if match and not re.search(r"<[^>]+>", match.group(0)):
                    command = match.group(0).strip().strip("`")
                    command = re.sub(r"(?:[\w./-]*search\.py)", shlex.quote(str(script)), command, count=1)
                    try:
                        proc = subprocess.run(shlex.split(command), cwd=_probe_cwd(), capture_output=True, text=True, timeout=30)
                        if proc.returncode:
                            problems.append("{}:{} command exit {}: {}".format(doc.relative_to(ROOT), line_no, proc.returncode, (proc.stderr or proc.stdout)[:300]))
                    except Exception as exc:
                        problems.append("{}:{} {}".format(doc.relative_to(ROOT), line_no, exc))
        return problems
    run_check(results, "12 DOCUMENTED CLI TRUTH", documented_cli)

    probe = {}
    def persist_contract():
        failures = []
        cache = get_probe()
        out = cache["out"]
        produced = [str(p.relative_to(out)) for p in out.rglob("*") if p.is_file()]
        doc = (ROOT / "references/research.md").read_text(encoding="utf-8")
        promised = set(re.findall(r"design-system/[A-Za-z0-9._/<>-]+", doc))
        for rel in sorted(promised):
            clean = rel.rstrip(".,;:")
            if not clean or clean.endswith("design-system/"):
                continue
            # docs use placeholders such as <project-slug>: resolve them to the probe slug
            resolved = clean.replace("<project-slug>", "validateprobe").replace("<page-name>", "dashboard").replace("<page>", "dashboard")
            if any(ch in resolved for ch in "<>[]"):
                continue
            if not any(resolved in path for path in produced):
                failures.append("docs promise {!r} but the probe wrote {}".format(clean, produced))
        if not promised:
            failures.append("references/research.md names no persist path: the contract cannot be checked")
        if any(path.endswith("/design-system/MASTER.md") for path in produced):
            failures.append("legacy non-slugged design-system/MASTER.md was produced")
        return failures
    run_check(results, "13 PERSIST CONTRACT", persist_contract)

    def frontmatter_types():
        failures = []
        for path in skills:
            data, raw = frontmatter(path)
            metadata = data.get("metadata", {})
            if not isinstance(metadata, dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in metadata.items()):
                failures.append("{}: metadata must be string-to-string map".format(path.relative_to(ROOT)))
            if "yaml" not in sys.modules:
                section = re.search(r"(?ms)^metadata:\s*\n(.*?)(?=^\S|\Z)", raw)
                if section and (re.search(r"(?m)^\s*-", section.group(1)) or re.search(r"(?m)^\s*\w+:\s*\d{4}-\d\d-\d\d\s*$", section.group(1))):
                    failures.append("{}: fallback metadata list/date is not string-map safe".format(path.relative_to(ROOT)))
        return failures
    run_check(results, "14 FRONTMATTER TYPES", frontmatter_types)

    def toc_sync():
        import importlib.util
        spec = importlib.util.spec_from_file_location("toc_tool", str(ROOT / "scripts" / "toc.py"))
        toc_tool = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(toc_tool)
        failures = []
        for path in sorted((ROOT / "references").glob("*.md")):
            text = path.read_text(encoding="utf-8")
            heads = [ln for ln in text.splitlines() if ln.strip() == "## Contents"]
            if len(heads) != 1:
                failures.append("{}: expected exactly one ## Contents, found {}".format(path.relative_to(ROOT), len(heads)))
                continue
            if toc_tool.rebuild(text) != text:
                failures.append("{}: contents block is stale (run scripts/toc.py --write)".format(path.relative_to(ROOT)))
        return failures
    run_check(results, "15 TOC SYNC", toc_sync)

    def ban_voiding():
        findings = []
        for path in md_files:
            for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                hedges = re.compile(
                    r"bare minimum guidelines|improvise beyond what's documented|"
                    r"(?:rules?|guidelines?)\s+(?:are|is)\s+(?:advisory|optional|not mandatory)|"
                    r"not mandatory|may be skipped|feel free to ignore|use your (?:own )?judgement|"
                    r"guidelines,? not rules|"
                    r"(?:section|rule|guideline|checklist)[^.]*\boptional\b|"
                    r"\bskip (?:it|this|these)\b|best[- ]effort", re.I)
                if hedges.search(line) and "within the bans" not in line.casefold() and "nothing here overrides" not in line.casefold():
                    findings.append("{}:{} ban-voiding phrase".format(path.relative_to(ROOT), n))
        return findings
    run_check(results, "16 NO BAN-VOIDING CLAUSE", ban_voiding)

    def single_motion():
        failures = []
        for path in md_files:
            if path == ROOT / "SKILL.md":
                continue
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if "OVERRIDE" in line or "≤" in line:
                    continue
                if re.search(r"duration-(?:3(?:0[1-9]|[1-9]\d)|[4-9]\d\d|\d{4,})\b|\b(?:3(?:0[1-9]|[1-9]\d)|[4-9]\d\d|\d{4,})ms\b", line):
                    failures.append("{}:{} noncanonical duration".format(path.relative_to(ROOT), number))
        return failures
    run_check(results, "17 SINGLE MOTION CANON", single_motion)

    def single_skill_contract():
        failures = []
        if len(skills) != 1:
            failures.append("expected exactly one discovered SKILL.md, found {}".format(len(skills)))
        for path in skills:
            desc = str(parsed.get(path, {}).get("description", ""))
            if len(desc) < 60 or "not for" not in desc.casefold():
                failures.append("{}: description must be >=60 chars and contain Not for".format(path.relative_to(ROOT)))
            if not re.search(r"\bload\w*\b|\bbefore\b", desc, re.I):
                failures.append("{}: description must state a load trigger".format(path.relative_to(ROOT)))
        return failures
    run_check(results, "18 SINGLE SKILL CONTRACT", single_skill_contract)

    def readme_claim_sync():
        text = readme.read_text(encoding="utf-8")
        failures = []
        if "--write#" in text:
            failures.append("README.md contains --write# (missing shell-comment space)")
        if not re.search(r"(\d+)\s+structural", text, re.I):
            failures.append("README does not state the number of structural checks")
        rows = sum(1 for line in (ROOT / "references/slop-uiux-patterns.md").read_text(encoding="utf-8").splitlines()
                   if re.match(r"^\|\s*[A-Z]{1,3}\d+\s*\|", line))
        claimed = re.search(r"(\d+)\s+tell rows", text)
        skill_text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        skill_claim = re.search(r"(\d+)\s+tell rows", skill_text)
        if skill_claim and int(skill_claim.group(1)) != rows:
            failures.append("SKILL.md claims {} tell rows; the catalogue has {}".format(skill_claim.group(1), rows))
        if claimed and int(claimed.group(1)) != rows:
            failures.append("README claims {} tell rows; the catalogue has {}".format(claimed.group(1), rows))
        gates = sum(1 for line in (ROOT / "SKILL.md").read_text(encoding="utf-8").splitlines()
                    if re.match(r"^\|\s*[A-Z]{1,3}\d+\s*(?:/\s*[A-Z]{1,3}\d+)?\s*\|", line))
        kb = re.search(r"Ceiling:[^\n]*?(\d+)\s*KB", text)
        skill_kb = re.search(r"Ceiling:[^\n]*?(\d+)\s*KB", skill_text)
        divisor = re.search(r"([0-9.]+)\s*bytes? ≈ 1 token", text)
        skill_divisor = re.search(r"([0-9.]+)\s*bytes? ≈ 1 token", skill_text)
        if divisor and skill_divisor and divisor.group(1) != skill_divisor.group(1):
            failures.append("budget divisor differs: README {} vs SKILL.md {}".format(divisor.group(1), skill_divisor.group(1)))
        if kb and skill_kb and kb.group(1) != skill_kb.group(1):
            failures.append("budget ceiling differs: README {} KB vs SKILL.md {} KB".format(kb.group(1), skill_kb.group(1)))
        skill_text_c = skill_text
        words = {"one":1,"two":2,"three":3,"four":4,"five":5,"six":6,"seven":7,"eight":8}
        def number(value):
            value = (value or "").strip().lower()
            return int(value) if value.isdigit() else words.get(value)
        for label, pattern, token in (("a11y HIGH items", r"([\w]+)\s+a11y(?:/form)?\s+HIGH\s+items", "(HIGH"),
                                      ("code P0 items", r"([\w]+)\s+code\s+P0\s+items", "(P0")):
            readme_v = re.search(pattern, text)
            skill_v = re.search(pattern, skill_text)
            if not readme_v or not skill_v:
                failures.append("{} count not stated in README or SKILL.md".format(label))
                continue
            a, b = number(readme_v.group(1)), number(skill_v.group(1))
            if a is None or b is None:
                failures.append("{} count is not a number: README {!r} vs SKILL.md {!r}".format(label, readme_v.group(1), skill_v.group(1)))
            elif a != b:
                failures.append("{} differs: README {} vs SKILL.md {}".format(label, a, b))
            else:
                items = [line.strip().lower() for line in skill_text.splitlines()
                         if line.lstrip().startswith("- [ ]") and token in line]
                enumerated = len(items)
                if enumerated != b:
                    failures.append("{} declares {} but the audit enumerates {}".format(label, b, enumerated))
                elif len(set(items)) != enumerated:
                    failures.append("{} has duplicate audit items ({} lines, {} distinct)".format(label, enumerated, len(set(items))))
        claimed_gates = re.search(r"(\d+)\s+hard gates", text)
        if claimed_gates and int(claimed_gates.group(1)) != gates:
            failures.append("README claims {} hard gates; the table has {}".format(claimed_gates.group(1), gates))
        return failures
    run_check(results, "19 README CLAIM SYNC", readme_claim_sync)

    def generated_audit():
        master = get_probe()["master"]
        proc = subprocess.run([sys.executable, str(ROOT / "scripts/audit.py"), str(master)], capture_output=True, text=True, timeout=30)
        return [] if proc.returncode == 0 else ["audit exit {}: {}".format(proc.returncode, (proc.stdout + proc.stderr).strip())]
    run_check(results, "20 GENERATED ARTIFACT AUDIT", generated_audit)

    def suite_version():
        versions = {}
        for path, data in parsed.items():
            meta = data.get("metadata") or {}
            value = meta.get("suite_version") if isinstance(meta, dict) else None
            versions[path.relative_to(ROOT)] = value
        distinct = {v for v in versions.values()}
        if None in distinct:
            return ["missing metadata.suite_version in {}".format(
                ", ".join(str(k) for k, v in versions.items() if v is None))]
        if len(distinct) != 1:
            return ["suite_version disagrees: {}".format(versions)]
        version = next(iter(distinct))
        problems = []
        for path, data in parsed.items():
            meta = data.get("metadata") or {}
            declared = meta.get("version") if isinstance(meta, dict) else None
            if declared != version:
                problems.append("{}: metadata.version {!r} differs from suite_version {!r}".format(
                    path.relative_to(ROOT), declared, version))
            updated = meta.get("updated") if isinstance(meta, dict) else None
            if updated is not None and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(updated)):
                problems.append("{}: metadata.updated {!r} is not YYYY-MM-DD".format(
                    path.relative_to(ROOT), updated))
        if problems:
            return problems
        badge = re.search(r"suite%20([0-9][0-9.]*)-blue", readme.read_text(encoding="utf-8"))
        if not badge:
            return ["README badge does not state the suite version"]
        if badge.group(1) != version:
            return ["README badge says {} but metadata.suite_version is {}".format(badge.group(1), version)]
        return []
    run_check(results, "21 SUITE VERSION", suite_version)

    def referential_integrity():
        problems = []
        def names(path, col):
            rows = list(csv.reader(open(path, encoding="utf-8")))
            head = rows[0]
            idx = head.index(col)
            return rows, head, idx
        style_rows, style_head, style_idx = names(ROOT / "ui-ux-pro-max/data/styles.csv", "Style Category")
        known_styles = {r[style_idx] for r in style_rows[1:] if len(r) > style_idx}
        reason_rows, head, sp = names(ROOT / "ui-ux-pro-max/data/ui-reasoning.csv", "Style_Priority")
        for row in reason_rows[1:]:
            for part in [x.strip() for x in row[sp].split("+")]:
                if part and part not in known_styles:
                    problems.append("ui-reasoning.csv: unknown style {!r}".format(part))
        return problems
    run_check(results, "22 REFERENTIAL INTEGRITY", referential_integrity)

    def readme_check_count():
        text = readme.read_text(encoding="utf-8")
        match = re.search(r"(\d+)\s+structural", text, re.I)
        implemented = len(results) + 1
        if not match:
            return ["README does not state the number of structural checks"]
        if int(match.group(1)) != implemented:
            return ["README claims {} checks; implemented {}".format(match.group(1), implemented)]
        return []
    run_check(results, "23 README CHECK COUNT", readme_check_count)

    if "--json" in sys.argv:
        print(json.dumps({"passed": sum(results), "failed": len(results) - sum(results), "checks": len(results)}))
    raise SystemExit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
