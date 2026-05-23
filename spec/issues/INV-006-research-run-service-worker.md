---
id: INV-006
title: "feat(investigator): research run repository, service, and queue worker"
labels: [investigator, backend, batch-3]
batch: 3
priority: high
depends_on: [INV-003, INV-004]
spec_refs: [sec-3.1 REQ-005 to REQ-006 REQ-018, sec-4.1.3, PAT-005, NFR-002 NFR-003]
---

## Summary

Implement the research run lifecycle: repository for CRUD, service methods for starting and cancelling runs, a queue consumer worker that processes `investigator_research_run` jobs, and support for partial failures (REQ-018).

## Background / Context

REQ-005: user-initiated runs with kinds `company_brief`, `people_scan`, `dossier_refresh`. REQ-006: persist lifecycle data including status, timestamps, sanitized errors. REQ-018: save draft results even if some sources fail. NFR-002: runs execute asynchronously with durable status for polling. NFR-007: use existing queue infra.

## Acceptance Criteria

### Repository (`orchestrator/src/server/repositories/investigatorRunRepository.ts`)
- [ ] `create(tenantId, data)` — creates run with status `"queued"`
- [ ] `findByDossier(tenantId, dossierId)` — list runs ordered by `createdAt` desc
- [ ] `findById(tenantId, runId)`
- [ ] `updateStatus(tenantId, runId, status, extra?)` — updates `status`, `startedAt`, `completedAt`, `errorCode`, `errorMessage` as appropriate

### Service (`orchestrator/src/server/services/investigator/runService.ts`)
- [ ] `startRun(tenantId, dossierId, input: StartInvestigatorRunInput)` — validates no run with same `(dossierId, runKind)` is already `queued` or `running` (dedupe); creates run record; enqueues `investigator_research_run` job via `JobQueue`; writes `run_started` timeline event; returns created run
- [ ] `cancelRun(tenantId, dossierId, runId)` — sets status to `"cancelled"` if run is `queued` or `running`; writes timeline event; throws `conflict` if run is already terminal

### Queue Worker (`orchestrator/src/server/services/investigator/runWorker.ts`)
- [ ] Registered as the consumer for `"investigator_research_run"` jobs
- [ ] Fetches run record and dossier; sets status to `"running"`
- [ ] Executes phase steps: source fetch → people extraction → salary extraction → summary generation (stubs for v1 integration — actual content generation is wired up in INV-008/INV-009/INV-010/INV-012)
- [ ] On partial failure: saves completed phases, sets status to `"partial_failed"`, stores sanitized error
- [ ] On full failure: sets status to `"failed"`, stores sanitized error; does **not** throw (prevents queue retry loop)
- [ ] On success: sets status to `"completed"`, sets `completedAt`, updates `lastResearchedAt` on dossier
- [ ] Writes `run_completed` / `run_partial_failed` / `run_failed` timeline events

### Multi-tenancy & error handling
- [ ] All queries include `tenantId`
- [ ] Error messages stored in DB are sanitized via `sanitizeError()` from `@infra/sanitize` (SEC-004)
- [ ] Raw upstream bodies are never written to `errorMessage`

## Technical Implementation Notes

- For v1, the worker stubs can call no-op step functions and immediately succeed — the intent is wiring the queue consumer, lifecycle transitions, and timeline writes. Actual research logic lands in INV-008 through INV-012.
- Use `asyncPool` (concurrency=1 per run, but different runs can be concurrent) if multiple phases run in parallel within a single run.
- `dedupKey` check: query `investigator_research_runs` for any row with same `dossierId + runKind` and status in `['queued','running']` before creating.
- Worker registration: follow the pattern used by other workers in `orchestrator/src/server/` (check how the existing pipeline or PDF worker registers against the queue).
- Log at `info` on start, `warn` on partial failure, `error` on full failure.

## Out of Scope

- Research run HTTP routes (INV-007)
- Actual source/people/salary extraction logic (INV-008, INV-009, INV-010)
- SSE progress streaming (INV-007)
- LLM summarization (INV-012)

## Definition of Done

- Unit test for `startRun` duplicate prevention
- Unit test for `cancelRun` on terminal status
- Integration test: enqueue → worker runs → status transitions to `completed`
- `npm --workspace orchestrator run test:run` green
- `npm --workspace orchestrator run check:types` green
