---
id: INV-002
title: "feat(investigator): add database schema for all investigator tables"
labels: [investigator, backend, batch-1]
batch: 1
priority: high
depends_on: [INV-001]
spec_refs: [sec-4.1.1 through sec-4.1.8, PAT-001]
---

## Summary

Add all eight `investigator_*` Drizzle table definitions to `orchestrator/src/server/db/schema.ts` and run the migration so the tables exist in the SQLite database at startup.

## Background / Context

PAT-001: _"New investigator tables should follow the existing Drizzle table pattern with `id`, `tenantId`, `createdAt`, and `updatedAt` fields."_ All eight tables and their constraints are specified in §4.1.1–4.1.8. This must land before any repository or route work.

## Acceptance Criteria

- [ ] Table `investigator_dossiers` created per §4.1.1 with a unique index on `(tenantId, canonicalCompanyKey)`
- [ ] Table `investigator_dossier_jobs` created per §4.1.2 with a unique index on `(tenantId, dossierId, jobId)`
- [ ] Table `investigator_research_runs` created per §4.1.3
- [ ] Table `investigator_sources` created per §4.1.4
- [ ] Table `investigator_people` created per §4.1.5
- [ ] Table `investigator_salary_observations` created per §4.1.6
- [ ] Table `investigator_summaries` created per §4.1.7
- [ ] Table `investigator_timeline_events` created per §4.1.8
- [ ] Migration file or `migrate.ts` logic applies all new tables without breaking existing tables
- [ ] All `json` columns use `text` storage (SQLite JSON-as-text pattern consistent with existing tables)
- [ ] All timestamp columns match the convention already used in the schema (text datetime for `createdAt`/`updatedAt`, integer for business-time timestamps like `startedAt`)
- [ ] `npm --workspace orchestrator run check:types` passes

## Technical Implementation Notes

- Look at existing tables like `jobs`, `jobNotes`, `watchlist` in `schema.ts` to match field naming conventions exactly (camelCase column names, snake_case table name string).
- `tags`, `sourceIds`, `factsJson`, `hypothesesJson`, `seedContext`, `payload` are all `text` columns — use `.$type<string[]>()` or `.$type<unknown>()` in Drizzle typing as appropriate.
- The `status` enum columns (e.g. `dossierStatus`, `runStatus`) should be defined as `text` with a TypeScript type annotation — check whether existing enums use `text` with a narrow type or a Drizzle `sqliteEnum`.
- Unique constraint on `investigator_summaries`: the spec implies at most one current reviewed summary per `(dossierId, summaryType)` — this is enforced at service level, not DB level in v1.
- Foreign key enforcement: SQLite WAL mode does not enforce FK by default. Follow the existing pattern (define relations via Drizzle `relations()` for query joins, no FK pragma).

## Out of Scope

- Repository layer (INV-004)
- Seeding/migration tests
- Any data in the database

## Definition of Done

- Server starts with no migration errors
- All eight tables visible in SQLite schema
- `npm --workspace orchestrator run check:types` green
