---
id: INV-001
title: "feat(investigator): add shared investigator domain types, enums, and Zod schemas"
labels: [investigator, shared, batch-1]
batch: 1
priority: high
depends_on: []
spec_refs: [sec-3.1, sec-4.1.9, sec-4.2]
---

## Summary

Create the public domain module at `shared/src/types/investigator.ts` that provides all entities, enums, DTO shapes, filter types, and Zod schemas consumed by both the server API layer and the React client. This is the first prerequisite for all other Investigator work.

## Background / Context

Per `spec-design-investigator-feature.md` §4.1.9 and NFR-006: _"Public investigator data contracts shall be defined in `shared` so server and client code consume the same domain types."_ Currently no investigator types exist anywhere in the codebase. All subsequent batch work depends on these definitions being stable and exported.

## Acceptance Criteria

- [ ] `shared/src/types/investigator.ts` exports all DTO types: `InvestigatorDossier`, `InvestigatorDossierListItem`, `InvestigatorResearchRun`, `InvestigatorSource`, `InvestigatorPerson`, `InvestigatorSalaryObservation`, `InvestigatorSummary`, `InvestigatorTimelineEvent`
- [ ] All status and classification enums are exported as `const` objects with a matching TS type: `DossierStatus`, `RunKind`, `RunStatus`, `SourceType`, `ReviewState`, `PersonType`, `PayInterval`, `SummaryType`, `TimelineEventType`, `ConfidenceLabel`, `LinkReason`
- [ ] Request / filter input types are exported: `CreateInvestigatorDossierInput`, `UpdateInvestigatorDossierInput`, `StartInvestigatorRunInput`, `InvestigatorDossierListFilters`, `CreateInvestigatorSourceInput`, `CreateInvestigatorPersonInput`, `CreateInvestigatorSalaryObservationInput`, `RegenerateInvestigatorSummaryInput`
- [ ] Zod schemas exist for all Create/Update inputs and are co-located in the same file (or a sibling `investigator.schemas.ts`)
- [ ] `shared/src/types/index.ts` re-exports the new module so existing import paths stay consistent
- [ ] `npm run check:types:shared` passes with no new errors

## Technical Implementation Notes

- Follow the existing pattern in `shared/src/types/` — look at `job.ts` or `settings.ts` for the export style.
- Enum values come verbatim from spec §4.2. Do not add values not listed there.
- `InvestigatorDossierListItem` is a projection of `InvestigatorDossier` (no heavy nested arrays) — include: `id`, `tenantId`, `companyName`, `status`, `tags`, `lastResearchedAt`, `linkedJobCount`, `createdAt`.
- `factsJson` and `hypothesesJson` on `InvestigatorSummary` should type as `string[]` until the summary content shape is finalized.
- Zod schemas must use `.strict()` on create inputs to catch unexpected fields early.

## Out of Scope

- Server Drizzle table definitions (INV-002)
- Queue payload types (INV-003)
- Client-side query key types (INV-014)

## Definition of Done

- `npm run check:types:shared` green
- `npm --workspace orchestrator run check:types` green (no breakage in existing imports)
- Exported identifiers match the names in spec §4.1.9 exactly
