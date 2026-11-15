/**
 * TF Unions Global Feedback & QA Web Component (<tf-qa-widget>)
 * Styled to match Calm Alabaster & Fjord Slate (#FFFFFF sheet, #DFDDD6 border, #1B365D action).
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
          height: 38px;
          padding: 0 15px;
          border-radius: 9px;
          background: #FFFFFF;
          color: #161A22;
          border: 1px solid #DFDDD6;
          box-shadow: 0 2px 8px rgba(22, 26, 34, 0.08);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .trigger:hover { border-color: #1B365D; color: #1B365D; }
        .backdrop {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(22, 26, 34, 0.42);
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
          border: 1px solid #DFDDD6;
          border-radius: 12px;
          overflow: hidden;
          color: #161A22;
          box-shadow: 0 16px 36px rgba(22, 26, 34, 0.14);
        }
        .top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #F3F2EE;
          color: #161A22;
          padding: 16px 20px;
          border-bottom: 1px solid #DFDDD6;
        }
        .title { font-family: 'Bricolage Grotesque', sans-serif; font-size: 18px; font-weight: 700; margin: 0; }
        .close { background: #FFFFFF; border: 1px solid #DFDDD6; border-radius: 8px; color: #525866; font-size: 13px; cursor: pointer; width: 28px; height: 28px; }
        .close:hover { color: #161A22; border-color: #B8B4A8; }
        .body { padding: 20px; }
        .field {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          background: #EAE8E1;
          border: 1px solid #DFDDD6;
          color: #161A22;
          font-size: 13.5px;
          margin-bottom: 12px;
          outline: none;
        }
        .field:focus { border-color: #1B365D; background: #FFFFFF; }
        .btn {
          width: 100%;
          height: 40px;
          border-radius: 8px;
          background: #1B365D;
          color: #FFFFFF;
          border: none;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn:hover { background: #132847; }
        .msg { font-size: 13px; color: #0F766E; margin-top: 10px; display: none; font-weight: 500; }
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
