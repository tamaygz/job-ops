---
id: INV-013
title: "feat(investigator): dossier merge service and route"
labels: [investigator, backend, batch-6]
batch: 6
priority: medium
depends_on: [INV-004, INV-005]
spec_refs: [sec-3.1 REQ-020, sec-4.3.1]
---

## Summary

Implement dossier merge: absorb a source dossier's linked jobs, sources, people, salary observations, timeline events, and summaries into a target dossier, then archive the source dossier. This handles cases where the same company ended up with two dossiers (e.g., different canonical name spellings).

## Background / Context

REQ-020: users can merge two dossiers when they find duplicates. The operation must be explicit (the user chooses which dossier survives) and includes a `confirm: true` guard to prevent accidental destructive merges.

## Acceptance Criteria

### Service (`orchestrator/src/server/services/investigator/dossierMergeService.ts`)
- [ ] `mergeDossiers(targetDossierId, sourceDossierId)` — validates both dossiers exist and belong to tenant (via `getActiveTenantId()` internally); returns `conflict` if `targetDossierId === sourceDossierId`; reassigns all rows in `investigator_dossier_jobs`, `investigator_sources`, `investigator_people`, `investigator_salary_observations`, `investigator_summaries`, `investigator_timeline_events` from source to target (`dossierId = targetDossierId`); updates `targetDossier.linkedJobCount` if denormalized; sets source dossier `status = "archived"` and `archivedAt`; writes `dossier_merged` timeline event on target (payload includes `{ sourceDossierId, sourceCompanyName }`)
- [ ] Operation is atomic (single Drizzle transaction)
- [ ] After merge: source dossier is accessible via GET (shows `archived` status) but excluded from default list results
- [ ] Throws `notFound` if either dossier is inaccessible or wrong tenant

### Route (added to `dossiersRouter.ts`)
- [ ] `POST /api/investigator/dossiers/:dossierId/merge` — body `{ sourceDossierId: string, confirm: true }`; returns updated target dossier; returns `400 INVALID_REQUEST` if `confirm !== true`; returns `409 CONFLICT` if same dossier; uses `asyncRoute()` + `ok()` / `fail()`

## Technical Implementation Notes

- Transaction: Drizzle supports `db.transaction(async (tx) => { ... })` — use this to wrap all re-assignment updates and the source status change.
- Duplicate source handling: after merge, multiple sources with the same `contentHash` may exist on the target. This is acceptable for v1 — dedupe is a future enhancement.
- Archived dossiers: ensure `GET /api/investigator/dossiers` default query excludes `status = "archived"` unless the `status` filter explicitly includes it. Update the repository `findByTenant` filter accordingly.
- The `confirm: true` pattern matches the restore/delete pattern used elsewhere in the codebase — check existing routes for the exact Zod schema pattern.

## Out of Scope

- Merge UI (could be a modal in INV-015 dossier detail page, but scoped there)
- Automated duplicate detection

## Definition of Done

- Integration test: create two dossiers, merge, verify source is archived and all records moved to target
- Integration test: merge with same dossier IDs returns 409
- Integration test: merge with `confirm: false` returns 400
- `npm --workspace orchestrator run test:run` green
- `npm --workspace orchestrator run check:types` green
- Biome lint clean
