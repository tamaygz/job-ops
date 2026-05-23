import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer } from "../test-utils";

describe.sequential("Sources API routes", () => {
  let server: Server;
  let baseUrl: string;
  let closeDb: () => void;
  let tempDir: string;

  beforeEach(async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer());
  });

  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function dossiersUrl(path = "") {
    return `${baseUrl}/api/investigator/dossiers${path}`;
  }

  async function createDossier(overrides: Record<string, unknown> = {}) {
    const res = await fetch(dossiersUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: "SourceCo", ...overrides }),
    });
    return res.json() as Promise<{ data: { id: string } }>;
  }

  function defaultSourcePayload(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      sourceType: "manual_note",
      title: "A manual note",
      capturedExcerpt: "Some interesting content about the company.",
      retrievedAt: Math.floor(Date.now() / 1000),
      ...overrides,
    };
  }

  async function createSource(
    dossierId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return fetch(dossiersUrl(`/${dossierId}/sources`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaultSourcePayload(overrides)),
    });
  }

  // ---------------------------------------------------------------------------
  // POST /:dossierId/sources — create source
  // ---------------------------------------------------------------------------

  it("creates a source and returns 201 with reviewState unreviewed", async () => {
    const { data: dossier } = await createDossier();
    const res = await createSource(dossier.id);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data.dossierId).toBe(dossier.id);
    expect(body.data.sourceType).toBe("manual_note");
    expect(body.data.reviewState).toBe("unreviewed");
    expect(body.data.contentHash).toBeTruthy();
  });

  it("derives sourceHost from url when url is provided", async () => {
    const { data: dossier } = await createDossier();
    const res = await createSource(dossier.id, {
      sourceType: "company_site",
      url: "https://www.example.com/about",
      capturedExcerpt: "About us page content",
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.sourceHost).toBe("www.example.com");
    expect(body.data.url).toBe("https://www.example.com/about");
  });

  it("returns 400 for missing required fields", async () => {
    const { data: dossier } = await createDossier();
    const res = await fetch(dossiersUrl(`/${dossier.id}/sources`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Missing fields" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 404 when creating source for unknown dossier", async () => {
    const res = await createSource("nonexistent-dossier-id");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("returns existing source (200) when same content hash is submitted", async () => {
    const { data: dossier } = await createDossier();
    const payload = defaultSourcePayload({
      capturedExcerpt: "Unique dedup content",
    });

    const res1 = await fetch(dossiersUrl(`/${dossier.id}/sources`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body1 = await res1.json();
    expect(res1.status).toBe(201);

    const res2 = await fetch(dossiersUrl(`/${dossier.id}/sources`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(body2.ok).toBe(true);
    expect(body2.data.id).toBe(body1.data.id);
  });

  // ---------------------------------------------------------------------------
  // GET /:dossierId/sources — list sources
  // ---------------------------------------------------------------------------

  it("lists sources for a dossier", async () => {
    const { data: dossier } = await createDossier();
    await createSource(dossier.id, { capturedExcerpt: "first source" });
    await createSource(dossier.id, { capturedExcerpt: "second source" });

    const res = await fetch(dossiersUrl(`/${dossier.id}/sources`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  it("filters sources by reviewState query param", async () => {
    const { data: dossier } = await createDossier();
    await createSource(dossier.id, {
      capturedExcerpt: "content a",
      reviewState: "verified",
    });
    await createSource(dossier.id, {
      capturedExcerpt: "content b",
      reviewState: "unreviewed",
    });

    const res = await fetch(
      dossiersUrl(`/${dossier.id}/sources?reviewState=verified`),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].reviewState).toBe("verified");
  });

  it("returns 400 for invalid reviewState filter", async () => {
    const { data: dossier } = await createDossier();

    const res = await fetch(
      dossiersUrl(`/${dossier.id}/sources?reviewState=not_valid`),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  // ---------------------------------------------------------------------------
  // PATCH /:dossierId/sources/:sourceId — update source
  // ---------------------------------------------------------------------------

  it("patches reviewState and reviewerNote", async () => {
    const { data: dossier } = await createDossier();
    const createRes = await createSource(dossier.id);
    const { data: source } = await createRes.json();

    const res = await fetch(
      dossiersUrl(`/${dossier.id}/sources/${source.id}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewState: "verified",
          reviewerNote: "Looks good",
        }),
      },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.reviewState).toBe("verified");
    expect(body.data.reviewerNote).toBe("Looks good");
  });

  it("returns 404 when patching unknown source", async () => {
    const { data: dossier } = await createDossier();

    const res = await fetch(
      dossiersUrl(`/${dossier.id}/sources/nonexistent-source-id`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewState: "verified" }),
      },
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("returns 404 when patching source with wrong dossier id", async () => {
    const { data: dossierA } = await createDossier({ companyName: "Alpha" });
    const { data: dossierB } = await createDossier({ companyName: "Beta" });
    const createRes = await createSource(dossierA.id);
    const { data: source } = await createRes.json();

    const res = await fetch(
      dossiersUrl(`/${dossierB.id}/sources/${source.id}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewState: "verified" }),
      },
    );
    const _body = await res.json();

    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // DELETE /:dossierId/sources/:sourceId — delete source
  // ---------------------------------------------------------------------------

  it("deletes a source and returns 204", async () => {
    const { data: dossier } = await createDossier();
    const createRes = await createSource(dossier.id);
    const { data: source } = await createRes.json();

    const res = await fetch(
      dossiersUrl(`/${dossier.id}/sources/${source.id}`),
      { method: "DELETE" },
    );

    expect(res.status).toBe(204);

    // Confirm it no longer appears in the list
    const listRes = await fetch(dossiersUrl(`/${dossier.id}/sources`));
    const listBody = await listRes.json();
    expect(listBody.data).toHaveLength(0);
  });

  it("returns 404 when deleting unknown source", async () => {
    const { data: dossier } = await createDossier();

    const res = await fetch(
      dossiersUrl(`/${dossier.id}/sources/nonexistent-source-id`),
      { method: "DELETE" },
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("returns 404 when deleting source with wrong dossier id", async () => {
    const { data: dossierA } = await createDossier({ companyName: "AlphaDel" });
    const { data: dossierB } = await createDossier({ companyName: "BetaDel" });
    const createRes = await createSource(dossierA.id);
    const { data: source } = await createRes.json();

    const res = await fetch(
      dossiersUrl(`/${dossierB.id}/sources/${source.id}`),
      { method: "DELETE" },
    );
    const _body = await res.json();

    expect(res.status).toBe(404);
  });
});
