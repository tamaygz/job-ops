---
id: INV-011
title: "feat(investigator): timeline repository, service, and read route"
labels: [investigator, backend, batch-5]
batch: 5
priority: high
depends_on: [INV-004]
spec_refs: [sec-3.1 REQ-014, sec-4.1.8, sec-4.3.7, GUD-002]
---

## Summary

Implement the immutable timeline event log for investigator dossiers. The repository write helper has already been used by INV-004/006/008/009/010; this issue formalizes the service contract and adds the public read route.

## Background / Context

REQ-014: a chronological timeline of all activity (run starts, status changes, source saves, people additions, summary generations) makes the dossier auditable. GUD-002: events are append-only — no updates or deletes. Events are written by other services (dossier, run, source, people, salary, summary).

## Acceptance Criteria

### Repository (`orchestrator/src/server/repositories/investigatorTimelineRepository.ts`)
- [ ] `insert(dossierId, eventType, payload, occurredAt?)` — inserts event; `occurredAt` defaults to `now()`; `id` is a generated CUID or UUID; uses `getActiveTenantId()` internally for `tenantId`
- [ ] `findByDossier(dossierId, opts?)` — paginatable list; ordered `occurredAt` desc by default; optional `eventType` filter; scoped by tenant internally
- [ ] **No update or delete methods** (GUD-002)
- [ ] Repository is re-exported as `timelineRepository` and imported by all other services (not duplicated across files)

### Service (`orchestrator/src/server/services/investigator/timelineService.ts`)
- [ ] `writeEvent(dossierId, eventType, payload)` — thin wrapper around `timelineRepository.insert()`; sanitizes `payload` via `sanitizeUnknown()` from `@infra/sanitize` before write; throws `notFound` if dossier does not belong to tenant
- [ ] All other investigator services (dossier, run, source, people, salary, summary) import `writeEvent` from here — they do **not** call the repository directly

### Route (`orchestrator/src/server/api/routes/investigator/timelineRouter.ts`)
- [ ] `GET /api/investigator/dossiers/:dossierId/timeline` — returns `InvestigatorTimelineEvent[]`; supports `limit` (default 50, max 200) and `before` (cursor) query params; returns `404 NOT_FOUND` if dossier is inaccessible

## Technical Implementation Notes

- The repository `insert` helper was staked out in INV-004 as a thin write call. This issue replaces any temporary implementation with the canonical version.
- `payload` column is a JSON string (`text`). Use `JSON.stringify` on write, `JSON.parse` on read. Keep reads lazy — only parse if the route actually returns the payload.
- Validate `eventType` is a valid `TimelineEventType` enum value at the service layer (not just repository layer) so callers get a clear error.
- Pagination: use `WHERE occurredAt < :before` cursor pattern (ISO 8601 date string), not offset-based.

## Out of Scope

- Timeline event writing from other services — those services have their own write calls; this issue just establishes the canonical `writeEvent` service function they import
- Timeline UI (part of dossier detail page in INV-015)

## Definition of Done

- Integration test: create dossier → start run → list timeline confirms expected events in order
- `npm --workspace orchestrator run test:run` green
- `npm --workspace orchestrator run check:types` green
- Biome lint clean
