(function () {
  var savedTheme = null;
  try {
    savedTheme = localStorage.getItem('tf-theme');
  } catch (_) {}
  if (savedTheme === 'light' || savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  window.tfToggleTheme = function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = cur ? cur === 'dark' : sysDark;
    var next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('tf-theme', next);
    } catch (_) {}
  };

  var ITEMS = [
    { label: 'Foundation Home', url: 'https://www.tfunions.com/', cat: 'Home' },
    { label: 'Divisions & Programs', url: 'https://www.tfunions.com/divisions', cat: 'Home' },
    { label: 'Quick Actions Desk', url: 'https://www.tfunions.com/desk', cat: 'Act' },
    { label: 'Team & Governance', url: 'https://www.tfunions.com/team', cat: 'Trust' },
    { label: 'Open Financial Ledger', url: 'https://www.tfunions.com/transparency', cat: 'Trust' },
    { label: 'Charter & Bylaws', url: 'https://www.tfunions.com/charter', cat: 'Trust' },
    { label: 'Volunteer Tracks', url: 'https://www.tfunions.com/volunteer', cat: 'Act' },
    { label: 'Volunteer Application Form', url: 'https://www.tfunions.com/volunteer-apply', cat: 'Act' },
    { label: 'Ideas Backlog', url: 'https://www.tfunions.com/ideas', cat: 'Act' },
    { label: 'Submit a Union Idea', url: 'https://www.tfunions.com/ideas-submit', cat: 'Act' },
    { label: 'Support & Donations', url: 'https://www.tfunions.com/support', cat: 'Act' },
    { label: 'News & Bulletins', url: 'https://news.tfunions.com/', cat: 'Learn' },
    { label: 'Study Workbooks (Guides)', url: 'https://guides.tfunions.com/', cat: 'Learn' },
    { label: 'Study Groups (Connect)', url: 'https://connect.tfunions.com/', cat: 'Join' },
    { label: 'Propose a Study Chapter', url: 'https://connect.tfunions.com/propose', cat: 'Join' },
    { label: 'Certificate Verifier', url: 'https://verify.tfunions.com/', cat: 'Trust' },
    { label: 'Verification Schema & API', url: 'https://verify.tfunions.com/schema', cat: 'Trust' },
    { label: 'Docs & Platforms Directory', url: 'https://docs.tfunions.com/', cat: 'Learn' },
    { label: 'SSO Passport Docs', url: 'https://docs.tfunions.com/sso', cat: 'Learn' },
    { label: 'REST API Reference', url: 'https://docs.tfunions.com/api', cat: 'Learn' },
    { label: 'TF Passport Sign In', url: 'https://auth.tfunions.com/', cat: 'Me' },
  ];

  var backdrop = null;
  var inputEl = null;
  var listEl = null;
  var filtered = ITEMS;
  var activeIdx = 0;

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!filtered.length) {
      var empty = document.createElement('div');
      empty.style.padding = '1rem';
      empty.style.fontSize = '0.875rem';
      empty.style.color = 'var(--tf-text-muted)';
      empty.textContent = 'No matching TF Unions destination.';
      listEl.appendChild(empty);
      return;
    }
    filtered.forEach(function (item, idx) {
      var a = document.createElement('a');
      a.className = 'tf-cmd-item';
      a.href = item.url;
      a.setAttribute('role', 'option');
      a.setAttribute('aria-selected', idx === activeIdx ? 'true' : 'false');
      var title = document.createElement('span');
      title.textContent = item.label;
      var cat = document.createElement('span');
      cat.className = 'tf-cmd-item__cat';
      cat.textContent = item.cat;
      a.appendChild(title);
      a.appendChild(cat);
      listEl.appendChild(a);
    });
  }

  function ensurePalette() {
    if (backdrop) return;
    backdrop = document.createElement('div');
    backdrop.id = 'tf-cmd-palette';
    backdrop.className = 'tf-cmd-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Jump across TF Unions');

    var dialog = document.createElement('div');
    dialog.className = 'tf-cmd-dialog';

    inputEl = document.createElement('input');
    inputEl.type = 'search';
    inputEl.className = 'tf-cmd-input';
    inputEl.placeholder = 'Search pages, forms, guides, docs... (Esc to close)';
    inputEl.setAttribute('aria-label', 'Search TF Unions');

    listEl = document.createElement('div');
    listEl.className = 'tf-cmd-list';
    listEl.setAttribute('role', 'listbox');

    dialog.appendChild(inputEl);
    dialog.appendChild(listEl);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closePalette();
    });

    inputEl.addEventListener('input', function () {
      var q = inputEl.value.trim().toLowerCase();
      filtered = q
        ? ITEMS.filter(function (i) {
            return i.label.toLowerCase().indexOf(q) !== -1 || i.cat.toLowerCase().indexOf(q) !== -1;
          })
        : ITEMS;
      activeIdx = 0;
      renderList();
    });

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filtered.length) activeIdx = (activeIdx + 1) % filtered.length;
        renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filtered.length) activeIdx = (activeIdx - 1 + filtered.length) % filtered.length;
        renderList();
      } else if (e.key === 'Enter' && filtered[activeIdx]) {
        e.preventDefault();
        window.location.href = filtered[activeIdx].url;
      } else if (e.key === 'Escape') {
        closePalette();
      }
    });
  }

  function openPalette() {
    ensurePalette();
    filtered = ITEMS;
    activeIdx = 0;
    inputEl.value = '';
    renderList();
    backdrop.classList.add('is-open');
    setTimeout(function () {
      inputEl.focus();
    }, 10);
  }

  function closePalette() {
    if (backdrop) backdrop.classList.remove('is-open');
  }

  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    var isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (backdrop && backdrop.classList.contains('is-open')) closePalette();
      else openPalette();
    } else if (!isInput && e.key === '/') {
      e.preventDefault();
      openPalette();
    } else if (e.key === 'Escape' && backdrop && backdrop.classList.contains('is-open')) {
      closePalette();
    }
  });

  document.addEventListener('click', function (e) {
    var trigger = e.target && e.target.closest ? e.target.closest('[data-tf-cmd-open]') : null;
    if (trigger) {
      e.preventDefault();
      openPalette();
    }
  });
})();
