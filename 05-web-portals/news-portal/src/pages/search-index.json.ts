import type { APIRoute } from 'astro';
import { opportunities, universities, programs } from '../lib/data';

export const GET: APIRoute = () => {
  const index = [
    ...opportunities.map((o) => ({
      t: o.title,
      u: `/opportunity/${o.id}`,
      k: 'Opportunity',
      x: [o.category, o.topic].filter(Boolean).join(' · '),
    })),
    ...programs.map((p) => ({
      t: p.name,
      u: `/admissions/program/${p.key}`,
      k: 'Program',
      x: `${p.entries.length} universities`,
    })),
    ...universities.map((u) => ({
      t: u.name,
      u: `/admissions/university/${u.uniId}`,
      k: 'University',
      x: u.country,
    })),
  ];
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
