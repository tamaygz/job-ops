---
id: investigator
title: Investigator
description: Company-centric research workspace for building employer intelligence before and during interviews.
sidebar_position: 13
---

## What it is

Investigator is the company research workspace in JobOps.

It gives you a persistent, structured **dossier** for each employer — a single place to accumulate intelligence across multiple jobs, research runs, and interview rounds.

A dossier stores:

- company name and URL
- structured notes and summaries generated from research runs
- source links (articles, LinkedIn pages, press releases, filings) reviewed and tagged by you
- people records (executives, hiring managers, interviewers)
- salary observations from public data
- a chronological timeline of every event on the dossier

Dossier statuses:

- ctive — currently researching or applying
- watchlist — monitoring for future opportunities
- interviewing — active interview process underway
- rchived — no longer pursuing; kept for reference
- declined — explicitly passed on

Research runs are semi-automated jobs that fetch and present candidate sources for your review. You choose what to keep; nothing is persisted automatically.

## Why it exists

Job applications rarely happen in isolation. You apply to the same company multiple times across months or years. You prepare for interviews, revisit notes, and re-research the same employer context repeatedly.

Investigator exists to make that research **compound**: you build knowledge once, and it carries forward across every interaction with that employer.

Without it:

- research is scattered across browser tabs, notes apps, and memory
- every interview round restarts from scratch
- insights from a previous application cycle are lost
- there is no single answer to "what do I already know about this company?"

With it:

- one dossier captures everything relevant about an employer
- research runs surface new information on demand
- sources you reviewed previously are right there
- summaries can be promoted to job notes for specific applications
- people records keep interviewer context across rounds

## How to use it

### Create a dossier

You can create a dossier in two ways:

**From the Investigator page:**

1. Open the **Investigator** section from the sidebar.
2. Click **New Dossier**.
3. Enter the company name and URL.
4. Click **Create**.

**From a job:**

1. Open any job in the Orchestrator.
2. Click the **⋯** menu at the top right of the job detail panel.
3. Select **Open in Investigator**.
4. If no dossier exists for that company, JobOps prompts you to create one.

### Start a research run

A research run instructs JobOps to fetch candidate sources for a company. Sources are presented for review — nothing is saved until you explicitly accept them.

1. Open a dossier.
2. Click **Start Research Run**.
3. Choose a run kind:
   - **Company Brief** — general overview: mission, products, recent news
   - **People Scan** — executive and hiring team discovery
   - **Dossier Refresh** — update an existing dossier with recent changes
4. Click **Start**.
5. Monitor progress in the run panel. The run completes when all source candidates have been fetched.

Runs are semi-automated: JobOps fetches and proposes sources; you decide what to keep.

### Review sources

After a run completes, candidate sources appear in the **Sources** panel.

For each source:

- Read the excerpt.
- Mark it **Accepted** to add it to the dossier, or **Rejected** to discard it.
- Accepted sources become part of the permanent dossier record.

Unreviewed sources do not affect summaries. Summary generation waits until you have reviewed the run's sources.

### Generate and read summaries

Summaries are AI-generated briefs derived from the accepted sources on the dossier.

You can tune the summary prompt globally in **Settings → Investigator**. That section controls how many reviewed sources are sent, how much of each excerpt is included, and the system prompt used for future summary generations.

1. In the dossier, open the **Summary** panel.
2. Click **Regenerate Summary** to produce a fresh summary from current accepted sources.
3. Read and evaluate the output.

You can also **promote a summary to job notes**: select the text you want to carry over, then use the **Promote to notes** button to choose which job should receive it as a note.

### Manage people records

The **People** panel lists executives, hiring managers, and interviewers associated with the company.

To add a person manually:

1. Open the **People** panel in the dossier.
2. Click **Add Person**.
3. Enter name, role, and any relevant notes.

People records persist across jobs. When you interview with the same person at a later date, their context is already there.

### Track salary observations

The **Salary** panel stores public compensation data points for the company.

Add a salary observation:

1. Open the **Salary** panel.
2. Click **Add Observation**.
3. Fill in role, pay range, pay interval, and source URL.
4. Click **Save**.

Observations are used for reference and context only. They do not affect scoring or pipeline decisions.

### Link jobs to a dossier

A dossier can be linked to multiple jobs. This lets you associate specific applications with the employer record.

To view linked jobs, open the **Jobs** tab inside a dossier. Links are created automatically when you use **Open in Investigator** from a job.

### Merge duplicate dossiers

If you have created two dossiers for the same company, you can merge them.

1. Open the dossier you want to keep as the primary record.
2. Open the dossier actions menu (⋯).
3. Select **Merge with another dossier**.
4. Choose the secondary dossier from the picker.
5. Confirm the merge.

The secondary dossier is archived. All sources, people records, salary observations, and run history from the secondary dossier are moved to the primary.

## Privacy

Investigator stores **only public professional context**:

- company information from public sources (websites, press, filings)
- professional role and contact information from public profiles
- salary ranges from publicly disclosed or aggregated data
- notes you write yourself

Investigator does **not** collect, store, or process:

- personal data (home address, personal phone numbers, family information)
- non-public information
- communications or messages

All data is stored locally in your self-hosted JobOps instance and is never sent to external services except as part of a research run (where only the company name and URL are used as seed context).

## Data retrieval flows

Research runs go through phases. Each phase uses specific providers to collect data. Not all phases run for every run kind, and not all providers do external fetching.

### Run kinds and phases

| Run kind | sources | people | salary | summary |
|---|---|---|---|---|
| **Company Brief** | ✓ | — | — | ✓ |
| **People Scan** | ✓ | ✓ | — | ✓ |
| **Dossier Refresh** | ✓ | ✓ | ✓ | ✓ |

### Sources phase — the only external retrieval phase

The sources phase is the only phase that makes outbound network requests. It runs up to three providers in sequence:

| Provider | ID | Retrieval mode | What it does | Timeline event |
|---|---|---|---|---|
| **Linked jobs** | `linked_jobs` | Internal (DB) | Reads jobs already linked to the dossier and saves their metadata as sources. No external network calls. | `source_saved` |
| **Company site** | `company_site` | Direct HTTP fetch | Fetches the dossier's company URL plus common subpaths (`/about`, `/about-us`, `/company`, `/team`, `/careers`, `/jobs`, `/contact`). Extracts page text and saves as sources. | `url_fetched` per page, then `source_saved` |
| **Web search** | `web_search` | Web search APIs | Queries external search providers (Bing, Brave, SearXNG) for the company name. Saves search result snippets as sources. | `search_queried` with per-provider outcomes, then `source_saved` per result |

All three are enabled by default. You can change which providers run in **Settings → Investigator → Source providers**.

### People phase (internal only)

Parses already-saved source text for people names and titles. No external network calls. Uses:

- **Source text extraction** (`source_text`): regex-based extraction of person candidates from source excerpts.

### Salary phase (internal only)

Extracts salary data from existing sources. No external network calls. Uses:

- **Job metadata** (`job_metadata`): reads salary fields from linked jobs in the database.
- **Source text extraction** (`source_text`): regex-based extraction of salary ranges from source excerpts.

### Summary phase (LLM call)

Generates AI summaries from accepted sources. Sends source excerpts to your configured LLM provider. No web search or scraping. Summary types depend on run kind:

- Company Brief → `company_brief`, `interview_angles`
- People Scan → `people_brief`
- Dossier Refresh → all three

## Configuring web search

Web search is the most powerful source provider, but it **requires API credentials** to work. Without credentials, every configured search provider is silently skipped and the run still completes — it just has fewer sources.

### Supported search providers

| Provider | Setting key | Required credential | How to get it |
|---|---|---|---|
| **Bing** | `webSearchProviders: ["bing"]` | Bing API key | [Azure Cognitive Services](https://portal.azure.com/) → create a Bing Search v7 resource |
| **Brave** | `webSearchProviders: ["brave"]` | Brave API key | [Brave Search API](https://brave.com/search/api/) → sign up for a plan |
| **SearXNG** | `webSearchProviders: ["searxng"]` | SearXNG base URL | Self-host a [SearXNG](https://docs.searxng.org/) instance, then set the base URL |

The default configuration uses only Bing. Without a Bing API key set, web search is effectively disabled.

### Setting up web search

**Via Settings UI:**

1. Go to **Settings → Web Search**.
2. Check which providers you want to enable (Bing, Brave, SearXNG).
3. Enter the API key or base URL for each enabled provider.
4. Optionally adjust the result limit (default 8) and market/locale (default `en-US`).
5. Save.

**Via environment variables:**

| Variable | Provider |
|---|---|
| `WEB_SEARCH_BING_API_KEY` or `BING_SEARCH_API_KEY` | Bing |
| `BRAVE_SEARCH_API_KEY` | Brave |
| `SEARXNG_API_KEY` | SearXNG (optional; base URL still needed in settings) |

### Verifying web search is working

After configuring credentials:

1. Create or open a dossier with a company name and URL.
2. Start a **Company Brief** run.
3. When the run completes, open the **Run Details** page.
4. In the **Audit Trail** section, look for a **"Search queried"** event.
5. The event payload shows:
   - **Query**: the search query used (e.g., `Acme Corp site:acme.com`)
   - **Result Count**: total deduplicated results across all providers
   - **Providers**: per-provider status — each shows ✓ (success with count), ✗ (failed), or "skipped"

If you only see `url_fetched` events (from the company site provider) but no `search_queried` event, it means the web search provider was **not enabled** or returned no results.

If you see a `search_queried` event but all providers show "skipped", the credentials are missing. Check **Settings → Web Search** to verify the API key is set.

### SearXNG — the free self-hosted option

SearXNG is the only provider that does not require a paid API key. It is a metasearch engine that aggregates results from Google, Bing, DuckDuckGo, and dozens of other engines.

To use it:

1. Deploy a SearXNG instance (Docker recommended: `docker run -d -p 8080:8080 searxng/searxng`).
2. In JobOps settings, add `searxng` to web search providers and set the base URL (e.g., `http://localhost:8080`).
3. Optionally set a SearXNG API key if your instance requires authentication.

## Common problems

### Dossier is stale after a long gap

Research runs fetch the current state of public sources. If a dossier has not had a run in several months, summaries may reflect outdated information.

**Fix:** Start a **Dossier Refresh** run to surface recent changes. Review the new sources and regenerate the summary.

### Research run completes with no sources

Some companies have limited public presence. A run with no results is not an error — it means no matching sources were found at run time.

**Fix:** You can add sources manually via the Sources panel using a direct URL and excerpt.

### Research run shows no web search results

Web search requires API credentials. Without them, all search providers are silently skipped and only company-site and linked-job providers contribute sources.

**Fix:** Go to **Settings → Web Search** and configure at least one provider with valid credentials. See the [Configuring web search](#configuring-web-search) section above. The easiest free option is self-hosting a SearXNG instance.

### Two dossiers for the same company

If you created dossiers at different points under slightly different company names, you will have duplicates.

**Fix:** Use the **Merge** workflow described above. The merge is non-destructive — no data is lost.

### Summary does not reflect recent sources

Summaries are generated from accepted sources only. If you recently accepted new sources, regenerate the summary.

**Fix:** Open the Summary panel and click **Regenerate Summary**.

### Run kind differences

Not all run kinds produce the same output. A **Company Brief** may not surface hiring-specific people. A **People Scan** focuses on individual discovery and may not include product or news context.

**Fix:** Run multiple kinds for complete coverage.

## Related pages

- [Orchestrator](/docs/next/features/orchestrator) — manage job lifecycle and link jobs to dossiers
- [Ghostwriter](/docs/next/features/ghostwriter) — use researched context for job-specific writing
- [Pipeline Run](/docs/next/features/pipeline-run) — automated scoring and processing
- [Watchlist](/docs/next/features/watchlist) — track companies you are monitoring before a formal dossier