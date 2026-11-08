# Step 2: Complete Database Schemas (Firestore + Baserow)

## Overview
Defines the two-tier persistence architecture for TF Unions:
1. **Cloud Firestore (`firestore/`)**: High-concurrency student identity & profile layer (`users/{firebase_uid}`).
2. **Baserow Relational Database (`baserow/`)**: Internal back-office CRM, Volunteer HR, Public Team Directory, Certificate Registry, Open-Book Financial Ledger, and Global QA/Idea Incubator (`ops.tfunions.org`).

## Files Outline
- [`firestore/firestore.rules`](./firestore/firestore.rules) — Security rules enforcing student self-service creation and founder/core-team protection on privileged fields (`role`, `badges`, `baserowRowId`).
- [`firestore/firestore.indexes.json`](./firestore/firestore.indexes.json) — Composite index definitions.
- [`firestore/user-schema.json`](./firestore/user-schema.json) — Canonical JSON schema for `users/{firebase_uid}` and Firebase Auth Custom Claims.
- [`baserow/schema-definition.json`](./baserow/schema-definition.json) — Complete declarative specification of the `TF_Unions_Core` workspace and its 6 linked tables:
  1. `Members_Passport`
  2. `Volunteer_HR_Pipeline`
  3. `Public_Team_Directory`
  4. `Certificates_Registry`
  5. `Financial_Ledger_And_Sponsors`
  6. `QA_Tickets_And_Idea_Incubator`
- [`baserow/bootstrap_baserow.py`](./baserow/bootstrap_baserow.py) — Automated Python script to provision the workspace, tables, and fields against the Baserow REST API.
