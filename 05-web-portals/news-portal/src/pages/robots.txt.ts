import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const body = `User-agent: *\nAllow: /\nSitemap: https://news.tfunions.com/sitemap.xml\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
