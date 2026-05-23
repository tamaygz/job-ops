---
description: Established design and architectural patterns for job-ops. Apply when writing any server, shared, or client code in this repo.
applyTo: "**"
---

# job-ops Codebase Patterns

## 1. Monorepo Layout

npm workspaces: `orchestrator` (Express + React SPA), `shared` (domain types/logic), `extractors/*` (job-scraper plugins), `career-boards/*` (ATS integrations), `docs-site` (Docusaurus).

```
orchestrator/src/
  server/         ← Express API, services, repositories, pipeline
    api/routes/   ← One file = one domain router
    infra/        ← Shared infrastructure (logger, errors, http, sse, request-context, sanitize, job-queue)
    pipeline/     ← Orchestrator + steps + progress
    repositories/ ← Thin Drizzle ORM data access layer
    services/     ← Business logic
    tenancy/      ← Multi-tenant context helpers
    config/       ← env, demo, data-dir
  client/         ← React SPA (TanStack Query, Vite)
    api/          ← Typed API client functions
    hooks/        ← Custom React hooks + TanStack Query mutations
    lib/          ← Shared client utils (queryKeys, sse)
shared/src/       ← Types, Zod schemas, domain utilities used by both sides
extractors/<name>/
  manifest.ts     ← Entry point implementing ExtractorManifest
  src/            ← Extractor-specific crawl logic
```

**Path aliases** (tsconfig `paths`):
- `@infra/*` → `src/server/infra/*`
- `@server/*` → `src/server/*`
- `@client/*` → `src/client/*`
- `@shared/*` → `../shared/src/*`
- `@/*` → `src/*`

---

## 2. API Response Contract (enforced by automated test)

Every `/api/*` endpoint MUST use helpers from `@infra/http` — **never call `res.json()` directly**.

```ts
// Success
ok(res, data, 200);              // { ok: true, data, meta: { requestId } }
okWithMeta(res, data, extraMeta);

// Error
fail(res, toAppError(err));      // { ok: false, error: { code, message, details? }, meta: { requestId } }
```

`ApiResponse<T>` discriminated union is defined in `@shared/types/api.ts`.

Status/code mapping is strict — use the factory functions in `@infra/errors`:
`badRequest`, `unauthorized`, `forbidden`, `notFound`, `requestTimeout`, `conflict`, `unprocessableEntity`, `upstreamError`, `serviceUnavailable`.

Wrap async handlers with `asyncRoute()` so thrown errors reach the Express error handler:
```ts
router.get("/foo", asyncRoute(async (req, res) => { ... }));
```

---

## 3. Correlation IDs & Request Context

`AsyncLocalStorage` (Node's `async_hooks`) propagates context across the entire async call tree. Never pass `requestId` / `tenantId` / `userId` as function arguments — read them from context.

```ts
// Middleware (applied automatically in app.ts)
requestContextMiddleware()   // reads x-request-id header or generates one, injects context

// Reading from anywhere in the call chain
import { getRequestId, getTenantId, requireTenantId } from "@infra/request-context";

// Enriching a child flow
runWithRequestContext({ pipelineRunId, jobId }, () => doWork());
```

Always include `x-request-id` in response headers. Always return `meta.requestId` in API responses.

---

## 4. Multi-Tenancy

**Rule**: every state container, cache, in-memory map, and repository query MUST be keyed by `tenantId`.

```ts
// Pipeline state example — the standard pattern
const pipelineStateByTenant = new Map<string, TenantPipelineState>();

function getPipelineState(tenantId = getActiveTenantId()): TenantPipelineState {
  let state = pipelineStateByTenant.get(tenantId);
  if (!state) {
    state = { ...defaults };
    pipelineStateByTenant.set(tenantId, state);
  }
  return state;
}
```

`getActiveTenantId()` in `@server/tenancy/context` resolves to `getTenantId()` from request context, or `DEFAULT_TENANT_ID` as a fallback for single-user / backwards-compat situations. Never assume single-tenant when touching storage or in-process caches.

---

## 5. Structured Logging

Use the shared `Logger` class from `@infra/logger`. Never use `console.log/warn/error` directly in server paths.

```ts
import { logger } from "@infra/logger";

// Child logger with extra context
const log = logger.child({ pipelineRunId, source });
log.info("Discovery started", { termCount: 10 });
log.error("Unexpected failure", error);
```

The logger automatically attaches the full request context object (requestId, tenantId, etc.) from `AsyncLocalStorage` to every log line. Output is newline-delimited JSON.

---

## 6. Sanitization

All objects logged or returned in error `details` MUST be sanitized via `@infra/sanitize`:

```ts
import { sanitizeUnknown, sanitizeError } from "@infra/sanitize";
sanitizeUnknown(payload);   // redacts sensitive keys, truncates depth/length
sanitizeError(error);        // safe serialization of Error objects
```

Sensitive key regex: `authorization|cookie|password|secret|token|api.?key|credential|…`

---

## 7. Extractor Plugin System

Each extractor under `extractors/<name>/manifest.ts` exports a `manifest: ExtractorManifest`:

```ts
export const manifest: ExtractorManifest = {
  id: "my-source",           // unique, matches ExtractorSourceId
  displayName: "My Source",
  providesSources: ["my-source"],
  requiredEnvVars: ["MY_API_KEY"],           // optional
  capabilities: { locationEvidence: true }, // optional
  locationCapabilities: { ... },
  async run(context: ExtractorRuntimeContext): Promise<ExtractorRunResult> {
    // context.settings — DB/env settings (string map)
    // context.searchTerms — user-configured search terms
    // context.onProgress?.(event) — report crawl progress
    // context.shouldCancel?.() — cooperative cancellation
    // context.getExistingJobUrls?.() — dedup against existing URLs
    return { success: true, jobs: [] };
  },
};
```

The orchestrator's `ExtractorRegistry` discovers manifests at runtime by scanning a directory for `manifest.js` files and loading them dynamically. To add a new extractor:
1. Create `extractors/<name>/manifest.ts` implementing `ExtractorManifest`.
2. Register the source ID in `shared/src/extractors.ts` (`EXTRACTOR_SOURCE_IDS`).
3. Update `docker-compose.yml` and all `Dockerfile` stages (copy package.json before install, then copy directory).
4. Add deployment coverage to `orchestrator/src/server/extractors/deployment.test.ts`.

---

## 8. LLM Provider Strategy Pattern

Providers live in `orchestrator/src/server/services/llm/providers/`. Each exports a `ProviderStrategy` built with `createProviderStrategy()` from `factory.ts`. The index exports the `strategies` record:

```ts
export const strategies: Record<LlmProvider, ProviderStrategy> = {
  openrouter: ...,
  ollama: ...,
  // etc.
};
```

To add a new LLM provider:
1. Add its ID to the `LlmProvider` union in `types.ts`.
2. Create `providers/<name>.ts` calling `createProviderStrategy({ provider, defaultBaseUrl, modes, buildRequest, extractText, ... })`.
3. Register it in `providers/index.ts`.
4. Add default model logic in `shared/src/settings-registry.ts` (`getDefaultModelForProvider`).

`LlmService` (`services/llm/service.ts`) owns retry logic, capability-mode fallback, and response parsing — provider strategies only describe *how* to build the HTTP request and extract text.

---

## 9. LLM Resilience Policies (`services/llm/policies/`)

Three layered policies:

| Policy | File | Behavior |
|---|---|---|
| **Mode fallback** | `capability-fallback.ts` | If a 400 response body mentions `response_format`/`json_schema` keywords, the current mode is unsupported; fall back through `json_schema → json_object → text`. |
| **Mode caching** | `mode-selection.ts` | Remember the last successful mode per `provider:baseUrl` key so future calls skip failed modes. |
| **Retry** | `retry-policy.ts` | Retry on parse errors, 429, 5xx, or timeout. Delay = `baseDelayMs × attempt`. |

---

## 10. Settings System

Settings are a two-layer stack:

1. **Env defaults** — captured at process start via `getOriginalEnvValue()` in `envSettings.ts` (never mutated, isolates from per-tenant overrides).
2. **DB overrides** — stored per-tenant in the `settings` table, keyed by `SettingKey`.

The **Settings Registry** (`shared/src/settings-registry.ts`) is the single source of truth for every setting: kind (`env`, `secret`, `typed`), envKey, schema, default. The schema is derived automatically in `settings-schema.ts`.

The **Settings Update Registry** (`services/settings-update/registry.ts`) provides per-key handlers (`SettingUpdateHandler<K>`) that produce `SettingsUpdateAction[]` (persist calls) and `DeferredSideEffect[]`. Always use `applySettingsUpdates()` when mutating settings; never write to the settings repo directly from routes.

---

## 11. Pipeline Architecture

The pipeline is a staged, tenant-scoped orchestrator:

```
runPipeline()
  └── loadProfileStep       → context.profile
  └── discoverJobsStep      → context.discoveredJobs (parallel with asyncPool, DISCOVERY_CONCURRENCY=3)
  └── importJobsStep        → context.created / context.skipped
  └── scoreJobsStep         → context.scoredJobs
  └── selectJobsStep        → context.jobsToProcess
  └── processJobsStep       → context.processedCount (generate PDF + tailoring per job)
  └── notifyPipelineWebhookStep
```

Each step receives and returns the shared `RunPipelineContext` object. Steps are in `pipeline/steps/`. Progress is broadcast to SSE subscribers via tenant-keyed `listenersByTenant`.

Cancellation is cooperative: steps call `shouldCancel?.()` or check `isPipelineCancelRequested()` at natural boundaries.

---

## 12. SSE Infrastructure

**Server** (`@infra/sse`):
```ts
setupSse(res, { disableBuffering: true });  // sets headers
writeSseData(res, payload);                  // writes data: <json>\n\n
startSseHeartbeat(res);                      // returns cleanup fn, 30s interval
```

**Client** (`@client/lib/sse`):
```ts
const unsubscribe = subscribeToEventSource<T>(url, {
  onMessage: (payload) => ...,
  onError: () => ...,
});
```
The client uses `fetch` + `ReadableStream` (not native `EventSource`) to support custom auth headers and automatic token refresh on 401.

---

## 13. Job Queue

`JobQueue` interface (`@infra/job-queue`) is a typed abstraction over an in-process memory queue. All queue names and their payload types are declared centrally:

```ts
export interface JobQueuePayloadByName {
  auto_pdf_regeneration: AutoPdfRegenerationJobPayload;
}
```

To add a new queue: extend `JOB_QUEUE_NAMES`, `JobQueuePayloadByName`, and (if needed) the payload interface.

---

## 14. Post-Application Provider Adapter Pattern

New email/ATS providers implement `PostApplicationProviderAdapter`:

```ts
export interface PostApplicationProviderAdapter {
  readonly key: PostApplicationProvider;
  connect(args): Promise<PostApplicationProviderActionResult>;
  status(args):  Promise<PostApplicationProviderActionResult>;
  sync(args):    Promise<PostApplicationProviderActionResult>;
  disconnect(args): Promise<PostApplicationProviderActionResult>;
}
```

Register in `providers/registry.ts` → `providerRegistry`. Add the key to `POST_APPLICATION_PROVIDERS` in shared types.

---

## 15. Database

- **Drizzle ORM** + **better-sqlite3**, WAL journal mode.
- Schema defined in `server/db/schema.ts`. All tables have `createdAt`/`updatedAt` text columns with `(datetime('now'))` SQL defaults.
- Repositories (`server/repositories/`) are thin — one file per domain, named `domain.ts`. They call `db` directly with Drizzle query builder.
- Migrations live in `server/db/migrate.ts`.

---

## 16. Client Data Fetching

TanStack Query. All query keys are centralised in `@/client/lib/queryKeys`. Cache invalidation lives in `hooks/queries/invalidate.ts`.

```ts
// Mutations always call invalidateJobData() or invalidateSettingsData()
await invalidateJobData(queryClient, jobId);
```

The API client in `client/api/` exports one function per operation. All functions share `core.ts` for auth header management (JWT Bearer token, with automatic recovery on 401).

---

## 17. `asyncPool` Utility

Use `asyncPool` for bounded-concurrency parallel work on server. It caps concurrency to `[1, 10]`, supports cooperative cancellation via `shouldStop`, and fires `onTaskStarted`/`onTaskSettled` hooks.

```ts
await asyncPool({
  items: sources,
  concurrency: 3,
  shouldStop: () => isPipelineCancelRequested(),
  task: async (source) => runExtractor(source),
  onTaskSettled: (source, i, outcome) => { ... },
});
```

---

## 18. Testing Conventions

- **Framework**: Vitest.
- **Integration tests** spin up the real Express server in `startServer()` / `stopServer()` from `routes/test-utils.ts`. Tests use `fetch` against the running server.
- **Mocking**: `vi.mock(...)` at module level for heavy services (pipeline, scorer, profile). `vi.fn()` for everything else.
- **Factories**: `createJob(overrides)` and similar in `@shared/testing/factories` for deterministic test data.
- **API contract test** (`api-contract.test.ts`) asserts no route file calls `res.json()` directly and no legacy `success:` field leaks in.

---

## 19. Demo Mode

Demo mode is guarded by `isDemoMode()`. Mutating routes call `sendDemoBlocked()` instead of executing. A periodic timer (`runDemoResetCycle`) reseeds the DB from a baseline snapshot. Demo detection is done via environment variable — not user auth.

---

## 20. Resume Renderer

Multiple renderers are supported: `latex` (default) and `typst`. The `renderResumePdf()` entry in `services/resume-renderer/index.ts` dispatches to the right renderer based on the `renderer` setting. Resume JSON is first normalised to a shared `LatexDocument` intermediate format via `normalizeResumeJsonToLatexDocument()`, then rendered.

To add a new renderer: add it to the `PdfRenderer` union in shared types, write a `render<Name>Pdf()` function, and dispatch in `renderResumePdf()`.

---

## 21. CI-Parity Checks (run before marking work complete)

```bash
./orchestrator/node_modules/.bin/biome ci .
npm run check:types:shared
npm --workspace orchestrator run check:types
npm --workspace gradcracker-extractor run check:types
npm --workspace ukvisajobs-extractor run check:types
npm --workspace orchestrator run build:client
npm --workspace orchestrator run test:run
```

If tests fail with a Node ABI mismatch on `better-sqlite3`: `npm --workspace orchestrator rebuild better-sqlite3`.
