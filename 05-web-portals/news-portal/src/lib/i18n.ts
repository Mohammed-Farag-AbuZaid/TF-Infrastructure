// UI dictionary. Detail/content pages (scholarship text, opportunities) stay in English
// because the source material is English; only navigation and chrome are localised.
export type Lang = 'en' | 'ar';

export const LANGS: Lang[] = ['en', 'ar'];

type Dict = Record<string, string>;

const en: Dict = {
  'brand.sub': 'Scholarships, admissions & opportunities',
  'nav.home': 'Home',
  'nav.learn': 'Browse',
  'nav.act': 'Deadlines',
  'nav.me': 'Account',
  'nav.jump': 'Jump',
  'nav.signin': 'Sign in',
  'nav.foundation': 'Foundation',
  'lang.switch': 'العربية',
  'home.title': 'Find your next opportunity',
  'home.subtitle': 'Verified scholarships, admissions routes, activities, internships and programs for Egyptian students.',
  'home.search': 'Search opportunities, universities, programs',
  'home.open': 'open now',
  'home.card.study': 'Scholarships & Admissions',
  'home.card.study.d': '1,500+ universities and verified funding routes.',
  'home.card.dir': 'Opportunity directories',
  'home.card.dir.d': 'Activities, internships and research programs.',
  'home.card.bull': 'Live bulletins & deadlines',
  'home.card.bull.d': 'What is open now and closing soon.',
  'home.card.uni': 'Universities',
  'home.card.uni.d': 'Browse by country, region and QS ranking.',
  'section.all': 'All',
  'section.open': 'Open now',
  'section.upcoming': 'Upcoming',
  'section.search': 'Search this list',
  'section.empty': 'Nothing matches these filters.',
  'section.reset': 'Reset filters',
  'section.count': 'entries',
  'must.title': 'Must-know opportunities',
  'must.subtitle': 'The ones students starred most. Do not miss these.',
  'dir.title': 'Opportunity directories',
  'dir.subtitle': 'Browse admissions guides, extracurricular activities, internships, and research programs.',
  'dir.featured': 'Featured division',
  'dir.routes': '1,500+ verified routes',
  'dir.open': 'Open guide',
  'bull.title': 'Live bulletins & deadlines',
  'bull.subtitle': 'Open an entry for requirements, benefits and verified application links.',
  'bull.all': 'All open',
  'bull.closing': 'Closing soon',
  'bull.must': 'Must-know',
  'uni.title': 'Universities',
  'uni.subtitle': 'Every university with its verified ways to get funded.',
  'uni.search': 'Search university or country',
  'uni.region': 'Region',
  'uni.country': 'Country',
  'uni.withways': 'Only with funding routes',
  'uni.ways': 'ways',
  'uni.showing': 'Showing',
  'uni.more': 'Show more',
  'prog.title': 'Funding programs',
  'prog.subtitle': 'External scholarship programs, grouped by provider across every university they apply to.',
  'prog.search': 'Search programs',
  'prog.level': 'Level',
  'prog.field': 'Field',
  'prog.coverage': 'Coverage',
  'prog.any': 'Any',
  'prog.full': 'Full funding',
  'prog.partial': 'Partial',
  'prog.unis': 'universities',
  'search.title': 'Search',
  'search.placeholder': 'Type to search everything',
  'search.hint': 'Opportunities, universities and funding programs.',
  'search.none': 'No results.',
  'footer.note': 'Always confirm dates on the official site.',
  'footer.updated': 'Data refreshed',
};

const ar: Dict = {
  'brand.sub': 'منح وقبول وفرص للطلاب',
  'nav.home': 'الرئيسية',
  'nav.learn': 'تصفّح',
  'nav.act': 'المواعيد',
  'nav.me': 'حسابي',
  'nav.jump': 'انتقال سريع',
  'nav.signin': 'تسجيل الدخول',
  'nav.foundation': 'المؤسسة',
  'lang.switch': 'English',
  'home.title': 'اعثر على فرصتك التالية',
  'home.subtitle': 'منح دراسية ومسارات قبول وأنشطة وتدريبات وبرامج موثّقة للطلاب المصريين.',
  'home.search': 'ابحث عن فرص وجامعات وبرامج',
  'home.open': 'مفتوحة الآن',
  'home.card.study': 'المنح والقبول',
  'home.card.study.d': 'أكثر من ١٥٠٠ جامعة ومسارات تمويل موثّقة.',
  'home.card.dir': 'أدلّة الفرص',
  'home.card.dir.d': 'الأنشطة والتدريبات وبرامج البحث.',
  'home.card.bull': 'النشرة والمواعيد النهائية',
  'home.card.bull.d': 'ما هو مفتوح الآن وما يُغلق قريبًا.',
  'home.card.uni': 'الجامعات',
  'home.card.uni.d': 'تصفّح حسب الدولة والمنطقة وتصنيف QS.',
  'section.all': 'الكل',
  'section.open': 'مفتوحة الآن',
  'section.upcoming': 'قريبًا',
  'section.search': 'ابحث في هذه القائمة',
  'section.empty': 'لا توجد نتائج تطابق هذه الخيارات.',
  'section.reset': 'إعادة ضبط الفلاتر',
  'section.count': 'نتيجة',
  'must.title': 'فرص لا يجب أن تفوّتها',
  'must.subtitle': 'الفرص الأكثر تقييمًا بالنجوم من الطلاب.',
  'dir.title': 'أدلّة الفرص',
  'dir.subtitle': 'تصفّح أدلة القبول والأنشطة والتدريبات وبرامج البحث.',
  'dir.featured': 'القسم المميّز',
  'dir.routes': 'أكثر من ١٥٠٠ مسار موثّق',
  'dir.open': 'افتح الدليل',
  'bull.title': 'النشرة والمواعيد النهائية',
  'bull.subtitle': 'افتح أي فرصة لمعرفة الشروط والمزايا وروابط التقديم الموثّقة.',
  'bull.all': 'كل المفتوح',
  'bull.closing': 'يُغلق قريبًا',
  'bull.must': 'الأهم',
  'uni.title': 'الجامعات',
  'uni.subtitle': 'كل جامعة مع طرق التمويل الموثّقة الخاصة بها.',
  'uni.search': 'ابحث عن جامعة أو دولة',
  'uni.region': 'المنطقة',
  'uni.country': 'الدولة',
  'uni.withways': 'فقط التي لها مسارات تمويل',
  'uni.ways': 'مسارات',
  'uni.showing': 'المعروض',
  'uni.more': 'عرض المزيد',
  'prog.title': 'برامج التمويل',
  'prog.subtitle': 'برامج المنح الخارجية مجمّعة حسب الجهة المانحة عبر كل الجامعات التي تنطبق عليها.',
  'prog.search': 'ابحث في البرامج',
  'prog.level': 'المرحلة',
  'prog.field': 'المجال',
  'prog.coverage': 'نسبة التغطية',
  'prog.any': 'أي',
  'prog.full': 'تمويل كامل',
  'prog.partial': 'جزئي',
  'prog.unis': 'جامعة',
  'search.title': 'بحث',
  'search.placeholder': 'اكتب للبحث في كل شيء',
  'search.hint': 'الفرص والجامعات وبرامج التمويل.',
  'search.none': 'لا توجد نتائج.',
  'footer.note': 'تأكّد دائمًا من المواعيد من الموقع الرسمي.',
  'footer.updated': 'آخر تحديث للبيانات',
};

const dicts: Record<Lang, Dict> = { en, ar };

export function t(lang: Lang, key: string): string {
  return dicts[lang][key] ?? en[key] ?? key;
}

export const dirOf = (lang: Lang) => (lang === 'ar' ? 'rtl' : 'ltr');

/** Localised path: '/study' -> '/ar/study' for Arabic. */
export function href(lang: Lang, path: string): string {
  if (lang === 'en') return path;
  return path === '/' ? '/ar/' : `/ar${path}`;
}

export const SECTION_TITLES_AR: Record<string, { title: string; subtitle: string }> = {
  study: { title: 'المنح والقبول', subtitle: 'اعثر على جامعة أحلامك داخل مصر وخارجها' },
  activities: { title: 'الأنشطة اللامنهجية', subtitle: 'تطوع ومسابقات ونوادٍ وفرق وكل ما هو خارج الدراسة' },
  internships: { title: 'التدريب', subtitle: 'خبرة عمل حقيقية' },
  programs: { title: 'البرامج', subtitle: 'بحث وتبادل وقيادة وغير ذلك' },
};

export const CATEGORY_AR: Record<string, string> = {
  All: 'الكل', Egypt: 'مصر', US: 'أمريكا', China: 'الصين', Europe: 'أوروبا', Other: 'أخرى', 'Must-know': 'الأهم',
  Volunteering: 'تطوع', Competitions: 'مسابقات', 'Clubs & teams': 'نوادٍ وفرق', Hackathons: 'هاكاثون', Events: 'فعاليات',
  Workshops: 'ورش عمل', Abroad: 'خارج مصر', Remote: 'عن بُعد', Research: 'بحث', Exchange: 'تبادل', Leadership: 'قيادة',
};

export const catLabel = (lang: Lang, c: string) => (lang === 'ar' ? CATEGORY_AR[c] ?? c : c);
