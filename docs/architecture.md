# Implements: NFR-01, NFR-02, NFR-03, FR-01, FR-02, FR-03, FR-04, FR-16
# Safety:    S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, DR-15
# Owner:     backend (Vivek Amipara)

# Backend Developer Master Architecture & Context Guide

Welcome to the backend engineering team for the **Smart Healthcare Appointment & Triage System** (IT314 Group 6). This guide provides the complete architectural context, safety rules, data schemas, design patterns, and instructions you need to build, test, and extend backend services.

---

## 1. Project Domain & Core Principles

This system is an academic healthcare demonstration platform where:
- Patients register, book appointments, complete pre-visit questionnaires, and attend virtual (video) or in-person consultations.
- GenAI (via LangGraph 0.2 + Claude 3.5 Sonnet) **acts purely as an advisor**: it assesses triage urgency and produces clinical summaries.
- **Licensed doctors always decide and can override.** AI is never an autonomous diagnostic agent.

---

## 2. Mandatory Rules & Safety Constraints

Every backend pull request is evaluated against these non-negotiable safety rules:

| # | Rule | Implementation in Code |
|---|---|---|
| **S1 / DR-15** | **AI Advisory Only & Column Separation** | AI suggestions (`ai_*` columns) and doctor decisions (`clinician_*` columns) live in separate physical database columns. Clinician review never overwrites raw AI output. |
| **S2** | **Emergencies Never Queue** | Acute cases bypass standard scheduling and immediately transition to `EMERGENCY_ESCALATED`. |
| **S3** | **Graceful AI Degradation** | If OpenRouter/Claude fails or times out, the `manual_triage_fallback` node marks the case as `AWAITING_MANUAL_TRIAGE` with `ai_error`. The case is never lost. |
| **S4** | **Deterministic Keyword Pre-Check** | Before making any LLM call, code scans input for acute keywords (`chest pain`, `unconscious`, `severe bleeding`, `cannot breathe`). If matched, the emergency branch triggers even if the AI service is offline. |
| **S5** | **Consent Before Recording** | An explicit `Consent` record with `kind=RECORDING` is mandatory before initiating video recording or audio transcription. |
| **S6** | **Audit Every Mutation** | Every POST/PATCH/DELETE handler calls `audit(action, entity, actor)` after `db.commit()` to log an immutable audit event. |
| **S7** | **No Plaintext PHI in Logs** | `structlog` filters and `sanitize_metadata()` redact direct PHI (names, emails, phones, SSNs, credit cards) to opaque UUIDs. |
| **S8** | **3-Layer RBAC** | Enforce security at 3 tiers: (1) Middleware, (2) Endpoint `Depends(require_role(...))`, (3) SQL `WHERE` scoping (`WHERE patient_id = :id`). |
| **S9** | **Care Never Gated by Payment** | Triage, consultations, and emergency escalations must never check Stripe payment states before proceeding. |
| **S10** | **Model Provenance** | Every AI output row persists `ai_model`, `ai_prompt_version`, and `ai_graph_version`. |
| **IDOR Defense** | **Consistent 404s** | Return HTTP 404 for both non-existent items and items forbidden to the current user (prevents resource enumeration). |

---

## 3. Locked Technology Stack & Versions

Do not upgrade or replace these pinned dependencies without team review:

- **Language:** Python `3.11`
- **Web Framework:** FastAPI `0.115.0` + Uvicorn `0.30.6`
- **ORM & Driver:** SQLAlchemy `2.0.35` (async) + `asyncpg==0.29.0`
- **Database Migrations:** Alembic `1.13.3` (async configuration)
- **Validation & Settings:** Pydantic `2.9.2` + Pydantic-Settings `2.5.2`
- **Authentication:** `passlib[bcrypt]==1.7.4` + `python-jose[cryptography]==3.3.0`
- **Logging:** Structlog `24.4.0` (JSON renderer with contextual request ID)
- **AI Engine:** LangGraph `0.2.28` + LangChain `0.3.1` + `langchain-openai==0.2.1` (directed to OpenRouter `anthropic/claude-3.5-sonnet`)
- **Queue & Background Jobs:** ARQ `0.26.1` + Redis `7.0`
- **Database Server:** PostgreSQL `16` (Host port: `5433`)
- **Cache & Message Broker:** Redis `7` (Host port: `6380`)
- **Object Storage:** MinIO S3 API (Host port: `9000`, Console: `9001`)

---

## 4. Backend Directory Structure (`apps/backend/`)

```
apps/backend/
├── src/
│   ├── main.py                   # FastAPI app, CORS, structlog PHI filter middleware
│   ├── config.py                 # Settings (Pydantic BaseSettings loaded from .env)
│   ├── deps.py                   # get_current_user, require_role(Role.X)
│   ├── auth/
│   │   └── security.py           # bcrypt hashing, JWT access token generation
│   ├── db/
│   │   ├── session.py            # async_engine, async_session_maker, get_db generator
│   │   └── listen_notify.py      # PostgreSQL LISTEN/NOTIFY for SSE (to be implemented)
│   ├── models/
│   │   ├── __init__.py           # Model index export
│   │   ├── user.py               # User model & Role enum (PATIENT, DOCTOR, ADMIN, PHARMACIST)
│   │   ├── appointment.py        # Appointment model with DR-15 physical column separation
│   │   ├── consultation.py       # Consultation & Consent models (S5)
│   │   └── audit.py              # AuditLog model & AuditAction enum
│   ├── schemas/
│   │   └── user.py               # Pydantic models for user request/response/token
│   ├── ai/
│   │   ├── llm.py                # ChatOpenAI configured for Claude 3.5 Sonnet on OpenRouter
│   │   ├── schemas.py            # Pydantic structured output: TriageOutput
│   │   ├── prompt_registry.py    # Versioned prompt loader (S10)
│   │   ├── prompts/
│   │   │   └── triage_v1.txt     # System prompt template for clinical triage
│   │   └── graphs/
│   │       └── triage_graph.py   # StateGraph (precheck -> LLM -> emergency/fallback/summary)
│   ├── api/
│   │   ├── users.py              # POST /auth/register, POST /auth/login
│   │   ├── appointments.py       # POST /appointments, PATCH /appointments/{id}/review, GET /appointments
│   │   └── audit.py              # GET /audit (ADMIN only)
│   ├── audit/
│   │   └── helper.py             # audit() helper stripping PHI from metadata
│   └── jobs/                     # ARQ worker & background task definitions
├── alembic/                      # Database migrations
│   ├── env.py                    # Async connection migration runner
│   └── versions/                 # Revision scripts
├── pyproject.toml                # Pinned dependencies & ruff config
├── Dockerfile                    # Containerization recipe
└── alembic.ini                   # Alembic runtime config
```

---

## 5. Database Schema & Models

### User (`users` table)
- `id` (UUID PK)
- `email` (String 255, unique, indexed)
- `hashed_password` (String 255)
- `role` (Enum: `PATIENT`, `DOCTOR`, `ADMIN`, `PHARMACIST`)
- `is_active` (Boolean, default True)
- `created_at`, `updated_at` (DateTime TZ)

### Appointment (`appointments` table) — Enforcing DR-15
- `id` (UUID PK)
- `patient_id` (UUID FK `users.id`)
- `doctor_id` (UUID FK `users.id`, nullable)
- `scheduled_at` (DateTime TZ, nullable)
- `status` (Enum: `PENDING_TRIAGE`, `AWAITING_MANUAL_TRIAGE`, `EMERGENCY_ESCALATED`, `TRIAGED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
- `symptoms_text` (Text)
- `questionnaire_responses` (JSONB)
- **AI Columns (DR-15 & S10):**
  - `ai_urgency` (Enum: `EMERGENCY`, `URGENT`, `ROUTINE`, `SELF_CARE`)
  - `ai_summary` (Text)
  - `ai_model` (String 64, e.g. `anthropic/claude-3.5-sonnet`)
  - `ai_prompt_version` (String 32, e.g. `v1`)
  - `ai_graph_version` (String 32, e.g. `v1.0`)
  - `ai_error` (Text, set on fallback)
- **Clinician Columns (DR-15):**
  - `clinician_urgency` (Enum: `EMERGENCY`, `URGENT`, `ROUTINE`, `SELF_CARE`)
  - `clinician_notes` (Text)
  - `clinician_reviewed_at` (DateTime TZ)

### Consultation & Consent (`consultations` & `consents` tables)
- `consultations`: `id`, `appointment_id` (unique FK), `room_url`, `recording_url`, `transcript_text`, `ai_soap_summary`, `clinician_notes`.
- `consents`: `id`, `user_id` (FK), `appointment_id` (FK), `kind` (`RECORDING`, `DATA_PROCESSING`, `AI_ADVISORY`), `granted` (Bool), `revoked_at`.

### Audit Log (`audit_logs` table)
- `id` (UUID PK)
- `timestamp` (DateTime TZ, indexed desc)
- `actor_user_id` (UUID, nullable)
- `action` (Enum: `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `VIEW`, `TRIAGE`, `STATUS_CHANGE`)
- `entity_type` (String 64)
- `entity_id` (String 64, nullable)
- `metadata_json` (JSONB, sanitized)

---

## 6. How LangGraph Clinical Triage Operates

1. **Deterministic Pre-Check (`emergency_precheck`):**
   - Runs before invoking any LLM API.
   - Evaluates symptoms against high-risk keywords (`chest pain`, `cannot breathe`, `severe bleeding`, `unconscious`).
   - If a keyword matches: sets `is_emergency=True` and routes immediately to `emergency_branch` &rarr; `END`.
2. **LLM Structured Output (`llm_triage`):**
   - Invokes Claude 3.5 Sonnet using `ChatOpenAI.with_structured_output(TriageOutput)`.
   - Returns structured `urgency`, `summary`, `recommended_specialty`, and detected `red_flags`.
3. **Graceful Fallback (`manual_triage_fallback`):**
   - Catches timeouts and API errors without crashing.
   - Sets appointment status to `AWAITING_MANUAL_TRIAGE` and populates `ai_error`.

---

## 7. Standard Conventions for Writing Backend Code

1. **Every file must begin with the 3-line header:**
   ```python
   # Implements: FR-XX, FR-YY
   # Safety:    DR-ZZ (or S1-S10, or 'none')
   # Owner:     backend (<your name>)
   ```
2. **All endpoints must be async:** Use `async def` and `await db.execute(...)`.
3. **Pydantic v2 everywhere:** Use `model_config = ConfigDict(from_attributes=True)`.
4. **Audit mutations:** After altering database state and calling `await db.commit()`, always call:
   ```python
   await audit(
       db=db,
       action=AuditAction.UPDATE,
       entity_type="appointment",
       entity_id=str(appointment.id),
       actor_user_id=current_user.id,
       metadata={"new_status": appointment.status.value}
   )
   await db.commit()
   ```

---

## 8. Local Setup Instructions for Backend Developers

```bash
# 1. Start Docker containers (PostgreSQL on 5433, Redis on 6380, MinIO on 9000/9001)
cd /path/to/SE_Poject
docker compose -f docker/docker-compose.yml up -d

# 2. Setup Python environment
cd apps/backend
python3 -m venv .venv
source .venv/bin/activate

# 3. Install backend dependencies in editable mode
pip install -e ".[dev]"

# 4. Run database migrations
alembic upgrade head

# 5. Start the development server
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Swagger Docs:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **Health Check:** `http://localhost:8000/health`

---

## 9. Immediate Roadmap / Next Modules to Implement

1. **ARQ Worker (`src/jobs/`):**
   - Setup `worker.py` listening to Redis on port `6380`.
   - Implement notification tasks (`email.py`, `sms.py`, `reminders.py`).
2. **PostgreSQL LISTEN/NOTIFY & SSE (`src/api/sse.py`, `src/db/listen_notify.py`):**
   - Real-time updates pushed to the doctor clinical queue when new appointments are triaged.
3. **E-Prescriptions & Pharmacy Subsystem:**
   - Database models and API routes for e-prescriptions, pharmacy fulfillment, and order tracking (FR-25, FR-30, FR-31).
4. **MinIO Document Presigning (`boto3`):**
   - Presigned URL generation for medical records and test image uploads (the backend never buffers raw image bytes).
