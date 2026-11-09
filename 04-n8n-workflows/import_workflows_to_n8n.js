const fs = require('fs');
const path = require('path');

const apiKey = process.env.N8N_API_KEY;
const baseUrl = (process.env.N8N_API_URL || 'https://n8n.tfunions.com/api/v1').replace(/\/$/, '');
const dir = path.join(__dirname, 'workflows');

if (!apiKey) {
  console.error('Please set N8N_API_KEY environment variable');
  process.exit(1);
}

(async () => {
  const existingRes = await fetch(baseUrl + '/workflows', {
    headers: { 'X-N8N-API-KEY': apiKey },
  }).then((r) => r.json());

  const existingByName = {};
  for (const w of existingRes.data || []) {
    existingByName[w.name] = w.id;
  }

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const wf = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const payload = {
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: wf.settings || { executionOrder: 'v1' },
    };
    const existingId = existingByName[wf.name];
    const url = existingId ? `${baseUrl}/workflows/${existingId}` : `${baseUrl}/workflows`;
    const method = existingId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const out = await res.json();
    console.log(`✅ ${method} ${wf.name} -> HTTP ${res.status} (ID: ${out.id || out.message})`);
  }
})();
