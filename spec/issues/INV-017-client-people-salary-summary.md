---
id: INV-017
title: "feat(investigator): people panel, salary panel, and summary panel"
labels: [investigator, frontend, batch-9]
batch: 9
priority: high
depends_on: [INV-014, INV-015]
spec_refs: [sec-3.1 REQ-009 to REQ-013, NFR-005]
---

## Summary

Implement the three remaining content panels on the dossier detail page: people records, salary observations, and the AI-generated summary panel with inline editing.

## Background / Context

REQ-009: people cards by person type with profile link and notes. REQ-010: salary observations table with role, range, source. REQ-011–013: summary panel shows rendered markdown, facts, hypotheses separately (PAT-003), supports regeneration and inline editing (NFR-005). _"Users can refine AI output without triggering regeneration."_

## Acceptance Criteria

### People Panel (`orchestrator/src/client/components/investigator/PeoplePanel.tsx`)
- [ ] Uses `usePeople(dossierId)` — loaded when "People" tab is selected
- [ ] Groups cards by `personType` with section headers
- [ ] Each card shows: full name, role, `personType` badge, `profileUrl` as a link (opens in new tab), prep notes (truncated, expandable), confidence label badge, source count
- [ ] "Add person" button opens inline or dialog form; calls `useCreatePerson`
- [ ] Edit icon on each card opens edit form; calls `useUpdatePerson`
- [ ] Delete with confirmation popover; calls `useDeletePerson`
- [ ] Empty state for no people
- [ ] No fields for personal/home/family data (SEC-006 constraint — form must not include those fields)

### Salary Panel (`orchestrator/src/client/components/investigator/SalaryPanel.tsx`)
- [ ] Uses `useSalary(dossierId)` — loaded lazily
- [ ] Tabular layout: columns for role, geography, range (`minAmount–maxAmount currency`), source URL link, notes, observed date
- [ ] "Add observation" opens inline row or dialog; calls `useCreateObservation`
- [ ] Row edit: pencil icon → calls `useUpdateObservation`
- [ ] Row delete: confirmation → calls `useDeleteObservation`
- [ ] `payInterval` shown as a badge (hourly/annual/etc.)
- [ ] Empty state when no observations

### Summary Panel (`orchestrator/src/client/components/investigator/SummaryPanel.tsx`)
- [ ] Uses `useSummaries(dossierId)` — shows latest version per `summaryType`
- [ ] Summary type tabs or sections: `company_brief`, `people_brief`, `interview_angles` (per spec §4.1.7 and §4.2 enums)
- [ ] The `interview_angles` section specifically surfaces suggested interview questions (PRD 10.10: "Suggested interview questions are visible from the dossier") — label it as "Interview Prep & Questions"
- [ ] Each section shows:
  - `bodyMarkdown` rendered as markdown (not raw text)
  - "Facts" expandable list (items from `factsJson`)
  - "Hypotheses / Inferences" expandable list (items from `hypothesesJson`) — visually distinct from facts (NFR-005)
  - Version number and last generated date
- [ ] "Regenerate" button calls `useRegenerateSummary` — shows loading state; replaces panel content with new summary on success
- [ ] Inline body edit: "Edit" button toggles `bodyMarkdown` to a textarea; save calls `useEditSummary`; cancel reverts; version number increments on save
- [ ] If no summary exists for a type: shows "No summary yet — click Regenerate to generate one" placeholder

## Technical Implementation Notes

- Markdown rendering: use the same markdown renderer already used elsewhere in the app (check existing components for `react-markdown` or similar usage).
- Facts vs. hypotheses visual distinction: use different icon (checkmark for facts, question mark for hypotheses) and text muted color for hypotheses per NFR-005.
- Salary range display: if `minAmount` and `maxAmount` are both present: `$85k – $120k`; if only one: `from $85k` or `up to $120k`; if neither: `—`.
- Summary regeneration loading: disable the "Regenerate" button and show a spinner during the mutation. The mutation can take 10–30s — do not time out the UI.
- Inline edit: use a controlled textarea with the current `bodyMarkdown` value. On save, call `useEditSummary`. On cancel, restore the original value from the query cache.

## Out of Scope

- Timeline display (included in INV-015 dossier detail page as a stub tab)
- Dossier merge UI (a future modal on INV-015)

## Definition of Done

- Manual smoke test: add a person → see in panel; add salary observation → see in table; regenerate summary → see rendered result
- Inline summary edit: save and see version increment
- `npm --workspace orchestrator run build:client` green
- `npm --workspace orchestrator run check:types` green
