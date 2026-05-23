---
id: INV-016
title: "feat(investigator): research run progress panel and source review UI"
labels: [investigator, frontend, batch-8]
batch: 8
priority: high
depends_on: [INV-014, INV-015]
spec_refs: [sec-3.1 REQ-005 to REQ-008, sec-4.3.8, NFR-002]
---

## Summary

Implement the live run progress panel (shown when a research run is active or recently completed) and the source review panel (list and review sources gathered by a run or added manually).

## Background / Context

NFR-002: _"run status shall be readable within 2 seconds of transition via polling or SSE."_ REQ-008: users can review, annotate, and update source review states. These two components fill the dynamic heart of the dossier detail page.

## Acceptance Criteria

### Run Progress Panel (`orchestrator/src/client/components/investigator/RunProgressPanel.tsx`)
- [ ] Displays when a run with status `queued` or `running` exists for the dossier (detected via `useRuns(dossierId)`)
- [ ] Auto-refreshes status every 3 seconds using `refetchInterval` on `useRun(dossierId, runId)` hook
- [ ] Shows: status label (color-coded), animated progress indicator when `running`, elapsed time since `startedAt`
- [ ] Cancel button calls `useCancelRun` — only shown when status is `queued` or `running`; shows confirmation before cancelling
- [ ] `partial_failed` state: shows "Partial results available" with count of successful phases and a summarized (sanitized) error message from run record
- [ ] `completed` state: transitions panel to "Research complete — view results" with a dismiss or "refresh page" action
- [ ] `failed`/`cancelled` states: brief error/cancelled message with retry option (starts a new run)
- [ ] **Optional (if SSE endpoint from INV-007 was implemented):** subscribe to SSE progress stream using `subscribeToEventSource()` from `@client/lib/sse.ts`; fall back to polling if SSE is unavailable

### Source Review Panel (`orchestrator/src/client/components/investigator/SourceReviewPanel.tsx`)
- [ ] Shown in the "Sources" tab of the dossier detail page
- [ ] Groups sources by `sourceType` with a section header per type
- [ ] Each source card shows: title/URL, `sourceType` badge, `reviewState` badge, captured excerpt (truncated to 200 chars, expandable), `reviewerNote`, captured date
- [ ] Review state selector: dropdown or button group cycling through `ReviewState` values; calls `useUpdateSource` on change
- [ ] Reviewer note: inline editable text field; debounced save on blur via `useUpdateSource`
- [ ] Delete source: confirmation popover, then calls `useDeleteSource`
- [ ] "Add manual source" button: opens a create form (URL, title, excerpt, type); calls `useCreateSource`
- [ ] Empty state when no sources
- [ ] Verified sources visually distinguished (e.g. green border or check badge)

## Technical Implementation Notes

- Polling interval: use `refetchInterval: 3000` in `useRun` — only set when run is in `queued` or `running` status (use `refetchIntervalInBackground: false`).
- SSE path (if taken): use `subscribeToEventSource<{ runId: string; status: RunStatus; phase?: string }>(url, { onMessage, onError })` from `@client/lib/sse.ts` and clean up on component unmount.
- Source groups: `Object.groupBy(sources, (s) => s.sourceType)` or a reduce — check browser target compatibility and polyfill if needed.
- Review state transitions must be optimistic-updated in the UI for snappy feel — use `useMutation` `onMutate` / `onError` rollback pattern.
- Reviewer note debounce: 800ms debounce to avoid excessive API calls on keystroke.

## Out of Scope

- People, salary, summary panels (INV-017)
- Job context integration (INV-019)

## Definition of Done

- Manual smoke test: start a run → see progress panel → cancel run → see cancelled state
- Manual smoke test: review a source → see state change reflected
- `npm --workspace orchestrator run build:client` green
- `npm --workspace orchestrator run check:types` green
