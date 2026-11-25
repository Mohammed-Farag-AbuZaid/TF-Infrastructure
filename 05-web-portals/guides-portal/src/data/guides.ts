export interface GuideWorkbook {
  id: string;
  serial: string;
  category: 'Research & ISEF' | 'Olympiads' | 'Global Admissions' | 'Engineering';
  level: string;
  title: string;
  summary: string;
  steps: string[];
}

export const ROADMAPS: GuideWorkbook[] = [
  {
    id: 'isef-blueprint',
    serial: 'GD-01',
    category: 'Research & ISEF',
    level: '12 Weeks',
    title: 'Regeneron ISEF Complete Research Blueprint',
    summary:
      'From literature gap identification and experimental design to SRC forms, statistical validation, and Grand Award judging defense.',
    steps: [
      'Screen 15–20 peer-reviewed papers on Google Scholar & PubMed to lock a testable hypothesis.',
      'Draft Research Plan & complete ISEF Checklist (1, 1A, 1B) before starting lab work.',
      'Run baseline & experimental trials with controlled variables and log raw datasets.',
      'Perform t-test / ANOVA statistical significance analysis and build high-contrast plots.',
      'Design trifold poster typography & rehearse 2-minute elevator + Q&A defense.',
    ],
  },
  {
    id: 'ioi-informatics',
    serial: 'GD-02',
    category: 'Olympiads',
    level: '6 Months',
    title: 'Competitive Programming & Egyptian Olympiad in Informatics (EOI)',
    summary:
      'Progressive curriculum covering C++ STL, asymptotics, graph traversal, dynamic programming, and USACO Gold/Platinum tactics.',
    steps: [
      'Master C++ fast I/O, STL vectors/maps/sets, and sorting/binary search patterns.',
      'Solve 120 Codeforces problems rated 900–1400 covering greedy & two pointers.',
      'Implement BFS, DFS, Dijkstra, DSU, and Minimum Spanning Trees from scratch.',
      'Learn knapsack, LIS, bitmask DP, and tree DP state transitions.',
      'Simulate full 5-hour 3-problem Olympiad contests weekly.',
    ],
  },
  {
    id: 'us-eu-admissions',
    serial: 'GD-03',
    category: 'Global Admissions',
    level: '8 Months',
    title: 'International Scholarships & Financial Aid Dossier',
    summary:
      'How Egyptian high school students build competitive Common App honors, teacher recommendations, CSS Profile aid forms, and personal statements.',
    steps: [
      'Shortlist 12–15 universities offering full-tuition or need-blind financial aid for international applicants.',
      'Compile Transcript translations, official school profile, and SAT/IELTS testing calendar.',
      'Structure a coherent Personal Essay centered on intellectual vitality and community impact.',
      'Prepare recommender brag sheets highlighting specific classroom & project initiatives.',
      'Audit CSS Profile & ISFAA family income documentation 3 weeks before deadlines.',
    ],
  },
  {
    id: 'capstone-engineering',
    serial: 'GD-04',
    category: 'Engineering',
    level: '10 Weeks',
    title: 'STEM Capstone & Hardware Prototype Methodology',
    summary:
      'Systematic engineering process: design requirements, sensor calibration, PCB/microcontroller wiring, EDP logbook documentation, and prototype testing.',
    steps: [
      'Define quantifiable design criteria (efficiency, cost ceiling, tolerance, safety).',
      'Select microcontroller & sensors (ESP32/Arduino), verify pin voltage levels and power budget.',
      'Build modular breadboard prototype and benchmark baseline accuracy.',
      'Conduct failure-mode testing across edge temperatures and loads; iterate v2 enclosure.',
      'Write formal IEEE-style technical report & live test demonstration.',
    ],
  },
  {
    id: 'ipo-math-physics',
    serial: 'GD-05',
    category: 'Olympiads',
    level: '5 Months',
    title: 'Egyptian Physics & Mathematics Olympiad Foundation',
    summary:
      'Calculus-based mechanics, electromagnetism, Olympiad inequalities, combinatorics, and national camp problem sets.',
    steps: [
      'Master Halliday Resnick core mechanics, rotational dynamics, and differential kinematics.',
      'Work through Irodov & Krotov selected problems with full symbolic derivations.',
      'Cover combinatorics (Pigeonhole, invariants, generating functions) and number theory.',
      'Practice timed proof-writing with rigorous justification for every lemma.',
    ],
  },
  {
    id: 'arabic-paper-writing',
    serial: 'GD-06',
    category: 'Research & ISEF',
    level: '4 Weeks',
    title: 'Scientific Writing & LaTeX Preprint Preparation',
    summary:
      'Turn lab notebooks into publication-grade IMRAD manuscripts using Overleaf, BibTeX citation hygiene, and ethical figure design.',
    steps: [
      'Structure manuscript into Abstract, Introduction, Methodology, Results, and Discussion.',
      'Organize Zotero / BibTeX references consistently in IEEE or APA format.',
      'Export vector SVG/PDF figures with accessible color contrast and clear axis units.',
      'Run peer review checklist for reproducibility and limitation disclosure.',
    ],
  },
];
