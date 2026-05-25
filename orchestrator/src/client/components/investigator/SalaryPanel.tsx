import {
  useCreateSalary,
  useDeleteSalary,
  useUpdateSalary,
} from "@client/hooks/queries/useInvestigatorMutations";
import { useSalary } from "@client/hooks/queries/useInvestigatorQueries";
import { showErrorToast } from "@client/lib/error-toast";
import type {
  ConfidenceLabel,
  CreateInvestigatorSalaryObservationInput,
  InvestigatorSalaryObservation,
  PayInterval,
  UpdateInvestigatorSalaryObservationInput,
} from "@shared/types";
import {
  ConfidenceLabel as ConfidenceLabelValues,
  PayInterval as PayIntervalValues,
} from "@shared/types";
import { DollarSign, Pencil, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "../layout";

const PAY_INTERVAL_LABELS: Record<PayInterval, string> = {
  annual: "Annual",
  monthly: "Monthly",
  hourly: "Hourly",
  unknown: "Unknown",
};

const CONFIDENCE_LABELS: Record<ConfidenceLabel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  unknown: "Unknown",
};

function formatAmount(n: number, currency: string | null): string {
  const sym = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
  if (n >= 1000) return `${sym + Math.round(n / 1000)}k`;
  return sym + n;
}

function formatRange(obs: InvestigatorSalaryObservation): string {
  const { minAmount, maxAmount, currency } = obs;
  if (minAmount !== null && maxAmount !== null) {
    return `${formatAmount(minAmount, currency)} – ${formatAmount(maxAmount, currency)}`;
  }
  if (minAmount !== null) return `from ${formatAmount(minAmount, currency)}`;
  if (maxAmount !== null) return `up to ${formatAmount(maxAmount, currency)}`;
  return "—";
}

function formatObservedAt(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

interface SalaryFormState {
  roleScope: string;
  geoScope: string;
  currency: string;
  payInterval: PayInterval | "_none" | "";
  minAmount: string;
  maxAmount: string;
  equityText: string;
  bonusText: string;
  confidenceLabel: ConfidenceLabel;
  notes: string;
}

function emptyForm(): SalaryFormState {
  return {
    roleScope: "",
    geoScope: "",
    currency: "",
    payInterval: "",
    minAmount: "",
    maxAmount: "",
    equityText: "",
    bonusText: "",
    confidenceLabel: "medium",
    notes: "",
  };
}

function obsToForm(obs: InvestigatorSalaryObservation): SalaryFormState {
  return {
    roleScope: obs.roleScope ?? "",
    geoScope: obs.geoScope ?? "",
    currency: obs.currency ?? "",
    payInterval: obs.payInterval ?? "",
    minAmount: obs.minAmount?.toString() ?? "",
    maxAmount: obs.maxAmount?.toString() ?? "",
    equityText: obs.equityText ?? "",
    bonusText: obs.bonusText ?? "",
    confidenceLabel: obs.confidenceLabel,
    notes: obs.notes ?? "",
  };
}

interface SalaryDialogProps {
  mode: "add" | "edit";
  initial?: SalaryFormState;
  open: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (form: SalaryFormState) => void;
}

const SalaryDialog: React.FC<SalaryDialogProps> = ({
  mode,
  initial,
  open,
  isPending,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<SalaryFormState>(initial ?? emptyForm());
  const set = (k: keyof SalaryFormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add Salary Observation" : "Edit Observation"}
          </DialogTitle>
        </DialogHeader>
        <form
          id="salary-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sl-role">Role scope</Label>
                <input
                  id="sl-role"
                  value={form.roleScope}
                  onChange={(e) => set("roleScope", e.target.value)}
                  placeholder="Software Engineer L4"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-geo">Geography</Label>
                <input
                  id="sl-geo"
                  value={form.geoScope}
                  onChange={(e) => set("geoScope", e.target.value)}
                  placeholder="UK, London"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sl-min">Min amount</Label>
                <input
                  id="sl-min"
                  type="number"
                  min={0}
                  value={form.minAmount}
                  onChange={(e) => set("minAmount", e.target.value)}
                  placeholder="65000"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-max">Max amount</Label>
                <input
                  id="sl-max"
                  type="number"
                  min={0}
                  value={form.maxAmount}
                  onChange={(e) => set("maxAmount", e.target.value)}
                  placeholder="90000"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-curr">Currency</Label>
                <input
                  id="sl-curr"
                  value={form.currency}
                  onChange={(e) => set("currency", e.target.value)}
                  placeholder="GBP"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sl-interval">Pay interval</Label>
                <Select
                  value={form.payInterval}
                  onValueChange={(v) => set("payInterval", v)}
                >
                  <SelectTrigger id="sl-interval">
                    <SelectValue placeholder="— select —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— none —</SelectItem>
                    {(Object.keys(PayIntervalValues) as PayInterval[]).map(
                      (i) => (
                        <SelectItem key={i} value={i}>
                          {PAY_INTERVAL_LABELS[i]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-conf">Confidence</Label>
                <Select
                  value={form.confidenceLabel}
                  onValueChange={(v) => set("confidenceLabel", v)}
                >
                  <SelectTrigger id="sl-conf">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(ConfidenceLabelValues) as ConfidenceLabel[]
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CONFIDENCE_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sl-equity">Equity</Label>
                <input
                  id="sl-equity"
                  value={form.equityText}
                  onChange={(e) => set("equityText", e.target.value)}
                  placeholder="0.1–0.5%"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-bonus">Bonus</Label>
                <input
                  id="sl-bonus"
                  value={form.bonusText}
                  onChange={(e) => set("bonusText", e.target.value)}
                  placeholder="10–20%"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sl-notes">Notes</Label>
              <textarea
                id="sl-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Source or context…"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="salary-form" disabled={isPending}>
            {isPending
              ? "Saving…"
              : mode === "add"
                ? "Add observation"
                : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface SalaryPanelProps {
  dossierId: string;
}

export const SalaryPanel: React.FC<SalaryPanelProps> = ({ dossierId }) => {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] =
    useState<InvestigatorSalaryObservation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: observations, isLoading } = useSalary(dossierId, {
    enabled: true,
  });
  const createMutation = useCreateSalary();
  const updateMutation = useUpdateSalary();
  const deleteMutation = useDeleteSalary();

  const handleAdd = async (form: SalaryFormState) => {
    const input: CreateInvestigatorSalaryObservationInput = {
      roleScope: form.roleScope || null,
      geoScope: form.geoScope || null,
      currency: form.currency || null,
      payInterval:
        form.payInterval && form.payInterval !== "_none"
          ? (form.payInterval as PayInterval)
          : null,
      minAmount: form.minAmount ? Number(form.minAmount) : null,
      maxAmount: form.maxAmount ? Number(form.maxAmount) : null,
      equityText: form.equityText || null,
      bonusText: form.bonusText || null,
      confidenceLabel: form.confidenceLabel,
      notes: form.notes || null,
    };
    try {
      await createMutation.mutateAsync({ dossierId, input });
      setAddOpen(false);
    } catch (err) {
      showErrorToast(err, "Failed to add observation");
    }
  };

  const handleUpdate = async (form: SalaryFormState) => {
    if (!editTarget) return;
    const data: UpdateInvestigatorSalaryObservationInput = {
      roleScope: form.roleScope || null,
      geoScope: form.geoScope || null,
      currency: form.currency || null,
      payInterval:
        form.payInterval && form.payInterval !== "_none"
          ? (form.payInterval as PayInterval)
          : null,
      minAmount: form.minAmount ? Number(form.minAmount) : null,
      maxAmount: form.maxAmount ? Number(form.maxAmount) : null,
      equityText: form.equityText || null,
      bonusText: form.bonusText || null,
      confidenceLabel: form.confidenceLabel,
      notes: form.notes || null,
    };
    try {
      await updateMutation.mutateAsync({ dossierId, id: editTarget.id, data });
      setEditTarget(null);
    } catch (err) {
      showErrorToast(err, "Failed to update observation");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ dossierId, id });
      setDeleteTarget(null);
    } catch (err) {
      showErrorToast(err, "Failed to delete observation");
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-10 rounded-lg bg-muted/40" />
        <div className="h-10 rounded-lg bg-muted/40" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add observation
        </Button>
      </div>

      {!observations || observations.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No salary data yet"
          description="Salary observations are collected during research runs, or you can add them manually."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add observation
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Role
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Geography
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Range
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Interval
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Notes
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Observed
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {observations.map((obs) => (
                <tr
                  key={obs.id}
                  className="border-b last:border-0 hover:bg-muted/10 transition-colors"
                >
                  <td className="px-4 py-3 text-sm">
                    {obs.roleScope ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {obs.geoScope ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {formatRange(obs)}
                  </td>
                  <td className="px-4 py-3">
                    {obs.payInterval ? (
                      <Badge variant="outline" className="text-xs">
                        {PAY_INTERVAL_LABELS[obs.payInterval]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[12rem] truncate">
                    {obs.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatObservedAt(obs.observedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => setEditTarget(obs)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {deleteTarget === obs.id ? (
                        <div className="flex items-center gap-1 text-xs">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7"
                            onClick={() => void handleDelete(obs.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => setDeleteTarget(null)}
                          >
                            Keep
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                          onClick={() => setDeleteTarget(obs.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SalaryDialog
        mode="add"
        open={addOpen}
        isPending={createMutation.isPending}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
      />
      {editTarget && (
        <SalaryDialog
          mode="edit"
          initial={obsToForm(editTarget)}
          open={!!editTarget}
          isPending={updateMutation.isPending}
          onClose={() => setEditTarget(null)}
          onSubmit={handleUpdate}
        />
      )}
    </>
  );
};
