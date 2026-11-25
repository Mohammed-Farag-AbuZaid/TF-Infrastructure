export interface ChapterEntry {
  id: string;
  serial: string;
  type: 'School Chapter' | 'Project Guild' | 'Research Lab';
  gov: string;
  name: string;
  desc: string;
  focus: string;
}

export const GOVERNORATES = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Dakahlia',
  'Sharqia',
  'Ismailia',
  'Assiut',
  'Red Sea',
  'Nationwide',
] as const;

export const BASELINE_CHAPTERS: ChapterEntry[] = [
  {
    id: 'c1',
    serial: 'CN-01',
    type: 'School Chapter',
    gov: 'Giza',
    name: 'STEM 6th of October Union Chapter',
    desc: 'Flagship student research & Olympiad study circle coordinating ISEF mentorship and weekly peer reviews.',
    focus: 'ISEF & Olympiad Mentorship',
  },
  {
    id: 'c2',
    serial: 'CN-02',
    type: 'School Chapter',
    gov: 'Cairo',
    name: 'STEM Maadi Research Collective',
    desc: 'Student-led scientific writing and international summer programs advising circle for young women in STEM.',
    focus: 'Scientific Writing & Summer Aid',
  },
  {
    id: 'c3',
    serial: 'CN-03',
    type: 'School Chapter',
    gov: 'Alexandria',
    name: 'Alexandria STEM Robotics & AI Club',
    desc: 'Autonomous robotics, CAD hardware design, and competitive informatics practice group.',
    focus: 'Robotics & Informatics',
  },
  {
    id: 'c4',
    serial: 'CN-04',
    type: 'School Chapter',
    gov: 'Dakahlia',
    name: 'Dakahlia STEM Scholars Guild',
    desc: 'Connecting Delta governorates with chemistry, biology, and international admissions workshops.',
    focus: 'Regional Study Circles',
  },
  {
    id: 'c5',
    serial: 'CN-05',
    type: 'Research Lab',
    gov: 'Ismailia',
    name: 'Suez Canal Energy & Sustainability Lab',
    desc: 'Open student research group prototyping low-cost desalination, clean water, and solar storage capstones.',
    focus: 'Clean Energy & Water',
  },
  {
    id: 'c6',
    serial: 'CN-06',
    type: 'Project Guild',
    gov: 'Nationwide',
    name: 'TF Systems & Open-Source Engineering Guild',
    desc: 'Building self-hosted student infrastructure, Dart/Flutter apps, Astro web portals, and open APIs.',
    focus: 'Full-Stack & Mobile',
  },
  {
    id: 'c7',
    serial: 'CN-07',
    type: 'School Chapter',
    gov: 'Assiut',
    name: 'Upper Egypt STEM & Thanaweya Bridge',
    desc: 'Extending curated university admissions databases and research mentorship to Upper Egypt students.',
    focus: 'Upper Egypt Access',
  },
  {
    id: 'c8',
    serial: 'CN-08',
    type: 'Research Lab',
    gov: 'Red Sea',
    name: 'Red Sea Marine & Earth Sciences Circle',
    desc: 'Coastal ecology modeling and remote sensing environmental capstones.',
    focus: 'Earth & Marine Science',
  },
];
