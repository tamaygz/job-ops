/**
 * Database schema using Drizzle ORM with SQLite.
 */

import {
  APPLICATION_OUTCOMES,
  APPLICATION_STAGES,
  APPLICATION_TASK_TYPES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_TYPES,
  JOB_CHAT_MESSAGE_ROLES,
  JOB_CHAT_MESSAGE_STATUSES,
  JOB_CHAT_RUN_STATUSES,
  POST_APPLICATION_INTEGRATION_STATUSES,
  POST_APPLICATION_MESSAGE_TYPES,
  POST_APPLICATION_PROCESSING_STATUSES,
  POST_APPLICATION_PROVIDERS,
  POST_APPLICATION_RELEVANCE_DECISIONS,
  POST_APPLICATION_SYNC_RUN_STATUSES,
} from "@shared/types";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    isSystemAdmin: integer("is_system_admin", { mode: "boolean" })
      .notNull()
      .default(false),
    isDisabled: integer("is_disabled", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    usernameUnique: uniqueIndex("idx_users_username_unique").on(table.username),
  }),
);

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const tenantMemberships = sqliteTable(
  "tenant_memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("owner"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    userTenantUnique: uniqueIndex("idx_tenant_memberships_user_tenant").on(
      table.userId,
      table.tenantId,
    ),
    tenantIndex: index("idx_tenant_memberships_tenant_id").on(table.tenantId),
  }),
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),

    // From crawler
    source: text("source").notNull().default("gradcracker"),
    sourceJobId: text("source_job_id"),
    jobUrlDirect: text("job_url_direct"),
    datePosted: text("date_posted"),
    title: text("title").notNull(),
    employer: text("employer").notNull(),
    employerUrl: text("employer_url"),
    jobUrl: text("job_url").notNull(),
    applicationLink: text("application_link"),
    disciplines: text("disciplines"),
    deadline: text("deadline"),
    salary: text("salary"),
    location: text("location"),
    locationEvidence: text("location_evidence"),
    degreeRequired: text("degree_required"),
    starting: text("starting"),
    jobDescription: text("job_description"),

    // JobSpy fields (nullable for other sources)
    jobType: text("job_type"),
    salarySource: text("salary_source"),
    salaryInterval: text("salary_interval"),
    salaryMinAmount: real("salary_min_amount"),
    salaryMaxAmount: real("salary_max_amount"),
    salaryCurrency: text("salary_currency"),
    isRemote: integer("is_remote", { mode: "boolean" }),
    jobLevel: text("job_level"),
    jobFunction: text("job_function"),
    listingType: text("listing_type"),
    emails: text("emails"),
    companyIndustry: text("company_industry"),
    companyLogo: text("company_logo"),
    companyUrlDirect: text("company_url_direct"),
    companyAddresses: text("company_addresses"),
    companyNumEmployees: text("company_num_employees"),
    companyRevenue: text("company_revenue"),
    companyDescription: text("company_description"),
    skills: text("skills"),
    experienceRange: text("experience_range"),
    companyRating: real("company_rating"),
    companyReviewsCount: integer("company_reviews_count"),
    vacancyCount: integer("vacancy_count"),
    workFromHomeType: text("work_from_home_type"),

    // Orchestrator enrichments
    status: text("status", {
      enum: [
        "discovered",
        "processing",
        "ready",
        "applied",
        "in_progress",
        "skipped",
        "expired",
      ],
    })
      .notNull()
      .default("discovered"),
    outcome: text("outcome", { enum: APPLICATION_OUTCOMES }),
    closedAt: integer("closed_at", { mode: "number" }),
    suitabilityScore: real("suitability_score"),
    suitabilityReason: text("suitability_reason"),
    jobBrief: text("job_brief"),
    tailoredSummary: text("tailored_summary"),
    tailoredHeadline: text("tailored_headline"),
    tailoredSkills: text("tailored_skills"),
    selectedProjectIds: text("selected_project_ids"),
    pdfPath: text("pdf_path"),
    pdfSource: text("pdf_source", { enum: ["generated", "uploaded"] }),
    pdfRegenerating: integer("pdf_regenerating", { mode: "boolean" })
      .notNull()
      .default(false),
    pdfFingerprint: text("pdf_fingerprint"),
    pdfGeneratedAt: text("pdf_generated_at"),
    tracerLinksEnabled: integer("tracer_links_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    sponsorMatchScore: real("sponsor_match_score"),
    sponsorMatchNames: text("sponsor_match_names"),

    // Timestamps
    discoveredAt: text("discovered_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    processedAt: text("processed_at"),
    readyAt: text("ready_at"),
    appliedAt: text("applied_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantJobUrlUnique: uniqueIndex("idx_jobs_tenant_job_url_unique").on(
      table.tenantId,
      table.jobUrl,
    ),
    tenantStatusIndex: index("idx_jobs_tenant_status").on(
      table.tenantId,
      table.status,
    ),
    tenantDiscoveredAtIndex: index("idx_jobs_tenant_discovered_at").on(
      table.tenantId,
      table.discoveredAt,
    ),
  }),
);

export const stageEvents = sqliteTable("stage_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .default("tenant_default")
    .references(() => tenants.id, { onDelete: "cascade" }),
  applicationId: text("application_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  groupId: text("group_id"),
  fromStage: text("from_stage", { enum: APPLICATION_STAGES }),
  toStage: text("to_stage", { enum: APPLICATION_STAGES }).notNull(),
  occurredAt: integer("occurred_at", { mode: "number" }).notNull(),
  metadata: text("metadata", { mode: "json" }),
  outcome: text("outcome", { enum: APPLICATION_OUTCOMES }),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .default("tenant_default")
    .references(() => tenants.id, { onDelete: "cascade" }),
  applicationId: text("application_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  type: text("type", { enum: APPLICATION_TASK_TYPES }).notNull(),
  title: text("title").notNull(),
  dueDate: integer("due_date", { mode: "number" }),
  isCompleted: integer("is_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  notes: text("notes"),
});

export const jobNotes = sqliteTable(
  "job_notes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    jobUpdatedIndex: index("idx_job_notes_job_updated").on(
      table.jobId,
      table.updatedAt,
    ),
  }),
);

export const interviews = sqliteTable("interviews", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .default("tenant_default")
    .references(() => tenants.id, { onDelete: "cascade" }),
  applicationId: text("application_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  scheduledAt: integer("scheduled_at", { mode: "number" }).notNull(),
  durationMins: integer("duration_mins"),
  type: text("type", { enum: INTERVIEW_TYPES }).notNull(),
  outcome: text("outcome", { enum: INTERVIEW_OUTCOMES }),
});

export const pipelineRuns = sqliteTable("pipeline_runs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .default("tenant_default")
    .references(() => tenants.id, { onDelete: "cascade" }),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
  status: text("status", {
    enum: ["running", "completed", "failed", "cancelled"],
  })
    .notNull()
    .default("running"),
  jobsDiscovered: integer("jobs_discovered").notNull().default(0),
  jobsProcessed: integer("jobs_processed").notNull().default(0),
  errorMessage: text("error_message"),
  configSnapshot: text("config_snapshot"),
  requestedConfig: text("requested_config", { mode: "json" }),
  effectiveConfig: text("effective_config", { mode: "json" }),
  resultSummary: text("result_summary", { mode: "json" }),
});

export const jobChatThreads = sqliteTable(
  "job_chat_threads",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
    lastMessageAt: text("last_message_at"),
    activeRootMessageId: text("active_root_message_id"),
    selectedNoteIds: text("selected_note_ids").notNull().default("[]"),
    selectedEmailIds: text("selected_email_ids").notNull().default("[]"),
    selectedDocumentIds: text("selected_document_ids").notNull().default("[]"),
  },
  (table) => ({
    jobUpdatedIndex: index("idx_job_chat_threads_job_updated").on(
      table.jobId,
      table.updatedAt,
    ),
  }),
);

export const jobChatMessages = sqliteTable(
  "job_chat_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    threadId: text("thread_id")
      .notNull()
      .references(() => jobChatThreads.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    role: text("role", { enum: JOB_CHAT_MESSAGE_ROLES }).notNull(),
    content: text("content").notNull().default(""),
    status: text("status", { enum: JOB_CHAT_MESSAGE_STATUSES })
      .notNull()
      .default("partial"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    version: integer("version").notNull().default(1),
    replacesMessageId: text("replaces_message_id"),
    parentMessageId: text("parent_message_id"),
    activeChildId: text("active_child_id"),
    attachments: text("attachments").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    threadCreatedIndex: index("idx_job_chat_messages_thread_created").on(
      table.threadId,
      table.createdAt,
    ),
  }),
);

export const jobChatRuns = sqliteTable(
  "job_chat_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    threadId: text("thread_id")
      .notNull()
      .references(() => jobChatThreads.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: text("status", { enum: JOB_CHAT_RUN_STATUSES })
      .notNull()
      .default("running"),
    model: text("model"),
    provider: text("provider"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: integer("started_at", { mode: "number" }).notNull(),
    completedAt: integer("completed_at", { mode: "number" }),
    requestId: text("request_id"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    threadStatusIndex: index("idx_job_chat_runs_thread_status").on(
      table.threadId,
      table.status,
    ),
  }),
);

export const settings = sqliteTable(
  "settings",
  {
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantKeyUnique: uniqueIndex("idx_settings_tenant_key_unique").on(
      table.tenantId,
      table.key,
    ),
  }),
);

export const watchlistJobStates = sqliteTable(
  "watchlist_job_states",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    source: text("source").notNull(),
    sourceJobId: text("source_job_id").notNull(),
    state: text("state", { enum: ["ignored", "moved_to_workspace"] })
      .notNull()
      .default("ignored"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserSourceJobUnique: uniqueIndex(
      "idx_watchlist_job_states_tenant_user_source_job_unique",
    ).on(table.tenantId, table.userId, table.source, table.sourceJobId),
    tenantUserStateIndex: index(
      "idx_watchlist_job_states_tenant_user_state",
    ).on(table.tenantId, table.userId, table.state),
  }),
);

export const watchlistChecks = sqliteTable(
  "watchlist_checks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    lastCheckedAt: text("last_checked_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserUnique: uniqueIndex("idx_watchlist_checks_tenant_user_unique").on(
      table.tenantId,
      table.userId,
    ),
  }),
);

export const watchlistSeenJobs = sqliteTable(
  "watchlist_seen_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    source: text("source").notNull(),
    sourceJobId: text("source_job_id").notNull(),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserSourceJobUnique: uniqueIndex(
      "idx_watchlist_seen_jobs_tenant_user_source_job_unique",
    ).on(table.tenantId, table.userId, table.source, table.sourceJobId),
    tenantUserLastSeenIndex: index(
      "idx_watchlist_seen_jobs_tenant_user_last_seen",
    ).on(table.tenantId, table.userId, table.lastSeenAt),
  }),
);

export const watchlistSelectedSources = sqliteTable(
  "watchlist_selected_sources",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    catalogSourceId: text("catalog_source_id"),
    label: text("label").notNull(),
    careersUrl: text("careers_url").notNull(),
    cxsJobsUrl: text("cxs_jobs_url"),
    sourceType: text("source_type").notNull(),
    isCustom: integer("is_custom", { mode: "boolean" })
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantUserSortOrderUnique: uniqueIndex(
      "idx_watchlist_selected_sources_tenant_user_sort_order",
    ).on(table.tenantId, table.userId, table.sortOrder),
    tenantUserCareersUrlUnique: uniqueIndex(
      "idx_watchlist_selected_sources_tenant_user_careers_url",
    ).on(table.tenantId, table.userId, table.careersUrl),
    tenantUserIndex: index("idx_watchlist_selected_sources_tenant_user").on(
      table.tenantId,
      table.userId,
    ),
  }),
);

export const analyticsInstallState = sqliteTable("analytics_install_state", {
  id: text("id").primaryKey(),
  distinctId: text("distinct_id").notNull(),
  installedAt: text("installed_at").notNull(),
  rawEventReplayVersion: integer("raw_event_replay_version")
    .notNull()
    .default(0),
  rawEventReplayCompletedAt: text("raw_event_replay_completed_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const analyticsMilestones = sqliteTable(
  "analytics_milestones",
  {
    milestone: text("milestone").primaryKey(),
    firstSeenAt: integer("first_seen_at", { mode: "number" }).notNull(),
    firstSessionId: text("first_session_id"),
    reportedAt: text("reported_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    firstSeenAtIndex: index("idx_analytics_milestones_first_seen_at").on(
      table.firstSeenAt,
    ),
  }),
);

export const analyticsServerEventReplays = sqliteTable(
  "analytics_server_event_replays",
  {
    eventKey: text("event_key").primaryKey(),
    eventName: text("event_name").notNull(),
    occurredAt: integer("occurred_at", { mode: "number" }).notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    claimedAt: integer("claimed_at", { mode: "number" }),
    reportedAt: integer("reported_at", { mode: "number" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    eventNameIndex: index("idx_analytics_server_event_replays_event_name").on(
      table.eventName,
    ),
    occurredAtIndex: index("idx_analytics_server_event_replays_occurred_at").on(
      table.occurredAt,
    ),
  }),
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    subject: text("subject").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "number" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    expiresAtIndex: index("idx_auth_sessions_expires_at").on(table.expiresAt),
    revokedAtIndex: index("idx_auth_sessions_revoked_at").on(table.revokedAt),
  }),
);

export const designResumeDocuments = sqliteTable("design_resume_documents", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .default("tenant_default")
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  resumeJson: text("resume_json", { mode: "json" }).notNull(),
  revision: integer("revision").notNull().default(1),
  sourceResumeId: text("source_resume_id"),
  sourceMode: text("source_mode"),
  importedAt: text("imported_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const designResumeAssets = sqliteTable(
  "design_resume_assets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => designResumeDocuments.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["picture"] })
      .notNull()
      .default("picture"),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    storagePath: text("storage_path").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    documentIndex: index("idx_design_resume_assets_document_id").on(
      table.documentId,
    ),
  }),
);

export const jobDocuments = sqliteTable(
  "job_documents",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mediaType: text("media_type"),
    byteSize: integer("byte_size").notNull(),
    storagePath: text("storage_path").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    jobIndex: index("idx_job_documents_job_id").on(table.jobId),
    tenantJobIndex: index("idx_job_documents_tenant_job_id").on(
      table.tenantId,
      table.jobId,
    ),
  }),
);

export const postApplicationIntegrations = sqliteTable(
  "post_application_integrations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: POST_APPLICATION_PROVIDERS }).notNull(),
    accountKey: text("account_key").notNull().default("default"),
    displayName: text("display_name"),
    status: text("status", { enum: POST_APPLICATION_INTEGRATION_STATUSES })
      .notNull()
      .default("disconnected"),
    credentials: text("credentials", { mode: "json" }),
    lastConnectedAt: integer("last_connected_at", { mode: "number" }),
    lastSyncedAt: integer("last_synced_at", { mode: "number" }),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    providerAccountUnique: uniqueIndex(
      "idx_post_app_integrations_tenant_provider_account_unique",
    ).on(table.tenantId, table.provider, table.accountKey),
  }),
);

export const postApplicationSyncRuns = sqliteTable(
  "post_application_sync_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: POST_APPLICATION_PROVIDERS }).notNull(),
    accountKey: text("account_key").notNull().default("default"),
    integrationId: text("integration_id").references(
      () => postApplicationIntegrations.id,
      { onDelete: "set null" },
    ),
    status: text("status", { enum: POST_APPLICATION_SYNC_RUN_STATUSES })
      .notNull()
      .default("running"),
    startedAt: integer("started_at", { mode: "number" }).notNull(),
    completedAt: integer("completed_at", { mode: "number" }),
    messagesDiscovered: integer("messages_discovered").notNull().default(0),
    messagesRelevant: integer("messages_relevant").notNull().default(0),
    messagesClassified: integer("messages_classified").notNull().default(0),
    messagesMatched: integer("messages_matched").notNull().default(0),
    messagesApproved: integer("messages_approved").notNull().default(0),
    messagesDenied: integer("messages_denied").notNull().default(0),
    messagesErrored: integer("messages_errored").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    providerAccountStartedAtIndex: index(
      "idx_post_app_sync_runs_provider_account_started_at",
    ).on(table.provider, table.accountKey, table.startedAt),
  }),
);

export const postApplicationMessages = sqliteTable(
  "post_application_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: POST_APPLICATION_PROVIDERS }).notNull(),
    accountKey: text("account_key").notNull().default("default"),
    integrationId: text("integration_id").references(
      () => postApplicationIntegrations.id,
      { onDelete: "set null" },
    ),
    syncRunId: text("sync_run_id").references(
      () => postApplicationSyncRuns.id,
      {
        onDelete: "set null",
      },
    ),
    externalMessageId: text("external_message_id").notNull(),
    externalThreadId: text("external_thread_id"),
    fromAddress: text("from_address").notNull().default(""),
    fromDomain: text("from_domain"),
    senderName: text("sender_name"),
    subject: text("subject").notNull().default(""),
    receivedAt: integer("received_at", { mode: "number" }).notNull(),
    snippet: text("snippet").notNull().default(""),
    classificationLabel: text("classification_label"),
    classificationConfidence: real("classification_confidence"),
    classificationPayload: text("classification_payload", { mode: "json" }),
    relevanceLlmScore: real("relevance_llm_score"),
    relevanceDecision: text("relevance_decision", {
      enum: POST_APPLICATION_RELEVANCE_DECISIONS,
    })
      .notNull()
      .default("needs_llm"),
    matchConfidence: integer("match_confidence"),
    messageType: text("message_type", {
      enum: POST_APPLICATION_MESSAGE_TYPES,
    })
      .notNull()
      .default("other"),
    stageEventPayload: text("stage_event_payload", { mode: "json" }),
    processingStatus: text("processing_status", {
      enum: POST_APPLICATION_PROCESSING_STATUSES,
    })
      .notNull()
      .default("pending_user"),
    matchedJobId: text("matched_job_id").references(() => jobs.id, {
      onDelete: "set null",
    }),
    decidedAt: integer("decided_at", { mode: "number" }),
    decidedBy: text("decided_by"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    providerAccountExternalMessageUnique: uniqueIndex(
      "idx_post_app_messages_tenant_provider_account_external_unique",
    ).on(
      table.tenantId,
      table.provider,
      table.accountKey,
      table.externalMessageId,
    ),
    providerAccountReviewStatusIndex: index(
      "idx_post_app_messages_provider_account_processing_status",
    ).on(table.provider, table.accountKey, table.processingStatus),
  }),
);

export const tracerLinks = sqliteTable(
  "tracer_links",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    sourcePath: text("source_path").notNull(),
    sourceLabel: text("source_label").notNull(),
    destinationUrl: text("destination_url").notNull(),
    destinationUrlHash: text("destination_url_hash").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    jobPathDestinationUnique: uniqueIndex(
      "idx_tracer_links_tenant_job_source_destination_unique",
    ).on(
      table.tenantId,
      table.jobId,
      table.sourcePath,
      table.destinationUrlHash,
    ),
    jobIndex: index("idx_tracer_links_job_id").on(table.jobId),
  }),
);

export const tracerClickEvents = sqliteTable(
  "tracer_click_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    tracerLinkId: text("tracer_link_id")
      .notNull()
      .references(() => tracerLinks.id, { onDelete: "cascade" }),
    clickedAt: integer("clicked_at", { mode: "number" }).notNull(),
    requestId: text("request_id"),
    isLikelyBot: integer("is_likely_bot", { mode: "boolean" })
      .notNull()
      .default(false),
    deviceType: text("device_type").notNull().default("unknown"),
    uaFamily: text("ua_family").notNull().default("unknown"),
    osFamily: text("os_family").notNull().default("unknown"),
    referrerHost: text("referrer_host"),
    ipHash: text("ip_hash"),
    uniqueFingerprintHash: text("unique_fingerprint_hash"),
  },
  (table) => ({
    tracerLinkIndex: index("idx_tracer_click_events_tracer_link_id").on(
      table.tracerLinkId,
    ),
    clickedAtIndex: index("idx_tracer_click_events_clicked_at").on(
      table.clickedAt,
    ),
    botIndex: index("idx_tracer_click_events_is_likely_bot").on(
      table.isLikelyBot,
    ),
    uniqueFingerprintIndex: index(
      "idx_tracer_click_events_unique_fingerprint_hash",
    ).on(table.uniqueFingerprintHash),
  }),
);

// ---------------------------------------------------------------------------
// Investigator tables
// ---------------------------------------------------------------------------

export const investigatorDossiers = sqliteTable(
  "investigator_dossiers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    canonicalCompanyKey: text("canonical_company_key").notNull(),
    companyUrl: text("company_url"),
    normalizedDomain: text("normalized_domain"),
    status: text("status", {
      enum: ["active", "watchlist", "interviewing", "archived", "declined"],
    })
      .notNull()
      .default("active"),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    lastResearchedAt: integer("last_researched_at", { mode: "number" }),
    archivedAt: text("archived_at"),
    createdFromJobId: text("created_from_job_id"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantCanonicalKeyUnique: uniqueIndex(
      "idx_investigator_dossiers_tenant_canonical_key_unique",
    ).on(table.tenantId, table.canonicalCompanyKey),
    tenantStatusIndex: index("idx_investigator_dossiers_tenant_status").on(
      table.tenantId,
      table.status,
    ),
  }),
);

export const investigatorDossierJobs = sqliteTable(
  "investigator_dossier_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    dossierId: text("dossier_id").notNull(),
    jobId: text("job_id").notNull(),
    linkReason: text("link_reason", {
      enum: ["seeded", "manual", "suggested"],
    }).notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    tenantDossierJobUnique: uniqueIndex(
      "idx_investigator_dossier_jobs_tenant_dossier_job_unique",
    ).on(table.tenantId, table.dossierId, table.jobId),
    dossierIndex: index("idx_investigator_dossier_jobs_dossier_id").on(
      table.dossierId,
    ),
  }),
);

export const investigatorResearchRuns = sqliteTable(
  "investigator_research_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    dossierId: text("dossier_id").notNull(),
    runKind: text("run_kind", {
      enum: ["company_brief", "people_scan", "dossier_refresh"],
    }).notNull(),
    status: text("status", {
      enum: [
        "queued",
        "running",
        "completed",
        "partial_failed",
        "failed",
        "cancelled",
      ],
    })
      .notNull()
      .default("queued"),
    initiatedBy: text("initiated_by", { enum: ["user", "system"] })
      .notNull()
      .default("user"),
    seedContext: text("seed_context", { mode: "json" }),
    startedAt: integer("started_at", { mode: "number" }),
    completedAt: integer("completed_at", { mode: "number" }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    dossierStatusIndex: index(
      "idx_investigator_research_runs_dossier_status",
    ).on(table.dossierId, table.status),
    tenantStatusIndex: index("idx_investigator_research_runs_tenant_status").on(
      table.tenantId,
      table.status,
    ),
  }),
);

export const investigatorSources = sqliteTable(
  "investigator_sources",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    dossierId: text("dossier_id").notNull(),
    runId: text("run_id"),
    sourceType: text("source_type", {
      enum: [
        "company_site",
        "news_article",
        "public_profile",
        "github_profile",
        "review_site",
        "salary_site",
        "job_metadata",
        "manual_note",
        "other_web_page",
      ],
    }).notNull(),
    title: text("title").notNull(),
    url: text("url"),
    sourceHost: text("source_host"),
    capturedExcerpt: text("captured_excerpt").notNull(),
    retrievedAt: integer("retrieved_at", { mode: "number" }).notNull(),
    reviewState: text("review_state", {
      enum: [
        "unreviewed",
        "verified",
        "low_confidence",
        "outdated",
        "rejected",
      ],
    })
      .notNull()
      .default("unreviewed"),
    reviewerNote: text("reviewer_note"),
    contentHash: text("content_hash"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    dossierIndex: index("idx_investigator_sources_dossier_id").on(
      table.dossierId,
    ),
    dossierReviewStateIndex: index(
      "idx_investigator_sources_dossier_review_state",
    ).on(table.dossierId, table.reviewState),
  }),
);

export const investigatorPeople = sqliteTable(
  "investigator_people",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    dossierId: text("dossier_id").notNull(),
    runId: text("run_id"),
    fullName: text("full_name").notNull(),
    personType: text("person_type", {
      enum: [
        "recruiter",
        "hiring_manager",
        "interviewer",
        "executive",
        "founder",
        "employee",
      ],
    }).notNull(),
    title: text("title"),
    profileUrl: text("profile_url"),
    roleContext: text("role_context"),
    notes: text("notes"),
    confidenceLabel: text("confidence_label", {
      enum: ["high", "medium", "low", "unknown"],
    }).notNull(),
    sourceIds: text("source_ids", { mode: "json" }).$type<string[]>(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    dossierIndex: index("idx_investigator_people_dossier_id").on(
      table.dossierId,
    ),
    dossierPersonTypeIndex: index(
      "idx_investigator_people_dossier_person_type",
    ).on(table.dossierId, table.personType),
  }),
);

export const investigatorSalaryObservations = sqliteTable(
  "investigator_salary_observations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    dossierId: text("dossier_id").notNull(),
    runId: text("run_id"),
    roleScope: text("role_scope"),
    geoScope: text("geo_scope"),
    currency: text("currency"),
    payInterval: text("pay_interval", {
      enum: ["annual", "monthly", "hourly", "unknown"],
    }),
    minAmount: real("min_amount"),
    maxAmount: real("max_amount"),
    equityText: text("equity_text"),
    bonusText: text("bonus_text"),
    confidenceLabel: text("confidence_label", {
      enum: ["high", "medium", "low", "unknown"],
    }).notNull(),
    sourceId: text("source_id"),
    observedAt: integer("observed_at", { mode: "number" }),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    dossierIndex: index("idx_investigator_salary_observations_dossier_id").on(
      table.dossierId,
    ),
  }),
);

export const investigatorSummaries = sqliteTable(
  "investigator_summaries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    dossierId: text("dossier_id").notNull(),
    runId: text("run_id"),
    summaryType: text("summary_type", {
      enum: ["company_brief", "people_brief", "interview_angles"],
    }).notNull(),
    title: text("title").notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    factsJson: text("facts_json", { mode: "json" }).notNull(),
    hypothesesJson: text("hypotheses_json", { mode: "json" }).notNull(),
    reviewState: text("review_state", {
      enum: ["draft", "reviewed"],
    })
      .notNull()
      .default("draft"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    dossierSummaryTypeIndex: index(
      "idx_investigator_summaries_dossier_summary_type",
    ).on(table.dossierId, table.summaryType),
  }),
);

export const investigatorTimelineEvents = sqliteTable(
  "investigator_timeline_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .default("tenant_default")
      .references(() => tenants.id, { onDelete: "cascade" }),
    dossierId: text("dossier_id").notNull(),
    runId: text("run_id"),
    eventType: text("event_type", {
      enum: [
        "dossier_created",
        "job_linked",
        "run_started",
        "run_completed",
        "run_partial_failed",
        "run_failed",
        "source_saved",
        "source_reviewed",
        "person_saved",
        "salary_saved",
        "summary_saved",
        "status_changed",
        "dossier_merged",
        "url_fetched",
        "search_queried",
      ],
    }).notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    occurredAt: integer("occurred_at", { mode: "number" }).notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    dossierOccurredAtIndex: index(
      "idx_investigator_timeline_events_dossier_occurred_at",
    ).on(table.dossierId, table.occurredAt),
    dossierEventTypeIndex: index(
      "idx_investigator_timeline_events_dossier_event_type",
    ).on(table.dossierId, table.eventType),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type TenantRow = typeof tenants.$inferSelect;
export type NewTenantRow = typeof tenants.$inferInsert;
export type TenantMembershipRow = typeof tenantMemberships.$inferSelect;
export type NewTenantMembershipRow = typeof tenantMemberships.$inferInsert;
export type JobRow = typeof jobs.$inferSelect;
export type NewJobRow = typeof jobs.$inferInsert;
export type StageEventRow = typeof stageEvents.$inferSelect;
export type NewStageEventRow = typeof stageEvents.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
export type JobNoteRow = typeof jobNotes.$inferSelect;
export type NewJobNoteRow = typeof jobNotes.$inferInsert;
export type JobDocumentRow = typeof jobDocuments.$inferSelect;
export type NewJobDocumentRow = typeof jobDocuments.$inferInsert;
export type InterviewRow = typeof interviews.$inferSelect;
export type NewInterviewRow = typeof interviews.$inferInsert;
export type PipelineRunRow = typeof pipelineRuns.$inferSelect;
export type NewPipelineRunRow = typeof pipelineRuns.$inferInsert;
export type JobChatThreadRow = typeof jobChatThreads.$inferSelect;
export type NewJobChatThreadRow = typeof jobChatThreads.$inferInsert;
export type JobChatMessageRow = typeof jobChatMessages.$inferSelect;
export type NewJobChatMessageRow = typeof jobChatMessages.$inferInsert;
export type JobChatRunRow = typeof jobChatRuns.$inferSelect;
export type NewJobChatRunRow = typeof jobChatRuns.$inferInsert;
export type SettingsRow = typeof settings.$inferSelect;
export type NewSettingsRow = typeof settings.$inferInsert;
export type AnalyticsInstallStateRow =
  typeof analyticsInstallState.$inferSelect;
export type NewAnalyticsInstallStateRow =
  typeof analyticsInstallState.$inferInsert;
export type AnalyticsMilestoneRow = typeof analyticsMilestones.$inferSelect;
export type NewAnalyticsMilestoneRow = typeof analyticsMilestones.$inferInsert;
export type AnalyticsServerEventReplayRow =
  typeof analyticsServerEventReplays.$inferSelect;
export type NewAnalyticsServerEventReplayRow =
  typeof analyticsServerEventReplays.$inferInsert;
export type DesignResumeDocumentRow = typeof designResumeDocuments.$inferSelect;
export type NewDesignResumeDocumentRow =
  typeof designResumeDocuments.$inferInsert;
export type DesignResumeAssetRow = typeof designResumeAssets.$inferSelect;
export type NewDesignResumeAssetRow = typeof designResumeAssets.$inferInsert;
export type PostApplicationIntegrationRow =
  typeof postApplicationIntegrations.$inferSelect;
export type NewPostApplicationIntegrationRow =
  typeof postApplicationIntegrations.$inferInsert;
export type PostApplicationSyncRunRow =
  typeof postApplicationSyncRuns.$inferSelect;
export type NewPostApplicationSyncRunRow =
  typeof postApplicationSyncRuns.$inferInsert;
export type PostApplicationMessageRow =
  typeof postApplicationMessages.$inferSelect;
export type NewPostApplicationMessageRow =
  typeof postApplicationMessages.$inferInsert;
export type TracerLinkRow = typeof tracerLinks.$inferSelect;
export type NewTracerLinkRow = typeof tracerLinks.$inferInsert;
export type TracerClickEventRow = typeof tracerClickEvents.$inferSelect;
export type NewTracerClickEventRow = typeof tracerClickEvents.$inferInsert;
export type InvestigatorDossierRow = typeof investigatorDossiers.$inferSelect;
export type NewInvestigatorDossierRow =
  typeof investigatorDossiers.$inferInsert;
export type InvestigatorDossierJobRow =
  typeof investigatorDossierJobs.$inferSelect;
export type NewInvestigatorDossierJobRow =
  typeof investigatorDossierJobs.$inferInsert;
export type InvestigatorResearchRunRow =
  typeof investigatorResearchRuns.$inferSelect;
export type NewInvestigatorResearchRunRow =
  typeof investigatorResearchRuns.$inferInsert;
export type InvestigatorSourceRow = typeof investigatorSources.$inferSelect;
export type NewInvestigatorSourceRow = typeof investigatorSources.$inferInsert;
export type InvestigatorPersonRow = typeof investigatorPeople.$inferSelect;
export type NewInvestigatorPersonRow = typeof investigatorPeople.$inferInsert;
export type InvestigatorSalaryObservationRow =
  typeof investigatorSalaryObservations.$inferSelect;
export type NewInvestigatorSalaryObservationRow =
  typeof investigatorSalaryObservations.$inferInsert;
export type InvestigatorSummaryRow = typeof investigatorSummaries.$inferSelect;
export type NewInvestigatorSummaryRow =
  typeof investigatorSummaries.$inferInsert;
export type InvestigatorTimelineEventRow =
  typeof investigatorTimelineEvents.$inferSelect;
export type NewInvestigatorTimelineEventRow =
  typeof investigatorTimelineEvents.$inferInsert;
