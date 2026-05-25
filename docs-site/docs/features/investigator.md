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

## Common problems

### Dossier is stale after a long gap

Research runs fetch the current state of public sources. If a dossier has not had a run in several months, summaries may reflect outdated information.

**Fix:** Start a **Dossier Refresh** run to surface recent changes. Review the new sources and regenerate the summary.

### Research run completes with no sources

Some companies have limited public presence. A run with no results is not an error — it means no matching sources were found at run time.

**Fix:** You can add sources manually via the Sources panel using a direct URL and excerpt.

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