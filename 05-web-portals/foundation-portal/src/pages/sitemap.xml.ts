import type { APIRoute } from 'astro';

const SITE = 'https://www.tfunions.com';
const PATHS = [
  '/',
  '/ar/',
  '/about',
  '/charter',
  '/commitments',
  '/desk',
  '/divisions',
  '/ideas',
  '/ideas-submit',
  '/photos-submit',
  '/privacy',
  '/roster',
  '/support',
  '/support-receipt',
  '/team',
  '/transparency',
  '/volunteer',
  '/volunteer-apply',
];

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = PATHS.map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
