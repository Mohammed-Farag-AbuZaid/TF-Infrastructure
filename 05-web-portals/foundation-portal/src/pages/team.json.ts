import type { APIRoute } from 'astro';
import teamData from '../data/team-nodes.json';

type RawMember = (typeof teamData)[number] & {
  arabicName?: string;
  school?: string;
  grade?: string;
  cohortDate?: string;
  cohortLabel?: string;
  startDate?: string;
  endDate?: string;
  replacedBy?: string;
  replaces?: string;
  bio?: string;
  parent?: string;
  hub?: string;
};

export function toPublicMember(m: RawMember) {
  const startDate = m.startDate ?? m.cohortDate ?? '2026-11';
  const endDate = m.endDate ?? '';
  return {
    id: m.id,
    name: m.name,
    arabicName: m.arabicName ?? '',
    role: m.role,
    team: m.team,
    tier: m.tier,
    school: m.school ?? 'TF Unions',
    grade: m.grade ?? '',
    cohortDate: startDate,
    startDate,
    endDate,
    status: endDate ? 'alumni' : 'active',
    replacedBy: m.replacedBy ?? '',
    replaces: m.replaces ?? '',
    cohortLabel: m.cohortLabel ?? '',
    bio: m.bio ?? '',
    x: m.x,
    y: m.y,
    r: m.r,
    parent: m.parent ?? null,
    hub: m.hub ?? m.team,
  };
}

export const GET: APIRoute = () => {
  const members = (teamData as RawMember[]).map(toPublicMember);
  return new Response(
    JSON.stringify({
      count: members.length,
      teams: [...new Set(members.map((m) => m.team))],
      members,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
};
