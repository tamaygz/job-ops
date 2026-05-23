/**
 * LinkedIn profile scraper.
 * Strategy: try Camoufox binary first, fall back to plain fetch.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { AppError, upstreamError } from "@infra/errors";
import { logger } from "@infra/logger";

const execFileAsync = promisify(execFile);

const CAMOUFOX_SCRIPT_PATH = resolve(
	__dirname,
	"../../../../../scripts/camoufox-fetch.mjs",
);
const SCRAPE_TIMEOUT_MS = 30_000;
const USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function isCamoufoxAvailable(): boolean {
	try {
		return existsSync(CAMOUFOX_SCRIPT_PATH);
	} catch {
		return false;
	}
}

async function fetchViaCamoufox(url: string): Promise<string> {
	const { stdout } = await execFileAsync(
		"node",
		[CAMOUFOX_SCRIPT_PATH, url],
		{ timeout: SCRAPE_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
	);
	return stdout;
}

async function fetchViaHttp(url: string): Promise<string> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			headers: { "User-Agent": USER_AGENT },
			signal: controller.signal,
			redirect: "follow",
		});

		if (!response.ok) {
			throw upstreamError(
				`LinkedIn returned HTTP ${response.status}`,
				{ status: response.status },
			);
		}

		return await response.text();
	} finally {
		clearTimeout(timer);
	}
}

export async function scrapeLinkedInProfile(url: string): Promise<string> {
	if (isCamoufoxAvailable()) {
		try {
			logger.info("Scraping LinkedIn profile via Camoufox", { url });
			return await fetchViaCamoufox(url);
		} catch (error) {
			if (error instanceof AppError) throw error;
			logger.warn("Camoufox scrape failed, falling back to HTTP fetch", {
				url,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	logger.info("Scraping LinkedIn profile via HTTP fetch", { url });
	try {
		return await fetchViaHttp(url);
	} catch (error) {
		if (error instanceof AppError) throw error;
		throw upstreamError(
			"Failed to fetch LinkedIn profile",
			{ url, cause: error instanceof Error ? error.message : String(error) },
		);
	}
}
