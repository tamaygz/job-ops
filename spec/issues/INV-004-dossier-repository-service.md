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
- [ ] `findByTenant(tenantId, filters)` — supports `status`, `tag`, `linkedJobId`, `hasPeople`, `stale`, `q` (name search), `sort` filter fields from spec §4.3.1
- [ ] `findById(tenantId, dossierId)` — returns `null` for missing records (not throws)
- [ ] `findByCanonicalKey(tenantId, canonicalCompanyKey)`
- [ ] `create(tenantId, data)` — inserts and returns the new dossier
- [ ] `update(tenantId, dossierId, data)` — partial update, returns updated record
- [ ] `linkJob(tenantId, dossierId, jobId, linkReason)` — inserts into `investigator_dossier_jobs`, returns conflict-safe result
- [ ] `unlinkJob(tenantId, dossierId, jobId)`
- [ ] `listLinkedJobs(tenantId, dossierId)`

### Service (`orchestrator/src/server/services/investigator/dossierService.ts`)
- [ ] `createDossier(tenantId, input: CreateInvestigatorDossierInput)` — normalizes canonical key, checks for existing dossier with same key, creates dossier, writes `dossier_created` timeline event
- [ ] `createDossierFromJob(tenantId, jobId)` — seeds identity fields from job record, links job with reason `"seeded"`, writes timeline event (REQ-004)
- [ ] `updateDossier(tenantId, dossierId, input)` — updates fields, writes `status_changed` timeline event when status changes
- [ ] `linkJobToDossier(tenantId, dossierId, jobId, reason)` — links job, writes `job_linked` timeline event
- [ ] `unlinkJobFromDossier(tenantId, dossierId, jobId)` — unlinks job
- [ ] `listDossiers(tenantId, filters)` — delegates to repository with filter mapping
- [ ] `getDossier(tenantId, dossierId)` — throws `notFound` if missing or wrong tenant
- [ ] Canonical key normalization: lowercase, trim, strip punctuation (e.g. `"Acme, Inc."` → `"acme inc"`)

### Multi-tenancy
- [ ] All repository queries include `tenantId` in the `where` clause
- [ ] Cross-tenant lookup resolves as `notFound` (SEC-007)

## Technical Implementation Notes

- Use `getActiveTenantId()` / `requireTenantId()` from `@server/tenancy/context` — do not pass `tenantId` as a function argument into service methods that are called from route handlers.
- Timeline event writes should call a `writeTimelineEvent(tenantId, payload)` helper — define a thin `investigatorTimelineRepository.insert()` for this (the full timeline route is INV-011, but the insert helper is needed here).
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
