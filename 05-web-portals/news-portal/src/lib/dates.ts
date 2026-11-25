// Date/status logic ported 1:1 from tf_news (Opportunity.isOpenAt / dateLabel).
// Used at build time (SSR of lists) and in the browser (live status refresh).

export interface OppDates {
  startDate: string | null;
  deadline: string | null;
}

export type DateTone = 'urgent' | 'soon' | 'normal' | 'muted';

export interface DateLabel {
  text: string;
  tone: DateTone;
  isOpen: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function deadlineEnd(o: OppDates): Date | null {
  const d = parseDate(o.deadline);
  if (!d) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59));
}

export function hasDates(o: OppDates): boolean {
  return !!(parseDate(o.startDate) || parseDate(o.deadline));
}

export function isOpenAt(o: OppDates, now: Date): boolean {
  if (!hasDates(o)) return false;
  const start = parseDate(o.startDate);
  const end = deadlineEnd(o);
  const started = !start || start.getTime() <= now.getTime();
  const notClosed = !end || end.getTime() >= now.getTime();
  return started && notClosed;
}

export function nextOpeningAt(o: OppDates, now: Date): Date | null {
  const start = parseDate(o.startDate);
  if (!start) return null;
  let d = start;
  while (d.getTime() <= now.getTime()) {
    d = new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
  }
  return d;
}

export function dateLabel(o: OppDates, now: Date): DateLabel {
  if (!hasDates(o)) return { text: 'Date to be announced', tone: 'muted', isOpen: false };

  if (isOpenAt(o, now)) {
    const dl = parseDate(o.deadline);
    if (!dl) return { text: 'Open now', tone: 'normal', isOpen: true };
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const end = Date.UTC(dl.getUTCFullYear(), dl.getUTCMonth(), dl.getUTCDate());
    const days = Math.round((end - today) / 86400000);
    if (days <= 0) return { text: 'Closes today', tone: 'urgent', isOpen: true };
    if (days === 1) return { text: 'Closes tomorrow', tone: 'urgent', isOpen: true };
    const tone: DateTone = days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'normal';
    return { text: `Closes in ${days} days`, tone, isOpen: true };
  }

  const start = parseDate(o.startDate);
  if (start && start.getTime() > now.getTime()) {
    return { text: `Opens ${formatDate(start)}`, tone: 'muted', isOpen: false };
  }
  const next = nextOpeningAt(o, now);
  if (!next) return { text: 'Expected next season', tone: 'muted', isOpen: false };
  return { text: `Expected ~${MONTHS[next.getUTCMonth()]} ${next.getUTCFullYear()}`, tone: 'muted', isOpen: false };
}

/** Sort key for "open" lists: nearest deadline first, undated last. */
export function deadlineKey(o: OppDates): number {
  const d = parseDate(o.deadline);
  return d ? d.getTime() : Number.POSITIVE_INFINITY;
}

/** Sort key for "upcoming" lists: soonest next opening first, unknown last. */
export function openingKey(o: OppDates, now: Date): number {
  const n = nextOpeningAt(o, now);
  return n ? n.getTime() : Number.POSITIVE_INFINITY;
}

export const TONE_CLASS: Record<DateTone, string> = {
  urgent: 'text-tf-danger font-semibold',
  soon: 'text-tf-signal font-semibold',
  normal: 'text-tf-ink',
  muted: 'text-tf-muted',
};
