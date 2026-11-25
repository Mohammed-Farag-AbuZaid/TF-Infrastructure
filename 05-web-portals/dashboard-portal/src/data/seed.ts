import rawTeam from '../../../foundation-portal/src/data/team-nodes.json';
import { BASELINE_CHAPTERS } from '../../../connect-portal/src/data/chapters';
import { ROADMAPS } from '../../../guides-portal/src/data/guides';

type RawMember = (typeof rawTeam)[number] & {
  arabicName?: string;
  school?: string;
  grade?: string;
  cohortDate?: string;
  cohortLabel?: string;
  bio?: string;
  parent?: string;
  hub?: string;
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

export { BASELINE_CHAPTERS };

export const BASELINE_GUIDES = ROADMAPS.map((g) => ({
  id: g.id,
  serial: g.serial,
  category: g.category,
  level: g.level,
  title: g.title,
  summary: g.summary,
  url: `/guides/${g.id}`,
}));

export const BASELINE_LEDGER = [
  {
    id: 'seed-inflow-1',
    txDate: '2026-01-15',
    donorOrVendor: 'Founders Seed Allocation',
    paymentChannel: 'Founders Allocation',
    verificationStatus: 'Verified',
    entryType: 'inflow',
    amountEgp: 12000,
  },
  {
    id: 'seed-outflow-1',
    txDate: '2026-02-01',
    donorOrVendor: 'Dedicated Ubuntu VPS & Domain Renewal',
    paymentChannel: 'Infrastructure',
    verificationStatus: 'Verified',
    entryType: 'outflow',
    amountEgp: 4200,
  },
];

export const SITE_COPY_PAGES = [
  {
    pageKey: 'home',
    label: 'Foundation Home (EN)',
    url: 'https://www.tfunions.com/',
    fields: [
      { key: 'headline', label: 'Hero Headline', kind: 'h1', def: 'Egypt’s student union for STEM research and global admissions.' },
      { key: 'subtitle', label: 'Hero Subtitle', kind: 'p', def: 'Independent and student-run across all 27 governorates — verified admission data, research roadmaps, local chapters, and an open ledger.' },
      { key: 'cta_primary', label: 'Primary Button', kind: 'btn', def: 'Browse opportunities' },
      { key: 'cta_secondary', label: 'Secondary Action', kind: 'link', def: 'Verify a certificate →' },
      { key: 'dest_0_title', label: 'Card 1 Title', kind: 'h2', def: 'Divisions & platforms' },
      { key: 'dest_0_desc', label: 'Card 1 Description', kind: 'p', def: 'Access TF News admissions, TF Guides research roadmaps, TF Connect chapters, and STEM Shop.' },
      { key: 'dest_1_title', label: 'Card 2 Title', kind: 'h2', def: 'Live union desk' },
      { key: 'dest_1_desc', label: 'Card 2 Description', kind: 'p', def: 'Inspect active opportunity deadlines, regional governorate chapters, and treasury snapshots.' },
      { key: 'dest_2_title', label: 'Card 3 Title', kind: 'h2', def: 'Team & chapters' },
      { key: 'dest_2_desc', label: 'Card 3 Description', kind: 'p', def: 'Trace leadership history from October 2025 or browse active student contributors across Egypt.' },
      { key: 'dest_3_title', label: 'Card 4 Title', kind: 'h2', def: 'Open ledger & charter' },
      { key: 'dest_3_desc', label: 'Card 4 Description', kind: 'p', def: 'Verify public EGP inflows and outflows, read the non-profit charter, or submit chapter ideas.' },
    ],
  },
  {
    pageKey: 'home_ar',
    label: 'Foundation Home (AR)',
    url: 'https://www.tfunions.com/ar/',
    rtl: true,
    fields: [
      { key: 'headline', label: 'العنوان الرئيسي', kind: 'h1', def: 'اتحاد طلاب مصر للبحث العلمي والقبول الجامعي العالمي.' },
      { key: 'subtitle', label: 'الوصف الرئيسي', kind: 'p', def: 'مستقل وبإدارة طلابية في جميع محافظات مصر الـ 27 — بيانات قبول موثّقة، وأدلّة للأولمبياد والبحث العلمي، وفصول محلية، وسجل مالي مفتوح.' },
      { key: 'cta_primary', label: 'الزر الرئيسي', kind: 'btn', def: 'تصفّح المنح والفرص' },
      { key: 'cta_secondary', label: 'الرابط الثانوي', kind: 'link', def: 'تحقّق من شهادة ←' },
    ],
  },
  {
    pageKey: 'team',
    label: 'Team Constellation (/team)',
    url: 'https://www.tfunions.com/team',
    fields: [
      { key: 'headline', label: 'Hero Headline', kind: 'h1', def: 'Seventy-one students building Egypt’s STEM union.' },
      { key: 'subtitle', label: 'Hero Description', kind: 'p', def: 'From two founding systems architects in October 2025 to 71 active leaders across 5 operational divisions — scrub the timeline below or explore the live directory.' },
      { key: 'founders_heading', label: 'Founders Section Heading', kind: 'h2', def: 'Founding leadership' },
    ],
  },
  {
    pageKey: 'ledger',
    label: 'Open Financial Ledger',
    url: 'https://www.tfunions.com/transparency',
    fields: [
      { key: 'headline', label: 'Page Title', kind: 'h1', def: 'Open financial ledger' },
      { key: 'subtitle', label: 'Audit Summary Subtitle', kind: 'p', def: 'Every verified contribution inflow and self-hosted server infrastructure expense is audited publicly in Egyptian Pounds.' },
    ],
  },
  {
    pageKey: 'connect',
    label: 'TF Connect Chapters',
    url: 'https://connect.tfunions.com/',
    fields: [
      { key: 'headline', label: 'Sidebar Headline', kind: 'h1', def: 'Chapters, unions & guilds' },
      { key: 'subtitle', label: 'Sidebar Description', kind: 'p', def: 'Locate STEM high school chapters, regional study circles, and student-led research labs operating across Egypt.' },
    ],
  },
  {
    pageKey: 'guides',
    label: 'TF Guides Workbooks',
    url: 'https://guides.tfunions.com/',
    fields: [
      { key: 'headline', label: 'Sidebar Headline', kind: 'h1', def: 'Research and Olympiad roadmaps' },
      { key: 'subtitle', label: 'Sidebar Description', kind: 'p', def: 'Structured playbooks authored by ISEF finalists, Olympiad medalists, and global scholars. Check off milestones locally as you advance.' },
    ],
  },
  {
    pageKey: 'footer',
    label: 'Global Ecosystem Footer',
    url: 'https://www.tfunions.com/',
    fields: [
      { key: 'tagline', label: 'Union Tagline', kind: 'p', def: 'Independent non-profit student academic union supporting STEM and university scholars across all 27 Egyptian governorates.' },
      { key: 'copyright', label: 'Copyright Notice', kind: 'p', def: '© 2025–2026 TF Unions Foundation. Open access and ad-free for all students.' },
      { key: 'support_cta', label: 'Support Link Text', kind: 'link', def: 'Support the mission →' },
    ],
  },
];

export const STARTER_TASKS = [
  {
    id: 'task-seed-1',
    title: 'Audit Q4 HR member onboarding & verify 2026 cohort bios',
    division: 'HR Team',
    priority: 'high',
    status: 'todo',
    assigneeEmail: '',
    dueDate: '2026-12-05',
    points: 25,
  },
  {
    id: 'task-seed-2',
    title: 'Replace initial seed entries on Open Financial Ledger with Q4 receipts',
    division: 'Founders',
    priority: 'high',
    status: 'doing',
    assigneeEmail: '',
    dueDate: '2026-11-30',
    points: 25,
  },
  {
    id: 'task-seed-3',
    title: 'Verify international winter scholarship deadlines on TF News',
    division: 'PR Team',
    priority: 'medium',
    status: 'todo',
    assigneeEmail: '',
    dueDate: '2026-12-10',
    points: 25,
  },
  {
    id: 'task-seed-4',
    title: 'Collect 10 real study circle photos from Alexandria & Maadi chapters',
    division: 'Social Media Team',
    priority: 'medium',
    status: 'todo',
    assigneeEmail: '',
    dueDate: '2026-12-15',
    points: 25,
  },
  {
    id: 'task-seed-5',
    title: 'Review homepage copy & publish seasonal admissions announcement',
    division: 'Marketing Team',
    priority: 'low',
    status: 'done',
    assigneeEmail: '',
    dueDate: '2026-11-25',
    points: 25,
  },
];
