/**
 * TF Unions Global Feedback & QA Web Component (<tf-qa-widget>)
 * Styled to match TF Oxford & Stone (#0A1931 header, #FFFFFF sheet, #CFCBC2 border, #C88A14 brass accent).
 */
class TfQaWidget extends HTMLElement {
  connectedCallback() {
    const service = this.getAttribute('service') || 'Foundation_Portal';
    const root = this.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
        .trigger {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9998;
          height: 40px;
          padding: 0 16px;
          border-radius: 6px;
          background: #0A1931;
          color: #FFFFFF;
          border: 1.5px solid #C88A14;
          box-shadow: 0 4px 12px rgba(10, 25, 49, 0.18);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .trigger:hover { background: #14388C; }
        .backdrop {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(10, 25, 49, 0.52);
          z-index: 9999;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .backdrop.open { display: flex; }
        .sheet {
          width: 100%;
          max-width: 440px;
          background: #FFFFFF;
          border: 1px solid #CFCBC2;
          border-radius: 8px;
          overflow: hidden;
          color: #12161F;
          box-shadow: 0 18px 40px rgba(10, 25, 49, 0.24);
        }
        .top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #0A1931;
          color: #FFFFFF;
          padding: 16px 20px;
          border-bottom: 2px solid #C88A14;
        }
        .title { font-family: 'Newsreader', Georgia, serif; font-size: 20px; font-weight: 700; margin: 0; }
        .close { background: #102447; border: 1px solid #1E3A6D; border-radius: 6px; color: #FFFFFF; font-size: 14px; cursor: pointer; width: 30px; height: 30px; }
        .body { padding: 20px; }
        .field {
          width: 100%;
          padding: 11px 13px;
          border-radius: 6px;
          background: #ECEAE4;
          border: 1px solid #CFCBC2;
          color: #12161F;
          font-size: 14px;
          margin-bottom: 12px;
          outline: none;
        }
        .field:focus { border-color: #14388C; background: #FFFFFF; }
        .btn {
          width: 100%;
          height: 42px;
          border-radius: 6px;
          background: #14388C;
          color: #FFFFFF;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn:hover { background: #0F2C70; }
        .msg { font-size: 13px; color: #15803D; margin-top: 10px; display: none; font-weight: 600; }
      </style>
      <button class="trigger" id="open-btn">Feedback</button>
      <div class="backdrop" id="modal">
        <div class="sheet">
          <div class="top">
            <h3 class="title">Report issue or suggestion</h3>
            <button class="close" id="close-btn" aria-label="Close">✕</button>
          </div>
          <div class="body">
            <form id="qa-form">
              <select class="field" id="type">
                <option value="Bug_Report">Report a technical issue</option>
                <option value="Project_Idea">Suggest a portal improvement</option>
              </select>
              <input class="field" id="title" type="text" required placeholder="Short summary" />
              <textarea class="field" id="desc" rows="3" required placeholder="Details and page context"></textarea>
              <button class="btn" type="submit">Send to Engineering</button>
              <div class="msg" id="msg">Sent to engineering queue. Thank you.</div>
            </form>
          </div>
        </div>
      </div>
    `;

    const modal = root.getElementById('modal');
    root.getElementById('open-btn').onclick = () => modal.classList.add('open');
    root.getElementById('close-btn').onclick = () => modal.classList.remove('open');
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('open');
    };

    root.getElementById('qa-form').onsubmit = async (e) => {
      e.preventDefault();
      const msg = root.getElementById('msg');
      await fetch('https://n8n.tfunions.com/tf-api/api/qa-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionType: root.getElementById('type').value,
          service,
          title: root.getElementById('title').value.trim(),
          description: root.getElementById('desc').value.trim(),
          pageUrl: window.location.href,
        }),
      }).catch(() => {});
      msg.style.display = 'block';
      setTimeout(() => {
        msg.style.display = 'none';
        modal.classList.remove('open');
        root.getElementById('qa-form').reset();
      }, 900);
    };
  }
}

if (!customElements.get('tf-qa-widget')) {
  customElements.define('tf-qa-widget', TfQaWidget);
}
