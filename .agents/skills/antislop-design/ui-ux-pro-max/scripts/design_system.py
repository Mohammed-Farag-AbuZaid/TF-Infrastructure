#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Design System Generator - Aggregates search results and applies reasoning
to generate comprehensive design system recommendations.

Usage:
    from design_system import generate_design_system
    result = generate_design_system("SaaS dashboard", "My Project")
    
    # With persistence (Master + Overrides pattern)
    result = generate_design_system("SaaS dashboard", "My Project", persist=True)
    result = generate_design_system("SaaS dashboard", "My Project", persist=True, page="dashboard")
"""

import csv
import json
import os
from datetime import datetime
from pathlib import Path

# --- Local compliance post-filter (see ../../references/research.md) ------------
# The vendor database is statistically averaged and can recommend values the
# suite bans. Substitutions happen here, in code, so generated artifacts are
# compliant by construction instead of by agent discipline.
import hashlib
import re as _re

_BANNED_ACCENT = _re.compile(
    r"^#(?:6366F1|818CF8|8B5CF6|7C3AED|A78BFA|4F46E5|C4B5FD|6D28D9|5B21B6|A855F7|7B61FF|E879F9)$", _re.I)
_BANNED_TINT = _re.compile(
    r"^#(?:E0E7FF|EEF2FF|FAF5FF|F5F3FF|EDE9FE|F3E8FF|DDD6FE|C7D2FE)$", _re.I)
_BANNED_TEXT = _re.compile(r"^#(?:1E1B4B|312E81|3730A3|4C1D95|2E1065|86198F)$", _re.I)
# Domain table, identical to the "Palette and type" table in SKILL.md.
_DOMAIN_HUES = [
    (("money", "invoicing", "invoice", "ledger", "productivity"), "#0F766E"),
    (("health", "healthcare", "clinical", "clinic", "wellness", "care"), "#0E7490"),
    (("safety", "urgency", "logistics", "alert", "alerts"), "#B45309"),
    (("agriculture", "agricultural", "farming", "farm", "environment", "sustainability", "sustainable", "climate"), "#3F6212"),
    (("enterprise", "legal", "infrastructure", "docs"), "#334155"),
    (("food", "hospitality", "craft", "heritage"), "#7F1D1D"),
    (("developer", "devtool", "tooling", "data", "ai"), "#4D7C0F"),
]
_ACCENT_HUES = ["#0F766E", "#B45309", "#3F6212", "#334155", "#7F1D1D", "#0E7490", "#4D7C0F"]
_NEUTRAL_BG = "#F8FAFC"
_NEUTRAL_TINT = "#E2E8F0"
_NEUTRAL_TEXT = "#0F172A"


def _luminance(hex_value):
    value = (hex_value or "").lstrip("#")
    if len(value) != 6:
        return 0.0
    try:
        channels = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    except ValueError:
        return 0.0
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast_ratio(a, b):
    la, lb = _luminance(a), _luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _readable_on(background):
    """Pick the higher-contrast of white and near-black; verify the result against C7."""
    white = contrast_ratio(background, "#FFFFFF")
    ink = contrast_ratio(background, "#0F172A")
    if ink > white:
        _note_override("OVERRIDE: button text white → #0F172A on {} [catalog C7]".format(background))
        return "#0F172A"
    return "#FFFFFF"


def _mix(hex_value, factor):
    """Scale a hex colour's channels; >1 lightens, <1 darkens."""
    value = (hex_value or "").lstrip("#")
    if len(value) != 6:
        return hex_value
    try:
        channels = [int(value[i:i + 2], 16) for i in (0, 2, 4)]
    except ValueError:
        return hex_value
    scaled = [max(0, min(255, round(c * factor))) for c in channels]
    return "#{:02X}{:02X}{:02X}".format(*scaled)


def _hover_shade(background, text):
    """Pick a hover background that keeps the button text at 4.5:1 or better."""
    for factor in (0.90, 0.82, 0.74, 1.12, 1.22):
        candidate = _mix(background, factor)
        if contrast_ratio(candidate, text) >= 4.5:
            return candidate
    return background


def _ensure_contrast(background, text):
    """Return a background that clears 4.5:1 against `text`, changing the background if needed."""
    if contrast_ratio(background, text) >= 4.5:
        return background, text
    for factor in (1.12, 1.22, 0.90, 0.82, 0.74, 1.35, 0.65):
        candidate = _mix(background, factor)
        if contrast_ratio(candidate, text) >= 4.5:
            return candidate, text
    flipped = "#FFFFFF" if text.upper() != "#FFFFFF" else "#0F172A"
    for factor in (1.0, 0.90, 0.82, 1.12, 0.74):
        candidate = _mix(background, factor)
        if contrast_ratio(candidate, flipped) >= 4.5:
            return candidate, flipped
    return background, text


def _seed_index(seed, size):
    digest = hashlib.sha256((seed or "default").encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % size


_FACE_EDITORIAL = ("editorial", "luxury", "culture", "museum", "portfolio", "art", "gallery", "heritage", "beauty", "spa", "wellness", "jewel")
_FACE_CONSUMER = ("playful", "consumer", "education", "school", "kid", "game", "gaming", "esport", "ecommerce", "commerce", "retail", "fashion", "food", "restaurant")


def category_face(query):
    """Display face from the filter's category table, keyed on the product itself."""
    q = " " + _re.sub(r"[^a-z0-9]+", " ", (query or "").lower()) + " "
    if any(" {} ".format(word) in q for word in _FACE_EDITORIAL):
        return "Fraunces"
    if any(" {} ".format(word) in q for word in _FACE_CONSUMER):
        return "Cabinet Grotesk"
    return "Bricolage Grotesque"


def domain_hue(query):
    """Deterministic hue from the filter's domain table; the catch-all is deep teal."""
    tokens = _re.sub(r"[^a-z0-9]+", " ", (query or "").lower()).split()
    for words, hue in _DOMAIN_HUES:
        # exact word first: "care" must not match "career", "ai" must not match "airline"
        if any(token in words for token in tokens):
            return hue
    return "#0F766E"


def post_filter_colors(colors, seed=""):
    """Replace vendor indigo/violet values with the filter's domain hue."""
    out = dict(colors or {})
    base = domain_hue(seed)
    idx = _seed_index(seed, len(_ACCENT_HUES))  # accents rotate with the product domain only
    rotations = [base, _ACCENT_HUES[(idx + 1) % len(_ACCENT_HUES)], _ACCENT_HUES[(idx + 2) % len(_ACCENT_HUES)]]
    # The filter's step 2 always decides the hue, so the primary is the domain hue
    # even when the vendor palette was not itself banned.
    if isinstance(out.get("primary"), str) and out["primary"].strip().upper() != base.upper():
        _note_override("OVERRIDE: vendor primary {} → {} [domain table]".format(out["primary"], base))
        out["primary"] = base
        if isinstance(out.get("notes"), str) and out["notes"].strip():
            out["notes"] = "Primary follows the product-domain table; secondary and CTA are inherited from the vendor row unless banned, and each is recorded when replaced."
    accent_roles = ("primary", "secondary", "cta")
    accent_i = 0
    for role, value in list(out.items()):
        if not isinstance(value, str):
            continue
        hexv = value.strip()
        if _BANNED_TINT.match(hexv):
            out[role] = _NEUTRAL_TINT if "border" in role else _NEUTRAL_BG
            _note_override("OVERRIDE: vendor {} tint {} → {} [catalog C1]".format(role, hexv, out[role]))
        elif _BANNED_TEXT.match(hexv):
            out[role] = _NEUTRAL_TEXT
            _note_override("OVERRIDE: vendor {} text {} → {} [catalog C7]".format(role, hexv, out[role]))
        elif _BANNED_ACCENT.match(hexv):
            if role in accent_roles:
                out[role] = rotations[accent_i % len(rotations)]
                _note_override("OVERRIDE: vendor {} {} → {} [catalog C1]".format(role, hexv, out[role]))
                accent_i += 1
            else:
                out[role] = _NEUTRAL_TINT
    return out


def post_filter_typography(typo, query=""):
    """Break Inter-everywhere, Playfair+Inter, and mono-as-display pairings."""
    out = dict(typo or {})
    out["_query"] = query
    heading = str(out.get("heading") or "")
    body = str(out.get("body") or "")
    bad_pairing = "playfair" in heading.lower() and body.strip().lower() == "inter"
    inter_only = heading.strip().lower() == "inter" and body.strip().lower() == "inter"
    # A single versatile family is legitimate (Plus Jakarta, IBM Plex) unless it is Inter/Geist.
    mono_display = bool(_re.search(r"(?:^|\s)(?:fira code|jetbrains mono|space mono|ibm plex mono|share tech mono|roboto mono|source code pro|courier|consolas)(?:$|\s)|mono$", heading.lower()))
    in_table = any(name in heading.lower() for name in ("fraunces", "bricolage", "cabinet grotesk"))
    if inter_only or bad_pairing or mono_display or not in_table:
        new_heading = category_face(out.get("_query", ""))
        out["heading"] = new_heading
        body_face = body if body and body.strip().lower() != "inter" else "Inter"
        out["google_fonts_url"] = (
            "https://fonts.google.com/share?selection.family="
            + new_heading.replace(" ", "+") + ":wght@400;600;700|" + body_face.replace(" ", "+") + ":wght@400;500"
        )
        out["css_import"] = (
            "@import url('https://fonts.googleapis.com/css2?"
            "family=" + new_heading.replace(" ", "+") + ":wght@400;600;700&family="
            + body_face.replace(" ", "+") + ":wght@400;500&display=swap');"
        )
        out["post_filter_note"] = "display pairing substituted (banned pairing or Inter-everywhere)"
        if inter_only:
            reason = "catalog T1"
        elif bad_pairing:
            reason = "catalog T11"
        elif mono_display:
            reason = "catalog T13"
        else:
            reason = "display table"
        _note_override("OVERRIDE: {} / {} → {} / {} [{}]".format(heading or "?", body or "?", new_heading, body or "Inter", reason))
    return out


def post_filter_style(style):
    """Drop the vendored Glassmorphism recommendation, keep the rest."""
    out = dict(style or {})
    name = str(out.get("name") or "")
    if "glassmorphism" in name.lower() or "liquid glass" in name.lower():
        cleaned = _re.sub(r"(?:glassmorphism|liquid glass)\s*\+?\s*", "", name, flags=_re.I).strip(" +")
        out["name"] = cleaned or "Flat Design"
        for key in ("keywords", "effects"):
            if key in out:
                out[key] = "flat surfaces, solid fills, clear borders, no blur or transparency"
        _note_override("OVERRIDE: Glassmorphism → {} [catalog K4]".format(out["name"]))
    return out
# ---------------------------------------------------------------------------

from core import search, DATA_DIR


# ============ CONFIGURATION ============
REASONING_FILE = "ui-reasoning.csv"

SEARCH_CONFIG = {
    "product": {"max_results": 1},
    "style": {"max_results": 3},
    "color": {"max_results": 2},
    "landing": {"max_results": 2},
    "typography": {"max_results": 2}
}


# ============ DESIGN SYSTEM GENERATOR ============
class DesignSystemGenerator:
    """Generates design system recommendations from aggregated searches."""

    def __init__(self):
        self.reasoning_data = self._load_reasoning()

    def _load_reasoning(self) -> list:
        """Load reasoning rules from CSV."""
        filepath = DATA_DIR / REASONING_FILE
        if not filepath.exists():
            return []
        with open(filepath, 'r', encoding='utf-8') as f:
            return list(csv.DictReader(f))

    def _multi_domain_search(self, query: str, style_priority: list = None) -> dict:
        """Execute searches across multiple domains."""
        results = {}
        for domain, config in SEARCH_CONFIG.items():
            if domain == "style" and style_priority:
                # For style, also search with priority keywords
                priority_query = " ".join(style_priority[:2]) if style_priority else query
                combined_query = f"{query} {priority_query}"
                results[domain] = search(combined_query, domain, config["max_results"])
            else:
                results[domain] = search(query, domain, config["max_results"])
        return results

    def _find_reasoning_rule(self, category: str) -> dict:
        """Find matching reasoning rule for a category."""
        category_lower = category.lower()

        # Try exact match first
        for rule in self.reasoning_data:
            if rule.get("UI_Category", "").lower() == category_lower:
                return rule

        # Try partial match
        for rule in self.reasoning_data:
            ui_cat = rule.get("UI_Category", "").lower()
            if ui_cat in category_lower or category_lower in ui_cat:
                return rule

        # Try keyword match
        for rule in self.reasoning_data:
            ui_cat = rule.get("UI_Category", "").lower()
            keywords = ui_cat.replace("/", " ").replace("-", " ").split()
            if any(kw in category_lower for kw in keywords):
                return rule

        return {}

    def _apply_reasoning(self, category: str, search_results: dict) -> dict:
        """Apply reasoning rules to search results."""
        rule = self._find_reasoning_rule(category)

        if not rule:
            return {
                "pattern": "Hero + Features + CTA",
                "style_priority": ["Minimalism", "Flat Design"],
                "color_mood": "Professional",
                "typography_mood": "Clean",
                "key_effects": "Subtle hover transitions",
                "anti_patterns": "",
                "decision_rules": {},
                "severity": "MEDIUM"
            }

        # Parse decision rules JSON
        decision_rules = {}
        try:
            decision_rules = json.loads(rule.get("Decision_Rules", "{}"))
        except json.JSONDecodeError:
            pass

        return {
            "pattern": rule.get("Recommended_Pattern", ""),
            "style_priority": [s.strip() for s in rule.get("Style_Priority", "").split("+")],
            "color_mood": rule.get("Color_Mood", ""),
            "typography_mood": rule.get("Typography_Mood", ""),
            "key_effects": rule.get("Key_Effects", ""),
            "anti_patterns": rule.get("Anti_Patterns", ""),
            "decision_rules": decision_rules,
            "severity": rule.get("Severity", "MEDIUM")
        }

    def _select_best_match(self, results: list, priority_keywords: list) -> dict:
        """Select best matching result based on priority keywords."""
        if not results:
            return {}

        if not priority_keywords:
            return results[0]

        # First: try exact style name match
        for priority in priority_keywords:
            priority_lower = priority.lower().strip()
            for result in results:
                style_name = result.get("Style Category", "").lower()
                if priority_lower in style_name or style_name in priority_lower:
                    return result

        # Second: score by keyword match in all fields
        scored = []
        for result in results:
            result_str = str(result).lower()
            score = 0
            for kw in priority_keywords:
                kw_lower = kw.lower().strip()
                # Higher score for style name match
                if kw_lower in result.get("Style Category", "").lower():
                    score += 10
                # Lower score for keyword field match
                elif kw_lower in result.get("Keywords", "").lower():
                    score += 3
                # Even lower for other field matches
                elif kw_lower in result_str:
                    score += 1
            scored.append((score, result))

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1] if scored and scored[0][0] > 0 else results[0]

    def _extract_results(self, search_result: dict) -> list:
        """Extract results list from search result dict."""
        return search_result.get("results", [])

    def generate(self, query: str, project_name: str = None) -> dict:
        """Generate complete design system recommendation."""
        # Step 1: First search product to get category
        product_result = search(query, "product", 1)
        product_results = product_result.get("results", [])
        category = "General"
        if product_results:
            category = product_results[0].get("Product Type", "General")

        # Step 2: Get reasoning rules for this category
        reasoning = self._apply_reasoning(category, {})
        style_priority = reasoning.get("style_priority", [])

        # Step 3: Multi-domain search with style priority hints
        search_results = self._multi_domain_search(query, style_priority)
        search_results["product"] = product_result  # Reuse product search

        # Step 4: Select best matches from each domain using priority
        style_results = self._extract_results(search_results.get("style", {}))
        color_results = self._extract_results(search_results.get("color", {}))
        typography_results = self._extract_results(search_results.get("typography", {}))
        landing_results = self._extract_results(search_results.get("landing", {}))

        best_style = self._select_best_match(style_results, reasoning.get("style_priority", []))
        best_color = color_results[0] if color_results else {}
        best_typography = typography_results[0] if typography_results else {}
        best_landing = landing_results[0] if landing_results else {}

        # Step 5: Build final recommendation
        # Combine effects from both reasoning and style search
        style_effects = best_style.get("Effects & Animation", "")
        reasoning_effects = reasoning.get("key_effects", "")
        combined_effects = style_effects if style_effects else reasoning_effects

        return {
            "project_name": project_name or query.upper(),
            "category": category,
            "pattern": {
                "name": best_landing.get("Pattern Name", reasoning.get("pattern", "Hero + Features + CTA")),
                "sections": best_landing.get("Section Order", "Hero > Features > CTA"),
                "cta_placement": best_landing.get("Primary CTA Placement", "Above fold"),
                "color_strategy": best_landing.get("Color Strategy", ""),
                "conversion": best_landing.get("Conversion Optimization", "")
            },
            "style": post_filter_style({
                "name": best_style.get("Style Category", "Minimalism"),
                "type": best_style.get("Type", "General"),
                "effects": style_effects,
                "keywords": best_style.get("Keywords", ""),
                "best_for": best_style.get("Best For", ""),
                "performance": best_style.get("Performance", ""),
                "accessibility": best_style.get("Accessibility", "")
            }),
            "colors": post_filter_colors({
                "primary": best_color.get("Primary (Hex)", "#2563EB"),
                "secondary": best_color.get("Secondary (Hex)", "#3B82F6"),
                "cta": best_color.get("CTA (Hex)", "#F97316"),
                "background": best_color.get("Background (Hex)", "#F8FAFC"),
                "text": best_color.get("Text (Hex)", "#1E293B"),
                "notes": best_color.get("Notes", "")
            }, seed=query),
            "typography": post_filter_typography({
                "heading": best_typography.get("Heading Font", "Inter"),
                "body": best_typography.get("Body Font", "Inter"),
                "mood": best_typography.get("Mood/Style Keywords", reasoning.get("typography_mood", "")),
                "best_for": best_typography.get("Best For", ""),
                "google_fonts_url": best_typography.get("Google Fonts URL", ""),
                "css_import": best_typography.get("CSS Import", "")
            }, query=query),
            "key_effects": combined_effects,
            "anti_patterns": reasoning.get("anti_patterns", ""),
            "decision_rules": reasoning.get("decision_rules", {}),
            "severity": reasoning.get("severity", "MEDIUM")
        }


# ============ OUTPUT FORMATTERS ============
BOX_WIDTH = 90  # Wider box for more content

def format_ascii_box(design_system: dict) -> str:
    """Format design system as ASCII box with emojis (MCP-style)."""
    project = design_system.get("project_name", "PROJECT")
    pattern = design_system.get("pattern", {})
    style = design_system.get("style", {})
    colors = design_system.get("colors", {})
    typography = design_system.get("typography", {})
    effects = design_system.get("key_effects", "")
    anti_patterns = design_system.get("anti_patterns", "")

    def wrap_text(text: str, prefix: str, width: int) -> list:
        """Wrap long text into multiple lines."""
        if not text:
            return []
        words = text.split()
        lines = []
        current_line = prefix
        for word in words:
            if len(current_line) + len(word) + 1 <= width - 2:
                current_line += (" " if current_line != prefix else "") + word
            else:
                if current_line != prefix:
                    lines.append(current_line)
                current_line = prefix + word
        if current_line != prefix:
            lines.append(current_line)
        return lines

    # Build sections from pattern
    sections = pattern.get("sections", "").split(">")
    sections = [s.strip() for s in sections if s.strip()]

    # Build output lines
    lines = []
    w = BOX_WIDTH - 1

    lines.append("+" + "-" * w + "+")
    lines.append(f"|  TARGET: {project} - RECOMMENDED DESIGN SYSTEM".ljust(BOX_WIDTH) + "|")
    lines.append("+" + "-" * w + "+")
    lines.append("|" + " " * BOX_WIDTH + "|")

    # Pattern section
    lines.append(f"|  PATTERN: {pattern.get('name', '')}".ljust(BOX_WIDTH) + "|")
    if pattern.get('conversion'):
        lines.append(f"|     Conversion: {pattern.get('conversion', '')}".ljust(BOX_WIDTH) + "|")
    if pattern.get('cta_placement'):
        lines.append(f"|     CTA: {pattern.get('cta_placement', '')}".ljust(BOX_WIDTH) + "|")
    lines.append("|     Sections:".ljust(BOX_WIDTH) + "|")
    for i, section in enumerate(sections, 1):
        lines.append(f"|       {i}. {section}".ljust(BOX_WIDTH) + "|")
    lines.append("|" + " " * BOX_WIDTH + "|")

    # Style section
    lines.append(f"|  STYLE: {style.get('name', '')}".ljust(BOX_WIDTH) + "|")
    if style.get("keywords"):
        for line in wrap_text(f"Keywords: {style.get('keywords', '')}", "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
    if style.get("best_for"):
        for line in wrap_text(f"Best For: {style.get('best_for', '')}", "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
    if style.get("performance") or style.get("accessibility"):
        perf_a11y = f"Performance: {style.get('performance', '')} | Accessibility: {style.get('accessibility', '')}"
        lines.append(f"|     {perf_a11y}".ljust(BOX_WIDTH) + "|")
    lines.append("|" + " " * BOX_WIDTH + "|")

    # Colors section
    lines.append("|  COLORS:".ljust(BOX_WIDTH) + "|")
    lines.append(f"|     Primary:    {colors.get('primary', '')}".ljust(BOX_WIDTH) + "|")
    lines.append(f"|     Secondary:  {colors.get('secondary', '')}".ljust(BOX_WIDTH) + "|")
    lines.append(f"|     CTA:        {colors.get('cta', '')}".ljust(BOX_WIDTH) + "|")
    lines.append(f"|     Background: {colors.get('background', '')}".ljust(BOX_WIDTH) + "|")
    lines.append(f"|     Text:       {colors.get('text', '')}".ljust(BOX_WIDTH) + "|")
    if colors.get("notes"):
        for line in wrap_text(f"Notes: {colors.get('notes', '')}", "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
    lines.append("|" + " " * BOX_WIDTH + "|")

    # Typography section
    lines.append(f"|  TYPOGRAPHY: {typography.get('heading', '')} / {typography.get('body', '')}".ljust(BOX_WIDTH) + "|")
    if typography.get("mood"):
        for line in wrap_text(f"Mood: {typography.get('mood', '')}", "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
    if typography.get("best_for"):
        for line in wrap_text(f"Best For: {typography.get('best_for', '')}", "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
    if typography.get("google_fonts_url"):
        lines.append(f"|     Google Fonts: {typography.get('google_fonts_url', '')}".ljust(BOX_WIDTH) + "|")
    if typography.get("css_import"):
        _import = typography.get('css_import', '')
        if len(_import) > 80:
            _import = _import[:77] + "..."
        lines.append(f"|     CSS Import: {_import}".ljust(BOX_WIDTH) + "|")
    lines.append("|" + " " * BOX_WIDTH + "|")

    # Key Effects section
    if effects:
        lines.append("|  KEY EFFECTS:".ljust(BOX_WIDTH) + "|")
        for line in wrap_text(effects, "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
        lines.append("|" + " " * BOX_WIDTH + "|")

    # Anti-patterns section
    if anti_patterns:
        lines.append("|  AVOID (Anti-patterns):".ljust(BOX_WIDTH) + "|")
        for line in wrap_text(anti_patterns, "|     ", BOX_WIDTH):
            lines.append(line.ljust(BOX_WIDTH) + "|")
        lines.append("|" + " " * BOX_WIDTH + "|")

    # Pre-Delivery Checklist section
    lines.append("|  PRE-DELIVERY CHECKLIST:".ljust(BOX_WIDTH) + "|")
    checklist_items = [
        "[ ] No emojis as icons (use SVG: Heroicons/Lucide)",
        "[ ] cursor-pointer on all clickable elements",
        "[ ] Hover timing follows the motion table in SKILL.md",
        "[ ] Light mode: text contrast 4.5:1 minimum",
        "[ ] Focus states visible for keyboard nav",
        "[ ] prefers-reduced-motion respected",
        "[ ] Responsive: 375px, 768px, 1024px, 1440px"
    ]
    for item in checklist_items:
        lines.append(f"|     {item}".ljust(BOX_WIDTH) + "|")
    lines.append("|" + " " * BOX_WIDTH + "|")

    lines.append("+" + "-" * w + "+")

    return "\n".join(lines)


def format_markdown(design_system: dict) -> str:
    """Format design system as markdown."""
    project = design_system.get("project_name", "PROJECT")
    pattern = design_system.get("pattern", {})
    style = design_system.get("style", {})
    colors = design_system.get("colors", {})
    typography = design_system.get("typography", {})
    effects = design_system.get("key_effects", "")
    anti_patterns = design_system.get("anti_patterns", "")

    lines = []
    lines.append(f"## Design System: {project}")
    lines.append("")

    # Pattern section
    lines.append("### Pattern")
    lines.append(f"- **Name:** {pattern.get('name', '')}")
    if pattern.get('conversion'):
        lines.append(f"- **Conversion Focus:** {pattern.get('conversion', '')}")
    if pattern.get('cta_placement'):
        lines.append(f"- **CTA Placement:** {pattern.get('cta_placement', '')}")
    if pattern.get('color_strategy'):
        lines.append(f"- **Color Strategy:** {sanitize_prose(pattern.get('color_strategy', ''))}")
    lines.append(f"- **Sections:** {pattern.get('sections', '')}")
    lines.append("")

    # Style section
    lines.append("### Style")
    lines.append(f"- **Name:** {style.get('name', '')}")
    if style.get('keywords'):
        lines.append(f"- **Keywords:** {style.get('keywords', '')}")
    if style.get('best_for'):
        lines.append(f"- **Best For:** {style.get('best_for', '')}")
    if style.get('performance') or style.get('accessibility'):
        lines.append(f"- **Performance:** {style.get('performance', '')} | **Accessibility:** {style.get('accessibility', '')}")
    lines.append("")

    # Colors section
    lines.append("### Colors")
    lines.append(f"| Role | Hex |")
    lines.append(f"|------|-----|")
    lines.append(f"| Primary | {colors.get('primary', '')} |")
    lines.append(f"| Secondary | {colors.get('secondary', '')} |")
    lines.append(f"| CTA | {colors.get('cta', '')} |")
    lines.append(f"| Background | {colors.get('background', '')} |")
    lines.append(f"| Text | {colors.get('text', '')} |")
    if colors.get("notes"):
        lines.append(f"\n*Notes: {colors.get('notes', '')}*")
    lines.append("")

    # Typography section
    lines.append("### Typography")
    lines.append(f"- **Heading:** {typography.get('heading', '')}")
    lines.append(f"- **Body:** {typography.get('body', '')}")
    if typography.get("mood"):
        lines.append(f"- **Mood:** {typography.get('mood', '')}")
    if typography.get("best_for"):
        lines.append(f"- **Best For:** {typography.get('best_for', '')}")
    if typography.get("google_fonts_url"):
        lines.append(f"- **Google Fonts:** {typography.get('google_fonts_url', '')}")
    if typography.get("css_import"):
        lines.append(f"- **CSS Import:**")
        lines.append(f"```css")
        lines.append(f"{typography.get('css_import', '')}")
        lines.append(f"```")
    lines.append("")

    # Key Effects section
    if effects:
        lines.append("### Key Effects")
        lines.append(f"{effects}")
        lines.append("")

    # Anti-patterns section
    if anti_patterns:
        lines.append("### Avoid (Anti-patterns)")
        newline_bullet = '\n- '
        lines.append(f"- {anti_patterns.replace(' + ', newline_bullet)}")
        lines.append("")

    # Pre-Delivery Checklist section
    lines.append("### Pre-Delivery Checklist")
    lines.append("- [ ] No emojis as icons (use SVG: Heroicons/Lucide)")
    lines.append("- [ ] cursor-pointer on all clickable elements")
    lines.append("- [ ] Hover timing follows the motion table in SKILL.md")
    lines.append("- [ ] Light mode: text contrast 4.5:1 minimum")
    lines.append("- [ ] Focus states visible for keyboard nav")
    lines.append("- [ ] prefers-reduced-motion respected")
    lines.append("- [ ] Responsive: 375px, 768px, 1024px, 1440px")
    lines.append("")

    return "\n".join(lines)


# ============ MAIN ENTRY POINT ============
def generate_design_system(query: str, project_name: str = None, output_format: str = "ascii", 
                           persist: bool = False, page: str = None, output_dir: str = None) -> str:
    """
    Main entry point for design system generation.

    Args:
        query: Search query (e.g., "SaaS dashboard", "e-commerce luxury")
        project_name: Optional project name for output header
        output_format: "ascii" (default) or "markdown"
        persist: If True, save design system to design-system/ folder
        page: Optional page name for page-specific override file
        output_dir: Optional output directory (defaults to current working directory)

    Returns:
        Formatted design system string
    """
    _OVERRIDES.clear()
    generator = DesignSystemGenerator()
    design_system = sanitize_result(generator.generate(query, project_name))
    
    # Persist to files if requested
    if persist:
        persist_design_system(design_system, page, output_dir, query)

    if output_format == "markdown":
        return format_markdown(design_system) + "\n".join(render_overrides(design_system))
    return format_ascii_box(design_system) + "\n".join(render_overrides(design_system))


# ============ PERSISTENCE FUNCTIONS ============
def persist_design_system(design_system: dict, page: str = None, output_dir: str = None, page_query: str = None) -> dict:
    """
    Persist design system to design-system/<project>/ folder using Master + Overrides pattern.
    
    Args:
        design_system: The generated design system dictionary
        page: Optional page name for page-specific override file
        output_dir: Optional output directory (defaults to current working directory)
        page_query: Optional query string for intelligent page override generation
    
    Returns:
        dict with created file paths and status
    """
    base_dir = Path(output_dir) if output_dir else Path.cwd()
    
    # Use project name for project-specific folder
    project_name = design_system.get("project_name", "default")
    project_slug = project_name.lower().replace(' ', '-')
    
    design_system_dir = base_dir / "design-system" / project_slug
    pages_dir = design_system_dir / "pages"
    
    created_files = []
    
    # Create directories
    design_system_dir.mkdir(parents=True, exist_ok=True)
    pages_dir.mkdir(parents=True, exist_ok=True)
    
    master_file = design_system_dir / "MASTER.md"

    # Build the page first so its substitutions land in the same ledger as MASTER's.
    page_file = page_content = None
    if page:
        page_file = pages_dir / f"{page.lower().replace(' ', '-')}.md"
        page_content = format_page_override_md(design_system, page, page_query)

    # Generate and write MASTER.md, then the page file, both with the full ledger
    master_content = format_master_md(design_system) + "\n".join(render_overrides(design_system))
    with open(master_file, 'w', encoding='utf-8') as f:
        f.write(master_content)
    created_files.append(str(master_file))

    if page_file is not None:
        with open(page_file, 'w', encoding='utf-8') as f:
            f.write(page_content + "\n".join(render_overrides(design_system)))
        created_files.append(str(page_file))
    
    return {
        "status": "success",
        "design_system_dir": str(design_system_dir),
        "created_files": created_files
    }


def format_master_md(design_system: dict) -> str:
    """Format design system as MASTER.md with hierarchical override logic."""
    project = design_system.get("project_name", "PROJECT")
    pattern = design_system.get("pattern", {})
    style = design_system.get("style", {})
    colors = design_system.get("colors", {})
    typography = design_system.get("typography", {})
    effects = design_system.get("key_effects", "")
    anti_patterns = design_system.get("anti_patterns", "")
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    lines = []
    
    # Logic header
    lines.append("# Design System Master File")
    lines.append("")
    lines.append("> **LOGIC:** When building a specific page, first check `design-system/<project-slug>/pages/[page-name].md`.")
    lines.append("> If that file exists, its rules **override** this Master file.")
    lines.append("> If not, strictly follow the rules below.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(f"**Project:** {project}")
    lines.append(f"**Generated:** {timestamp}")
    lines.append(f"**Category:** {design_system.get('category', 'General')}")
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # Global Rules section
    lines.append("## Global Rules")
    lines.append("")
    
    # Color Palette
    lines.append("### Color Palette")
    lines.append("")
    lines.append("| Role | Hex | CSS Variable |")
    lines.append("|------|-----|--------------|")
    lines.append(f"| Primary | `{colors.get('primary', '#2563EB')}` | `--color-primary` |")
    lines.append(f"| Secondary | `{colors.get('secondary', '#3B82F6')}` | `--color-secondary` |")
    lines.append(f"| CTA/Accent | `{colors.get('cta', '#F97316')}` | `--color-cta` |")
    lines.append(f"| Background | `{colors.get('background', '#F8FAFC')}` | `--color-background` |")
    lines.append(f"| Text | `{colors.get('text', '#1E293B')}` | `--color-text` |")
    lines.append("")
    if colors.get("notes"):
        lines.append(f"**Color Notes:** {colors.get('notes', '')}")
        lines.append("")
    
    # Typography
    lines.append("### Typography")
    lines.append("")
    lines.append(f"- **Heading Font:** {typography.get('heading', 'Inter')}")
    lines.append(f"- **Body Font:** {typography.get('body', 'Inter')}")
    if typography.get("mood"):
        lines.append(f"- **Mood:** {typography.get('mood', '')}")
    if typography.get("google_fonts_url"):
        lines.append(f"- **Google Fonts:** [{typography.get('heading', '')} + {typography.get('body', '')}]({typography.get('google_fonts_url', '')})")
    lines.append("")
    if typography.get("css_import"):
        lines.append("**CSS Import:**")
        lines.append("```css")
        lines.append(typography.get("css_import", ""))
        lines.append("```")
        lines.append("")
    
    # Spacing Variables
    lines.append("### Spacing Variables")
    lines.append("")
    lines.append("| Token | Value | Usage |")
    lines.append("|-------|-------|-------|")
    lines.append("| `--space-xs` | `4px` / `0.25rem` | Tight gaps |")
    lines.append("| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |")
    lines.append("| `--space-md` | `16px` / `1rem` | Standard padding |")
    lines.append("| `--space-lg` | `24px` / `1.5rem` | Section padding |")
    lines.append("| `--space-xl` | `32px` / `2rem` | Large gaps |")
    lines.append("| `--space-2xl` | `48px` / `3rem` | Section margins |")
    lines.append("| `--space-3xl` | `64px` / `4rem` | Hero padding |")
    lines.append("")
    
    # Shadow Depths
    lines.append("### Shadow Depths")
    lines.append("")
    lines.append("| Level | Value | Usage |")
    lines.append("|-------|-------|-------|")
    lines.append("| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |")
    lines.append("| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.08)` | Cards, buttons |")
    lines.append("| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.12)` | Modals, dropdowns |")
    lines.append("| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |")
    lines.append("")
    
    # Component Specs section
    lines.append("---")
    lines.append("")
    lines.append("## Component Specs")
    lines.append("")
    
    # Buttons
    lines.append("### Buttons")
    lines.append("")
    lines.append("```css")
    lines.append("/* Primary Button */")
    lines.append(".btn-primary {")
    cta = colors.get("cta", "#F97316")
    _text = _readable_on(cta)
    _cta, _text = _ensure_contrast(cta, _text)
    if _cta.upper() != cta.upper():
        _note_override("OVERRIDE: button background {} → {} for 4.5:1 [catalog C7]".format(cta, _cta))
    lines.append(f"  background: {_cta};")
    lines.append(f"  color: {_text};")
    lines.append("  padding: 12px 24px;")
    lines.append("  border-radius: 8px;")
    lines.append("  font-weight: 600;")
    lines.append("  transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease;")
    lines.append("  cursor: pointer;")
    lines.append("}")
    lines.append("")
    _hover = _hover_shade(_cta, _text)
    if _hover.upper() != _cta.upper():
        _note_override("OVERRIDE: hover background {} → {} [catalog C7]".format(_cta, _hover))
    lines.append(".btn-primary:hover {")
    lines.append("  background: {};".format(_hover))
    lines.append("  transform: translateY(-1px);")
    lines.append("}")
    lines.append("")
    lines.append("/* Secondary Button */")
    lines.append(".btn-secondary {")
    lines.append(f"  background: transparent;")
    lines.append(f"  color: {colors.get('primary', '#2563EB')};")
    lines.append(f"  border: 2px solid {colors.get('primary', '#2563EB')};")
    lines.append("  padding: 12px 24px;")
    lines.append("  border-radius: 8px;")
    lines.append("  font-weight: 600;")
    lines.append("  transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease;")
    lines.append("  cursor: pointer;")
    lines.append("}")
    lines.append("```")
    lines.append("")
    
    # Cards
    lines.append("### Cards")
    lines.append("")
    lines.append("```css")
    lines.append(".card {")
    lines.append(f"  background: {colors.get('background', '#FFFFFF')};")
    lines.append("  border-radius: 12px;")
    lines.append("  padding: 24px;")
    lines.append("  box-shadow: var(--shadow-md);")
    lines.append("  transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease;")
    lines.append("  cursor: pointer;")
    lines.append("}")
    lines.append("")
    lines.append(".card:hover {")
    lines.append("  box-shadow: var(--shadow-lg);")
    lines.append("  transform: translateY(-2px);")
    lines.append("}")
    lines.append("```")
    lines.append("")
    
    # Inputs
    lines.append("### Inputs")
    lines.append("")
    lines.append("```css")
    lines.append(".input {")
    lines.append("  padding: 12px 16px;")
    lines.append("  border: 1px solid #E2E8F0;")
    lines.append("  border-radius: 8px;")
    lines.append("  font-size: 16px;")
    lines.append("  transition: border-color 150ms ease;")
    lines.append("}")
    lines.append("")
    lines.append(".input:focus {")
    lines.append(f"  border-color: {colors.get('primary', '#2563EB')};")
    lines.append("  outline: none;")
    lines.append(f"  box-shadow: 0 0 0 3px {colors.get('primary', '#2563EB')}20;")
    lines.append("}")
    lines.append("```")
    lines.append("")
    
    # Modals
    lines.append("### Modals")
    lines.append("")
    lines.append("```css")
    lines.append(".modal-overlay {")
    lines.append("  background: rgba(0, 0, 0, 0.5);")
    lines.append("  background: rgba(15, 23, 42, 0.45);")
    lines.append("}")
    lines.append("")
    lines.append(".modal {")
    lines.append("  background: white;")
    lines.append("  border-radius: 16px;")
    lines.append("  padding: 32px;")
    lines.append("  box-shadow: var(--shadow-xl);")
    lines.append("  max-width: 500px;")
    lines.append("  width: 90%;")
    lines.append("}")
    lines.append("```")
    lines.append("")
    
    # Style section
    lines.append("---")
    lines.append("")
    lines.append("## Style Guidelines")
    lines.append("")
    lines.append(f"**Style:** {style.get('name', 'Minimalism')}")
    lines.append("")
    if style.get("keywords"):
        lines.append(f"**Keywords:** {style.get('keywords', '')}")
        lines.append("")
    if style.get("best_for"):
        lines.append(f"**Best For:** {style.get('best_for', '')}")
        lines.append("")
    if effects:
        lines.append(f"**Key Effects:** {effects}")
        lines.append("")
    
    # Layout Pattern
    lines.append("### Page Pattern")
    lines.append("")
    lines.append(f"**Pattern Name:** {pattern.get('name', '')}")
    lines.append("")
    if pattern.get('conversion'):
        lines.append(f"- **Conversion Strategy:** {pattern.get('conversion', '')}")
    if pattern.get('cta_placement'):
        lines.append(f"- **CTA Placement:** {pattern.get('cta_placement', '')}")
    lines.append(f"- **Section Order:** {pattern.get('sections', '')}")
    lines.append("")
    
    # Anti-Patterns section
    lines.append("---")
    lines.append("")
    lines.append("## Anti-Patterns (Do NOT Use)")
    lines.append("")
    if anti_patterns:
        anti_list = [a.strip() for a in anti_patterns.split("+")]
        for anti in anti_list:
            if anti:
                lines.append(f"- ❌ {anti}")
    lines.append("")
    lines.append("### Additional Forbidden Patterns")
    lines.append("")
    lines.append("- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)")
    lines.append("- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer")
    lines.append("- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout")
    lines.append("- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio")
    lines.append("- ❌ **Instant state changes** — Use purposeful transitions within the motion table in SKILL.md")
    lines.append("- ❌ **Invisible focus states** — Focus states must be visible for a11y")
    lines.append("")
    
    # Pre-Delivery Checklist
    lines.append("---")
    lines.append("")
    lines.append("## Pre-Delivery Checklist")
    lines.append("")
    lines.append("Before delivering any UI code, verify:")
    lines.append("")
    lines.append("- [ ] No emojis used as icons (use SVG instead)")
    lines.append("- [ ] All icons from consistent icon set (Heroicons/Lucide)")
    lines.append("- [ ] `cursor-pointer` on all clickable elements")
    lines.append("- [ ] Hover timing follows the motion table in SKILL.md")
    lines.append("- [ ] Light mode: text contrast 4.5:1 minimum")
    lines.append("- [ ] Focus states visible for keyboard navigation")
    lines.append("- [ ] `prefers-reduced-motion` respected")
    lines.append("- [ ] Responsive: 375px, 768px, 1024px, 1440px")
    lines.append("- [ ] No content hidden behind fixed navbars")
    lines.append("- [ ] No horizontal scroll on mobile")
    lines.append("")
    
    return "\n".join(lines)


def format_page_override_md(design_system: dict, page_name: str, page_query: str = None) -> str:
    """Format a page-specific override file with intelligent AI-generated content."""
    project = design_system.get("project_name", "PROJECT")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    page_title = page_name.replace("-", " ").replace("_", " ").title()
    
    # Detect page type and generate intelligent overrides
    page_overrides = _generate_intelligent_overrides(page_name, page_query, design_system)
    
    lines = []
    
    lines.append(f"# {page_title} Page Overrides")
    lines.append("")
    lines.append(f"> **PROJECT:** {project}")
    lines.append(f"> **Generated:** {timestamp}")
    lines.append(f"> **Page Type:** {page_overrides.get('page_type', 'General')}")
    lines.append("")
    lines.append("> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/<project-slug>/MASTER.md`).")
    lines.append("> Only deviations from the Master are documented here. For all other rules, refer to the Master.")
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # Page-specific rules with actual content
    lines.append("## Page-Specific Rules")
    lines.append("")
    
    # Layout Overrides
    lines.append("### Layout Overrides")
    lines.append("")
    layout = page_overrides.get("layout", {})
    if layout:
        for key, value in layout.items():
            lines.append(f"- **{key}:** {value}")
    else:
        lines.append("- No overrides — use Master layout")
    lines.append("")
    
    # Spacing Overrides
    lines.append("### Spacing Overrides")
    lines.append("")
    spacing = page_overrides.get("spacing", {})
    if spacing:
        for key, value in spacing.items():
            lines.append(f"- **{key}:** {value}")
    else:
        lines.append("- No overrides — use Master spacing")
    lines.append("")
    
    # Typography Overrides
    lines.append("### Typography Overrides")
    lines.append("")
    typography = page_overrides.get("typography", {})
    if typography:
        for key, value in typography.items():
            lines.append(f"- **{key}:** {value}")
    else:
        lines.append("- No overrides — use Master typography")
    lines.append("")
    
    # Color Overrides
    lines.append("### Color Overrides")
    lines.append("")
    colors = page_overrides.get("colors", {})
    if colors:
        for key, value in colors.items():
            lines.append(f"- **{key}:** {value}")
    else:
        lines.append("- No overrides — use Master colors")
    lines.append("")
    
    # Component Overrides
    lines.append("### Component Overrides")
    lines.append("")
    components = page_overrides.get("components", [])
    if components:
        for comp in components:
            lines.append(f"- {comp}")
    else:
        lines.append("- No overrides — use Master component specs")
    lines.append("")
    
    # Page-Specific Components
    lines.append("---")
    lines.append("")
    lines.append("## Page-Specific Components")
    lines.append("")
    unique_components = page_overrides.get("unique_components", [])
    if unique_components:
        for comp in unique_components:
            lines.append(f"- {comp}")
    else:
        lines.append("- No unique components for this page")
    lines.append("")
    
    # Recommendations
    lines.append("---")
    lines.append("")
    lines.append("## Recommendations")
    lines.append("")
    recommendations = page_overrides.get("recommendations", [])
    if recommendations:
        for rec in recommendations:
            lines.append(f"- {rec}")
    lines.append("")
    
    return "\n".join(lines)


def _generate_intelligent_overrides(page_name: str, page_query: str, design_system: dict) -> dict:
    """
    Generate intelligent overrides based on page type using layered search.
    
    Uses the existing search infrastructure to find relevant style, UX, and layout
    data instead of hardcoded page types.
    """
    from core import search
    
    page_lower = page_name.lower()
    query_lower = (page_query or "").lower()
    combined_context = f"{page_lower} {query_lower}"
    
    # Search across multiple domains for page-specific guidance
    style_search = search(combined_context, "style", max_results=1)
    ux_search = search(combined_context, "ux", max_results=3)
    landing_search = search(combined_context, "landing", max_results=1)
    
    # Extract results from search response
    style_results = style_search.get("results", [])
    ux_results = ux_search.get("results", [])
    landing_results = landing_search.get("results", [])
    
    # Detect page type from search results or context
    page_type = _detect_page_type(combined_context, style_results)
    
    # Build overrides from search results
    layout = {}
    spacing = {}
    typography = {}
    colors = {}
    components = []
    unique_components = []
    recommendations = []
    
    # Extract style-based overrides
    if style_results:
        style = style_results[0]
        style_name = style.get("Style Category", "")
        keywords = style.get("Keywords", "")
        best_for = style.get("Best For", "")
        effects = style.get("Effects & Animation", "")
        
        # Infer layout from style keywords
        if any(kw in keywords.lower() for kw in ["data", "dense", "dashboard", "grid"]):
            layout["Max Width"] = "1400px or full-width"
            layout["Grid"] = "12-column grid for data flexibility"
            spacing["Content Density"] = "High — optimize for information display"
        elif any(kw in keywords.lower() for kw in ["minimal", "simple", "clean", "single"]):
            layout["Max Width"] = "800px (narrow, focused)"
            layout["Layout"] = "Single column, centered"
            spacing["Content Density"] = "Low — focus on clarity"
        else:
            layout["Max Width"] = "1200px (standard)"
            layout["Layout"] = "Full-width sections, centered content"
        
        if effects:
            recommendations.append(f"Effects: {sanitize_prose(effects)}")
    
    # Extract UX guidelines as recommendations
    for ux in ux_results:
        category = ux.get("Category", "")
        do_text = ux.get("Do", "")
        dont_text = ux.get("Don't", "")
        if do_text:
            recommendations.append(f"{category}: {sanitize_prose(do_text)}")
        if dont_text:
            components.append(f"Avoid: {dont_text}")
    
    # Extract landing pattern info for section structure
    if landing_results:
        landing = landing_results[0]
        sections = landing.get("Section Order", "")
        cta_placement = landing.get("Primary CTA Placement", "")
        color_strategy = landing.get("Color Strategy", "")
        
        if sections:
            layout["Sections"] = sanitize_prose(sections)
        if cta_placement:
            recommendations.append(f"CTA Placement: {sanitize_prose(cta_placement)}")
        if color_strategy:
            colors["Strategy"] = sanitize_prose(color_strategy)
    
    # Add page-type specific defaults if no search results
    if not layout:
        layout["Max Width"] = "1200px"
        layout["Layout"] = "Responsive grid"
    
    if not recommendations:
        recommendations = [
            "Refer to MASTER.md for all design rules",
            "Add specific overrides as needed for this page"
        ]
    
    return {
        "page_type": page_type,
        "layout": layout,
        "spacing": spacing,
        "typography": typography,
        "colors": colors,
        "components": components,
        "unique_components": unique_components,
        "recommendations": recommendations
    }


def _detect_page_type(context: str, style_results: list) -> str:
    """Detect page type from context and search results."""
    context_lower = context.lower()
    
    # Check for common page type patterns
    page_patterns = [
        (["dashboard", "admin", "analytics", "data", "metrics", "stats", "monitor", "overview"], "Dashboard / Data View"),
        (["checkout", "payment", "cart", "purchase", "order", "billing"], "Checkout / Payment"),
        (["settings", "profile", "account", "preferences", "config"], "Settings / Profile"),
        (["landing", "marketing", "homepage", "hero", "home", "promo"], "Landing / Marketing"),
        (["login", "signin", "signup", "register", "auth", "password"], "Authentication"),
        (["pricing", "plans", "subscription", "tiers", "packages"], "Pricing / Plans"),
        (["blog", "article", "post", "news", "content", "story"], "Blog / Article"),
        (["product", "item", "detail", "pdp", "shop", "store"], "Product Detail"),
        (["search", "results", "browse", "filter", "catalog", "list"], "Search Results"),
        (["empty", "404", "error", "not found", "zero"], "Empty State"),
    ]
    
    for keywords, page_type in page_patterns:
        if any(kw in context_lower for kw in keywords):
            return page_type
    
    # Fallback: try to infer from style results
    if style_results:
        style_name = style_results[0].get("Style Category", "").lower()
        best_for = style_results[0].get("Best For", "").lower()
        
        if "dashboard" in best_for or "data" in best_for:
            return "Dashboard / Data View"
        elif "landing" in best_for or "marketing" in best_for:
            return "Landing / Marketing"
    
    return "General"



# --- Semantic post-filter: prose columns and override ledger ----------------
_PROSE_SUBS = [
    (r"glassmorphism", "solid surfaces"),
    (r"frosted glass[^.,;]*", "solid surface"),
    (r"backdrop[- ]blur(?:\s*\([^)]*\))?[^.,;]*", "solid surface"),
    (r"neon glow", "flat accent"),
    (r"streaming text", "progressive text update"),
    (r"blurred background", "solid background"),
    (r"\btranslucent\b", "opaque"),
    (r"backdrop[- ]filter[^.,;]*", "solid surface"),
    (r"\bglass\b(?!morphism)", "solid surface"),
    (r"light source|light reflection|Z-depth", "flat surface"),
    (r"hover\s*\((?:(?:100|150|200|250|300|350|400)-\d+ms)\)", "hover (100-150ms)"),
    (r"hover[^.,;]*\((?:2[5-9]\d|[3-9]\d\d)ms\)", "hover (100-150ms)"),
    (r"minimum glow[^.,;]*|minimal glow[^.,;]*", "flat accents only"),
    (r"\b(?:50|100|150|200|300|400|500|600)-(?:100|150|200|250|300|400|500|600|700)ms\b", "150-250ms"),
    (r"parallax(?:\s*\([^)]*\))?[^.,;]*", "scroll-linked reveal"),
    (r"Client Logos", "Customer proof (omit if not supplied)"),
    (r"(?:3-5 )?testimonials", "customer evidence (omit if not supplied)"),
    (r"social proof[^.,;]*", "customer evidence (omit if not supplied)"),
    (r"waitlist (?:count|number)[^.,;]*", "sign-up count (omit if not supplied)"),
    (r"sponsors?", "partners (omit if not supplied)"),
    (r"aggregate rating[^.,;]*", "rating (omit if not supplied)"),
    (r"individual reviews?", "customer quotes (omit if not supplied)"),
    (r"include ratings?[^.,;]*", "omit ratings unless supplied"),
    (r"trust signals?[^.,;]*", "supplied evidence only"),
    (r"join [\d,]+ readers", "state the audience only if supplied"),
    (r"show (?:verified )?purchases?", "omit purchase proof unless supplied"),
    (r"member count[^.,;]*", "omit community figures unless supplied"),
    (r"posts today", "omit activity figures unless supplied"),
    (r"include photo \+ name \+ role", "omit customer details unless supplied"),
    (r"subscriber count[^.,;]*", "omit subscriber figures unless supplied"),
    (r"ratings? \(4\.5\+?[^)]*\)", "omit ratings unless supplied"),
    (r"verified badge[^.,;]*", "omit verification cues unless accounts are verified"),
    (r"member photos?[^.,;]*", "omit member imagery unless supplied"),
    (r"review sentiment[^.,;]*", "omit sentiment mapping unless supplied"),
    (r"indigo primary", "brand primary"),
    (r"purple tech", "brand accent"),
    (r"\b(?:indigo|violet|purple|lavender)\b", "brand"),
    (r"\b(?:200-300ms|300-400ms)\b", "150-250ms"),
]
_OVERRIDES = []


def _note_override(message):
    if message not in _OVERRIDES:
        _OVERRIDES.append(message)


def sanitize_prose(text):
    """Remove banned concepts from vendor prose columns and record the override."""
    if not isinstance(text, str) or not text:
        return text
    out = text
    for pattern, replacement in _PROSE_SUBS:
        new = _re.sub(pattern, replacement, out, flags=_re.I)
        if new != out:
            _note_override("OVERRIDE: vendor prose \"{}\" → \"{}\" [prose]".format(
                _re.search(pattern, out, _re.I).group(0), replacement))
            out = new
    return out


_PROOF_WORDS = _re.compile(r"\b(?:proof|metric|metrics|results?|badges?|credibility|credentials?|guarantee|rating|ratings|review|reviews|testimonial|testimonials|sponsor|sponsors|logos?|trust|verified|certificates?|recognition|stats?|statistics?|awards?)\b", _re.I)
_PROOF_REPLACEMENT = "customer evidence the user supplied (omit otherwise)"


def sanitize_proof_items(text):
    """Replace every comma-separated clause that talks about proof."""
    if not isinstance(text, str) or not text:
        return text
    items = [item.strip() for item in text.split(",")]
    changed = False
    for i, item in enumerate(items):
        if _PROOF_WORDS.search(item):
            items[i] = _PROOF_REPLACEMENT
            changed = True
    if not changed:
        return text
    _note_override("OVERRIDE: vendor proof language → {} [prose]".format(_PROOF_REPLACEMENT))
    return ", ".join(dict.fromkeys(items))


def sanitize_result(design_system):
    """Apply the semantic post-filter to every prose-bearing field."""
    for section, keys in (("style", ("effects", "keywords", "best_for")),
                          ("colors", ("notes",)),
                          ("typography", ("mood", "best_for")),
                          ("pattern", ("name", "conversion", "sections", "cta_placement", "color_strategy"))):
        block = design_system.get(section)
        if isinstance(block, dict):
            for key in keys:
                if key in block:
                    block[key] = sanitize_prose(block[key])
    for section, keys in (("pattern", ("conversion", "sections", "color_strategy", "cta_placement")),
                          ("style", ("keywords", "effects", "best_for")),
                          ("typography", ("best_for",))):
        block = design_system.get(section)
        if isinstance(block, dict):
            for key in keys:
                if isinstance(block.get(key), str):
                    block[key] = sanitize_proof_items(block[key])

    pattern_block = design_system.get("pattern")
    if isinstance(pattern_block, dict) and isinstance(pattern_block.get("conversion"), str):
        conversion = pattern_block["conversion"]
        cleaned = _re.sub(r"\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?x\b", "a measured result (supply the figure)", conversion)
        if cleaned != conversion:
            _note_override("OVERRIDE: vendor conversion metric → a measured result [prose]")
            pattern_block["conversion"] = cleaned
    for key in ("key_effects",):
        if key in design_system:
            value = design_system.get(key)
            design_system[key] = sanitize_proof_items(sanitize_prose(value) or "") or value
    # anti_patterns is a list of things to AVOID: rewriting it would invert its polarity
    for key in ("keywords", "effects", "accessibility", "performance"):
        block = design_system.get("style")
        if isinstance(block, dict) and key in block:
            block[key] = sanitize_prose(block[key])
    design_system["overrides"] = list(_OVERRIDES)
    return design_system


def render_overrides(design_system):
    """Lines describing every substitution, so the ledger reaches the artifact."""
    overrides = list(_OVERRIDES) or list(design_system.get("overrides") or [])
    if not overrides:
        return []
    return ["", "## Post-filter overrides", ""] + ["- {}".format(o) for o in overrides] + [""]
# ---------------------------------------------------------------------------

# ============ CLI SUPPORT ============
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate Design System")
    parser.add_argument("query", help="Search query (e.g., 'SaaS dashboard')")
    parser.add_argument("--project-name", "-p", type=str, default=None, help="Project name")
    parser.add_argument("--format", "-f", choices=["ascii", "markdown"], default="ascii", help="Output format")

    args = parser.parse_args()

    result = generate_design_system(args.query, args.project_name, args.format)
    print(result)
