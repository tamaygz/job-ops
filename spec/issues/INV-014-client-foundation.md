---
id: INV-014
title: "feat(investigator): client query keys, typed API functions, and TanStack Query hooks"
labels: [investigator, frontend, batch-7]
batch: 7
priority: high
depends_on: [INV-005, INV-007, INV-008, INV-009, INV-010, INV-011, INV-012]
spec_refs: [sec-3.6 client layer, sec-4.4.1, PAT-006]
---

## Summary

Create the client-side API foundation for the Investigator feature: extend `queryKeys.ts` with the investigator key family, write typed API client functions for all endpoints, and create TanStack Query hooks (queries and mutations) that the UI pages will consume.

## Background / Context

PAT-006: _"Client code shall use TanStack Query for all server state. All query keys shall be declared in `orchestrator/src/client/lib/queryKeys.ts`."_ No raw `fetch()` calls in hooks or components — all server communication goes through the typed API client layer.

## Acceptance Criteria

### Query keys (`orchestrator/src/client/lib/queryKeys.ts`)
- [ ] `queryKeys.investigator` added as a const family with sub-factories:
  - `queryKeys.investigator.dossiers(filters?)` — list
  - `queryKeys.investigator.dossier(dossierId)` — detail
  - `queryKeys.investigator.runs(dossierId)` — run list
  - `queryKeys.investigator.run(dossierId, runId)` — run detail
  - `queryKeys.investigator.sources(dossierId)` — source list
  - `queryKeys.investigator.people(dossierId)` — people list
  - `queryKeys.investigator.salary(dossierId)` — salary list
  - `queryKeys.investigator.summaries(dossierId, opts?)` — summaries list
  - `queryKeys.investigator.timeline(dossierId)` — timeline list

### API client (`orchestrator/src/client/api/investigator/`)
- [ ] `dossiers.ts` — `listDossiers(filters?)`, `getDossier(id)`, `createDossier(input)`, `updateDossier(id, input)`, `linkJob(dossierId, input)`, `unlinkJob(dossierId, jobId)`, `createDossierFromJob(jobId)`, `mergeDossiers(targetId, sourceId)`
- [ ] `runs.ts` — `listRuns(dossierId)`, `getRun(dossierId, runId)`, `startRun(dossierId, input)`, `cancelRun(dossierId, runId)`
- [ ] `sources.ts` — `listSources(dossierId)`, `createSource(dossierId, input)`, `updateSource(dossierId, sourceId, data)`, `deleteSource(dossierId, sourceId)`
- [ ] `people.ts` — `listPeople(dossierId)`, `createPerson(dossierId, input)`, `updatePerson(dossierId, personId, data)`, `deletePerson(dossierId, personId)`
- [ ] `salary.ts` — `listSalary(dossierId)`, `createObservation(dossierId, input)`, `updateObservation(dossierId, id, data)`, `deleteObservation(dossierId, id)`
- [ ] `summaries.ts` — `listSummaries(dossierId)`, `regenerateSummary(dossierId, type)`, `editSummary(dossierId, summaryId, data)`
- [ ] `timeline.ts` — `listTimeline(dossierId, opts?)`
- [ ] All client functions use the shared `core.ts` auth/fetch helper already used by other API modules

### Hooks (`orchestrator/src/client/hooks/queries/investigator*.ts`)
- [ ] Query hooks: `useDossiers(filters?)`, `useDossier(dossierId)`, `useRuns(dossierId)`, `useRun(dossierId, runId)`, `useSources(dossierId)`, `usePeople(dossierId)`, `useSalary(dossierId)`, `useSummaries(dossierId)`, `useTimeline(dossierId)`
- [ ] Mutation hooks: `useCreateDossier`, `useUpdateDossier`, `useLinkJob`, `useUnlinkJob`, `useStartRun`, `useCancelRun`, `useCreateSource`, `useUpdateSource`, `useDeleteSource`, `useCreatePerson`, `useUpdatePerson`, `useDeletePerson`, `useCreateSalary`, `useUpdateSalary`, `useDeleteSalary`, `useRegenerateSummary`, `useEditSummary`
- [ ] Mutations call `queryClient.invalidateQueries({ queryKey: queryKeys.investigator.dossier(dossierId) })` (and sub-key invalidations) on success — follow existing `invalidate.ts` patterns
- [ ] `npm --workspace orchestrator run build:client` passes (no TS errors in client code)

## Technical Implementation Notes

- Follow the pattern established in `orchestrator/src/client/api/` and `hooks/queries/` — look at `jobs.ts` / `useJobs.ts` as reference.
- The `core.ts` fetch wrapper handles auth headers and 401 refresh — do not replicate that logic.
- Mutation `onSuccess` callbacks should invalidate at the right granularity: e.g., `deleteSource` should invalidate `sources(dossierId)` and `dossier(dossierId)` (since summary context changes).
- Hooks should accept `enabled` option so they can be suspended/disabled when the component is not ready.

## Out of Scope

- UI components (INV-015 through INV-018)
- SSE subscription hook (included optionally in INV-016)

## Definition of Done

- All typed API functions have the correct return types (matching `ApiResponse<T>`)
- No `fetch()` calls in hook files
- `npm --workspace orchestrator run build:client` green
- `npm --workspace orchestrator run check:types` green
