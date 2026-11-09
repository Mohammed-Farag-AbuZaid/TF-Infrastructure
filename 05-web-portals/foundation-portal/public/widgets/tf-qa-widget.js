/**
 * Minimalist Feedback & QA Web Component (`<tf-qa-widget>`)
 * Matches `tf_minimal.dart`: quiet pill button, white modal with hairline border, #F5F5F7 inputs, #002583 button.
 */
class TfQaWidget extends HTMLElement {
  connectedCallback() {
    const service = this.getAttribute('service') || 'Foundation_Portal';
    const root = this.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        * { box-sizing: border-box; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .trigger {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9998;
          height: 38px;
          padding: 0 14px;
          border-radius: 999px;
          background: #F5F5F7;
          color: #1D1D1F;
          border: 1px solid #D2D2D7;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .trigger:hover { background: #E8E8ED; }
        .backdrop {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(29, 29, 31, 0.25);
          z-index: 9999;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .backdrop.open { display: flex; }
        .sheet {
          width: 100%;
          max-width: 400px;
          background: #FFFFFF;
          border: 1px solid #D2D2D7;
          border-radius: 20px;
          padding: 24px;
          color: #1D1D1F;
        }
        .top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .title { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; margin: 0; }
        .close { background: none; border: none; color: #6E6E73; font-size: 18px; cursor: pointer; padding: 4px; }
        .field {
          width: 100%;
          padding: 13px 14px;
          border-radius: 12px;
          background: #F5F5F7;
          border: 1.5px solid transparent;
          color: #1D1D1F;
          font-size: 14px;
          margin-bottom: 10px;
          outline: none;
        }
        .field:focus { border-color: #002583; background: #FFFFFF; }
        .btn {
          width: 100%;
          height: 44px;
          border-radius: 12px;
          background: #002583;
          color: #FFFFFF;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .msg { font-size: 13px; color: #15803D; margin-top: 8px; display: none; }
      </style>
      <button class="trigger" id="open-btn">Feedback</button>
      <div class="backdrop" id="modal">
        <div class="sheet">
          <div class="top">
            <h3 class="title">Report issue or idea</h3>
            <button class="close" id="close-btn">✕</button>
          </div>
          <form id="qa-form">
            <select class="field" id="type">
              <option value="Bug_Report">Report an issue</option>
              <option value="Project_Idea">Suggest an improvement</option>
            </select>
            <input class="field" id="title" type="text" required placeholder="Short summary" />
            <textarea class="field" id="desc" rows="3" required placeholder="Details"></textarea>
            <button class="btn" type="submit">Send</button>
            <div class="msg" id="msg">Sent. Thank you.</div>
          </form>
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
