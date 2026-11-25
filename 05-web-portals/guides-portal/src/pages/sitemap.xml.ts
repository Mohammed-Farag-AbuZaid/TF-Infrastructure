import type { APIRoute } from 'astro';
import { ROADMAPS } from '../data/guides';

const SITE = 'https://guides.tfunions.com';

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const paths = ['/', ...ROADMAPS.map((g) => `/guides/${g.id}`)];
  const urls = paths.map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
