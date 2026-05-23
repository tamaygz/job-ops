# PRD: Investigator Feature

## 1. Product overview

### 1.1 Document title and version

- PRD: Investigator Feature
- Version: 0.1.0

### 1.2 Product summary

The investigator feature adds a company-centric research workspace to JobOps so users can build, revisit, and reuse structured intelligence about target employers over time. Instead of scattering ad hoc notes across browser tabs, bookmarks, and one-off markdown entries, users will maintain persistent company dossiers with tracked sources, people records, salary observations, AI-generated synthesis, and timeline history.

The first release should be semi-automated. Users initiate a research run from a company or job context, JobOps collects and organizes evidence through guided search and browsing workflows, and the user reviews, edits, and saves the result. The feature must extend JobOps' current strengths in job tracking, notes, and company metadata without creating a disconnected second system.

## 2. Goals

### 2.1 Business goals

- Increase JobOps retention by giving users a reason to return between search, application, and interview stages.
- Expand JobOps from job discovery and application tracking into reusable employer intelligence.
- Create a durable data layer that can support future interview prep, outreach, and prioritization features.
- Improve perceived product quality by turning research into a tracked, reviewable asset rather than ephemeral AI output.

### 2.2 User goals

- Save company research in one place and reuse it across multiple jobs.
- Track how salary, people, and company signals change over time.
- Generate concise AI briefs without losing the underlying evidence and sources.
- Research interviewers, leaders, recruiters, and employees in a structured way.
- Move from raw research to concrete application or interview actions quickly.

### 2.3 Non-goals

- Fully autonomous continuous crawling of the public web without user initiation.
- Hidden or opaque AI conclusions without source attribution.
- Contact enrichment, private data collection, or invasive surveillance-style people research.
- Automatic outreach, application submission, or recruiter messaging.
- Building a generic CRM outside the job-search and interview workflow.

## 3. User personas

### 3.1 Key user types

- Active job seeker managing multiple target companies.
- Interview-stage candidate preparing for recruiter, hiring manager, and loop conversations.
- Strategic applicant tracking compensation, market, and org signals before deciding where to invest effort.

### 3.2 Basic persona details

- **Focused applicant**: Applies selectively and wants evidence-backed reasons to prioritize or reject a company.
- **Interview prep power user**: Builds employer dossiers before every loop and wants reusable company and people context.
- **Opportunity tracker**: Monitors a smaller set of companies over time and wants a timeline of changes, signals, and notes.

### 3.3 Role-based access

- **Workspace member**: Can create, edit, run, and delete investigator dossiers and related artifacts within the active workspace.
- **Workspace admin**: Can manage workspace-level defaults, retention settings, and future shared taxonomy or templates.
- **System**: Can run semi-automated research workflows, generate synthesis, and persist source-linked outputs only within the active tenant or workspace boundary.

## 4. Functional requirements

- **Company dossiers** (Priority: High)

  - Users can create a dossier from a company name, a saved job, or a manual URL.
  - A dossier is company-centric and can be linked to multiple jobs.
  - Each dossier stores canonical company identity fields such as company name, normalized company URL, status, tags, and last researched timestamp.
  - Dossiers must remain editable by the user after AI generation.

- **Research runs and tracked timeline** (Priority: High)

  - Users can launch a semi-automated research run for a dossier.
  - Each run records when it started, when it finished, what workflow was used, and whether it succeeded, partially succeeded, or failed.
  - Runs persist their source artifacts, generated outputs, and review status.
  - The dossier timeline shows run history, manual edits, saved observations, and important signal changes.

- **People and employee research** (Priority: High)

  - Users can store structured people records tied to a company dossier.
  - Supported person types in v1 include recruiter, hiring manager, interviewer, executive, founder, and employee.
  - Each person record supports role, profile links, evidence notes, relationship to the company, and user-authored preparation notes.
  - AI-generated people summaries must include source references and an editable confidence or completeness indicator.

- **AI-generated synthesis** (Priority: High)

  - JobOps generates a company brief from the saved evidence, including summary, market position, notable risks, strengths, and suggested questions to ask.
  - JobOps can generate people briefs and interview-prep angles from saved people records.
  - Generated content must be reviewable, editable, and regenerable without deleting source history.
  - Synthesis should clearly separate source-derived facts from model-generated hypotheses.

- **Source capture and evidence management** (Priority: High)

  - Every major insight must be traceable to one or more saved sources.
  - Source records include URL, title, source type, retrieval timestamp, snippet or extract, and optional user annotation.
  - Users can manually add sources, remove sources, and mark sources as low confidence or outdated.
  - JobOps should support browser-assisted collection in a review-gated flow rather than silent background ingestion.

- **Search and browsing automation** (Priority: High)

  - Users can start guided research from a company or job context using suggested search queries and supported browse flows.
  - JobOps should reuse or extend existing people-search patterns already exposed in the ready panel.
  - The workflow should help collect company, people, and market evidence without requiring the user to rebuild queries manually.
  - Automation must stop short of unsupervised continuous scraping in v1.

- **JobOps integration** (Priority: High)

  - Users can open an investigator dossier from a job where the employer is known.
  - Users can link one dossier to many jobs and see which jobs reference that company.
  - Users can promote important investigator insights into job notes or use them as context in future AI features.
  - Existing company metadata already stored on jobs should be used as seed context where available.

- **Search, filter, and status management** (Priority: Medium)

  - Users can browse dossiers by company, research status, last updated date, linked jobs, and tags.
  - Users can filter for companies needing refresh, companies with saved people records, or companies with recent salary intelligence.
  - Users can mark dossiers as active, watchlist, interviewing, archived, or declined.

- **Salary intelligence foundation** (Priority: Medium)

  - The model must allow salary observations and compensation signals even though salary intelligence is not the main v1 emphasis.
  - Users can store compensation observations with source, role scope, region, date, and confidence.
  - AI synthesis may surface compensation themes when supported by evidence.

- **Authentication, authorization, and isolation** (Priority: High)

  - All investigator data must be scoped to the active tenant or workspace by default.
  - Cross-workspace access is forbidden unless a future feature explicitly introduces controlled sharing.
  - API routes, background jobs, caches, files, and saved source artifacts must all enforce tenant scoping.
  - Logs and API responses must follow existing request ID, sanitization, and structured error contracts.

## 5. User experience

### 5.1 Entry points & first-time user flow

- User opens a saved job and chooses to research the employer.
- User creates a new company dossier from the employer field or from a manual company name.
- JobOps seeds the dossier with known company metadata from the job record when available.
- User selects a research mode such as company brief, people scan, or broad dossier refresh.
- JobOps runs a guided research flow, presents sources and generated synthesis, and asks the user to save or revise the result.

### 5.2 Core experience

- **Create dossier**: User creates a company dossier from a job or manual input.

  - This gives the user a persistent company home instead of scattering insights across notes.

- **Run research**: User launches a semi-automated research task for company or people intelligence.

  - This reduces repetitive searching while keeping the user in control of what gets saved.

- **Review evidence**: User inspects sources, extracted snippets, and generated summaries before saving.

  - This improves trust and makes the AI output auditable.

- **Capture actions**: User saves red flags, interview questions, people notes, and priority signals.

  - This turns research into decisions and preparation steps.

- **Reuse across jobs**: User links the same dossier to multiple roles at the company.

  - This compounds research value and avoids duplicate work.

### 5.3 Advanced features & edge cases

- Users can manually create or correct a dossier when automatic company identity is ambiguous.
- Users can add people records even when no public profile or reliable source is available.
- Users can save partial research runs when some sources fail or rate-limit.
- Users can mark AI claims as unverified and keep them out of final summaries.
- Users can archive a dossier without losing historical runs or links to old jobs.
- Users can revisit a dossier months later and compare new findings against prior runs.

### 5.4 UI/UX highlights

- A company dossier page that feels closer to a tracked case file than a plain note list.
- A clear evidence-to-summary flow so sources, snippets, and synthesis remain visually connected.
- Timeline visualization for research runs, manual edits, and notable company changes.
- Embedded people cards with role, relevance, and preparation notes.
- Clear badges for stale, draft, reviewed, and needs-refresh states.

## 6. Narrative

The user discovers a promising employer through JobOps, opens the company dossier, and starts a guided investigation instead of leaving the product to open a dozen tabs. Over time the dossier becomes a living record of company context, people, signals, and interview preparation, with every important conclusion backed by saved evidence. By the time the user applies or interviews, JobOps has shifted from a job tracker into a reusable intelligence system that compounds effort across the full search lifecycle.

## 7. Success metrics

### 7.1 User-centric metrics

- Percentage of dossiers revisited after initial creation within 14 days.
- Average number of jobs linked to an existing dossier.
- Percentage of research runs that are saved after review.
- Percentage of dossiers containing at least one saved people record.
- User-reported trust score for AI summaries with source attribution.

### 7.2 Business metrics

- Increase in weekly active usage among users with at least one active application.
- Increase in median session depth for users who access investigator features.
- Increase in feature retention between first company research action and third follow-up session.
- Increase in downstream use of interview-prep or notes features from investigator surfaces.

### 7.3 Technical metrics

- Median time to complete a semi-automated research run.
- Percentage of research runs with complete source attribution.
- Percentage of investigator records correctly scoped to the active tenant.
- Error rate for research runs, source fetches, and dossier save operations.
- Percentage of generated summaries marked reviewed versus left as draft.

## 8. Technical considerations

### 8.1 Integration points

- Existing job records already store employer, company description, employee count, revenue, rating, review count, and salary metadata that can seed dossier creation.
- Existing job notes provide a nearby persistence and editing pattern that the investigator feature should extend rather than duplicate.
- Existing ready-panel Google search links for LinkedIn, GitHub, and web results are a natural launch point for guided people and company research.
- Existing multi-tenant server patterns, request ID handling, and structured API error contracts must apply to all new investigator routes and background work.
- Existing AI context systems such as notes and future Ghostwriter-style workflows should be able to consume investigator outputs later.

### 8.2 Data storage & privacy

- New investigator entities should be stored in tenant-scoped tables keyed by the active workspace or tenant.
- Expected v1 entities include company dossiers, research runs, source artifacts, people profiles, salary observations, summaries, and dossier-job links.
- Source storage should capture only the minimum required excerpts and metadata needed for user review and traceability.
- Sensitive fields and large payloads must be sanitized before logging or returning in API error details.
- Person research must remain limited to public professional context and user-authored notes.

### 8.3 Scalability & performance

- Research runs should be asynchronous and trackable so the UI can show progress and partial completion states.
- Source fetching and summarization should be chunked and rate-limit aware.
- Dossier pages should load quickly with summary-first rendering and progressive detail expansion for sources and timelines.
- Caches, queues, and dedupe keys must include tenant context to avoid cross-workspace contamination.

### 8.4 Potential challenges

- Company identity normalization will be difficult when one employer appears under multiple legal names or job-board variants.
- Public people data is noisy, so false matches and stale profiles are a real risk.
- Source terms of service and scraping boundaries must be respected, especially for browser-assisted collection.
- AI summaries can overstate weak evidence unless facts and hypotheses are clearly separated.
- The feature can become an unstructured dumping ground unless dossier states, source quality, and review flows are opinionated.

## 9. Milestones & sequencing

### 9.1 Project estimate

- Large: 6-8 weeks for a production-ready first release

### 9.2 Team size & composition

- 2-4 people: product-minded full-stack engineer, backend engineer, frontend engineer, and optional design or AI systems support

### 9.3 Suggested phases

- **Phase 1**: Foundation and dossier model (1-2 weeks)

  - Key deliverables: tenant-scoped schema, basic dossier CRUD, company normalization strategy, job-to-dossier linking, initial UI shell.

- **Phase 2**: Research runs and evidence capture (2 weeks)

  - Key deliverables: guided research workflow, source storage, run statuses, timeline model, browser-assisted review flow.

- **Phase 3**: People records and synthesis (1-2 weeks)

  - Key deliverables: people entities, AI company brief, people brief generation, review badges, editable summaries.

- **Phase 4**: Search, polish, and rollout hardening (1-2 weeks)

  - Key deliverables: dossier list and filters, stale-state handling, docs, metrics, privacy review, regression coverage.

## 10. User stories

### 10.1 Create a company dossier

- **ID**: INV-001
- **Description**: As a job seeker, I want to create a company dossier from a saved job or company name so that I can keep all employer research in one persistent place.
- **Acceptance criteria**:

  - User can create a dossier from a job with a known employer.
  - User can create a dossier manually by entering a company name and optional URL.
  - JobOps seeds the dossier with existing company metadata from linked jobs when available.
  - User can edit the company name, URL, and status after creation.

### 10.2 Link jobs to an existing dossier

- **ID**: INV-002
- **Description**: As a job seeker, I want multiple jobs from the same company to reuse one dossier so that I do not repeat the same research.
- **Acceptance criteria**:

  - User can link a saved job to an existing dossier.
  - A dossier shows all linked jobs.
  - A job can open its linked dossier from the job context.
  - Users are warned before creating duplicate dossiers for the same normalized company.

### 10.3 Start a semi-automated research run

- **ID**: INV-003
- **Description**: As a user, I want to launch a guided research run so that JobOps can gather and organize relevant company or people evidence for me.
- **Acceptance criteria**:

  - User can choose a research mode from company brief, people scan, or dossier refresh.
  - The run is saved with started, completed, failed, or partial status.
  - The UI shows progress and final output for the run.
  - The user can stop reviewing and still save partial results as draft.

### 10.4 Save and review sources

- **ID**: INV-004
- **Description**: As a user, I want every major insight tied to saved evidence so that I can trust and revisit the research later.
- **Acceptance criteria**:

  - Each saved source stores URL, title, type, timestamp, and captured excerpt.
  - Users can manually add a source and note without running automation.
  - Users can mark a source outdated, weak, or verified.
  - Generated summaries reference their supporting sources.

### 10.5 Research people connected to a company

- **ID**: INV-005
- **Description**: As a user, I want to save structured people records for recruiters, interviewers, leaders, and employees so that I can prepare for conversations and understand the company better.
- **Acceptance criteria**:

  - User can create or edit a people record within a dossier.
  - Person type can be selected from recruiter, hiring manager, interviewer, executive, founder, or employee.
  - Each record can store profile links, notes, and source-backed role context.
  - AI-generated people summaries remain editable and clearly attributed.

### 10.6 Generate an AI company brief

- **ID**: INV-006
- **Description**: As a user, I want JobOps to synthesize saved research into a concise brief so that I can quickly understand the company before applying or interviewing.
- **Acceptance criteria**:

  - The brief includes company summary, notable strengths, risks, and suggested questions.
  - The brief distinguishes source-grounded facts from inferred hypotheses.
  - User can edit the generated brief and save the revised version.
  - User can regenerate the brief without deleting prior source records.

### 10.7 Track research history over time

- **ID**: INV-007
- **Description**: As a user, I want a timeline of runs and updates so that I can see what changed and whether a dossier needs refresh.
- **Acceptance criteria**:

  - Dossier shows a chronological history of research runs, edits, and notable saved observations.
  - User can filter timeline items by run type, people changes, or manual edits.
  - Dossier displays last researched and stale indicators.
  - Historical entries persist after the dossier is archived.

### 10.8 Capture compensation signals

- **ID**: INV-008
- **Description**: As a user, I want to save compensation observations for a company so that I can compare salary expectations across roles and regions.
- **Acceptance criteria**:

  - User can add a salary or compensation observation manually.
  - An observation records source, role scope, region, date, and confidence.
  - Salary observations are visible in the dossier and available to AI synthesis.
  - Missing or low-confidence salary data can be saved without blocking the rest of the dossier.

### 10.9 Search and manage dossiers

- **ID**: INV-009
- **Description**: As a user, I want to search and filter company dossiers so that I can focus on active targets and stale research.
- **Acceptance criteria**:

  - User can search dossiers by company name.
  - User can filter by status, last updated, linked jobs, and people-record presence.
  - User can archive and unarchive dossiers.
  - Archived dossiers remain accessible in history views.

### 10.10 Promote insights into application preparation

- **ID**: INV-010
- **Description**: As a user, I want to reuse dossier insights in job preparation workflows so that research becomes actionable instead of static.
- **Acceptance criteria**:

  - User can copy or promote a saved insight into job notes.
  - Dossier content can be referenced from a linked job context.
  - Suggested interview questions are visible from the dossier.
  - The feature does not overwrite existing job notes without explicit user action.

### 10.11 Correct ambiguous company identity

- **ID**: INV-011
- **Description**: As a user, I want to correct company identity mismatches so that research is attached to the right employer.
- **Acceptance criteria**:

  - User can change the canonical company name or URL when JobOps guessed incorrectly.
  - JobOps warns before merging two dossiers.
  - Linked jobs remain visible after a correction.
  - The correction is recorded in dossier history.

### 10.12 Handle incomplete or failed research runs

- **ID**: INV-012
- **Description**: As a user, I want partial results to remain useful when a source fails so that I do not lose all progress from a research session.
- **Acceptance criteria**:

  - Failed sources are shown distinctly from successful sources.
  - A partially completed run can still be saved as draft.
  - The user can rerun the failed portion later.
  - Error messaging does not expose raw sensitive payloads.

### 10.13 Enforce tenant-scoped access

- **ID**: INV-013
- **Description**: As a workspace user, I want investigator data isolated to my workspace so that company and people research does not leak across tenants.
- **Acceptance criteria**:

  - Every investigator API route enforces active tenant or workspace scoping.
  - Background jobs, caches, and stored artifacts use tenant-aware keys.
  - Unauthorized cross-tenant access returns the existing structured error contract.
  - Logs include request ID and relevant context without leaking sensitive details.

### 10.14 Respect public-data and review boundaries

- **ID**: INV-014
- **Description**: As a user, I want people research to stay within public professional context and remain review-gated so that the feature is useful without becoming invasive.
- **Acceptance criteria**:

  - The product only stores public professional context and user-authored notes in v1.
  - AI-generated people summaries cannot be saved without review.
  - The UI avoids encouraging personal or non-professional data collection.
  - Documentation and UX copy clearly define the intended boundaries of the feature.