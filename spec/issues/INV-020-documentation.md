---
id: INV-020
title: "docs(investigator): add user-facing documentation to docs-site"
labels: [investigator, documentation, batch-11]
batch: 11
priority: medium
depends_on: [INV-015, INV-016, INV-017, INV-018]
spec_refs: [PRD sec-10.14, SEC-005, SEC-006]
---

## Summary

Add user-facing documentation for the Investigator feature to `docs-site/docs/features/`. This covers the feature overview, usage instructions, privacy boundaries, and common workflows.

## Background / Context

PRD 10.14 acceptance criterion: _"Documentation and UX copy clearly define the intended boundaries of the feature."_ SEC-005/SEC-006 require that the feature only stores public professional context. Users must understand what data the feature collects, how research runs work, and what limitations exist.

## Acceptance Criteria

- [ ] `docs-site/docs/features/investigator.md` created with feature-page structure:
  1. What it is — company-centric research workspace for building employer intelligence
  2. Why it exists — compound reusable research across jobs and interviews
  3. How to use it — create dossier, start research run, review sources, manage people records, view summaries
  4. Common problems — stale dossiers, partial run failures, company identity mismatch and merge
  5. Related pages — links to job management, notes, pipeline docs
- [ ] Frontmatter includes: `id`, `title`, `description`, `sidebar_position`
- [ ] Privacy section explicitly states: feature stores only public professional context and user-authored notes; no personal, family, or non-professional data is collected
- [ ] Step-by-step instructions for core workflows: create dossier from job, run research, review and promote insights to notes
- [ ] States defaults and constraints: semi-automated only, no autonomous crawling, review-gated before persistence
- [ ] Registered in `docs-site/sidebars.ts` under the features section
- [ ] Copy-pasteable examples where relevant (e.g., what a dossier looks like after creation)

## Technical Implementation Notes

- Follow the existing feature-page structure used by `docs-site/docs/features/orchestrator.md` and other feature docs.
- Use `/docs/...` URLs for cross-linking.
- Keep language user-focused, not implementation-focused.
- Screenshots can be added as a follow-up once the UI is stable.

## Out of Scope

- API reference documentation (auto-generated in future)
- Developer/contributor docs for extending the investigator

## Definition of Done

- Documentation page renders correctly in Docusaurus
- Sidebar link visible and correctly positioned
- Privacy boundaries explicitly documented
- Core workflows documented with step-by-step instructions
