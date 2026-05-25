---
id: INV-019
title: "test(investigator): integration tests, tenant isolation, and CI parity"
labels: [investigator, testing, batch-11]
batch: 11
priority: high
depends_on: [INV-005, INV-007, INV-008, INV-009, INV-010, INV-011, INV-012, INV-013]
spec_refs: [SEC-001 SEC-007, AGENTS.md CI-parity checks]
---

## Summary

Write the integration test suite for all investigator route groups, covering happy paths, tenant isolation, and API contract correctness. Ensure all CI-parity checks pass with the full Investigator feature in place.

## Background / Context

SEC-007: _"Tenant A cannot read Tenant B's dossiers, runs, sources, people, salary observations, or summaries — not even through guessable IDs."_ The response for cross-tenant access is `404 NOT_FOUND` (not `403 FORBIDDEN`) to avoid leaking resource existence. The existing `api-contract.test.ts` must also be confirmed to cover the new route files.

## Acceptance Criteria

### Route integration tests (using real Express server)
Each test file uses `startServer()` / `stopServer()` from `routes/test-utils.ts` and `createJob()` / similar factories.

- [ ] `dossiersRouter.test.ts` — create, get, list (with multiple filters), patch, link job, unlink job, duplicate canonical key → 409, wrong-tenant get → 404, wrong-tenant patch → 404
- [ ] `runsRouter.test.ts` — start run, list runs, get run detail, cancel run, duplicate in-flight run → 409, wrong-tenant access → 404
- [ ] `sourcesRouter.test.ts` — create, list (with reviewState filter), patch review state, delete, contentHash duplicate returns existing source, wrong-tenant → 404
- [ ] `peopleRouter.test.ts` — create, list, patch, delete, wrong-tenant → 404
- [ ] `salaryRouter.test.ts` — create, list, patch, delete, min > max → 400, wrong-tenant → 404
- [ ] `summariesRouter.test.ts` — regenerate (mocked LLM), list, patch (user edit), wrong-tenant → 404
- [ ] `timelineRouter.test.ts` — get timeline after create + run start confirms events present; pagination cursor works
- [ ] `dossierMerge.test.ts` — merge two dossiers, verify source archived and records moved; same dossier → 409; confirm missing → 400; wrong-tenant → 404

### Tenant isolation test (can be a single dedicated test file)
- [ ] `investigatorTenantIsolation.test.ts`: Tenant A creates dossier with known `dossierId`; Tenant B attempts GET `/api/investigator/dossiers/:dossierId` → `404 NOT_FOUND` (not 403); same pattern for runs, sources, people, salary, summaries, timeline

### API contract test extension
- [ ] Confirm that `api-contract.test.ts` now scans the investigator route files and finds no `res.json()` direct calls
- [ ] Confirm no legacy `success:` field in investigator responses

### CI-parity checks
All of the following must pass without failures or ignored errors:
- [ ] `./orchestrator/node_modules/.bin/biome ci .` — lint clean
- [ ] `npm run check:types:shared` — shared types valid
- [ ] `npm --workspace orchestrator run check:types` — server + client types valid
- [ ] `npm --workspace gradcracker-extractor run check:types` — no regression
- [ ] `npm --workspace ukvisajobs-extractor run check:types` — no regression
- [ ] `npm --workspace orchestrator run build:client` — client build clean
- [ ] `npm --workspace orchestrator run test:run` — all tests (existing + new) pass

## Technical Implementation Notes

- If `better-sqlite3` ABI mismatch occurs when running tests: `npm --workspace orchestrator rebuild better-sqlite3` before `test:run`.
- Multi-tenant test setup: use two separate request instances with different auth tokens, or call `runWithRequestContext({ tenantId: 'tenant-b' }, ...)` to simulate the second tenant.
- LLM calls in `summariesRouter.test.ts`: mock `llmService` at the module level (`vi.mock(...)`) to return a deterministic `{ summary: "Test summary", facts: ["F1"], hypotheses: ["H1"] }` JSON string.
- All test data should use `createJob()` and similar factories from `@shared/testing/factories` — no hardcoded UUIDs except in the isolation test (where you deliberately try the other tenant's ID).
- Tests must not rely on test ordering; each test should create its own dossier.

## Out of Scope

- E2E Playwright tests (separate initiative)
- Load/performance tests
- Extractor deployment tests (covered in existing `deployment.test.ts`)

## Definition of Done

- All test files listed above exist and pass
- Cross-tenant access test asserts `404` not `403`
- `npm --workspace orchestrator run test:run` 100% green
- All CI-parity checks pass
