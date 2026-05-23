---
id: INV-005
title: "feat(investigator): dossier API routes"
labels: [investigator, backend, batch-2]
batch: 2
priority: high
depends_on: [INV-004]
spec_refs: [sec-4.3.1, SEC-002 to SEC-004, PAT-002, PAT-004, AC-001 to AC-003]
---

## Summary

Implement the Express router for `/api/investigator/dossiers/*` covering dossier CRUD, job linking, and job unlinking. Register the router in the app's route tree.

## Background / Context

PAT-004: all route handlers must use `asyncRoute()` + `ok()` / `fail()` from `@infra/http`. PAT-002: mirror existing route organisation under `/api/*`. SEC-002: responses follow `{ ok: true, data, meta: { requestId } }`.

## Acceptance Criteria

- [ ] `GET /api/investigator/dossiers` — lists dossiers for active tenant; supports query params `q`, `status`, `tag`, `linkedJobId`, `hasPeople`, `stale`, `sort`; returns `InvestigatorDossierListItem[]`
- [ ] `POST /api/investigator/dossiers` — creates a dossier; validates body via Zod (`CreateInvestigatorDossierInput`); returns created `InvestigatorDossier`
- [ ] `GET /api/investigator/dossiers/:dossierId` — returns full `InvestigatorDossier` with linked job list
- [ ] `PATCH /api/investigator/dossiers/:dossierId` — partial update; validates body via Zod (`UpdateInvestigatorDossierInput`); returns updated record
- [ ] `POST /api/investigator/dossiers/:dossierId/jobs` — links a job; body `{ jobId, linkReason }`
- [ ] `DELETE /api/investigator/dossiers/:dossierId/jobs/:jobId` — unlinks a job; returns `204`
- [ ] All handlers wrapped with `asyncRoute()`; all success responses use `ok()`; all errors use `fail(toAppError(err))`
- [ ] Route file never calls `res.json()` directly (enforced by existing API contract test)
- [ ] `x-request-id` is present in all responses (handled by existing middleware, just confirm not broken)
- [ ] `400 INVALID_REQUEST` returned for malformed Zod body
- [ ] `404 NOT_FOUND` returned when dossier does not exist for the active tenant
- [ ] `409 CONFLICT` returned when creating a dossier with a duplicate canonical key

## Technical Implementation Notes

- Router file: `orchestrator/src/server/api/routes/investigator/dossiersRouter.ts`
- Register in the main routes index at `/api/investigator/dossiers`
- Input Zod schemas: import from `@shared/types/investigator` (defined in INV-001); keep route-local schemas for query params
- Use `getActiveTenantId()` inside handlers — no tenantId in route path
- `POST /api/investigator/dossiers/from-job` is a convenience alias: body `{ jobId }` → calls `dossierService.createDossierFromJob()` — include this as an additional endpoint in the same router
- Logging: use `logger.info("Dossier created", { dossierId, tenantId: getActiveTenantId() })` pattern

## Out of Scope

- Dossier merge route (INV-013)
- Research run routes (INV-007)
- SSE (INV-007)
- Dossier hard-delete route: the spec intentionally omits a DELETE endpoint for dossiers — archiving (status change via PATCH) is the intended workflow per PRD. If a future hard-delete is added, it must cascade-delete all child records (runs, sources, people, salary, summaries, timeline events).

## Definition of Done

- Integration test `dossiersRouter.test.ts` covers: create, get, list (with filter), patch, link job, unlink job, 404 path, duplicate conflict
- `npm --workspace orchestrator run test:run` green
- `npm --workspace orchestrator run check:types` green
- Biome lint clean: `./orchestrator/node_modules/.bin/biome ci .`
