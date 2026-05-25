
---

## Architecture Analysis: Web Search / Scrape / Crawl / Fetch in `job-ops`

---

### 1. Monorepo Layout & Primary Runtime

The repository is an npm workspace monorepo with these top-level workspaces:

| Workspace | Role |
|---|---|
| `orchestrator/` | Main Node/TypeScript Express server + React SPA client. All API routes, pipeline orchestration, repositories, LLM services |
| `extractors/<name>/` | Independent job-board scraper packages (TypeScript or Python), each self-contained |
| `shared/` | Shared TypeScript types, constants, utilities consumed by both orchestrator and extractors |
| `career-boards/` | BambooHR and Workday helpers (HTTP-based board scrapers) |
| `visa-sponsor-providers/` | UK visa sponsor data fetchers |
| `docs-site/` | Docusaurus documentation site |

**Runtime:** Node.js 22 / TypeScript, Express as the HTTP framework, SQLite (via `better-sqlite3`) for persistence, Playwright (with Camoufox for anti-detection) for browser-based extractors, Python 3 (via child process) for the JobSpy extractor.

---

### 2. The `ExtractorManifest` Interface — The Core Abstraction

**File:** `shared/src/types/extractors.ts` (lines 55–65)

### 10. Correlation IDs, Logging & Multi-Tenancy Propagation

**Correlation IDs (`infra/http.ts:78–95`):**
- `requestContextMiddleware()` reads inbound `x-request-id` header; if absent, generates a UUID.
- Sets `x-request-id` response header immediately.
- Calls `runWithRequestContext({ requestId, analyticsSessionId, requestUserAgent })` — stores context in Node's `AsyncLocalStorage`.

**Logging (`infra/logger.ts`):**
- `Logger` class reads from `AsyncLocalStorage` at log time (line 49): `const requestContext = getRequestContext()` — automatically includes `requestId`, `pipelineRunId`, `jobId`, `tenantId` in every log line without explicit passing.
- Structured JSON output (`console.log(JSON.stringify(payload))`).
- `logger.child({ pipelineRunId })` (orchestrator.ts:260) creates a child logger that merges the run ID into all subsequent logs in that async context.

**Pipeline context propagation (`orchestrator.ts:259`):**
```typescript
return runWithRequestContext({ pipelineRunId: pipelineRun.id }, async () => {
  // All logs within this async context automatically include pipelineRunId
  ...
  await discoverJobsStep(...)  // logs inside extractors inherit this
});
```

**Multi-tenancy (`tenancy/context.ts`):**
- `getActiveTenantId()` reads from ALS via `getTenantId()`, defaulting to `DEFAULT_TENANT_ID` for single-user deployments.
- `pipelineStateByTenant: Map<string, TenantPipelineState>` (orchestrator.ts:88) keeps per-tenant pipeline state (isRunning, active run ID, challenge state, LLM config state).
- All repositories scope reads/writes by tenant ID. The extractor registry is global (source manifests are not tenant-specific), but jobs, settings, profiles, and pipeline runs are tenant-scoped.

---

### 11. Extractor Deployment (Docker)

The `Dockerfile` + `docker-compose.yml` bake all extractor directories into the image. The `docker-compose.yml` `develop.watch` entries sync changed source files into the running container for live-reload during development (lines 55–90). The `orchestrator/src/server/extractors/deployment.test.ts` asserts that every extractor in the catalog has corresponding Docker/compose sync coverage — enforcing that new extractors get proper container support.

---

### 12. Webhook Outbound

**File:** `orchestrator/src/server/pipeline/steps/notify-webhook.ts`

After pipeline completion, a minimal whitelisted payload (`{ event, sentAt, pipelineRunId, jobsDiscovered, jobsScored, jobsProcessed, error }`) is sent via `fetch()` POST to `PIPELINE_WEBHOOK_URL`. The payload goes through `sanitizeWebhookPayload()` (from `infra/sanitize.ts`) before transmission — redacting any accidentally-included sensitive keys.

---

### Summary Table: Extractor Implementation Patterns

| Extractor | Sources | Mechanism | Anti-detection |
|---|---|---|---|
| `jobspy` | indeed, linkedin, glassdoor | Python subprocess (`python-jobspy` library) | None (library-handled) |
| `gradcracker` | gradcracker | Crawlee + Playwright (Firefox) | Camoufox + CF cookie persistence |
| `adzuna` | adzuna | Node child process → plain `fetch()` to REST API | None (API key auth) |
| `hiringcafe` | hiringcafe | Direct async `fetch()` (JSON API) | None |
| `ukvisajobs` | ukvisajobs | Playwright or HTTP (credentials required) | — |
| `seek`, `naukri`, `wazzuf`, `fiveamsat`, `jobindex`, `golangjobs`, `startupjobs`, `workingnomads` | same | Direct HTTP `fetch()` / HTML parsing | None |




# Map Investigator (PR #6) into job-ops architecture: API, data model, async orchestration, and client wiring

The issue was to clarify how the Investigator feature integrates with existing job-ops architecture, rather than treating it as an isolated module. This PR captures the architectural linkage across server layers, persistence, async execution, and UI entry points.

- **Scope clarified**
  - Investigator is implemented as a new domain vertical under `orchestrator` (`/api/investigator/dossiers`), not as part of extractor/pipeline step execution.
  - Integration points were traced across route composition, repositories/services, queue worker flow, and client navigation/actions.

- **Server architecture linkage**
  - New router subtree mounted from the central API router.
  - Investigator follows existing layering conventions:
    - routes: `server/api/routes/investigator/*`
    - services: `server/services/investigator/*`
    - repositories: `server/repositories/investigator*`
  - Uses the existing API response/error contract (`asyncRoute`, `ok`, `fail`, `toAppError`).

- **Persistence and tenancy model**
  - Investigator introduces tenant-scoped tables for dossiers, runs, sources, people, salary observations, summaries, and timeline events.
  - Repositories consistently scope reads/writes via tenant context (`getActiveTenantId()`), and run worker execution is wrapped with request context propagation.

- **Async orchestration + progress transport**
  - Added queue type `investigator_research_run` and payload contract.
  - Run lifecycle: start/cancel APIs → queue enqueue → in-process worker drain → status/timeline updates.
  - Live progress is exposed via SSE endpoint using centralized SSE helpers.

- **Client integration**
  - Added `/investigator` and `/investigator/:dossierId` routes.
  - Wired Investigator into global navigation.
  - Connected job workflow via “Open in Investigator” with create-from-job fallback path.
  - Added dedicated query/mutation hooks and query keys for investigator resources.

- **Notable implementation observation**
  - Identified a likely route mismatch between client salary endpoints (`/salary`) and server-mounted salary routes (`/salary-observations`), which may require follow-up alignment.

```ts
// Central API mount + queue extension + tenant-aware worker context
apiRouter.use("/investigator/dossiers", dossiersRouter);

export const JOB_QUEUE_NAMES = [
  "auto_pdf_regeneration",
  "investigator_research_run",
] as const;

runWithRequestContext({ tenantId: payload.tenantId, pipelineRunId: payload.runId }, async () => {
  // investigator run processing
});
```
git rev-parse HEAD
  dd140e36d059699e53b97a080b55a04deb8d2e70
  
Already on 'copilot/research-repo-architecture'

Pushing to https://github.com/tamaygz/job-ops
To https://github.com/tamaygz/job-ops
 = [up to date]      copilot/research-repo-architecture -> copilot/research-repo-architecture
updating local tracking ref 'refs/remotes/origin/copilot/research-repo-architecture'
Everything up-to-date

git diff

copilot-result: Map Investigator (PR #6) into job-ops architecture: API, data model, async orchestration, and client wiring

The issue was to clarify how the Investigator feature integrates with existing job-ops architecture, rather than treating it as an isolated module. This PR captures the architectural linkage across server layers, persistence, async execution, and UI entry points.

- **Scope clarified**
  - Investigator is implemented as a new domain vertical under `orchestrator` (`/api/investigator/dossiers`), not as part of extractor/pipeline step execution.
  - Integration points were traced across route composition, repositories/services, queue worker flow, and client navigation/actions.

- **Server architecture linkage**
  - New router subtree mounted from the central API router.
  - Investigator follows existing layering conventions:
    - routes: `server/api/routes/investigator/*`
    - services: `server/services/investigator/*`
    - repositories: `server/repositories/investigator*`
  - Uses the existing API response/error contract (`asyncRoute`, `ok`, `fail`, `toAppError`).

- **Persistence and tenancy model**
  - Investigator introduces tenant-scoped tables for dossiers, runs, sources, people, salary observations, summaries, and timeline events.
  - Repositories consistently scope reads/writes via tenant context (`getActiveTenantId()`), and run worker execution is wrapped with request context propagation.

- **Async orchestration + progress transport**
  - Added queue type `investigator_research_run` and payload contract.
  - Run lifecycle: start/cancel APIs → queue enqueue → in-process worker drain → status/timeline updates.
  - Live progress is exposed via SSE endpoint using centralized SSE helpers.

- **Client integration**
  - Added `/investigator` and `/investigator/:dossierId` routes.
  - Wired Investigator into global navigation.
  - Connected job workflow via “Open in Investigator” with create-from-job fallback path.
  - Added dedicated query/mutation hooks and query keys for investigator resources.

- **Notable implementation observation**
  - Identified a likely route mismatch between client salary endpoints (`/salary`) and server-mounted salary routes (`/salary-observations`), which may require follow-up alignment.

```ts
// Central API mount + queue extension + tenant-aware worker context
apiRouter.use("/investigator/dossiers", dossiersRouter);

export const JOB_QUEUE_NAMES = [
  "auto_pdf_regeneration",
  "investigator_research_run",
] as const;

runWithRequestContext({ tenantId: payload.tenantId, pipelineRunId: payload.runId }, async () => {
  // investigator run processing
});
```
