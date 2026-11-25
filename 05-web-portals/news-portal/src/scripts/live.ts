// Client behaviour: live date labels, list filtering/sorting, bulletin tabs, open counts.
import { dateLabel, deadlineKey, openingKey, isOpenAt, TONE_CLASS, type OppDates } from '../lib/dates';

const ALL_TOPICS = 'All Opportunities';
const MUST = 'Must-know';

const datesOf = (el: HTMLElement): OppDates => ({
  startDate: el.dataset.start || null,
  deadline: el.dataset.deadline || null,
});

function refreshLabels(root: ParentNode = document) {
  const now = new Date();
  root.querySelectorAll<HTMLElement>('[data-opp]').forEach((el) => {
    const l = dateLabel(datesOf(el), now);
    el.dataset.status = l.isOpen ? 'open' : 'upcoming';
    const span = el.querySelector<HTMLElement>('.js-label');
    if (span) {
      span.textContent = l.text;
      span.className = `js-label ${TONE_CLASS[l.tone]}`;
    }
  });
}

function refreshOpenCounts() {
  const node = document.getElementById('opp-dates');
  if (!node) return;
  let rows: Array<{ s: string; st: string | null; dl: string | null }> = [];
  try {
    rows = JSON.parse(node.textContent || '[]');
  } catch {
    return;
  }
  const now = new Date();
  const counts: Record<string, number> = {};
  for (const r of rows) {
    if (isOpenAt({ startDate: r.st, deadline: r.dl }, now)) counts[r.s] = (counts[r.s] || 0) + 1;
  }
  document.querySelectorAll<HTMLElement>('[data-open-count]').forEach((el) => {
    const key = el.dataset.openCount || '';
    const n = key === '__all' ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[key] ?? 0);
    el.textContent = String(n);
    el.closest('[data-open-wrap]')?.classList.remove('opacity-0');
  });
}

// ---------------------------------------------------------------------------
// Section / must-know listings
// ---------------------------------------------------------------------------
function initListing(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>('[data-list]')!;
  const items = Array.from(list.querySelectorAll<HTMLElement>('[data-opp]'));
  const topicsMap: Record<string, string[]> = JSON.parse(root.dataset.topicsMap || '{}');
  const defaultTopics: string[] = JSON.parse(root.dataset.defaultTopics || '[]');
  const state = { status: root.dataset.defaultStatus || 'open', category: 'All', topic: ALL_TOPICS, q: '' };

  const catBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-ctl="category"] [data-value]'));
  const statusBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-ctl="status"] [data-value]'));
  const topicSel = root.querySelector<HTMLSelectElement>('[data-ctl="topic"]');
  const qInput = root.querySelector<HTMLInputElement>('[data-ctl="q"]');
  const countEl = root.querySelector<HTMLElement>('[data-count]');
  const emptyEl = root.querySelector<HTMLElement>('[data-empty]');

  function buildTopics() {
    if (!topicSel) return;
    const topics = topicsMap[state.category] ?? defaultTopics;
    topicSel.innerHTML = '';
    for (const tp of [ALL_TOPICS, ...topics]) {
      const o = document.createElement('option');
      o.value = tp;
      o.textContent = tp === ALL_TOPICS ? topicSel.dataset.allLabel || tp : tp;
      topicSel.appendChild(o);
    }
    topicSel.value = ALL_TOPICS;
    state.topic = ALL_TOPICS;
    topicSel.disabled = state.category === MUST;
  }

  function mark(btns: HTMLButtonElement[], value: string) {
    btns.forEach((b) => {
      const on = b.dataset.value === value;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('bg-tf-surface', on);
      b.classList.toggle('border-tf-border', on);
      b.classList.toggle('font-semibold', on);
      b.classList.toggle('text-tf-ink', on);
      b.classList.toggle('text-tf-muted', !on);
    });
  }

  function apply() {
    refreshLabels(list);
    const now = new Date();
    const q = state.q.trim().toLowerCase();
    const shown = items.filter((el) => {
      const st = el.dataset.status || 'upcoming';
      if (state.status !== 'all' && st !== state.status) return false;
      if (state.category === MUST) {
        if (el.dataset.must !== '1') return false;
      } else if (state.category !== 'All' && el.dataset.category !== state.category) return false;
      if (state.category !== MUST && state.topic !== ALL_TOPICS && el.dataset.topic !== state.topic) return false;
      if (q && !(el.dataset.text || '').includes(q)) return false;
      return true;
    });
    shown.sort((a, b) => {
      const sa = a.dataset.status === 'open' ? 0 : 1;
      const sb = b.dataset.status === 'open' ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return sa === 0
        ? deadlineKey(datesOf(a)) - deadlineKey(datesOf(b))
        : openingKey(datesOf(a), now) - openingKey(datesOf(b), now);
    });
    items.forEach((el) => (el.hidden = true));
    shown.forEach((el) => {
      el.hidden = false;
      list.appendChild(el);
    });
    if (countEl) countEl.textContent = String(shown.length);
    if (emptyEl) emptyEl.hidden = shown.length > 0;
  }

  catBtns.forEach((b) =>
    b.addEventListener('click', () => {
      state.category = b.dataset.value || 'All';
      mark(catBtns, state.category);
      buildTopics();
      apply();
    }),
  );
  statusBtns.forEach((b) =>
    b.addEventListener('click', () => {
      state.status = b.dataset.value || 'open';
      mark(statusBtns, state.status);
      apply();
    }),
  );
  topicSel?.addEventListener('change', () => {
    state.topic = topicSel.value;
    apply();
  });
  qInput?.addEventListener('input', () => {
    state.q = qInput.value;
    apply();
  });
  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    state.category = 'All';
    state.q = '';
    state.status = root.dataset.defaultStatus || 'open';
    if (qInput) qInput.value = '';
    mark(catBtns, 'All');
    mark(statusBtns, state.status);
    buildTopics();
    apply();
  });

  mark(catBtns, state.category);
  mark(statusBtns, state.status);
  buildTopics();
  apply();
}

// ---------------------------------------------------------------------------
// Bulletins (All open / Closing soon / Must-know)
// ---------------------------------------------------------------------------
function initBulletins(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>('[data-list]')!;
  const items = Array.from(list.querySelectorAll<HTMLElement>('[data-opp]'));
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-ctl="tab"] [data-value]'));
  const emptyEl = root.querySelector<HTMLElement>('[data-empty]');
  const param = new URLSearchParams(location.search).get('tab');
  let tab = param === 'closing' ? 'closing' : param === 'essential' ? 'must' : 'all';

  const rating = (el: HTMLElement) => Number(el.dataset.rating || 0);

  function apply() {
    refreshLabels(list);
    const open = items.filter((el) => el.dataset.status === 'open');
    let rows: HTMLElement[];
    if (tab === 'closing') {
      rows = open
        .filter((el) => el.dataset.deadline)
        .sort((a, b) => deadlineKey(datesOf(a)) - deadlineKey(datesOf(b)))
        .slice(0, 8);
    } else if (tab === 'must') {
      rows = open.filter((el) => el.dataset.must === '1').sort((a, b) => rating(b) - rating(a)).slice(0, 8);
    } else {
      rows = open
        .sort((a, b) => {
          const da = a.dataset.deadline;
          const db = b.dataset.deadline;
          if (da && db) return deadlineKey(datesOf(a)) - deadlineKey(datesOf(b));
          if (da) return -1;
          if (db) return 1;
          return rating(b) - rating(a);
        })
        .slice(0, 10);
    }
    items.forEach((el) => (el.hidden = true));
    rows.forEach((el) => {
      el.hidden = false;
      list.appendChild(el);
    });
    if (emptyEl) emptyEl.hidden = rows.length > 0;
    tabs.forEach((b) => {
      const on = b.dataset.value === tab;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('bg-tf-surface', on);
      b.classList.toggle('border-tf-border', on);
      b.classList.toggle('font-semibold', on);
      b.classList.toggle('text-tf-ink', on);
      b.classList.toggle('text-tf-muted', !on);
    });
  }

  tabs.forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.value || 'all';
      apply();
    }),
  );
  apply();
}

function boot() {
  refreshLabels();
  refreshOpenCounts();
  document.querySelectorAll<HTMLElement>('[data-listing]').forEach(initListing);
  document.querySelectorAll<HTMLElement>('[data-bulletins]').forEach(initBulletins);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
