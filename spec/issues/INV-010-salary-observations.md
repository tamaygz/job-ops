---
id: INV-010
title: "feat(investigator): salary observations repository, service, and routes"
labels: [investigator, backend, batch-4]
batch: 4
priority: medium
depends_on: [INV-004]
spec_refs: [sec-3.1 REQ-010, sec-4.1.6, sec-4.3.5]
---

## Summary

Implement salary observation persistence and CRUD routes. Salary observations allow users to record gathered comp data (from job postings, community sources, or direct evidence) per company/role combination for comparison during interview prep.

## Background / Context

REQ-010: store and view salary observations per dossier including role, geography, source URL, amount range, pay interval, and user-provided notes. Amount fields are nullable because publicly posted ranges are often incomplete.

## Acceptance Criteria

### Repository (`orchestrator/src/server/repositories/investigatorSalaryRepository.ts`)
- [ ] `findByDossier(dossierId)` — list ordered by `observedAt` desc; uses `getActiveTenantId()` internally
- [ ] `findById(observationId)` — scoped by tenant internally
- [ ] `create(data)` — inserts with tenant from `getActiveTenantId()`
- [ ] `update(observationId, data)` — partial update; scoped by tenant
- [ ] `delete(observationId)` — scoped by tenant

### Service (`orchestrator/src/server/services/investigator/salaryService.ts`)
- [ ] `createObservation(dossierId, input)` — validates `minAmount ≤ maxAmount` when both are present (throws `400 INVALID_REQUEST` otherwise); creates record; writes `salary_saved` timeline event (per spec §4.1.8 event type)
- [ ] `updateObservation(observationId, data)` — validates amount range if both present; updates record
- [ ] `deleteObservation(observationId)` — deletes; no timeline event required
- [ ] `listObservations(dossierId)` — delegates to repository
- [ ] `getObservation(observationId)` — throws `notFound` if missing or wrong tenant

### Routes (`orchestrator/src/server/api/routes/investigator/salaryRouter.ts`)
- [ ] `GET /api/investigator/dossiers/:dossierId/salary-observations`
- [ ] `POST /api/investigator/dossiers/:dossierId/salary-observations`
- [ ] `PATCH /api/investigator/dossiers/:dossierId/salary-observations/:observationId`
- [ ] `DELETE /api/investigator/dossiers/:dossierId/salary-observations/:observationId`
- [ ] All handlers use `asyncRoute()` + `ok()` / `fail()`

## Technical Implementation Notes

- `minAmount` and `maxAmount` are stored as real numbers (Drizzle `real()` column). Both nullable.
- `currency` defaults to `"USD"` in the Zod schema if not provided.
- `observedAt` is a user-provided date string (ISO 8601); default to `now()` if not provided.
- `payInterval` must be one of the values from `PayInterval` enum in shared types.

## Out of Scope

- Salary panel UI (INV-017)
- Automated salary extraction from sources (future run worker step)

## Definition of Done

- Integration test covers: create, list, patch, delete, amount range validation error
- `npm --workspace orchestrator run test:run` green
- `npm --workspace orchestrator run check:types` green
- Biome lint clean
