# Branch Split Remediation

## Problem

The current branch spans multiple concerns across 256 changed files, which makes review, rollback, and targeted validation expensive.

## Goal

Split future delivery of this work into smaller, independently reviewable slices without losing the current implementation map.

## Recommended Stacks

### 1. Investigator Core

- Shared investigator types and schemas in `shared/src/types/investigator.ts`
- Investigator database schema and migration updates
- Investigator repositories and server services
- Investigator API routes and server tests

Validation:

- Investigator route and service tests
- Orchestrator typecheck

### 2. Investigator Client

- `orchestrator/src/client/pages/investigator/*`
- `orchestrator/src/client/components/investigator/*`
- Investigator query hooks and API client files

Validation:

- Investigator client tests
- Orchestrator typecheck

### 3. Compare Feature

- `shared/src/types/compare.ts`
- `orchestrator/src/server/services/compare/*`
- `orchestrator/src/server/api/routes/compare*`
- `orchestrator/src/client/pages/ComparePage*`
- Compare API client

Validation:

- Compare route and service tests
- Compare page tests
- Orchestrator typecheck

### 4. Web Search and Settings

- `orchestrator/src/server/services/web-search/*`
- `shared/src/settings-registry.ts`
- Settings page and settings components related to web search and investigator

Validation:

- Web-search unit tests
- Settings page tests
- Orchestrator typecheck

### 5. Post-Application Ingestion

- O365 and IMAP ingestion services
- Post-application providers and route updates
- Ingestion tests

Validation:

- Ingestion tests
- Provider route tests
- Orchestrator typecheck

### 6. Resume Renderer and Design Resume

- Resume renderer changes, templates, and Typst theme assets
- Design resume client hooks and components

Validation:

- Resume renderer tests
- Design resume client tests
- Orchestrator typecheck

### 7. Docs and Versioned Docs

- `docs-site/docs/**`
- `docs-site/versioned_docs/**`
- `docs-site/versioned_sidebars/**`
- `docs-site/versions.json`

Validation:

- `npm --workspace docs-site run build`

## Extraction Order

1. Land server-first slices before UI slices when a feature spans both.
2. Keep docs/version snapshots in their own slice unless they are required for the same release.
3. Avoid mixing dependency churn with feature movement unless the dependency is required by that slice.

## Minimum Review Rules

1. Every slice must have at least one focused executable validation command.
2. Every new page or major UI surface must ship with a dedicated client test file.
3. New provider-based services must ship with direct unit tests for provider selection and failure handling.