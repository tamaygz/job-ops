/**
 * In-memory TTL cache for scraped LinkedIn profiles.
 * Keyed by `${tenantId}::${urlHash}` with a 30-minute TTL.
 */

import { createHash } from "node:crypto";

const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function buildCacheKey(tenantId: string, url: string): string {
	const urlHash = createHash("sha256").update(url).digest("hex");
	return `${tenantId}::${urlHash}`;
}

export function getCached<T>(key: string): T | null {
	const entry = cache.get(key);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		cache.delete(key);
		return null;
	}
	return entry.value as T;
}

export function setCached<T>(key: string, value: T): void {
	cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearExpired(): void {
	const now = Date.now();
	for (const [key, entry] of cache.entries()) {
		if (now > entry.expiresAt) {
			cache.delete(key);
		}
	}
}

/** Visible for testing only */
export function clearAll(): void {
	cache.clear();
}
