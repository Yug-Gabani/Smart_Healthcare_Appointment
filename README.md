# Smart Healthcare Appointment & Triage System

**Group 6 · IT314 Software Engineering**

A web platform where patients book appointments, complete a pre-visit questionnaire,
and consult a doctor in person or by video. An AI service (LangChain + LangGraph)
produces advisory urgency and history summaries; doctors always review and can override.
AI outputs are advisory only — never a diagnosis.

> Student / portfolio project. Not a medical service. Not HIPAA/DPDP compliant in current form.

---

## Stack

| Layer       | Tech                                                                  |
|-------------|-----------------------------------------------------------------------|
| Frontend    | React 18 + Vite + TypeScript + Tailwind + shadcn/ui                   |
| Backend     | Spring Boot 3.3.x + Java 21 + Spring Security + Spring Data JPA       |
| AI service  | Python 3.11 + FastAPI + LangChain + LangGraph (Claude via OpenRouter) |
| Database    | PostgreSQL 16 + Flyway migrations                                     |
| Cache/queue | Redis 7                                                               |
| Storage     | MinIO (S3-compatible)                                                 |
| Payments    | Stripe                                                                |
| Video / STT | Daily.co · Deepgram                                                   |

---

## Repository layout

```
smart-healthcare/
├── apps/
│   ├── backend/           Spring Boot (owner of CRUD, auth, payments, orchestration)
│   ├── frontend/          React + Vite                        (added later)
│   └── ai-service/        Python FastAPI LangChain microservice (added later)
├── docker/
│   └── docker-compose.yml postgres + redis + minio + backend
├── docs/
│   └── api/               one .md per feature contract
├── .gitignore
└── README.md
```

---

## Prerequisites

- JDK **21** (`java -version`)
- Maven **3.9+** (`mvn -version`)
- Docker + Docker Compose
- Node.js 20+ and pnpm (for the frontend, later)

---

## Quick start (backend only, Step 0)

```bash
# 1. Start infra
docker compose -f docker/docker-compose.yml up -d postgres redis minio

# 2. Build and run the backend
cd apps/backend
mvn clean package -DskipTests
mvn spring-boot:run

# 3. Open
# http://localhost:8080/actuator/health
# http://localhost:8080/swagger-ui.html
```

---

## Development workflow

- **Branches:** `feat/<area>-<short-desc>`, `fix/<area>-<short-desc>`.
- **Commits:** Conventional Commits (`feat(auth): add JWT filter`).
- **PRs:** target `main`, at least one reviewer, CI must pass.

---

## Safety principles (from Part A, DR-15 / DR-16 / DR-11)

1. AI output is advisory. Stored in columns separate from clinician-confirmed data.
2. Doctor overrides are recorded; AI value is never overwritten in place.
3. Video transcription requires explicit consent from all parties.
4. Every clinical mutation and every AI call writes an immutable audit row.
