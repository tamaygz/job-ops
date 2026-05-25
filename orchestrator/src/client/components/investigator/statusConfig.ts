import type { DossierStatus } from "@shared/types";

export const dossierStatusConfig: Record<
  DossierStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  watchlist: {
    label: "Watchlist",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  },
  interviewing: {
    label: "Interviewing",
    className: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  },
  archived: {
    label: "Archived",
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  },
  declined: {
    label: "Declined",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  },
};