---
id: INV-009
title: "feat(investigator): people records repository, service, and routes"
labels: [investigator, backend, batch-4]
batch: 4
priority: high
depends_on: [INV-004]
spec_refs: [sec-3.1 REQ-009, sec-4.1.5, sec-4.3.4, SEC-005 SEC-006]
---

## Summary

Implement people record persistence: repository, service, and HTTP routes. People records link key individuals (recruiters, interviewers, executives) to a dossier with optional public profile references and user prep notes.

## Background / Context

REQ-009: structured people records with person type, role, profile URL, notes, source references, and confidence indicator. SEC-005: _"store only public professional context and user-authored notes in v1."_ SEC-006: _"the UI and workflows shall not encourage collection of personal, family, location-sensitive, or non-professional social data."_

## Acceptance Criteria

### Repository (`orchestrator/src/server/repositories/investigatorPeopleRepository.ts`)
- [ ] `findByDossier(dossierId)` — list people ordered by `personType`, then `fullName`; uses `getActiveTenantId()` internally
- [ ] `findById(personId)` — scoped by tenant internally
- [ ] `create(data)` — inserts with tenant from `getActiveTenantId()`
- [ ] `update(personId, data)` — partial update; scoped by tenant
- [ ] `delete(personId)` — scoped by tenant

### Service (`orchestrator/src/server/services/investigator/peopleService.ts`)
- [ ] `createPerson(dossierId, input: CreateInvestigatorPersonInput)` — creates person; writes `person_saved` timeline event
- [ ] `updatePerson(personId, data)` — updates; writes `person_saved` timeline event
- [ ] `deletePerson(personId)` — deletes; no timeline event required
- [ ] `listPeople(dossierId)` — delegates to repository
- [ ] `getPerson(personId)` — throws `notFound` if missing or wrong tenant

### Routes (`orchestrator/src/server/api/routes/investigator/peopleRouter.ts`)
- [ ] `GET /api/investigator/dossiers/:dossierId/people`
- [ ] `POST /api/investigator/dossiers/:dossierId/people`
- [ ] `PATCH /api/investigator/dossiers/:dossierId/people/:personId`
- [ ] `DELETE /api/investigator/dossiers/:dossierId/people/:personId`
- [ ] All handlers use `asyncRoute()` + `ok()` / `fail()`

### Privacy constraints
- [ ] Zod schema for `CreateInvestigatorPersonInput` does NOT include fields for home address, personal phone, personal email, family info, or social media handles unrelated to professional context
- [ ] `profileUrl` validated to be a URL; a note in the Zod schema's `.describe()` states "public professional profile only"

## Technical Implementation Notes

- `sourceIds` stored as `text` (JSON array of source ID strings); Drizzle type annotation `.$type<string[]>()`.
- `confidenceLabel` is a required field with no default — require it explicitly in the Zod create schema.
- Route file: one file for all four CRUD operations on people.

## Out of Scope

- People cards UI (INV-017)
- Automated people extraction in the run worker (future enhancement to INV-006 worker steps)

## Definition of Done

- Integration test covers: create, list, patch, delete, cross-tenant 404
- `npm --workspace orchestrator run test:run` green
- `npm --workspace orchestrator run check:types` green
- Biome lint clean
