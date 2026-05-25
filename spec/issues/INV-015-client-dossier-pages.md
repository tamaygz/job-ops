---
id: INV-015
title: "feat(investigator): dossier list page and dossier detail page"
labels: [investigator, frontend, batch-8]
batch: 8
priority: high
depends_on: [INV-014]
spec_refs: [sec-3.1 REQ-001 to REQ-004 REQ-015 REQ-016, sec-3.6 client pages, NFR-001]
---

## Summary

Implement the two core Investigator pages: the dossier list (dashboard entry point) and the dossier detail (tabbed view of all dossier data). These pages form the navigational shell; content tabs are filled out in INV-016 to INV-018.

## Background / Context

REQ-015: navigate to Investigator from main nav. REQ-016: view all saved dossiers with status badges and linked job count. NFR-001: _"dossier list and detail pages shall load within 1 second on LAN; heavy sub-sections (sources, timeline) shall be loaded progressively."_

## Acceptance Criteria

### Dossier list page (`orchestrator/src/client/pages/investigator/InvestigatorListPage.tsx`)
- [ ] Accessible via `/investigator` route registered in the client router
- [ ] Uses `useDossiers(filters)` hook to load `InvestigatorDossierListItem[]`
- [ ] Displays company name, status badge (color-coded by `DossierStatus`), tag chips, last-researched date (relative, e.g. "3 days ago"), and linked job count
- [ ] Filter bar: status dropdown, tag input, stale toggle, text search (`q`)
- [ ] Empty state when no dossiers: illustration + "Create your first dossier" CTA
- [ ] "New Dossier" button opens a create dialog using `useCreateDossier` mutation
- [ ] Clicking a dossier row navigates to its detail page
- [ ] Loading state uses a skeleton placeholder consistent with other list pages in the app

### Dossier detail page (`orchestrator/src/client/pages/investigator/InvestigatorDetailPage.tsx`)
- [ ] Accessible via `/investigator/:dossierId`
- [ ] Header: company name, status badge, tag chips, "Start Research" button, action menu (edit, archive)
- [ ] Tabs or sections: Summary | Sources | People | Salary | Timeline — rendered but content panels are stubs until INV-016/017/018
- [ ] "Start Research" opens a RunKind selection dialog and calls `useStartRun`
- [ ] Changing status via action menu calls `useUpdateDossier`
- [ ] Back navigation to list page
- [ ] Dossier not found: shows 404 state consistent with other detail pages in the app
- [ ] Progressive loading: sources and timeline tabs load lazily (only when tab is selected) to satisfy NFR-001

## Technical Implementation Notes

- Route registration: follow the pattern used for other pages — check `orchestrator/src/client/routes.tsx` or similar router config file.
- Status badge colors: define in a `dossierStatusConfig` const (label + color) so it can be shared with the create dialog.
- "Start Research" dialog: simple dropdown of `RunKind` options + confirm button. No complex state; just calls `useStartRun(dossierId, { runKind })`.
- For progressive loading of tabs, use React `Suspense` with a lazy-loaded component per tab if the app already uses Suspense boundaries. Otherwise use an `isTabVisible` state flag to defer the query hook's `enabled` option.
- Stale indicator on list: highlight rows where `lastResearchedAt` is null or > 30 days old.

## Out of Scope

- Source review UI (INV-016)
- People, salary, summary panels (INV-017)
- Run progress panel (INV-016)
- Job context integration (INV-019)

## Definition of Done

- `npm --workspace orchestrator run build:client` green
- Manual smoke test: create dossier → see in list → open detail → change status → reflected in list
- `npm --workspace orchestrator run check:types` green
