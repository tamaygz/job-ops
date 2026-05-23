/**
 * Profile Compare service — barrel re-exports.
 */

export { buildCacheKey, clearAll, clearExpired, getCached, setCached } from "./cache";
export { scrapeLinkedInProfile } from "./scraper";
export { normaliseLinkedInHtml } from "./normaliser";
export { evaluateSections } from "./evaluator";
export { applySection } from "./apply";
