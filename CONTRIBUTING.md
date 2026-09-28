# Contributing — Group 6

Everyone commits, everyone reviews, no direct pushes to `main`.

## Branches

- `main` — always green, always deployable.
- Feature branches — `feat/<short-desc>`, `fix/<short-desc>`, `docs/<short-desc>`, `chore/<short-desc>`, `test/<short-desc>`.
- Example: `feat/auth-magic-link`, `fix/queue-sse-reconnect`.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary in imperative>

<optional body: what and why, not how>

<optional footer: BREAKING CHANGE / issue links>
```

Types: `feat` · `fix` · `docs` · `style` · `refactor` · `test` · `chore` · `ci`.

Examples:
```
feat(auth): add email magic-link signin
fix(triage): retry OpenRouter on HTTP 429
docs(api): specify triage endpoint contract
```

## Pull requests

1. Push your branch: `git push -u origin feat/…`
2. Open a PR to `main`. Fill in the PR template.
3. Assign at least one reviewer from a different track (e.g. backend PRs reviewed by an AI teammate, and vice versa — spreads knowledge).
4. Wait for CI to pass (lint + typecheck + tests).
5. Address review comments; do not force-push after review starts (add commits so the reviewer can see the delta).
6. Squash-merge into `main` when approved.

## Definition of Done

A PR is Done only when **all** of these are true:

- Feature works locally (screencap or steps in the PR description).
- Type-check clean (`tsc --noEmit` for frontend; `mypy` optional for backend but preferred).
- Lint clean (`eslint` for frontend; `ruff` for backend).
- New logic has at least one unit test.
- If the change touches PHI, AI, or authorization → an audit row is written, and a test verifies it.
- No `.env`, no keys, no `console.log("patient full name = …")` in the diff.
- README / docs updated if the change is user-visible or contract-changing.

## Individual commits

The instructor will check that commits reflect actual individual contribution. Every teammate makes their own commits — do **not** commit code someone else wrote under your name. Pair programming is fine; use `Co-authored-by:` in the commit trailer.

## Getting help

Ask in the team Slack channel (`#dev`). Decisions land in `#decisions` so they don't get lost.

## Weekly cadence

- **Daily async stand-up** in `#standup` — reply in the thread with: yesterday / today / blockers.
- **Sprint planning** — first Monday of each sprint.
- **Sprint review** — last Friday of each sprint (demo whatever is on `main`).
- **Retrospective** — 15 min after review.

## What NOT to commit

- `.env` (or any `.env.*.local`)
- Real API keys / passwords / tokens — ever, in any form
- `node_modules/`, `.venv/`, `__pycache__/`, `dist/`, `build/`
- Compiled binaries, media larger than 5 MB (use MinIO)
- Patient-realistic data with real-looking names — use obvious fakes only

If you commit a secret by accident: **do not just delete it in a new commit** — the history still has it. Rotate the secret immediately and tell the team. Then rewrite history if the repo is small.
