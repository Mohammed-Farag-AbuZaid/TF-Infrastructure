// Data access + domain logic for TF News (ported from the Flutter app).
import oppsRaw from '../data/generated/opportunities.json';
import unisRaw from '../data/generated/universities.json';
import waysRaw from '../data/generated/ways.json';
import metaRaw from '../data/generated/meta.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Opportunity {
  id: string;
  section: string;
  title: string;
  shortDescription: string;
  aboutMarkdown: string;
  requirementsMarkdown: string;
  benefitsMarkdown: string;
  guidelinesMarkdown: string;
  startDate: string | null;
  deadline: string | null;
  category: string;
  topic: string;
  link: string;
  ratingCount: number;
  mustKnow: boolean;
}

export interface University {
  uniId: number;
  name: string;
  country: string;
  region: string;
  qsRank: number | null;
  qsRankText: string;
  website: string;
  researched: boolean;
  waysFound: number;
}

export interface Way {
  uniId: number;
  wayNo: number;
  title: string;
  provider: string;
  scope: string;
  coverage: string;
  markdown: string;
  sourceUrls: string[];
}

export const opportunities = oppsRaw as Opportunity[];
export const universities = unisRaw as University[];
export const ways = waysRaw as Way[];
export const dataMeta = metaRaw as { fetchedAt: string; opportunities: number; universities: number; ways: number };

export const isExternal = (w: Way) => w.scope === 'external_program';
export const isEgypt = (u: University) => u.country.trim().toLowerCase() === 'egypt';

export function websiteHost(u: University): string {
  const m = /^(?:https?:\/\/)?(?:www\.)?([^/:?#\s]+)/i.exec(u.website.trim());
  return m?.[1] ?? '';
}

export const universityById = new Map(universities.map((u) => [u.uniId, u]));

const waysByUni = new Map<number, Way[]>();
for (const w of ways) {
  const list = waysByUni.get(w.uniId);
  if (list) list.push(w);
  else waysByUni.set(w.uniId, [w]);
}

const coverageRank = (c: string) => (c === 'full' ? 0 : c === 'partial' ? 1 : 2);

export function sortWays(list: Way[]): Way[] {
  return [...list].sort((a, b) => coverageRank(a.coverage) - coverageRank(b.coverage) || a.wayNo - b.wayNo);
}

export function waysFor(uniId: number): Way[] {
  return sortWays(waysByUni.get(uniId) ?? []);
}

// ---------------------------------------------------------------------------
// Opportunity sections
// ---------------------------------------------------------------------------

export const MUST_KNOW = 'Must-know';
export const ALL_TOPICS = 'All Opportunities';
const SCIENCE = ['Mathematics', 'Physics', 'Computer Science', 'Biology', 'Chemistry', 'Sustainability'];

export interface Section {
  id: 'study' | 'activities' | 'internships' | 'programs';
  title: string;
  subtitle: string;
  route: string;
  categories: string[];
  topicsLabel: string;
  defaultTopics: string[];
  topicsByCategory: Record<string, string[]>;
}

export const SECTIONS: Section[] = [
  {
    id: 'study',
    title: 'Scholarships & Admissions',
    subtitle: 'Find your dream university, within Egypt and abroad',
    route: '/study',
    categories: ['All', 'Egypt', 'US', 'China', 'Europe', 'Other', MUST_KNOW],
    topicsLabel: 'Degree level',
    defaultTopics: ['Bachelor', 'Master', 'PhD'],
    topicsByCategory: {},
  },
  {
    id: 'activities',
    title: 'Extracurricular Activities',
    subtitle: 'Volunteering, competitions, clubs, teams, and everything beyond academics',
    route: '/activities',
    categories: ['All', 'Volunteering', 'Competitions', 'Clubs & teams', 'Hackathons', 'Events', 'Workshops', MUST_KNOW],
    topicsLabel: 'Topics',
    defaultTopics: ['STEM', 'Mathematics', 'Physics', 'Computer Science', 'Business', 'Science', 'Sustainability', 'Biology', 'Chemistry'],
    topicsByCategory: {
      Volunteering: ['Education', 'Environment', 'Health', 'Community'],
      'Clubs & teams': ['Debate', 'Model UN', 'Robotics', 'Arts'],
      Hackathons: ['Computer Science', 'Sustainability', 'Business', 'STEM'],
    },
  },
  {
    id: 'internships',
    title: 'Internships',
    subtitle: 'Real work experience',
    route: '/internships',
    categories: ['All', 'Egypt', 'Abroad', 'Remote', MUST_KNOW],
    topicsLabel: 'Topics',
    defaultTopics: ['Tech', 'Business', 'Science'],
    topicsByCategory: {},
  },
  {
    id: 'programs',
    title: 'Programs',
    subtitle: 'Research, exchange, leadership, and more',
    route: '/programs',
    categories: ['All', 'Research', 'Exchange', 'Leadership', MUST_KNOW],
    topicsLabel: 'Topics',
    defaultTopics: SCIENCE,
    topicsByCategory: {
      Research: SCIENCE,
      Exchange: ['Cultural', 'Academic', 'Language'],
      Leadership: ['Public speaking', 'Entrepreneurship', 'Civic engagement'],
    },
  },
];

export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id);

export function opportunitiesFor(sectionId: string): Opportunity[] {
  return opportunities.filter((o) => o.section === sectionId);
}

// ---------------------------------------------------------------------------
// Way markdown parsing (admissions_models.dart / way_page.dart)
// ---------------------------------------------------------------------------

export interface ParsedWay {
  intro: string;
  sections: Array<[string, string]>;
  applyUrl: string | null;
}

export function parseWayMarkdown(md: string): ParsedWay {
  const intro: string[] = [];
  const sections: Array<[string, string[]]> = [];
  let current: string[] | null = null;
  for (const line of md.split('\n')) {
    if (line.startsWith('# ')) continue;
    if (line.startsWith('## ')) {
      current = [];
      sections.push([line.slice(3).trim(), current]);
      continue;
    }
    if (current === null) intro.push(line);
    else current.push(line);
  }
  const out: Array<[string, string]> = sections.map(([k, v]) => [k, v.join('\n').trim()]);
  const apply = out.find(([k]) => k === 'Apply link')?.[1];
  const m = apply ? /https?:\/\/[^\s)>\]]+/.exec(apply) : null;
  return { intro: intro.join('\n').trim(), sections: out, applyUrl: m ? m[0] : null };
}

export interface RenderedWay {
  sections: Array<{ title: string; markdown: string }>;
  sources: Array<{ n: number; url: string; host: string }>;
}

export function hostOf(url: string): string {
  const m = /^https?:\/\/(?:www\.)?([^/?#\s]+)/i.exec(url);
  return m?.[1] ?? url;
}

/** Numbered-citation view of a way: each quote gets [n](url); duplicate passages are shown once. */
export function buildWayView(way: Way): RenderedWay {
  const parsed = parseWayMarkdown(way.markdown);
  const seen = new Set<string>();
  const urlIndex = new Map<string, number>();
  const out: Array<{ title: string; markdown: string }> = [];
  const sourceRx = /^Source:\s*(https?:\/\/\S+)\s*$/;

  for (const [title, body] of parsed.sections) {
    const passages: Array<{ quote: string; url: string | null }> = [];
    let buf: string[] = [];
    const flush = (url: string | null) => {
      if (buf.length) passages.push({ quote: buf.join('\n'), url });
      buf = [];
    };
    for (const raw of body.split('\n')) {
      const line = raw.trimEnd();
      const m = sourceRx.exec(line.trim());
      if (m) flush(m[1]);
      else if (line.trim()) buf.push(line);
    }
    flush(null);

    const parts: string[] = [];
    for (const p of passages) {
      const key = p.quote.replace(/[>\s]+/g, ' ').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      let q = p.quote;
      if (p.url) {
        if (!urlIndex.has(p.url)) urlIndex.set(p.url, urlIndex.size + 1);
        q = `${q} [${urlIndex.get(p.url)}](${p.url})`;
      }
      parts.push(q);
    }
    if (parts.length) out.push({ title, markdown: parts.join('\n\n') });
  }
  for (const u of way.sourceUrls) if (!urlIndex.has(u)) urlIndex.set(u, urlIndex.size + 1);
  const sources = [...urlIndex.entries()].map(([url, n]) => ({ n, url, host: hostOf(url) }));
  return { sections: out, sources };
}

// ---------------------------------------------------------------------------
// Regions, levels, fields, programs (admissions_programs.dart)
// ---------------------------------------------------------------------------

export const REGION_ORDER = ['MENA', 'Europe', 'Sub-Saharan Africa', 'Asia', 'North America', 'Latin America', 'Oceania'];

const MENA = new Set([
  'egypt', 'algeria', 'bahrain', 'iran', 'iraq', 'israel', 'jordan', 'kuwait', 'lebanon', 'libya', 'morocco', 'oman',
  'palestine', 'qatar', 'saudi arabia', 'syria', 'tunisia', 'turkey', 'türkiye', 'turkiye', 'united arab emirates', 'yemen',
]);

export function regionOf(u: University): string {
  const c = u.country.trim().toLowerCase();
  const r = u.region.trim().toLowerCase();
  if (MENA.has(c)) return 'MENA';
  if (r === 'africa') return 'Sub-Saharan Africa';
  if (r === 'americas') return c.includes('united states') || c === 'canada' ? 'North America' : 'Latin America';
  if (!r) return 'Other';
  return u.region.trim();
}

export const LEVELS = ['Bachelor', 'Master', 'PhD'];
export const FIELDS: Record<string, string[]> = {
  'Engineering & Tech': ['engineering', 'computer science', 'informatics', 'artificial intelligence', 'data science', 'software'],
  'Medicine & Health': ['medicine', 'medical', 'nursing', 'pharmacy', 'dentist', 'public health'],
  'Business & Economics': ['business', 'economics', 'finance', 'mba', 'entrepreneur'],
  'Natural Sciences': ['physics', 'chemistry', 'biology', 'mathematics', 'natural science', 'life science'],
  'Social Sciences & Law': ['law', 'politics', 'social science', 'public policy', 'international relations'],
  'Arts & Humanities': ['arts', 'humanities', 'history', 'literature', 'linguistics', 'architecture', 'design'],
};
const fieldRx = Object.entries(FIELDS).map(([k, v]) => [k, new RegExp(`\\b(?:${v.join('|')})`, 'i')] as const);
const bachelorRx = /bachelor|undergraduate|\bb\.?sc\b/i;
const masterRx = /\bmaster|postgraduate|\bm\.?sc\b/i;
const phdRx = /\bph\.?d\b|doctora/i;

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export interface ProgramEntry {
  uni: University;
  way: Way;
}

export interface Program {
  key: string;
  name: string;
  entries: ProgramEntry[];
  levels: string[];
  fields: string[];
  coverage: 'full' | 'partial' | 'unknown';
  regions: string[];
  countries: string[];
}

function buildPrograms(): Program[] {
  const groups = new Map<string, ProgramEntry[]>();
  const names = new Map<string, string>();
  for (const w of ways) {
    if (!isExternal(w)) continue;
    const u = universityById.get(w.uniId);
    if (!u) continue;
    const name = w.provider.trim() || w.title.trim();
    if (!name) continue;
    const key = slugify(name);
    if (!key) continue;
    if (!names.has(key)) names.set(key, name);
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    if (list.some((e) => e.uni.uniId === u.uniId && e.way.wayNo === w.wayNo)) continue;
    list.push({ uni: u, way: w });
  }
  const out: Program[] = [];
  for (const [key, entries] of groups) {
    entries.sort((a, b) => (a.uni.qsRank ?? 99999) - (b.uni.qsRank ?? 99999));
    const levels = new Set<string>();
    const fields = new Set<string>();
    for (const e of entries) {
      const p = parseWayMarkdown(e.way.markdown);
      const sec = (n: string) => p.sections.find(([k]) => k === n)?.[1] ?? '';
      const t = `${e.way.title} ${sec('Overview')} ${sec('Requirements')}`;
      if (bachelorRx.test(t)) levels.add('Bachelor');
      if (masterRx.test(t)) levels.add('Master');
      if (phdRx.test(t)) levels.add('PhD');
      for (const [f, rx] of fieldRx) if (rx.test(t)) fields.add(f);
    }
    const coverage = entries.some((e) => e.way.coverage === 'full')
      ? 'full'
      : entries.some((e) => e.way.coverage === 'partial')
        ? 'partial'
        : 'unknown';
    out.push({
      key,
      name: names.get(key)!,
      entries,
      levels: [...levels],
      fields: [...fields],
      coverage,
      regions: [...new Set(entries.map((e) => regionOf(e.uni)))],
      countries: [...new Set(entries.map((e) => e.uni.country))],
    });
  }
  return out.sort((a, b) => b.entries.length - a.entries.length);
}

export const programs: Program[] = buildPrograms();
export const programByKey = new Map(programs.map((p) => [p.key, p]));

// ---------------------------------------------------------------------------
// Open-count helper used at build time (client refreshes live)
// ---------------------------------------------------------------------------

export const qsLabel = (u: University) => (u.qsRankText ? `QS ${u.qsRankText}` : 'Unranked');
