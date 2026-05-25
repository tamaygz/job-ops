---
id: INV-003
title: "feat(investigator): extend job queue with investigator_research_run payload"
labels: [investigator, backend, batch-1]
batch: 1
priority: high
depends_on: [INV-001]
spec_refs: [sec-4.4.2, NFR-007]
---

## Summary

Extend `orchestrator/src/server/infra/job-queue.ts` to register the `investigator_research_run` queue name and its typed payload, so research run orchestration can enqueue work using the existing `JobQueue` abstraction.

## Background / Context

NFR-007: _"Long-running run orchestration shall use the existing queue, service, or SSE abstractions already established in `orchestrator/src/server/infra`."_ The `JobQueuePayloadByName` interface and `JOB_QUEUE_NAMES` const array in `job-queue.ts` are the extension points for new queue types.

## Acceptance Criteria

- [ ] `"investigator_research_run"` is added to `JOB_QUEUE_NAMES` const array
- [ ] `InvestigatorResearchRunJobPayload` interface is defined and registered under `JobQueuePayloadByName["investigator_research_run"]`
- [ ] Payload includes at minimum: `tenantId: string`, `dossierId: string`, `runId: string`, `runKind: RunKind`
- [ ] Deduplication is achieved via the existing `EnqueueJobOptions.dedupeKey` option (value: `"{tenantId}:{dossierId}:{runKind}"`), NOT as a field in the payload. The `dedupeKey` is passed as the `options` argument when calling `queue.enqueue(...)`. This follows the existing `EnqueueJobOptions` interface contract in `job-queue.ts`.
- [ ] No existing queue names or payload types are modified
- [ ] `npm --workspace orchestrator run check:types` passes

## Technical Implementation Notes

- Import `RunKind` from `@shared/types/investigator` (defined in INV-001).
- Follow the exact shape of existing payload definitions in `job-queue.ts` — `tenantId` is required in every payload per the multi-tenancy rule.
- Deduplication uses the existing `EnqueueJobOptions.dedupeKey` option, which the `MemoryJobQueue` implementation already supports. The caller (INV-006 `runService.startRun`) passes `{ dedupeKey: \`${tenantId}:${dossierId}:${runKind}\` }` as the third argument to `queue.enqueue(...)`.
- Do not implement the queue consumer worker here — that is scoped to INV-006.

## Out of Scope

- Queue consumer / worker logic (INV-006)
- SSE progress events (INV-007)

## Definition of Done

- `JOB_QUEUE_NAMES` includes `"investigator_research_run"`
- TypeScript correctly narrows payload shape when using `queue.enqueue("investigator_research_run", payload)`
- `npm --workspace orchestrator run check:types` green
