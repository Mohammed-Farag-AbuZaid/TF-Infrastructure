import type { APIRoute } from 'astro';
import { opportunities, universities, programs, dataMeta } from '../lib/data';

const SITE = 'https://news.tfunions.com';
const CORE = [
  '/',
  '/directories',
  '/bulletins',
  '/must-know',
  '/study',
  '/study/universities',
  '/study/programs',
  '/activities',
  '/internships',
  '/programs',
];

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const GET: APIRoute = () => {
  const lastmod = new Date(dataMeta.fetchedAt).toISOString().slice(0, 10);
  const paths = [
    ...CORE,
    ...CORE.map((p) => (p === '/' ? '/ar/' : `/ar${p}`)),
    ...opportunities.map((o) => `/opportunity/${o.id}`),
    ...programs.map((p) => `/admissions/program/${p.key}`),
    ...universities.map((u) => `/admissions/university/${u.uniId}`),
  ];

  const urls = paths
    .map((p) => `  <url><loc>${escXml(`${SITE}${p}`)}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
