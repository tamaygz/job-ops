You are implementing issue {ISSUE_NUMBER} for the JobOps Investigator feature.

## Required Reading (in order)

1. **PRD**: `spec/iinvestigator.prd.md`
   - Read sections 2-4 for goals, requirements, and user experience
   - Understand the "why" behind the feature

2. **Spec**: `spec/spec-design-investigator-feature.md`
   - Read sections 3-4 for requirements, constraints, and data contracts
   - This is your technical authority

3. **Issue File**: `spec/issues/INV-{ISSUE_NUMBER}.md`
   - This is your specific work scope
   - Complete ALL acceptance criteria
   - Follow ALL technical implementation notes
   - Respect the "Out of Scope" section

4. **Codebase Patterns**: `AGENTS.md`
   - Read the entire file to understand established patterns
   - Pay special attention to:
     - API response contract (mandatory helpers)
     - Multi-tenancy (AsyncLocalStorage pattern)
     - Logging and sanitization
     - Repository/service/route layering

## Critical Requirements

### Before Starting
- [ ] Read all four documents above completely
- [ ] Identify dependencies (issue's `depends_on` field)
- [ ] Verify dependencies are complete before starting
- [ ] Map acceptance criteria to code locations

### Tenancy Pattern (CRITICAL)
- Repositories call `getActiveTenantId()` internally — NEVER accept `tenantId` as a parameter
- Services call `getActiveTenantId()` internally — NEVER accept `tenantId` as a parameter
- Queue workers MUST call `runWithRequestContext({ tenantId: payload.tenantId })` before service calls
- Reference: `orchestrator/src/server/repositories/jobs.ts` and `orchestrator/src/server/services/auto-pdf-regeneration.ts`

### API Contract (MANDATORY)
- ALL `/api/*` routes MUST use `asyncRoute()` wrapper
- ALL success responses MUST use `ok(res, data)` helper
- ALL error responses MUST use `fail(res, toAppError(err))` helper
- NEVER call `res.json()` directly
- Reference: `orchestrator/src/server/infra/http.ts`

### Testing Requirements
- Write integration tests for ALL new routes
- Follow existing test patterns in `orchestrator/src/server/api/routes/*/test.ts`
- Use `startServer()` / `stopServer()` from `test-utils.ts`
- Test cross-tenant isolation (404 not 403)
- Test all acceptance criteria paths

### Validation (REQUIRED BEFORE COMPLETION)
Run ALL these commands and ensure they pass:
```bash
./orchestrator/node_modules/.bin/biome ci .
npm run check:types:shared
npm --workspace orchestrator run check:types
npm --workspace orchestrator run build:client
npm --workspace orchestrator run test:run
