# Buddhira — root dev runner
# Ports: backend 8000, frontend 3000
# On Windows, run dev-backend and dev-frontend in two terminals instead of `make dev`.

.PHONY: dev dev-backend dev-frontend seed

# Run backend and frontend in parallel (Unix/macOS). Ctrl+C stops both.
dev:
	(cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000) & \
	(cd frontend && npm run dev) & \
	wait

# Backend only (port 8000). Activate venv first: source backend/venv/bin/activate
dev-backend:
	cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000

# Frontend only (port 3000)
dev-frontend:
	cd frontend && npm run dev

# Seed demo data. Usage: make seed USER_ID=<your-uuid>
# Get USER_ID from Supabase Dashboard → Authentication → Users, or from GET /me after sign-in.
seed:
	@if [ -z "$(USER_ID)" ]; then echo "Usage: make seed USER_ID=<uuid>"; exit 1; fi
	cd backend && source venv/bin/activate && python seed.py $(USER_ID)
