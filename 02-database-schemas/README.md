# Step 2: Database Schemas & Zero-Trust RBAC (Firestore + Baserow)

## Overview
Defines TF Unions' two-tier persistence layer:
1. **Cloud Firestore (`firestore/`)**: Live public/private portal backend & Owner Dashboard store with fine-grained permission-based RBAC rules and strict PII isolation.
2. **Baserow Relational Database (`baserow/`)**: Internal back-office CRM and relational backup tables hosted on `ops.tfunions.com`.

---

## Firestore (`firestore/`)

- [`firebase.json`](./firebase.json) — Firebase project configuration targeting `firestore.rules` and `firestore.indexes.json`.
- [`firestore.rules`](./firestore.rules) — Enforces verified-email RBAC, dynamic custom role permissions via `/staffAccess` & `/roleDefinitions`, strict self-write anti-escalation on `/users`, zero-PII enforcement (`!hasAny(['email', 'phone', 'age'])`) on public `/teamMembers`, and default deny catch-all.
- [`firestore.indexes.json`](./firestore.indexes.json) — Composite query index definitions.
- [`user-schema.json`](./user-schema.json) — Reference schema for student profiles & custom claims.
- [`test/rules.test.mjs`](./test/rules.test.mjs) — 15 automated unit tests validating all rule guarantees.

### Firestore Collection Map
| Scope | Collections | Access Policy |
| :--- | :--- | :--- |
| **Identity & RBAC** | `users`, `usernames`, `staffAccess`, `roleDefinitions` | Self-read + Admin / `manage_access` / `edit_team` controls |
| **Public Content (PII-Free)** | `teamMembers`, `ledgerEntries`, `siteCopy`, `siteConfig`, `chapters`, `guides`, `opportunities`, `allProjects`, `inProgressProjects`, `upcomingProjects`, `ideas`, `certificates` | Public read; permission-gated writes (`edit_team`, `edit_ledger`, `edit_site_copy`, `edit_chapters`, `edit_guides`, `edit_opportunities`, `manage_certificates`) |
| **Bounded Public Intake** | `volunteers`, `donations`, `photoSubmissions` | Public create with schema bounds (`status == 'pending'`); read/moderate restricted to staff/leads/owner |
| **Team Operations & Audit** | `tasks`, `timeLogs`, `recognitions`, `auditLogs` | Verified staff/admin only (`auditLogs` strictly append-only) |

### Running Tests & Deploying Rules
```bash
cd 02-database-schemas/firestore
node test/rules.test.mjs
firebase deploy --only firestore:rules --project tf-unions
```

---

## Baserow (`baserow/`)
- [`schema-definition.json`](./baserow/schema-definition.json) — Declarative definition of `TF_Unions_Core` (`Members_Passport`, `Volunteer_HR_Pipeline`, `Public_Team_Directory`, `Certificates_Registry`, `Financial_Ledger_And_Sponsors`, `QA_Tickets_And_Idea_Incubator`).
- [`bootstrap_baserow.py`](./baserow/bootstrap_baserow.py) — Python script to provision the Baserow workspace, tables, and fields via API.
