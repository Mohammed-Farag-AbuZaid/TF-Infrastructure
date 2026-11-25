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

  var ALLOWED_EVENTS = {
    signup: true,
    signin: true,
    idea_submit: true,
    volunteer_apply: true,
    donation_receipt: true,
    certificate_verify: true,
  };

  window.tfTrack = function (eventName, props) {
    try {
      if (navigator && navigator.doNotTrack === '1') return;
      if (!ALLOWED_EVENTS[eventName]) return;
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track(eventName, props || {});
      }
    } catch (_) {}
  };

  var ITEMS = [
    { label: 'Foundation Home', url: 'https://www.tfunions.com/', cat: 'Home' },
    { label: 'Arabic Home (العربية)', url: 'https://www.tfunions.com/ar/', cat: 'Home' },
    { label: 'Divisions & Programs', url: 'https://www.tfunions.com/divisions', cat: 'Home' },
    { label: 'Team & Governance', url: 'https://www.tfunions.com/team', cat: 'Trust' },
    { label: 'Open Financial Ledger', url: 'https://www.tfunions.com/transparency', cat: 'Trust' },
    { label: 'Charter & Bylaws', url: 'https://www.tfunions.com/charter', cat: 'Trust' },
    { label: 'Volunteer', url: 'https://www.tfunions.com/volunteer', cat: 'Act' },
    { label: 'Ideas Backlog', url: 'https://www.tfunions.com/ideas', cat: 'Act' },
    { label: 'Support', url: 'https://www.tfunions.com/support', cat: 'Act' },
    { label: 'TF Dashboard', url: 'https://dashboard.tfunions.com/', cat: 'Act' },
    { label: 'TF News', url: 'https://news.tfunions.com/', cat: 'Learn' },
    { label: 'TF Guides', url: 'https://guides.tfunions.com/', cat: 'Learn' },
    { label: 'TF Connect', url: 'https://connect.tfunions.com/', cat: 'Join' },
    { label: 'TF Verify', url: 'https://verify.tfunions.com/', cat: 'Trust' },
    { label: 'TF Docs', url: 'https://docs.tfunions.com/', cat: 'Learn' },
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

  // Live visual copy + global text replacement hydration from Firestore siteCopy/{pageKey}
  if (typeof document !== 'undefined' && !document.getElementById('dash-shell')) {
    var lastCopyFetch = 0;
    function hydrateSiteCopy(force) {
      if (document.getElementById('dash-shell')) return;
      var now = Date.now();
      if (!force && now - lastCopyFetch < 1500) return;
      lastCopyFetch = now;
      var url = 'https://firestore.googleapis.com/v1/projects/tf-unions/databases/(default)/documents/siteCopy?pageSize=200';
      fetch(url, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || !Array.isArray(data.documents)) return;
          var flat = {};
          var globalRules = [];
          data.documents.forEach(function (doc) {
            var pageKey = doc.name.split('/').pop();
            var fields = doc.fields || {};
            if (pageKey === '_global') {
              var rawJson = fields.replacementsJson && fields.replacementsJson.stringValue;
              if (rawJson) {
                try {
                  var parsed = JSON.parse(rawJson);
                  if (Array.isArray(parsed)) {
                    parsed.forEach(function (rule) {
                      if (rule && typeof rule.from === 'string' && rule.from && typeof rule.to === 'string') {
                        globalRules.push({ from: rule.from, to: rule.to });
                      }
                    });
                  }
                } catch (_) {}
              }
              return;
            }
            Object.keys(fields).forEach(function (k) {
              var v = fields[k];
              if (v && typeof v.stringValue === 'string' && v.stringValue.trim()) {
                flat[pageKey + '.' + k] = v.stringValue;
              }
            });
          });

          document.querySelectorAll('[data-tf-copy]').forEach(function (el) {
            var isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
            if (!el.dataset.tfOrigSet) {
              el.dataset.tfOrig = isInput ? (el.getAttribute('placeholder') || '') : (el.textContent || '');
              el.dataset.tfOrigSet = '1';
            }
            var key = el.getAttribute('data-tf-copy');
            var val = (key && Object.prototype.hasOwnProperty.call(flat, key)) ? flat[key] : el.dataset.tfOrig;
            if (isInput) {
              if (el.getAttribute('placeholder') !== val) el.setAttribute('placeholder', val);
            } else {
              if (el.textContent !== val) el.textContent = val;
            }
          });

          if ((globalRules.length > 0 || window.__tfHadGlobalRules) && document.body && document.createTreeWalker) {
            window.__tfHadGlobalRules = globalRules.length > 0;
            var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            var textNodes = [];
            var current;
            while ((current = walker.nextNode())) {
              var parent = current.parentElement;
              if (!parent || parent.closest('script, style, noscript, input, textarea, code, pre')) continue;
              textNodes.push(current);
            }
            textNodes.forEach(function (node) {
              if (typeof node.__tfOrigText !== 'string') {
                node.__tfOrigText = node.nodeValue || '';
              }
              var baseTxt = node.__tfOrigText;
              if (!baseTxt || !baseTxt.trim()) return;
              var nextTxt = baseTxt;
              globalRules.forEach(function (rule) {
                if (nextTxt.indexOf(rule.from) !== -1) {
                  nextTxt = nextTxt.split(rule.from).join(rule.to);
                }
              });
              if (node.nodeValue !== nextTxt) node.nodeValue = nextTxt;
            });
          }
        })
        .catch(function () {});
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { hydrateSiteCopy(true); });
    } else {
      hydrateSiteCopy(true);
    }
    window.addEventListener('focus', function () { hydrateSiteCopy(false); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) hydrateSiteCopy(false);
    });
    window.tfRefreshCopy = function () { hydrateSiteCopy(true); };
  }
})();
