---
id: INV-008
title: "feat(investigator): source artifact repository, service, and routes"
labels: [investigator, backend, batch-4]
batch: 4
priority: high
depends_on: [INV-004]
spec_refs: [sec-3.1 REQ-007 to REQ-008, sec-4.1.4, sec-4.3.3, PAT-005]
---

## Summary

Implement source artifact persistence: the repository for CRUD, the service for capture, deduplication via `contentHash`, review-state transitions, and the HTTP routes for manual create/edit/delete.

## Background / Context

REQ-007: persist source artifacts with URL, type, excerpt, review state, and annotations. REQ-008: support manual CRUD and review-state changes independent of automation. Sources are the primary evidence store that feeds summaries.

## Acceptance Criteria

### Repository (`orchestrator/src/server/repositories/investigatorSourceRepository.ts`)
- [ ] `findByDossier(tenantId, dossierId, opts?)` — list sources, optional filter by `runId`, `reviewState`, `sourceType`
- [ ] `findById(tenantId, sourceId)`
- [ ] `findByContentHash(tenantId, dossierId, contentHash)` — returns existing source if hash matches
- [ ] `create(tenantId, data)`
- [ ] `update(tenantId, sourceId, data)` — partial update
- [ ] `delete(tenantId, sourceId)`

### Service (`orchestrator/src/server/services/investigator/sourceService.ts`)
- [ ] `saveSource(tenantId, dossierId, input: CreateInvestigatorSourceInput)` — computes `contentHash` (SHA-256 of `capturedExcerpt`) if not provided; checks for duplicate by hash; creates source; writes `source_saved` timeline event
- [ ] `updateSource(tenantId, sourceId, data)` — updates fields; if `reviewState` changes, writes `source_reviewed` timeline event
- [ ] `deleteSource(tenantId, sourceId)` — deletes source; no timeline event required
- [ ] `listSources(tenantId, dossierId, filters?)` — delegates to repository

### Routes (`orchestrator/src/server/api/routes/investigator/sourcesRouter.ts`)
- [ ] `GET /api/investigator/dossiers/:dossierId/sources` — list sources; optional `reviewState`, `sourceType` query params
- [ ] `POST /api/investigator/dossiers/:dossierId/sources` — create source; validates body; returns created source
- [ ] `PATCH /api/investigator/dossiers/:dossierId/sources/:sourceId` — update; returns updated source
- [ ] `DELETE /api/investigator/dossiers/:dossierId/sources/:sourceId` — delete; returns `204`
- [ ] All handlers use `asyncRoute()` + `ok()` / `fail()`

## Technical Implementation Notes

- `contentHash`: SHA-256 of `capturedExcerpt.trim().toLowerCase()` using Node's built-in `crypto.createHash('sha256')`.
- When a hash collision is found via `findByContentHash`, return the existing source rather than creating a duplicate (return `200` not `201` with the existing record, or return `409 CONFLICT` if the client should be aware — choose `200` with existing record for automation-friendly behavior).
- `sourceHost` should be derived from `url` using `new URL(url).hostname` if `url` is present and valid.
- Log sanitization: never log `capturedExcerpt` in full; log `sourceId`, `dossierId`, `sourceType` only.

## Out of Scope

- Automated source fetch/crawl (that is part of the run worker in INV-006)
- Source display in the UI (INV-016)

## Definition of Done

- Integration test covers: create, list, patch review state, delete, hash dedupe
- `npm --workspace orchestrator run test:run` green
- `npm --workspace orchestrator run check:types` green
- Biome lint clean
