---
id: INV-018
title: "feat(investigator): open dossier from job context and promote insight to job note"
labels: [investigator, frontend, batch-10]
batch: 10
priority: high
depends_on: [INV-014, INV-015]
spec_refs: [sec-3.1 REQ-001 REQ-016 REQ-017, GUD-001]
---

## Summary

Integrate Investigator into the existing job detail/job card context: an "Open in Investigator" action that either navigates to an existing dossier or prompts to create one seeded from the job, plus a "Promote to job notes" action in the summary panel that appends selected text to the job's notes field.

## Background / Context

REQ-016: dossiers can be created or accessed from a job. REQ-001: seed from job metadata. GUD-001: _"the Investigator is a research workspace, not a replacement for existing notes."_ REQ-017: promote selected insight text to job notes without overwriting. Explicit selection + confirmation guard prevents accidental note replacement.

## Acceptance Criteria

### "Open in Investigator" action on job
- [ ] A button or menu item "Open in Investigator" appears on the job detail page and/or job card
- [ ] On click: checks if a dossier exists for the job's company via `getDossier` by canonical key lookup (API call to `GET /api/investigator/dossiers?linkedJobId=<jobId>`)
- [ ] If dossier found: navigate to `/investigator/:dossierId`
- [ ] If not found: show a confirmation dialog "No dossier for [Company Name] — create one seeded from this job?" with Confirm / Cancel; on Confirm: calls `createDossierFromJob(jobId)` API function and navigates to the new dossier
- [ ] Loading state on button while API check is in-progress
- [ ] Error state: if creation fails, show a toast with the error message

### "Promote to job notes" in Summary Panel
- [ ] "Promote" button appears in `SummaryPanel.tsx` (per INV-017)
- [ ] Requires the user to select text within the summary body before the button is active
- [ ] On click (with text selected): show a confirmation popover "Append the selected text to notes for [Job Name]?" with Confirm / Cancel
- [ ] On Confirm: calls the existing job notes update mutation with appended text (e.g. `\n\n---\n[promoted text]`)
- [ ] On Cancel: selection preserved, no change
- [ ] If no job is linked to the dossier: button is hidden or shows tooltip "Link a job first to promote notes"
- [ ] If multiple jobs are linked: show a job selector dropdown before the confirmation popover

## Technical Implementation Notes

- Job context: the dossier detail page needs to know which job (if any) the user navigated from. Use router state (pass `sourceJobId` via navigation state) rather than storing it in component state.
- For the "Open in Investigator" button placement on the job detail page, follow the same pattern as other action buttons in the existing job detail page component.
- Text selection detection: use `window.getSelection()` inside the summary panel container; only enable "Promote" when selection is non-empty and within the summary markdown element.
- The append format `\n\n---\n{selectedText}` is a convention — check if existing job notes have a convention and match it.
- `createDossierFromJob`: this calls `POST /api/investigator/dossiers/from-job` with `{ jobId }` (defined in INV-005).

## Out of Scope

- Auto-sync of job changes back to dossier (future enhancement)
- Bulk promote from multiple summaries

## Definition of Done

- Manual smoke test: job with no dossier → "Open in Investigator" → confirm create → lands on new dossier
- Manual smoke test: job with existing dossier → "Open in Investigator" → navigates directly to dossier
- Manual smoke test: select text in summary → Promote → confirm → text appears appended in job notes
- `npm --workspace orchestrator run build:client` green
- `npm --workspace orchestrator run check:types` green
