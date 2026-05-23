---
id: INV-004
title: "feat(investigator): dossier repository, service, and canonical normalization"
labels: [investigator, backend, batch-2]
batch: 2
priority: high
depends_on: [INV-001, INV-002]
spec_refs: [sec-3.1 REQ-001 to REQ-004, sec-3.5 PAT-005, sec-4.1.1 to 4.1.2, sec-3.6]
---

## Summary

Implement the thin Drizzle dossier repository and the business-logic dossier service. The service owns canonical company key normalization, dossier creation from a job record (seed), job linking/unlinking, and timeline event writing for all dossier state changes.

## Background / Context

REQ-001: users create dossiers from a job or from manual input. REQ-002: one dossier → many jobs. REQ-004: seed from existing job metadata. PAT-005: _"Repositories shall remain thin Drizzle data-access layers, while normalization, merge logic, AI summarization, and run orchestration shall live in services."_

## Acceptance Criteria

### Repository (`orchestrator/src/server/repositories/investigatorDossierRepository.ts`)
- [ ] `findAll(filters)` — supports `status`, `tag`, `linkedJobId`, `hasPeople`, `stale`, `q` (name search), `sort` filter fields from spec §4.3.1; internally calls `getActiveTenantId()` for tenant scoping
- [ ] `findById(dossierId)` — returns `null` for missing records (not throws); scoped by `getActiveTenantId()`
- [ ] `findByCanonicalKey(canonicalCompanyKey)` — scoped by `getActiveTenantId()`
- [ ] `create(data)` — inserts with `tenantId` from `getActiveTenantId()` and returns the new dossier
- [ ] `update(dossierId, data)` — partial update, returns updated record; scoped by tenant
- [ ] `linkJob(dossierId, jobId, linkReason)` — inserts into `investigator_dossier_jobs`, returns conflict-safe result
- [ ] `unlinkJob(dossierId, jobId)` — scoped by tenant
- [ ] `listLinkedJobs(dossierId)` — scoped by tenant

### Service (`orchestrator/src/server/services/investigator/dossierService.ts`)
- [ ] `createDossier(input: CreateInvestigatorDossierInput)` — normalizes canonical key, checks for existing dossier with same key, creates dossier, writes `dossier_created` timeline event
- [ ] `createDossierFromJob(jobId)` — seeds identity fields from job record, links job with reason `"seeded"`, writes timeline event (REQ-004)
- [ ] `updateDossier(dossierId, input)` — updates fields, writes `status_changed` timeline event when status changes
- [ ] `linkJobToDossier(dossierId, jobId, reason)` — links job, writes `job_linked` timeline event
- [ ] `unlinkJobFromDossier(dossierId, jobId)` — unlinks job
- [ ] `listDossiers(filters)` — delegates to repository with filter mapping
- [ ] `getDossier(dossierId)` — throws `notFound` if missing or wrong tenant
- [ ] Canonical key normalization: lowercase, trim, strip punctuation (e.g. `"Acme, Inc."` → `"acme inc"`)

### Multi-tenancy
- [ ] All repository queries use `getActiveTenantId()` internally in the `where` clause — callers do NOT pass tenantId
- [ ] Cross-tenant lookup resolves as `notFound` (SEC-007)
- [ ] Queue worker wraps execution in `runWithRequestContext({ tenantId: payload.tenantId })` before calling services

## Technical Implementation Notes

- **Tenancy pattern (IMPORTANT):** Follow the existing codebase convention — repositories call `getActiveTenantId()` internally. Neither repositories nor services receive `tenantId` as a function parameter. The queue worker (INV-006) must call `runWithRequestContext({ tenantId: payload.tenantId })` before invoking service methods so that `getActiveTenantId()` resolves correctly inside the async context. This is the same pattern used by the existing `auto-pdf-regeneration` worker.
- Timeline event writes should call a `writeTimelineEvent(payload)` helper — define a thin `investigatorTimelineRepository.insert()` for this (the full timeline route is INV-011, but the insert helper is needed here).
- `stale` filter: a dossier is stale if `lastResearchedAt` is older than 30 days or is null.
- The `hasPeople` filter: a subquery count on `investigator_people` where `dossierId` matches and `tenantId` matches.
- Error helpers come from `@infra/errors`: use `notFound`, `conflict` (duplicate canonical key).

## Out of Scope

- Dossier merge (INV-013)
- Research run orchestration (INV-006)
- HTTP route handlers (INV-005)

## Definition of Done

- Repository has no LLM calls, no business logic, no HTTP response shapes
- Service unit-testable in isolation with mocked repository
- `npm --workspace orchestrator run check:types` green
- `npm --workspace orchestrator run test:run` passes (add unit tests for canonical key normalization)
