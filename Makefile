# Buddhira — root dev runner
# Ports: backend 8000, frontend 3000
# On Windows, run dev-backend and dev-frontend in two terminals instead of `make dev`.

.PHONY: dev dev-backend dev-frontend prod-backend prod-frontend seed

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

# Production mode locally — same commands as Render / Vercel. Set .env and .env.local first.
prod-backend:
	cd backend && source venv/bin/activate && gunicorn main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --workers 1

prod-frontend:
	cd frontend && npm run build && npm run start

# Seed demo data. Usage: make seed USER_ID=<your-uuid>
# Get USER_ID from Supabase Dashboard → Authentication → Users, or from GET /me after sign-in.
seed:
	@if [ -z "$(USER_ID)" ]; then echo "Usage: make seed USER_ID=<uuid>"; exit 1; fi
	cd backend && source venv/bin/activate && python seed.py $(USER_ID)
