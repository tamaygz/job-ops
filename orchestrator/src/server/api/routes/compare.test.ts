import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer } from "./test-utils";

describe.sequential("compare routes", () => {
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

  it("POST /api/compare/scrape returns 400 for non-LinkedIn URL", async () => {
    const res = await fetch(`${baseUrl}/api/compare/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/not-linkedin" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("POST /api/compare/scrape returns 400 for missing URL", async () => {
    const res = await fetch(`${baseUrl}/api/compare/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("POST /api/compare/apply returns 404 when cache is empty", async () => {
    const res = await fetch(`${baseUrl}/api/compare/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        otherProfileUrl: "https://www.linkedin.com/in/nonexistent-user",
        section: "experience",
        action: "copy",
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("POST /api/compare/apply returns 400 for invalid section", async () => {
    const res = await fetch(`${baseUrl}/api/compare/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        otherProfileUrl: "https://www.linkedin.com/in/test-user",
        section: "invalid-section",
        action: "copy",
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("POST /api/compare/apply returns 400 for invalid action", async () => {
    const res = await fetch(`${baseUrl}/api/compare/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        otherProfileUrl: "https://www.linkedin.com/in/test-user",
        section: "experience",
        action: "invalid-action",
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });
});
