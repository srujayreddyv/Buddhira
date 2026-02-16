"""
Seed script — run once to populate demo data for a user.

Usage:
    cd backend
    source venv/bin/activate
    python seed.py <user_id>

Get your user_id from:
  - The /me endpoint after signing in
  - Supabase Dashboard → Authentication → Users
"""

import sys
from app.config import settings
from supabase import create_client

if len(sys.argv) < 2:
    print("Usage: python seed.py <user_id>")
    sys.exit(1)

user_id = sys.argv[1]
sb = create_client(settings.supabase_url, settings.supabase_key)

# ── Tags ────────────────────────────────────────────────────────────────────

tag_names = ["ideas", "aws", "python", "reading-list", "devops"]
tags = {}
for name in tag_names:
    row = sb.table("tags").upsert(
        {"user_id": user_id, "name": name},
        on_conflict="user_id,name",
    ).execute()
    tags[name] = row.data[0]["id"]
    print(f"  Tag: {name} → {tags[name]}")

# ── Items ───────────────────────────────────────────────────────────────────

items_data = [
    {
        "type": "note",
        "title": "Buddhira product principles",
        "content": "1. Capture in under 10 seconds\n2. Every item needs 'why this matters'\n3. Tags over folders\n4. Inbox zero is the goal",
        "why_this_matters": "These are the design constraints for the whole app.",
        "state": "active",
        "is_pinned": True,
        "tags": ["ideas"],
    },
    {
        "type": "link",
        "title": "AWS Well-Architected Framework",
        "url": "https://aws.amazon.com/architecture/well-architected/",
        "content": "The 6 pillars of cloud architecture. Good reference for system design interviews.",
        "why_this_matters": "Foundational mental model for building on AWS.",
        "state": "inbox",
        "tags": ["aws", "reading-list"],
    },
    {
        "type": "snippet",
        "title": "Python dataclass with slots",
        "content": "from dataclasses import dataclass\n\n@dataclass(slots=True)\nclass Point:\n    x: float\n    y: float\n\n# slots=True prevents __dict__, saves memory",
        "why_this_matters": "Faster attribute access, lower memory — use for hot-path objects.",
        "state": "active",
        "tags": ["python"],
    },
    {
        "type": "link",
        "title": "Terraform best practices — HashiCorp",
        "url": "https://developer.hashicorp.com/terraform/cloud-docs/recommended-practices",
        "content": "Module structure, state management, workspace patterns.",
        "state": "inbox",
        "tags": ["devops", "reading-list"],
    },
    {
        "type": "note",
        "title": "Second brain capture workflow",
        "content": "1. Capture quickly (inbox)\n2. Clarify — add 'why this matters'\n3. Organize with tags\n4. Activate when working on it\n5. Archive when done",
        "why_this_matters": "This is the GTD-inspired loop that keeps the system useful.",
        "state": "active",
        "tags": ["ideas"],
    },
    {
        "type": "snippet",
        "title": "AWS CLI — list S3 buckets by size",
        "content": "aws s3api list-buckets --query 'Buckets[].Name' --output text | \\\n  xargs -I {} aws s3 ls s3://{} --summarize --recursive | \\\n  grep 'Total Size'",
        "why_this_matters": "Useful for cost audits — find the biggest buckets fast.",
        "state": "inbox",
        "tags": ["aws", "devops"],
    },
    {
        "type": "link",
        "title": "FastAPI advanced middleware patterns",
        "url": "https://fastapi.tiangolo.com/advanced/middleware/",
        "content": "Custom middleware, CORS deep dive, request timing.",
        "state": "archive",
        "is_archived": True,
        "tags": ["python", "reading-list"],
    },
    {
        "type": "note",
        "title": "Ideas for Buddhira v2",
        "content": "- AI-generated 'why this matters' suggestions\n- Weekly digest email of unprocessed inbox items\n- Browser extension for one-click link capture\n- Mobile PWA for quick capture on the go",
        "why_this_matters": "Backlog for after the MVP is solid.",
        "state": "inbox",
        "tags": ["ideas"],
    },
    {
        "type": "snippet",
        "title": "Docker multi-stage build for Python",
        "content": "FROM python:3.12-slim AS builder\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --user -r requirements.txt\n\nFROM python:3.12-slim\nWORKDIR /app\nCOPY --from=builder /root/.local /root/.local\nCOPY . .\nENV PATH=/root/.local/bin:$PATH\nCMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\"]",
        "why_this_matters": "Keeps the final image small — no build tools in production.",
        "state": "active",
        "is_pinned": True,
        "tags": ["devops", "python"],
    },
]

for i, item_data in enumerate(items_data):
    tag_list = item_data.pop("tags", [])
    item_data["user_id"] = user_id
    item_data.setdefault("is_pinned", False)
    item_data.setdefault("is_archived", False)

    result = sb.table("items").insert(item_data).execute()
    item_id = result.data[0]["id"]
    title = item_data.get("title", "Untitled")
    print(f"  [{i+1}] {item_data['type']:8s} | {item_data['state']:8s} | {title}")

    for tag_name in tag_list:
        sb.table("item_tags").upsert(
            {"item_id": item_id, "tag_id": tags[tag_name]}
        ).execute()

print(f"\nDone. Seeded {len(items_data)} items and {len(tags)} tags for user {user_id}.")
print("\nDemo flow:")
print("  1. Open /inbox — see inbox items (pinned first)")
print("  2. Go to /new, create a link, tag it 'aws'")
print("  3. Back to /inbox, search 'aws'")
print("  4. Click Tags → open 'ideas' tag")
print("  5. Pin 'Ideas for Buddhira v2'")
print("  6. Archive 'Terraform best practices'")
