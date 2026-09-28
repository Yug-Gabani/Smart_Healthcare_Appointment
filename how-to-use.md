# How to use this initial-push kit

Six files that make up the very first commit of the Group 6 GitHub repo.

## Step 1 — Create the empty repo on GitHub

- Repo name: `smart-healthcare` (or whatever the team agrees on)
- Public or private — either works
- Add a description: *"Smart Healthcare Appointment & Triage System — IT314 Group 6"*
- Do **NOT** initialize with a README or .gitignore (this kit provides them)

## Step 2 — On your local machine

```bash
# somewhere sensible, NOT inside your brother's project folder
mkdir smart-healthcare
cd smart-healthcare
git init
git branch -M main
```

## Step 3 — Copy every file from this kit

Copy the contents of this directory into your new local `smart-healthcare/` folder, preserving the folder structure:

```
smart-healthcare/
├── .env.example              ← from kit
├── .gitignore                ← from kit
├── .github/
│   ├── pull_request_template.md   ← from kit
│   └── workflows/
│       └── ci.yml                 ← from kit
├── CONTRIBUTING.md           ← from kit
├── docker-compose.yml        ← from kit
└── README.md                 ← from kit
```

## Step 4 — Create the two empty app folders

You'll add real code inside them in Sprint 1. For the first commit, add a `.gitkeep` file so git tracks them:

```bash
mkdir -p apps/frontend apps/backend docs/api
touch apps/frontend/.gitkeep apps/backend/.gitkeep docs/api/.gitkeep docs/.gitkeep
```

## Step 5 — First commit and push

```bash
git add .
git status                    # verify: no .env, no node_modules, no .venv
git commit -m "chore: initial repo scaffold

Adds README, .gitignore, docker-compose (postgres/redis/minio),
CI workflow, PR template, CONTRIBUTING, .env.example.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git remote add origin https://github.com/<org-or-your-user>/smart-healthcare.git
git push -u origin main
```

## Step 6 — On GitHub, immediately

1. **Settings → Collaborators** — add all 9 members by GitHub username. Give them Write access.
2. **Settings → Branches → Add branch protection rule** for `main`:
   - Require pull request before merging
   - Require approvals: **1**
   - Dismiss stale approvals when new commits are pushed
   - Require status checks to pass — select the CI jobs once the first PR runs
   - Do NOT allow force pushes, do NOT allow deletions
3. **Projects tab → New project → Board** — columns: `Backlog / Sprint 1 / In Progress / Review / Done`.
4. **Issues tab → Labels** — add these labels:
   - Track: `frontend`, `backend`, `ai`
   - Type: `bug`, `feat`, `docs`, `chore`
   - Sprint: `sprint-1`, `sprint-2`, `sprint-3`, `sprint-4`, `sprint-5`, `sprint-6`
   - Priority: `blocker`, `high`, `low`

## Step 7 — Tell the team

Post in Slack:

> Repo is up: <https://github.com/…/smart-healthcare>. Please clone, run the setup steps in the README, and confirm `docker compose up -d` brings up postgres/redis/minio without errors. First PRs land tomorrow.

## Optional — pre-Sprint 1 tickets to open on the board

Copy these as GitHub Issues so people have things to grab:

- `[chore] Bootstrap Vite + React + TypeScript in apps/frontend`
- `[chore] Bootstrap FastAPI project in apps/backend with uv`
- `[chore] Add Alembic and initial empty migration`
- `[chore] Add pnpm-workspace.yaml (or root package.json) if going monorepo`
- `[docs] Write docs/architecture.md summary`
- `[docs] Write docs/api/README.md explaining the API-contract convention`
- `[feat] FastAPI /health endpoint returning {ok: true, version, git_sha}`
- `[feat] React landing page with 'Hello Group 6' + backend-health badge`
