import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";

describe.sequential("database migrations", () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("boots when an older pipeline_runs table lacks config_snapshot", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-migrate-"));
    const script = `
      import { join } from "node:path";
      import { pathToFileURL } from "node:url";
      import Database from "better-sqlite3";

      const dbPath = join(process.env.DATA_DIR, "jobs.db");
      const sqlite = new Database(dbPath);
      sqlite.exec(\`
        CREATE TABLE pipeline_runs (
          id TEXT PRIMARY KEY,
          started_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT,
          status TEXT NOT NULL DEFAULT 'running',
          jobs_discovered INTEGER NOT NULL DEFAULT 0,
          jobs_processed INTEGER NOT NULL DEFAULT 0,
          error_message TEXT
        );
      \`);
      sqlite.close();

      await import(pathToFileURL(join(process.cwd(), "src/server/db/migrate.ts")).href);

      const migratedDb = new Database(dbPath, { readonly: true });
      const columns = migratedDb.prepare("PRAGMA table_info(pipeline_runs)").all();
      if (!columns.some((column) => column.name === "config_snapshot")) {
        throw new Error("config_snapshot column missing after migration");
      }
      migratedDb.close();
    `;

    execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        env: {
          ...process.env,
          DATA_DIR: tempDir,
        },
        stdio: "pipe",
      },
    );
  });

  it("creates tenant foreign keys for tenant-scoped core tables", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-migrate-"));
    const script = `
      import { join } from "node:path";
      import { pathToFileURL } from "node:url";
      import Database from "better-sqlite3";

      const dbPath = join(process.env.DATA_DIR, "jobs.db");
      await import(pathToFileURL(join(process.cwd(), "src/server/db/migrate.ts")).href);

      const migratedDb = new Database(dbPath, { readonly: true });

      function hasTenantCascade(tableName) {
        const fks = migratedDb.prepare(\`PRAGMA foreign_key_list(\${tableName})\`).all();
        return fks.some((fk) => fk.from === "tenant_id" && fk.table === "tenants" && String(fk.on_delete).toUpperCase() === "CASCADE");
      }

      const requiredTables = ["jobs", "pipeline_runs", "settings"];
      for (const tableName of requiredTables) {
        if (!hasTenantCascade(tableName)) {
          throw new Error(\`\${tableName} is missing tenant_id -> tenants(id) ON DELETE CASCADE\`);
        }
      }

      migratedDb.close();
    `;

    execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        env: {
          ...process.env,
          DATA_DIR: tempDir,
        },
        stdio: "pipe",
      },
    );
  });

  it("creates all investigator tables with expected indexes and storage types", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-migrate-"));
    const script = `
      import { join } from "node:path";
      import { pathToFileURL } from "node:url";
      import Database from "better-sqlite3";

      const dbPath = join(process.env.DATA_DIR, "jobs.db");
      await import(pathToFileURL(join(process.cwd(), "src/server/db/migrate.ts")).href);

      const migratedDb = new Database(dbPath, { readonly: true });

      function requireTable(tableName) {
        const row = migratedDb
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
          .get(tableName);
        if (!row) {
          throw new Error(\`Missing table: \${tableName}\`);
        }
      }

      function requireColumnType(tableName, columnName, expectedType) {
        const columns = migratedDb.prepare(\`PRAGMA table_info(\${tableName})\`).all();
        const column = columns.find((candidate) => candidate.name === columnName);
        if (!column) {
          throw new Error(\`Missing column \${tableName}.\${columnName}\`);
        }
        if (String(column.type).toUpperCase() !== expectedType) {
          throw new Error(
            \`Expected \${tableName}.\${columnName} to be \${expectedType}, got \${column.type}\`,
          );
        }
      }

      function requireAuditTimestamps(tableName) {
        const columns = migratedDb.prepare(\`PRAGMA table_info(\${tableName})\`).all();
        for (const columnName of ["created_at", "updated_at"]) {
          const column = columns.find((candidate) => candidate.name === columnName);
          if (!column) {
            throw new Error(\`Missing audit column \${tableName}.\${columnName}\`);
          }
          if (String(column.type).toUpperCase() !== "TEXT") {
            throw new Error(\`Expected \${tableName}.\${columnName} to use TEXT storage\`);
          }
          if (!String(column.dflt_value ?? "").includes("datetime('now')")) {
            throw new Error(\`Expected \${tableName}.\${columnName} to default to datetime('now')\`);
          }
        }
      }

      function requireIndex(tableName, indexName, expectedUnique) {
        const indexes = migratedDb.prepare(\`PRAGMA index_list(\${tableName})\`).all();
        const index = indexes.find((candidate) => candidate.name === indexName);
        if (!index) {
          throw new Error(\`Missing index \${indexName} on \${tableName}\`);
        }
        if (Boolean(index.unique) !== expectedUnique) {
          throw new Error(
            \`Expected index \${indexName} unique=\${expectedUnique}, got unique=\${index.unique}\`,
          );
        }
      }

      const investigatorTables = [
        "investigator_dossiers",
        "investigator_dossier_jobs",
        "investigator_research_runs",
        "investigator_sources",
        "investigator_people",
        "investigator_salary_observations",
        "investigator_summaries",
        "investigator_timeline_events",
      ];

      for (const tableName of investigatorTables) {
        requireTable(tableName);
        requireAuditTimestamps(tableName);
      }

      requireColumnType("investigator_dossiers", "tags", "TEXT");
      requireColumnType("investigator_dossiers", "last_researched_at", "INTEGER");
      requireColumnType("investigator_research_runs", "seed_context", "TEXT");
      requireColumnType("investigator_research_runs", "started_at", "INTEGER");
      requireColumnType("investigator_research_runs", "completed_at", "INTEGER");
      requireColumnType("investigator_sources", "retrieved_at", "INTEGER");
      requireColumnType("investigator_people", "source_ids", "TEXT");
      requireColumnType("investigator_salary_observations", "observed_at", "INTEGER");
      requireColumnType("investigator_summaries", "facts_json", "TEXT");
      requireColumnType("investigator_summaries", "hypotheses_json", "TEXT");
      requireColumnType("investigator_timeline_events", "payload", "TEXT");
      requireColumnType("investigator_timeline_events", "occurred_at", "INTEGER");

      requireIndex(
        "investigator_dossiers",
        "idx_investigator_dossiers_tenant_canonical_key_unique",
        true,
      );
      requireIndex(
        "investigator_dossier_jobs",
        "idx_investigator_dossier_jobs_tenant_dossier_job_unique",
        true,
      );

      migratedDb.close();
    `;

    execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        env: {
          ...process.env,
          DATA_DIR: tempDir,
        },
        stdio: "pipe",
      },
    );
  });

  it("rebuilds legacy investigator timeline table to allow fetched/query events", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-migrate-"));
    const script = `
      import { join } from "node:path";
      import { pathToFileURL } from "node:url";
      import Database from "better-sqlite3";

      const dbPath = join(process.env.DATA_DIR, "jobs.db");
      const sqlite = new Database(dbPath);
      sqlite.exec(\`
        CREATE TABLE tenants (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO tenants(id, name, slug) VALUES ('tenant_default', 'JobOps', 'default');

        CREATE TABLE investigator_timeline_events (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
          dossier_id TEXT NOT NULL,
          run_id TEXT,
          event_type TEXT NOT NULL CHECK(event_type IN ('dossier_created','job_linked','run_started','run_completed','run_partial_failed','run_failed','source_saved','source_reviewed','person_saved','salary_saved','summary_saved','status_changed','dossier_merged')),
          payload TEXT NOT NULL,
          occurred_at INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        );
        INSERT INTO investigator_timeline_events(id, tenant_id, dossier_id, event_type, payload, occurred_at)
          VALUES ('evt-legacy', 'tenant_default', 'dossier-1', 'run_started', '{}', 1);
      \`);
      sqlite.close();

      await import(pathToFileURL(join(process.cwd(), "src/server/db/migrate.ts")).href);

      const migratedDb = new Database(dbPath);
      const existing = migratedDb
        .prepare("SELECT event_type FROM investigator_timeline_events WHERE id = ?")
        .get("evt-legacy");
      if (!existing || existing.event_type !== "run_started") {
        throw new Error("Existing investigator timeline event missing after migration");
      }

      migratedDb
        .prepare(
          "INSERT INTO investigator_timeline_events(id, tenant_id, dossier_id, event_type, payload, occurred_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run("evt-new", "tenant_default", "dossier-1", "url_fetched", "{}", 2);

      migratedDb
        .prepare(
          "INSERT INTO investigator_timeline_events(id, tenant_id, dossier_id, event_type, payload, occurred_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run("evt-new-2", "tenant_default", "dossier-1", "search_queried", "{}", 3);

      const indexes = migratedDb
        .prepare("PRAGMA index_list(investigator_timeline_events)")
        .all();
      if (
        !indexes.some(
          (index) =>
            index.name === "idx_investigator_timeline_events_dossier_occurred_at",
        )
      ) {
        throw new Error("investigator timeline occurred_at index missing");
      }
      if (
        !indexes.some(
          (index) =>
            index.name === "idx_investigator_timeline_events_dossier_event_type",
        )
      ) {
        throw new Error("investigator timeline event_type index missing");
      }

      migratedDb.close();
    `;

    execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        env: {
          ...process.env,
          DATA_DIR: tempDir,
        },
        stdio: "pipe",
      },
    );
  });

  it("backfills legacy PDF rows as generated", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-migrate-"));
    const script = `
      import { join } from "node:path";
      import { pathToFileURL } from "node:url";
      import Database from "better-sqlite3";

      const dbPath = join(process.env.DATA_DIR, "jobs.db");
      const migrationUrl = pathToFileURL(join(process.cwd(), "src/server/db/migrate.ts")).href;
      await import(\`\${migrationUrl}?run=initial\`);

      const sqlite = new Database(dbPath);
      sqlite.prepare("INSERT INTO jobs(id, title, employer, job_url, pdf_path, pdf_source) VALUES (?, ?, ?, ?, ?, NULL)").run(
        "legacy-pdf-job",
        "Legacy PDF Job",
        "Acme",
        "https://example.com/legacy-pdf-job",
        "data/pdfs/resume_legacy-pdf-job.pdf",
      );
      sqlite.close();

      await import(\`\${migrationUrl}?run=backfill\`);

      const migratedDb = new Database(dbPath, { readonly: true });
      const row = migratedDb.prepare("SELECT pdf_source FROM jobs WHERE id = ?").get("legacy-pdf-job");
      if (row?.pdf_source !== "generated") {
        throw new Error(\`Expected legacy PDF source to be generated, got \${row?.pdf_source}\`);
      }
      migratedDb.close();
    `;

    execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        env: {
          ...process.env,
          DATA_DIR: tempDir,
        },
        stdio: "pipe",
      },
    );
  });

  it("adds the tracer-link composite unique index to legacy tables", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-migrate-"));
    const script = `
      import { join } from "node:path";
      import { pathToFileURL } from "node:url";
      import Database from "better-sqlite3";

      const dbPath = join(process.env.DATA_DIR, "jobs.db");
      const sqlite = new Database(dbPath);
      sqlite.exec(\`
        CREATE TABLE tracer_links (
          id TEXT PRIMARY KEY,
          token TEXT NOT NULL UNIQUE,
          job_id TEXT NOT NULL,
          source_path TEXT NOT NULL,
          source_label TEXT NOT NULL,
          destination_url TEXT NOT NULL,
          destination_url_hash TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE tracer_click_events (
          id TEXT PRIMARY KEY,
          tracer_link_id TEXT NOT NULL,
          clicked_at INTEGER NOT NULL,
          is_likely_bot INTEGER NOT NULL DEFAULT 0,
          unique_fingerprint_hash TEXT
        );

        INSERT INTO tracer_links(
          id, token, job_id, source_path, source_label, destination_url,
          destination_url_hash, created_at, updated_at
        )
        VALUES
          ('link-1', 'acme-aa', 'job-1', 'basics.url.href', 'Portfolio', 'https://example.com', 'hash-1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
          ('link-2', 'acme-bb', 'job-1', 'basics.url.href', 'Portfolio', 'https://example.com', 'hash-1', '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z');

        INSERT INTO tracer_click_events(id, tracer_link_id, clicked_at)
        VALUES ('click-1', 'link-2', 1);
      \`);
      sqlite.close();

      await import(pathToFileURL(join(process.cwd(), "src/server/db/migrate.ts")).href);

      const migratedDb = new Database(dbPath, { readonly: true });
      const indexes = migratedDb.prepare("PRAGMA index_list(tracer_links)").all();
      const uniqueIndex = indexes.find((index) => index.name === "idx_tracer_links_tenant_job_source_destination_unique");
      if (!uniqueIndex || !uniqueIndex.unique) {
        throw new Error("tracer_links composite unique index missing after migration");
      }

      const linkCount = migratedDb.prepare("SELECT count(*) AS count FROM tracer_links").get();
      if (linkCount.count !== 1) {
        throw new Error(\`Expected duplicate tracer links to be merged, got \${linkCount.count}\`);
      }

      const click = migratedDb.prepare("SELECT tracer_link_id FROM tracer_click_events WHERE id = ?").get("click-1");
      if (click?.tracer_link_id !== "link-1") {
        throw new Error(\`Expected duplicate click to be reassigned to link-1, got \${click?.tracer_link_id}\`);
      }

      migratedDb.close();
    `;

    execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        env: {
          ...process.env,
          DATA_DIR: tempDir,
        },
        stdio: "pipe",
      },
    );
  });

  it("rebuilds post-application tables to accept o365 provider", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-migrate-"));
    const script = `
      import { join } from "node:path";
      import { pathToFileURL } from "node:url";
      import Database from "better-sqlite3";

      const dbPath = join(process.env.DATA_DIR, "jobs.db");
      const sqlite = new Database(dbPath);

      // Seed an older schema with CHECK(provider IN ('gmail', 'imap'))
      sqlite.exec(\`
        CREATE TABLE tenants (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO tenants(id, name, slug) VALUES ('tenant_default', 'JobOps', 'default');

        CREATE TABLE post_application_integrations (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'tenant_default',
          provider TEXT NOT NULL CHECK(provider IN ('gmail', 'imap')),
          account_key TEXT NOT NULL DEFAULT 'default',
          display_name TEXT,
          status TEXT NOT NULL DEFAULT 'disconnected',
          credentials TEXT,
          last_connected_at INTEGER,
          last_synced_at INTEGER,
          last_error TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(tenant_id, provider, account_key),
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        );
        INSERT INTO post_application_integrations(id, provider, status)
          VALUES ('int-1', 'gmail', 'connected');
      \`);
      sqlite.close();

      await import(pathToFileURL(join(process.cwd(), "src/server/db/migrate.ts")).href);

      const migratedDb = new Database(dbPath);

      // Existing gmail row must survive
      const gmail = migratedDb.prepare(
        "SELECT provider, status FROM post_application_integrations WHERE id = ?"
      ).get("int-1");
      if (!gmail || gmail.provider !== "gmail" || gmail.status !== "connected") {
        throw new Error("Existing gmail integration lost after migration");
      }

      // Inserting o365 must now succeed
      migratedDb.prepare(
        "INSERT INTO post_application_integrations(id, provider, status) VALUES (?, ?, ?)"
      ).run("int-2", "o365", "connected");

      migratedDb.close();
    `;

    execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        env: {
          ...process.env,
          DATA_DIR: tempDir,
        },
        stdio: "pipe",
      },
    );
  });
});
