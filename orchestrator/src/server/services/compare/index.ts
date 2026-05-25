/**
 * Profile Compare service — barrel re-exports.
 */

export { applySection } from "./apply";
export {
  buildCacheKey,
  clearAll,
  clearExpired,
  getCached,
  setCached,
} from "./cache";
export { evaluateSections } from "./evaluator";
export { normaliseLinkedInHtml } from "./normaliser";
export { scrapeLinkedInProfile } from "./scraper";
