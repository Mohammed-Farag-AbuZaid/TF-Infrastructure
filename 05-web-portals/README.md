# Step 5: Public Web Portals & Global Widgets

## Overview
Contains the Astro 5 frontend applications deployed on **Cloudflare Pages** (Free Tier):

1. **[`foundation-portal/`](./foundation-portal) (`tfunions.org`)**
   - `/` — Ecosystem Landing Page, product grid (**TF News**, **TF Connect**, **TF Guide**), live impact counters, and SSO CTA.
   - `/about` & `/charter` — Non-profit mission, project selection criteria, and governance charter.
   - `/team` — Dynamic Team & Contributors Wall pulled from Baserow `Public_Team_Directory`.
   - `/volunteer` — Seasonal Role Board & application form connected to n8n Workflow #2.
   - `/support` & `/transparency` — Individual donations (InstaPay QR, Vodafone Cash, Open Collective), Corporate Sponsor Deck, and the 100% transparent Open-Book Financial Ledger.
   - `/ideas` — Student Problem & Project Incubator with live upvoting.
   - `public/widgets/tf-qa-widget.js` — Lightweight (`<4 KB`) embeddable `<tf-qa-widget>` Web Component included across all TF Unions services.
2. **[`verify-portal/`](./verify-portal) (`verify.tfunions.org`)**
   - Instant credential & certificate verification portal backed by n8n Workflow #4 (`GET /webhook/verify-certificate`).
3. **[`docs-portal/`](./docs-portal) (`docs.tfunions.org`)**
   - Astro Starlight documentation portal hosting the official TF Unions Wiki, Student FAQ, and Governance Charter.
