---
id: INV-012
title: "feat(investigator): summary repository, LLM generation service, and routes"
labels: [investigator, backend, batch-5]
batch: 5
priority: high
depends_on: [INV-004, INV-008]
spec_refs: [sec-3.1 REQ-011 to REQ-013, sec-4.1.7, sec-4.3.6, PAT-003 PAT-008]
---

## Summary

Implement AI-generated company summaries using the existing LLM stack: repository for versioned summary records, service for prompt construction and LLM dispatch, and routes for generation, listing, and user-editing.

## Background / Context

REQ-011: generate structured summaries (`company_overview`, `compensation_intelligence`, `hiring_signals`, `red_flags`). REQ-012: summaries contain a `bodyMarkdown` narrative plus separate `factsJson` (verifiable claims) and `hypothesesJson` (plausible inferences) arrays. REQ-013: users can view and edit `bodyMarkdown` inline; regeneration increments version but preserves previous versions. PAT-008: _"use `orchestrator/src/server/services/llm/service.ts` via its public API; do not implement a parallel AI transport."_

## Acceptance Criteria

### Repository (`orchestrator/src/server/repositories/investigatorSummaryRepository.ts`)
- [ ] `findByDossier(tenantId, dossierId)` — list all summaries (all versions, all types)
- [ ] `findLatest(tenantId, dossierId, summaryType)` — returns the highest-version record for a given type
- [ ] `findById(tenantId, summaryId)`
- [ ] `create(tenantId, data)` — inserts; previous versions are NOT deleted
- [ ] `update(tenantId, summaryId, data)` — partial update (for user edits)

### Service (`orchestrator/src/server/services/investigator/summaryService.ts`)
- [ ] `regenerateSummary(tenantId, dossierId, summaryType)` — fetches verified/low_confidence sources; constructs prompt including company context, verified excerpts, and requested summary type; calls `llmService.complete(prompt)` (or equivalent public method); parses response to extract `bodyMarkdown`, `factsJson[]`, `hypothesesJson[]`; increments version; persists new summary record; writes `summary_generated` timeline event; returns new summary
- [ ] `editSummary(tenantId, summaryId, data)` — allows user edit of `bodyMarkdown` and `reviewState` only; increments version; does not re-run LLM; writes `summary_edited` timeline event
- [ ] `listSummaries(tenantId, dossierId)` — returns all versions, ordered by `summaryType`, then `version` desc
- [ ] LLM response sanitized before persistence: `sanitizeUnknown(parsed)` from `@infra/sanitize`

### Routes (`orchestrator/src/server/api/routes/investigator/summariesRouter.ts`)
- [ ] `GET /api/investigator/dossiers/:dossierId/summaries` — list summaries (optionally latest-only via `?latest=true`)
- [ ] `POST /api/investigator/dossiers/:dossierId/summaries/regenerate` — body `{ summaryType }`; returns new summary record (status 201)
- [ ] `PATCH /api/investigator/dossiers/:dossierId/summaries/:summaryId` — user edit; body `{ bodyMarkdown?, reviewState? }`; returns updated summary
- [ ] All handlers use `asyncRoute()` + `ok()` / `fail()`

## Technical Implementation Notes

- Prompt construction: use `dossier.companyName`, `dossier.industry`, `dossier.notes`, plus up to 10 most-recently-saved sources with `reviewState` in `["verified","low_confidence"]`. Truncate excerpts to 500 chars each.
- LLM `systemPrompt`: instruct the LLM to return a JSON object with keys `summary` (markdown string), `facts` (string array), `hypotheses` (string array). Use `json_schema` output mode if the provider supports it.
- Version field: `SELECT MAX(version) FROM investigator_summaries WHERE dossierId=? AND summaryType=? AND tenantId=?` then increment by 1.
- Never throw if LLM parsing fails — return a `partial_failed`-style summary with `bodyMarkdown: "(Generation failed)"` and write a `summary_generation_failed` timeline event instead.
- The `regenerate` route should be synchronous (waits for LLM response) unless the LLM call exceeds 30s — in that case a future issue can move it to the queue worker.

## Out of Scope

- Summary panel UI (INV-017)
- Moving LLM calls to the run worker (future enhancement)

## Definition of Done

- Unit test: prompt construction logic (verify correct source count, sanitized excerpts)
- Unit test: LLM parse failure path returns graceful result
- Integration test: regenerate endpoint returns 201 with summary record
- `npm --workspace orchestrator run test:run` green
- `npm --workspace orchestrator run check:types` green
- Biome lint clean
