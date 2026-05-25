import { getRequestContext } from "./request-context";
import { sanitizeError, sanitizeUnknown } from "./sanitize";

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogStreamEntry = {
  id: number;
  ts: string;
  level: LogLevel;
  line: string;
  tenantId: string | null;
};

type LogStreamSubscriber = (entry: LogStreamEntry) => void;

const MAX_LOG_STREAM_ENTRIES = 400;
const logStreamEntries: LogStreamEntry[] = [];
const logStreamSubscribers = new Set<LogStreamSubscriber>();

let nextLogStreamEntryId = 1;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

const minLevel = resolveMinLevel();

function normalizeTenantId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function buildLogStreamEntry(
  payload: Record<string, unknown>,
  line: string,
  level: LogLevel,
): LogStreamEntry {
  return {
    id: nextLogStreamEntryId++,
    ts: typeof payload.ts === "string" ? payload.ts : new Date().toISOString(),
    level,
    line,
    tenantId: normalizeTenantId(payload.tenantId),
  };
}

function shouldIncludeLogStreamEntry(
  entry: LogStreamEntry,
  tenantId?: string,
): boolean {
  if (!tenantId) return true;
  return entry.tenantId === null || entry.tenantId === tenantId;
}

function publishLogStreamEntry(entry: LogStreamEntry): void {
  logStreamEntries.push(entry);
  if (logStreamEntries.length > MAX_LOG_STREAM_ENTRIES) {
    logStreamEntries.splice(0, logStreamEntries.length - MAX_LOG_STREAM_ENTRIES);
  }

  for (const subscriber of logStreamSubscribers) {
    subscriber(entry);
  }
}

export function listBufferedLogStreamEntries(input?: {
  tenantId?: string;
  limit?: number;
}): LogStreamEntry[] {
  const filtered = logStreamEntries.filter((entry) =>
    shouldIncludeLogStreamEntry(entry, input?.tenantId),
  );

  if (input?.limit && filtered.length > input.limit) {
    return filtered.slice(-input.limit);
  }

  return filtered.slice();
}

export function subscribeToLogStream(
  listener: (entry: LogStreamEntry) => void,
  input?: { tenantId?: string },
): () => void {
  const subscriber: LogStreamSubscriber = (entry) => {
    if (!shouldIncludeLogStreamEntry(entry, input?.tenantId)) return;
    listener(entry);
  };

  logStreamSubscribers.add(subscriber);
  return () => {
    logStreamSubscribers.delete(subscriber);
  };
}

export class Logger {
  constructor(private readonly context: Record<string, unknown> = {}) {}

  child(context: Record<string, unknown>): Logger {
    return new Logger({ ...this.context, ...context });
  }

  debug(message: string, meta?: unknown): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.log("error", message, meta);
  }

  private log(level: LogLevel, message: string, meta?: unknown): void {
    if (levelPriority[level] < levelPriority[minLevel]) return;

    const requestContext = getRequestContext();
    const payload: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg: message,
      ...this.context,
      ...(requestContext ?? {}),
    };

    if (meta !== undefined) {
      payload.meta =
        meta instanceof Error ? sanitizeError(meta) : sanitizeUnknown(meta);
    }

    const line = JSON.stringify(payload);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }

    publishLogStreamEntry(buildLogStreamEntry(payload, line, level));
  }
}

export const logger = new Logger();
