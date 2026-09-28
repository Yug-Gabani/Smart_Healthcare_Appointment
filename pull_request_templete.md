<!-- Fill this in for every PR. Delete sections that do not apply. -->

## What this changes

<!-- One or two sentences. -->

## Related issue / ticket

<!-- Closes #123 -->

## Type of change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` — no user-visible behavior change
- [ ] `test` — tests only
- [ ] `chore` / `ci` — tooling, dependencies, workflows

## How to test locally

<!-- Concrete steps. E.g.:
1. Pull this branch
2. `docker compose up -d`
3. `cd apps/backend && uv run uvicorn src.main:app --reload`
4. Open http://localhost:5173/patient/book
5. Book a slot; confirm the appointment shows up in the doctor's dashboard.
-->

## Screenshots / clips (if user-visible)

<!-- Paste a screenshot or link to a short screen recording. -->

## Checklist

- [ ] Branch name follows `feat/… | fix/… | docs/… | chore/…`
- [ ] Commit messages follow Conventional Commits
- [ ] Type-check passes (`tsc --noEmit` for frontend; `mypy` if backend uses it)
- [ ] Lint passes (`eslint` / `ruff`)
- [ ] New logic has at least one test
- [ ] If the change touches PHI, AI outputs, or authorization → audit row is written **and** a test asserts it
- [ ] No `.env`, no secrets, no plaintext PHI in the diff
- [ ] README / API docs updated if user-visible or contract-changing
- [ ] Reviewer assigned from a different track (frontend ↔ backend ↔ AI)

## Notes for the reviewer

<!-- Anything they should look at first, or context they will not get from the diff. -->
