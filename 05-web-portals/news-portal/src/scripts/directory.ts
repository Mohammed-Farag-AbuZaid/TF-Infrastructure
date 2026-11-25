// Client filtering + "show more" paging for the university and program directories.
// Row attributes: data-text (lowercase haystack), and pipe-delimited sets like "|MENA|Europe|".
// A set containing "|*|" means "not stated" and matches any selected value (same rule as the Flutter app).

function initDir(root: HTMLElement) {
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-row]'));
  const countEl = root.querySelector<HTMLElement>('[data-count]');
  const emptyEl = root.querySelector<HTMLElement>('[data-empty]');
  const moreBtn = root.querySelector<HTMLButtonElement>('[data-more]');
  const pageSize = Number(root.dataset.pageSize || 80);
  let limit = pageSize;

  const controls = Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-f]'));
  const q = root.querySelector<HTMLInputElement>('[data-f="q"]');

  function matches(row: HTMLElement): boolean {
    const text = q?.value.trim().toLowerCase() || '';
    if (text && !(row.dataset.text || '').includes(text)) return false;
    for (const c of controls) {
      const key = c.dataset.f!;
      if (key === 'q') continue;
      if (c instanceof HTMLInputElement && c.type === 'checkbox') {
        if (c.checked && row.dataset[key] !== '1') return false;
        continue;
      }
      const v = c.value;
      if (!v) continue;
      const set = row.dataset[key] || '';
      if (c.dataset.mode === 'eq') {
        if (set !== v) return false;
      } else if (!set.includes(`|${v}|`) && !set.includes('|*|')) return false;
    }
    return true;
  }

  function apply(resetLimit = true) {
    if (resetLimit) limit = pageSize;
    let matched = 0;
    let shown = 0;
    for (const row of rows) {
      const ok = matches(row);
      if (ok) matched++;
      const visible = ok && shown < limit;
      row.hidden = !visible;
      if (visible) shown++;
    }
    if (countEl) countEl.textContent = String(matched);
    if (emptyEl) emptyEl.hidden = matched > 0;
    if (moreBtn) moreBtn.hidden = shown >= matched;
  }

  controls.forEach((c) => {
    c.addEventListener(c instanceof HTMLInputElement && c.type !== 'checkbox' ? 'input' : 'change', () => apply());
  });
  moreBtn?.addEventListener('click', () => {
    limit += pageSize;
    apply(false);
  });
  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    controls.forEach((c) => {
      if (c instanceof HTMLInputElement && c.type === 'checkbox') c.checked = false;
      else c.value = '';
    });
    apply();
  });

  const preset = new URLSearchParams(location.search);
  controls.forEach((c) => {
    const v = preset.get(c.dataset.f!);
    if (v !== null && !(c instanceof HTMLInputElement && c.type === 'checkbox')) c.value = v;
  });
  apply();
}

function initSearch(root: HTMLElement) {
  const input = root.querySelector<HTMLInputElement>('[data-search-input]')!;
  const out = root.querySelector<HTMLElement>('[data-search-results]')!;
  const none = root.querySelector<HTMLElement>('[data-search-none]')!;
  let index: Array<{ t: string; u: string; k: string; x: string }> | null = null;

  async function ensure() {
    if (index) return index;
    const res = await fetch('/search-index.json');
    index = await res.json();
    return index!;
  }

  function esc(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function run() {
    const q = input.value.trim().toLowerCase();
    const idx = await ensure();
    if (!q) {
      out.innerHTML = '';
      none.hidden = true;
      return;
    }
    const terms = q.split(/\s+/);
    const hits = idx
      .map((r) => {
        const hay = `${r.t} ${r.x}`.toLowerCase();
        if (!terms.every((tm) => hay.includes(tm))) return null;
        const score = (r.t.toLowerCase().startsWith(terms[0]) ? 0 : 1) + (r.k === 'Opportunity' ? 0 : 0.5);
        return { r, score };
      })
      .filter(Boolean)
      .sort((a, b) => a!.score - b!.score)
      .slice(0, 60) as Array<{ r: { t: string; u: string; k: string; x: string } }>;
    none.hidden = hits.length > 0;
    out.innerHTML = hits
      .map(
        ({ r }) =>
          `<li class="border-b border-tf-border last:border-b-0"><a href="${esc(r.u)}" class="block py-4 group"><div class="text-[12.5px] text-tf-muted">${esc(r.k)}${r.x ? ' · ' + esc(r.x) : ''}</div><div class="font-display text-[18px] font-semibold mt-0.5 group-hover:text-tf-brand transition">${esc(r.t)}</div></a></li>`,
      )
      .join('');
  }

  input.addEventListener('input', run);
  const initial = new URLSearchParams(location.search).get('q');
  if (initial) {
    input.value = initial;
    run();
  }
  input.focus();
}

document.querySelectorAll<HTMLElement>('[data-dir]').forEach(initDir);
document.querySelectorAll<HTMLElement>('[data-search]').forEach(initSearch);
