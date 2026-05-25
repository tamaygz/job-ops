---
id: INV-007
title: "feat(investigator): research run API routes with optional SSE progress"
labels: [investigator, backend, batch-3]
batch: 3
priority: high
depends_on: [INV-006]
spec_refs: [sec-4.3.2, sec-4.3.8, PAT-004, PAT-007, AC-004 to AC-006]
---

## Summary

Implement `/api/investigator/dossiers/:dossierId/runs/*` routes: start, list, detail, cancel. Optionally add an SSE endpoint for live run progress using the centralized SSE helpers.

## Background / Context

PAT-007: _"If live progress streaming is introduced, it shall use centralized helpers from `orchestrator/src/server/infra/sse.ts`."_ The polling-first approach is the baseline; SSE is optional for v1 if polling is sufficient.

## Acceptance Criteria

- [ ] `POST /api/investigator/dossiers/:dossierId/runs` — starts a run; validates body (`StartInvestigatorRunInput`); returns created run with `status: "queued"`; returns `409 CONFLICT` if a same-kind run is already in-flight
- [ ] `GET /api/investigator/dossiers/:dossierId/runs` — lists runs for dossier; ordered newest first; returns `InvestigatorResearchRun[]`
- [ ] `GET /api/investigator/dossiers/:dossierId/runs/:runId` — returns full run detail; returns `404 NOT_FOUND` if missing or wrong tenant
- [ ] `POST /api/investigator/dossiers/:dossierId/runs/:runId/cancel` — cancels the run; returns updated run; returns `409 CONFLICT` if already terminal
- [ ] All handlers use `asyncRoute()` + `ok()` / `fail()`; no `res.json()` direct calls
- [ ] **Optional (v1 stretch):** `GET /api/investigator/dossiers/:dossierId/runs/:runId/progress` — SSE stream using `setupSse()`, `writeSseData()`, `startSseHeartbeat()` from `@infra/sse`; emits run status change events; cleans up heartbeat on client disconnect

## Technical Implementation Notes

- Router file: `orchestrator/src/server/api/routes/investigator/runsRouter.ts`
- Mount as a sub-router under `dossiersRouter` at `/:dossierId/runs`
- The SSE endpoint — if implemented — should follow the exact pattern in `sse.ts`: set up with `setupSse(res, { disableBuffering: true })`, start heartbeat, register a tenant-keyed listener, write events, clean up in `res.on("close")`.
- Progress events payload shape: `{ runId, status, phase?, message? }` — keep it minimal so the UI can poll for full detail.
- Do NOT implement a custom in-process pub/sub — use the tenant-keyed listener pattern already used by the pipeline SSE.

## Out of Scope

- Source/people/salary extraction (INV-008 through INV-010)
- Summary regeneration route (INV-012)
- Client SSE subscription (INV-014)

## Definition of Done

- Integration test covers: start run, list runs, get run by id, cancel run, duplicate in-flight 409
- `npm --workspace orchestrator run test:run` green
- `npm --workspace orchestrator run check:types` green
- Biome lint clean
