# Step 4: Core n8n Automation Pipelines (`n8n.tfunions.com` / `auto.tfunions.com`)

## Overview
Contains the 7 n8n workflow definitions, automated importer script, and the HTML/CSS A4 landscape certificate template rendered via internal **Gotenberg 8**.

> Note: Public intake forms on `www.tfunions.com` and `connect.tfunions.com` submit directly to Cloud Firestore via verified schema rules and are moderated directly inside **`dashboard.tfunions.com`**. These n8n workflows handle downstream automation, certificate PDF rendering, Baserow mirroring, and Telegram notifications.

## Files & Workflows (`workflows/`)
- [`import_workflows_to_n8n.js`](./import_workflows_to_n8n.js) — Imports workflow JSON definitions into your n8n instance via REST API.
- [`templates/certificate-a4-landscape.html`](./templates/certificate-a4-landscape.html) — Print-ready HTML/CSS certificate template with SVG QR verification link (`https://verify.tfunions.com`) and founder signatures.

### Workflow Catalog
1. **[`01-sso-user-onboarding-sync.json`](./workflows/01-sso-user-onboarding-sync.json)**
   - **Trigger:** `POST /webhook/user-onboard` (`X-TF-Webhook-Secret`)
   - **Action:** Mirrors new member records into Baserow `Members_Passport`, subscribes to Listmonk digest, and sends onboarding email.
2. **[`02-volunteer-hr-auto-promotion.json`](./workflows/02-volunteer-hr-auto-promotion.json)**
   - **Trigger:** Baserow webhook on `Volunteer_HR_Pipeline` status updates.
   - **Action:** Notifies HR/Founders on application and handles custom claims/directory promotion + onboarding email upon acceptance.
3. **[`03-certificate-generator.json`](./workflows/03-certificate-generator.json)**
   - **Trigger:** Baserow webhook (`issue_certificate_trigger == true`).
   - **Action:** Generates `TFU-YYYY-XXXXXX` serial, renders [`templates/certificate-a4-landscape.html`](./templates/certificate-a4-landscape.html) to PDF via Gotenberg, stores in Cloudflare R2, updates `Certificates_Registry`, and emails the student.
4. **[`04-certificate-verifier-api.json`](./workflows/04-certificate-verifier-api.json)**
   - **Trigger:** `GET /webhook/verify-certificate?code=TFU-2026-XXXXXX`
   - **Action:** Queries Baserow `Certificates_Registry` as an auxiliary verification API endpoint alongside direct Firestore verification on `https://verify.tfunions.com`.
5. **[`05-donation-ledger-sync.json`](./workflows/05-donation-ledger-sync.json)**
   - **Trigger:** `POST /webhook/submit-donation`
   - **Action:** Logs donation receipts to `Financial_Ledger_And_Sponsors` and notifies Founders on Telegram for approval.
6. **[`06-global-qa-and-idea-voting.json`](./workflows/06-global-qa-and-idea-voting.json)**
   - **Triggers:** `POST /webhook/qa-submit` and `POST /webhook/idea-upvote`
   - **Action:** Routes QA tickets to Telegram alerts and processes verified idea upvotes.
7. **[`07-photo-moderation-r2-baserow.json`](./workflows/07-photo-moderation-r2-baserow.json)**
   - **Action:** Handles chapter/event photo submission moderation and R2 storage archiving.
