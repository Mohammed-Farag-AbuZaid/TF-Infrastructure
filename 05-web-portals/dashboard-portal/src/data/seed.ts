import rawTeam from '../../../foundation-portal/src/data/team-nodes.json';
import copyCatalog from './copy-catalog.json';

type RawMember = (typeof rawTeam)[number] & {
  arabicName?: string;
  school?: string;
  grade?: string;
  cohortDate?: string;
  cohortLabel?: string;
  bio?: string;
  parent?: string;
};

export const BASELINE_MEMBERS = (rawTeam as RawMember[]).map((m) => ({
  id: m.id,
  name: m.name,
  arabicName: m.arabicName ?? '',
  role: m.role,
  team: m.team,
  tier: m.tier,
  school: m.school ?? 'TF Unions',
  grade: m.grade ?? '',
  cohortDate: m.cohortDate ?? '2026-11',
  cohortLabel: m.cohortLabel ?? '',
  bio: m.bio ?? '',
  parent: m.parent ?? null,
}));

export const COPY_CATALOG = copyCatalog;
