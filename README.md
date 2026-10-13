# Smart Healthcare Appointment & Triage System

**Group 6 · IT314 — Software Engineering**

A web platform where patients book appointments, complete a pre-visit questionnaire, and consult a doctor in person or by video. Generative AI (via LangChain + LangGraph) suggests urgency and summarises patient history; **doctors always review and can override**. AI outputs are **advisory only** — never a diagnosis.

> This is a student portfolio/demo project. It is **not** a medical service and is **not** compliant with HIPAA/DPDP in its current form.

---

## Stack (at a glance)

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Python 3.11 + FastAPI + SQLAlchemy 2.0 + Pydantic v2
- **AI:** LangChain + LangGraph, calling Claude via OpenRouter
- **Database:** PostgreSQL 16
- **Queue / cache:** Redis 7 + ARQ
- **Object storage:** MinIO (local) / S3 (prod)
- **Video / STT / Payments:** Daily.co · Deepgram · Stripe

Details: [`docs/architecture.md`](docs/architecture.md).

---

## Prerequisites

- **Docker Desktop** — for Postgres + Redis + MinIO
- **Node.js 20+** and **pnpm** (or npm) — for the frontend
- **Python 3.11+** and **uv** (recommended) or plain `pip` — for the backend
- **Git**

---

## Local setup (first run)

```bash
# 1. Clone
git clone https://github.com/<org>/smart-healthcare.git
cd smart-healthcare

# 2. Environment variables
cp .env.example .env
# edit .env — at minimum set AUTH_SECRET; leave AI/Stripe/Daily keys empty for now.
# Generate AUTH_SECRET with:  python -c "import secrets; print(secrets.token_urlsafe(32))"

# 3. Start shared infrastructure (postgres + redis + minio)
docker compose up -d

# 4. Backend — FastAPI
cd apps/backend
uv sync               # or: python -m venv .venv && .venv/Scripts/pip install -e .
uv run alembic upgrade head
uv run uvicorn src.main:app --reload --port 8000

# 5. Frontend — React + Vite (in another terminal)
cd apps/frontend
pnpm install          # or: npm install
pnpm dev              # runs on http://localhost:5173
```

Open http://localhost:5173 — you should see the "Hello Group 6" landing page and a green "Backend OK" badge.

---

## Repository layout

```
smart-healthcare/
├── apps/
│   ├── frontend/          React + Vite (owned by Frontend team)
│   └── backend/           FastAPI + LangChain + LangGraph (Backend + AI teams)
├── docker/                docker-compose.yml + init scripts
├── docs/
│   ├── api/               endpoint contracts (one .md per feature)
│   └── architecture.md
├── .github/
│   ├── workflows/         CI (lint + typecheck + tests)
│   └── pull_request_template.md
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
└── README.md
```

---

## Development workflow

- **Branch naming:** `feat/<short-desc>`, `fix/<short-desc>`, `docs/<short-desc>`, `chore/<short-desc>`.
- **Commit messages:** [Conventional Commits](https://www.conventionalcommits.org/) — e.g. `feat(auth): add magic-link signin`.
- **PRs:** always to `main`, always reviewed by at least one teammate, CI must pass.
- **See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full flow.**

---

## Documentation

- Project scope, requirements, Part A submission → `docs/`
- API contracts (one per endpoint or feature) → `docs/api/`
- Architecture → `docs/architecture.md`

---

## Safety principles baked into the system

1. **AI is advisory only.** AI outputs are stored in DB columns physically separate from clinician-confirmed columns. Doctor overrides are recorded, never overwrite the AI value.
2. **Emergencies never queue.** An `EMERGENCY` triage classification triggers out-of-band notification to on-call staff.
3. **Graceful AI failure.** If the AI service fails, the case falls back to *awaiting manual triage* — never dropped.
4. **Auditability.** Every clinical mutation and every AI call writes an immutable row to the audit log.
5. **Consent.** Video consultation transcription requires explicit consent from all participants before starting.
