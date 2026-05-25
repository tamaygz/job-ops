import { getActiveTenantId } from "@server/tenancy/context";

export type RunProgressEvent = {
  runId: string;
  dossierId: string;
  status: string;
  phase?: string;
  message?: string;
};

type RunProgressListener = (event: RunProgressEvent) => void;

const listenersByTenant = new Map<string, Set<RunProgressListener>>();

/**
 * Notify all listeners registered for the current tenant context.
 * Must be called from within a tenant request context (runWithRequestContext).
 */
export function notifyRunProgress(event: RunProgressEvent): void {
  const tenantId = getActiveTenantId();
  for (const listener of listenersByTenant.get(tenantId) ?? []) {
    try {
      listener(event);
    } catch {
      // Never let a broken SSE client crash the worker.
    }
  }
}

/**
 * Subscribe to run progress events for the current tenant.
 * Returns an unsubscribe function; call it when the SSE connection closes.
 */
export function subscribeToRunProgress(
  listener: RunProgressListener,
): () => void {
  const tenantId = getActiveTenantId();
  const listeners = listenersByTenant.get(tenantId) ?? new Set();
  listenersByTenant.set(tenantId, listeners);
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
