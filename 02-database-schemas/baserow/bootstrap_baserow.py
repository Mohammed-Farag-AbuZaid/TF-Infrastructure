#!/usr/bin/env python3
"""
TF Unions — Automated Baserow Workspace & 6-Table Bootstrap Script
Target: https://ops.tfunions.org (or local Docker http://localhost:80)

Usage:
    export BASEROW_URL="https://ops.tfunions.org"
    export BASEROW_EMAIL="founders@tfunions.org"
    export BASEROW_PASSWORD="your_admin_password"
    python3 bootstrap_baserow.py
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

BASEROW_URL = os.environ.get("BASEROW_URL", "https://ops.tfunions.org").rstrip("/")
BASEROW_EMAIL = os.environ.get("BASEROW_EMAIL", "founders@tfunions.org")
BASEROW_PASSWORD = os.environ.get("BASEROW_PASSWORD", "")

SCHEMA_PATH = Path(__file__).parent / "schema-definition.json"


def api_request(method: str, path: str, token: str = None, payload: dict = None, is_db_token: bool = False):
    url = f"{BASEROW_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        prefix = "Token" if is_db_token else "JWT"
        headers["Authorization"] = f"{prefix} {token}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"❌ HTTP {e.code} on {method} {path}: {err_body}", file=sys.stderr)
        raise


def main():
    if not BASEROW_PASSWORD:
        print("⚠️  Please set BASEROW_PASSWORD environment variable before running.", file=sys.stderr)
        sys.exit(1)

    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema = json.load(f)

    print(f"🔐 Authenticating with Baserow at {BASEROW_URL}...")
    try:
        auth = api_request("POST", "/api/user/token-auth/", payload={
            "email": BASEROW_EMAIL,
            "password": BASEROW_PASSWORD,
        })
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print(f"👤 Registering initial Baserow admin account ({BASEROW_EMAIL})...")
            auth = api_request("POST", "/api/user/", payload={
                "name": "TF Unions Admin",
                "email": BASEROW_EMAIL,
                "password": BASEROW_PASSWORD,
                "authenticate": True,
            })
        else:
            raise
    jwt_token = auth["token"]

    # 1. Create or locate Workspace `TF_Unions_Core`
    workspaces = api_request("GET", "/api/workspaces/", token=jwt_token)
    ws = next((w for w in workspaces if w["name"] == schema["workspace_name"]), None)
    if not ws:
        print(f"📁 Creating workspace '{schema['workspace_name']}'...")
        ws = api_request("POST", "/api/workspaces/", token=jwt_token, payload={"name": schema["workspace_name"]})
    else:
        print(f"✅ Found existing workspace '{ws['name']}' (ID: {ws['id']})")

    # 2. Create Database Application inside Workspace
    apps = api_request("GET", f"/api/applications/workspace/{ws['id']}/", token=jwt_token)
    db_app = next((a for a in apps if a["name"] == schema["database_name"] and a["type"] == "database"), None)
    if not db_app:
        print(f"🗄️  Creating database '{schema['database_name']}'...")
        db_app = api_request(
            "POST",
            f"/api/applications/workspace/{ws['id']}/",
            token=jwt_token,
            payload={"name": schema["database_name"], "type": "database"},
        )
    else:
        print(f"✅ Found existing database '{db_app['name']}' (ID: {db_app['id']})")

    # 3. Create all 6 tables first so we have table IDs for `link_row` fields
    existing_tables = api_request("GET", f"/api/database/tables/database/{db_app['id']}/", token=jwt_token)
    table_map = {t["name"]: t["id"] for t in existing_tables}

    for tbl_spec in schema["tables"]:
        t_name = tbl_spec["name"]
        if t_name not in table_map:
            print(f"📋 Creating table '{t_name}'...")
            created = api_request(
                "POST",
                f"/api/database/tables/database/{db_app['id']}/",
                token=jwt_token,
                payload={"name": t_name},
            )
            table_map[t_name] = created["id"]
        else:
            print(f"✅ Table '{t_name}' already exists (ID: {table_map[t_name]})")

    # 4. Configure primary & secondary fields for each table
    # Pass 1: Standard & link_row fields; Pass 2: lookup fields
    lookup_queue = []

    for tbl_spec in schema["tables"]:
        t_name = tbl_spec["name"]
        t_id = table_map[t_name]
        existing_fields = api_request("GET", f"/api/database/fields/table/{t_id}/", token=jwt_token)
        field_by_name = {fld["name"]: fld for fld in existing_fields}
        primary_existing = next((fld for fld in existing_fields if fld.get("primary")), None)

        for fld_spec in tbl_spec["fields"]:
            f_name = fld_spec["name"]
            f_type = fld_spec["type"]

            if fld_spec.get("primary"):
                if primary_existing and primary_existing["name"] != f_name:
                    print(f"  🔧 Updating primary field on '{t_name}' -> '{f_name}' ({f_type})")
                    api_request(
                        "PATCH",
                        f"/api/database/fields/{primary_existing['id']}/",
                        token=jwt_token,
                        payload={"name": f_name, "type": f_type},
                    )
                continue

            if f_name in field_by_name:
                continue

            if f_type == "lookup":
                lookup_queue.append((t_id, t_name, fld_spec))
                continue

            payload = {"name": f_name, "type": f_type}
            if f_type in ("single_select", "multiple_select"):
                payload["select_options"] = fld_spec.get("select_options", [])
            elif f_type == "link_row":
                payload["link_row_table_id"] = table_map[fld_spec["link_row_table"]]
            elif f_type == "number":
                payload["number_decimal_places"] = fld_spec.get("number_decimal_places", 0)
            elif f_type == "date":
                payload["date_format"] = fld_spec.get("date_format", "ISO")

            print(f"  ➕ Adding field '{t_name}.{f_name}' ({f_type})")
            api_request("POST", f"/api/database/fields/table/{t_id}/", token=jwt_token, payload=payload)

    # Pass 2: Lookup fields
    for t_id, t_name, fld_spec in lookup_queue:
        f_name = fld_spec["name"]
        print(f"  🔍 Adding lookup field '{t_name}.{f_name}'")
        api_request(
            "POST",
            f"/api/database/fields/table/{t_id}/",
            token=jwt_token,
            payload={
                "name": f_name,
                "type": "lookup",
                "through_field_name": fld_spec["through_field"],
                "target_field_name": fld_spec["target_field"],
            },
        )

    # 5. Seed Founders into Public_Team_Directory if empty
    team_table_id = table_map["Public_Team_Directory"]
    rows_resp = api_request("GET", f"/api/database/rows/table/{team_table_id}/?user_field_names=true", token=jwt_token)
    if rows_resp.get("count", 0) == 0:
        for seed_row in schema.get("seed_rows", {}).get("Public_Team_Directory", []):
            print(f"🌱 Seeding Public_Team_Directory row: {seed_row['display_name']}")
            api_request(
                "POST",
                f"/api/database/rows/table/{team_table_id}/?user_field_names=true",
                token=jwt_token,
                payload=seed_row,
            )

    # 6. Create or retrieve Database Token for n8n & API automation
    tokens = api_request("GET", "/api/database/tokens/", token=jwt_token)
    db_token_obj = next((t for t in tokens if t["name"] == "TF_N8N_API_TOKEN" and t["workspace"] == ws["id"]), None)
    if not db_token_obj:
        print("🔑 Creating Baserow Database Token 'TF_N8N_API_TOKEN'...")
        db_token_obj = api_request(
            "POST",
            "/api/database/tokens/",
            token=jwt_token,
            payload={"name": "TF_N8N_API_TOKEN", "workspace": ws["id"]},
        )

    output_meta = {
        "workspace_id": ws["id"],
        "database_id": db_app["id"],
        "db_api_token": db_token_obj.get("key"),
        "tables": table_map,
    }
    meta_path = Path(__file__).parent / "baserow-provisioned.json"
    with open(meta_path, "w", encoding="utf-8") as mf:
        json.dump(output_meta, mf, indent=2)

    print("\n🎉 Baserow Workspace 'TF_Unions_Core' and all 6 tables are provisioned!")
    print("Provisioned Metadata (saved to baserow-provisioned.json):")
    print(json.dumps(output_meta, indent=2))


if __name__ == "__main__":
    main()
