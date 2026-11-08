# Step 4: Core n8n Automation Pipelines (`auto.tfunions.org`)

## Overview
Contains the 6 foundational n8n workflow exports and the HTML/CSS certificate template rendered via internal **Gotenberg 8**.

## Workflows Outline (`workflows/`)
1. **[`01-sso-user-onboarding-sync.json`](./workflows/01-sso-user-onboarding-sync.json)**
   - **Trigger:** `POST /webhook/user-onboard` (Header: `X-TF-Webhook-Secret`)
   - **Action:** Syncs new user to Baserow `Members_Passport`, patches `baserowRowId` back to Firestore `users/{uid}`, subscribes user to Listmonk digest, and sends welcome email.
2. **[`02-volunteer-hr-auto-promotion.json`](./workflows/02-volunteer-hr-auto-promotion.json)**
   - **Trigger:** Baserow webhook on `Volunteer_HR_Pipeline.status` change.
   - **Action:** On `1_Applied`, notifies Founders' Telegram + emails applicant. On `4_Accepted`, updates Firebase Custom Claims, sets `Members_Passport.ecosystem_role = Volunteer`, adds public entry to `Public_Team_Directory`, triggers Cloudflare Pages rebuild of `tfunions.org/team`, and emails onboarding kit.
3. **[`03-certificate-generator.json`](./workflows/03-certificate-generator.json)**
   - **Trigger:** Baserow webhook when `Volunteer_HR_Pipeline.issue_certificate_trigger == true`.
   - **Action:** Generates `TFU-YYYY-XXXXXX` serial, injects data + SVG QR into [`templates/certificate-a4-landscape.html`](./templates/certificate-a4-landscape.html), converts to PDF via `http://gotenberg:3000/forms/chromium/convert/html`, uploads to Cloudflare R2 (`tf-certificates`), logs to `Certificates_Registry`, and emails PDF to student.
4. **[`04-certificate-verifier-api.json`](./workflows/04-certificate-verifier-api.json)**
   - **Trigger:** `GET /webhook/verify-certificate?code=TFU-2026-XXXXXX`
   - **Action:** Validates format, queries `Certificates_Registry`, and returns public verification JSON (or HTTP 404 if revoked/missing) with CORS enabled for `https://verify.tfunions.org`.
5. **[`05-donation-ledger-sync.json`](./workflows/05-donation-ledger-sync.json)**
   - **Trigger:** `POST /webhook/submit-donation`
   - **Action:** Logs pending donation to `Financial_Ledger_And_Sponsors`, sends InstaPay proof to Founders' Telegram with `[✅ Approve & Publish]` / `[❌ Reject]` callback buttons, and publishes to `/transparency` upon approval.
6. **[`06-global-qa-and-idea-voting.json`](./workflows/06-global-qa-and-idea-voting.json)**
   - **Triggers:** `POST /webhook/qa-submit` and `POST /webhook/idea-upvote`
   - **Action:** Triages bug reports to `#qa-alerts` Telegram topic and handles deduplicated Firebase ID token upvoting on student ideas.
