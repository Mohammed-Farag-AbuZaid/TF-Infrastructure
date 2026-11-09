/**
 * TF Unions — Global QA & Bug Reporter Web Component (<4KB)
 * Connected to Self-Hosted VPS API (`https://n8n.tfunions.com/tf-api/api/qa-submit`)
 */
(function () {
  if (customElements.get('tf-qa-widget')) return;

  function getUserHintUid() {
    try {
      const m = document.cookie.match(/(?:^|;\s*)tf_user_hint=([^;]*)/);
      if (!m) return '';
      return JSON.parse(decodeURIComponent(m[1])).uid || '';
    } catch {
      return '';
    }
  }

  class TfQaWidget extends HTMLElement {
    connectedCallback() {
      const service = this.getAttribute('service') || 'Foundation_Portal';
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>
        :host{position:fixed;bottom:18px;left:18px;z-index:99999;font-family:Inter,system-ui,sans-serif}
        .btn{background:#070E24;color:#fff;border:1px solid rgba(255,184,0,.45);border-radius:99px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;align-items:center;gap:6px;transition:transform .15s}
        .btn:hover{transform:translateY(-2px);border-color:#FFB800}
        .modal{display:none;position:fixed;bottom:64px;left:18px;width:310px;background:#0C1636;color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:16px;box-shadow:0 16px 40px rgba(0,0,0,.5)}
        .modal.open{display:block}
        h4{margin:0 0 10px;font-size:14px;color:#FFB800}
        select,input,textarea{width:100%;box-sizing:border-box;margin-bottom:8px;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:#070E24;color:#fff;font-size:12px}
        .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
        .sub{background:#FFB800;color:#070E24;border:0;padding:7px 12px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer}
        .can{background:transparent;color:#94a3b8;border:0;font-size:12px;cursor:pointer}
        .msg{font-size:11px;color:#34d399;margin-top:6px;display:none}
      </style>
      <button class="btn" id="tg" type="button">🛠️ Report Bug / Suggest Fix</button>
      <div class="modal" id="md">
        <h4>QA & Feedback (${service.replace(/_/g, ' ')})</h4>
        <form id="fm">
          <select id="tp">
            <option value="Bug_Report">Bug Report</option>
            <option value="Broken_Link_Or_Typo">Broken Link / Typo</option>
            <option value="Feature_Request">Feature Request</option>
            <option value="Project_Idea">Project Idea</option>
          </select>
          <input id="ti" required placeholder="Short summary..." />
          <textarea id="ds" rows="3" required placeholder="Steps to reproduce or suggestion..."></textarea>
          <div class="actions">
            <button type="button" class="can" id="cl">Cancel</button>
            <button type="submit" class="sub" id="sb">Send Report</button>
          </div>
          <div class="msg" id="ok">✅ Sent to TF Unions QA & Zain Bot!</div>
        </form>
      </div>`;

      const md = root.getElementById('md');
      root.getElementById('tg').onclick = () => md.classList.toggle('open');
      root.getElementById('cl').onclick = () => md.classList.remove('open');
      root.getElementById('fm').onsubmit = async (e) => {
        e.preventDefault();
        const sb = root.getElementById('sb');
        sb.disabled = true;
        try {
          await fetch('https://n8n.tfunions.com/tf-api/api/qa-submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service,
              submissionType: root.getElementById('tp').value,
              title: root.getElementById('ti').value,
              description: root.getElementById('ds').value,
              pageUrl: window.location.href,
              userAgent: navigator.userAgent,
              uid: getUserHintUid(),
            }),
          });
          root.getElementById('ok').style.display = 'block';
          setTimeout(() => {
            md.classList.remove('open');
            root.getElementById('fm').reset();
            root.getElementById('ok').style.display = 'none';
            sb.disabled = false;
          }, 1400);
        } catch {
          sb.disabled = false;
        }
      };
    }
  }

  customElements.define('tf-qa-widget', TfQaWidget);
})();
