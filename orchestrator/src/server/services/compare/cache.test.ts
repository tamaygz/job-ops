import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCacheKey, clearAll, getCached, setCached } from "./cache";

describe("compare/cache", () => {
  afterEach(() => {
    clearAll();
  });

  it("returns null for uncached keys", () => {
    const result = getCached<string>(buildCacheKey("t1", "https://example.com"));
    expect(result).toBeNull();
  });

  it("stores and retrieves cached values", () => {
    const key = buildCacheKey("t1", "https://linkedin.com/in/test");
    setCached(key, { name: "Test User" });
    expect(getCached<{ name: string }>(key)).toEqual({ name: "Test User" });
  });

  it("scopes cache by tenant", () => {
    const key1 = buildCacheKey("tenant-a", "https://linkedin.com/in/user");
    const key2 = buildCacheKey("tenant-b", "https://linkedin.com/in/user");
    setCached(key1, { tenant: "a" });
    setCached(key2, { tenant: "b" });
    expect(getCached<{ tenant: string }>(key1)?.tenant).toBe("a");
    expect(getCached<{ tenant: string }>(key2)?.tenant).toBe("b");
  });

  it("returns null after TTL expires", () => {
    const key = buildCacheKey("t1", "https://linkedin.com/in/expired");
    setCached(key, "value");

    // Manually expire by manipulating the internal entry
    vi.useFakeTimers();
    vi.advanceTimersByTime(31 * 60 * 1000); // 31 minutes
    expect(getCached<string>(key)).toBeNull();
    vi.useRealTimers();
  });

  it("clearAll removes all entries", () => {
    const key = buildCacheKey("t1", "https://linkedin.com/in/test");
    setCached(key, "value");
    clearAll();
    expect(getCached<string>(key)).toBeNull();
  });
});
