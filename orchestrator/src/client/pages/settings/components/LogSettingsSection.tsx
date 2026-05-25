import * as api from "@client/api";
import type { SettingsLogEntry, SettingsLogStreamEvent } from "@client/api";
import { SettingsSectionFrame } from "@client/pages/settings/components/SettingsSectionFrame";
import { AlertCircle, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type LogSettingsSectionProps = {
  layoutMode?: "accordion" | "panel";
};

type ConnectionState = "connecting" | "connected" | "paused" | "reconnecting";

const MAX_CLIENT_LOG_ENTRIES = 500;
const RECONNECT_DELAY_MS = 1_500;

function getConnectionBadge(state: ConnectionState): {
  label: string;
  className: string;
} {
  switch (state) {
    case "connected":
      return {
        label: "Connected",
        className: "border-emerald-300 text-emerald-700",
      };
    case "paused":
      return {
        label: "Paused",
        className: "border-amber-300 text-amber-700",
      };
    case "reconnecting":
      return {
        label: "Reconnecting",
        className: "border-blue-300 text-blue-700",
      };
    default:
      return {
        label: "Connecting",
        className: "border-muted text-muted-foreground",
      };
  }
}

function appendLogEntry(
  current: SettingsLogEntry[],
  entry: SettingsLogEntry,
): SettingsLogEntry[] {
  const next = [...current, entry];
  if (next.length <= MAX_CLIENT_LOG_ENTRIES) {
    return next;
  }
  return next.slice(next.length - MAX_CLIENT_LOG_ENTRIES);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString();
}

function getLevelClassName(level: SettingsLogEntry["level"]): string {
  switch (level) {
    case "error":
      return "text-rose-300";
    case "warn":
      return "text-amber-300";
    case "debug":
      return "text-sky-300";
    default:
      return "text-zinc-100";
  }
}

export const LogSettingsSection: React.FC<LogSettingsSectionProps> = ({
  layoutMode,
}) => {
  const [entries, setEntries] = useState<SettingsLogEntry[]>([]);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [followOutput, setFollowOutput] = useState(true);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [streamCycle, setStreamCycle] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!followOutput) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries, followOutput]);

  useEffect(() => {
    if (!autoUpdate) {
      setConnectionState("paused");
      return;
    }

    let disposed = false;
    let reconnectTimer: number | null = null;
    setConnectionState((current) =>
      current === "connected" ? current : "connecting",
    );

    const unsubscribe = api.subscribeToSettingsLogStream({
      onOpen: () => {
        if (disposed) return;
        setConnectionState("connected");
      },
      onMessage: (event: SettingsLogStreamEvent) => {
        if (disposed) return;
        if (event.type === "snapshot") {
          setEntries(event.entries.slice(-MAX_CLIENT_LOG_ENTRIES));
          return;
        }
        setEntries((current) => appendLogEntry(current, event.entry));
      },
      onError: () => {
        if (disposed) return;
        setConnectionState("reconnecting");
        reconnectTimer = window.setTimeout(() => {
          setStreamCycle((current) => current + 1);
        }, RECONNECT_DELAY_MS);
      },
    });

    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      unsubscribe();
    };
  }, [autoUpdate, streamCycle]);

  const badge = getConnectionBadge(connectionState);

  return (
    <SettingsSectionFrame mode={layoutMode} title="Logs" value="logs">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              {connectionState === "connected" ? (
                <RefreshCw className="h-4 w-4 text-emerald-600" />
              ) : connectionState === "paused" ? (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              )}
              <span>Server log stream</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Shows recent buffered lines first, then appends new log output as
              it arrives.
            </p>
          </div>
          <Badge variant="outline" className={badge.className}>
            {badge.label}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label htmlFor="logs-auto-update" className="flex items-center gap-2">
            <Switch
              id="logs-auto-update"
              checked={autoUpdate}
              onCheckedChange={setAutoUpdate}
              aria-label="Auto update"
            />
            <span>Auto update</span>
          </label>
          <label htmlFor="logs-follow-output" className="flex items-center gap-2">
            <Switch
              id="logs-follow-output"
              checked={followOutput}
              onCheckedChange={setFollowOutput}
              aria-label="Follow output"
            />
            <span>Follow output</span>
          </label>
          <div className="text-xs text-muted-foreground">
            {entries.length} line{entries.length === 1 ? "" : "s"} in view
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {connectionState === "reconnecting" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStreamCycle((current) => current + 1)}
              >
                Reconnect now
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEntries([])}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear view
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/60 bg-zinc-950">
          <div className="max-h-[32rem] min-h-[20rem] overflow-y-auto px-3 py-3">
            {entries.length === 0 ? (
              <div className="flex min-h-[18rem] items-center justify-center text-sm text-zinc-400">
                Waiting for log output...
              </div>
            ) : (
              <div className="space-y-1" aria-live="off">
                {entries.map((entry) => (
                  <div
                    key={`${entry.id}-${entry.ts}`}
                    className={`rounded px-2 py-1 font-mono text-xs leading-5 ${getLevelClassName(
                      entry.level,
                    )}`}
                  >
                    <span className="mr-2 text-zinc-500">
                      {formatTimestamp(entry.ts)}
                    </span>
                    <span className="mr-2 text-zinc-400">
                      {entry.level.toUpperCase()}
                    </span>
                    <span className="whitespace-pre-wrap break-words">
                      {entry.line}
                    </span>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </SettingsSectionFrame>
  );
};