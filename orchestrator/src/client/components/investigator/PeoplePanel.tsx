import {
  useCreatePerson,
  useDeletePerson,
  useUpdatePerson,
} from "@client/hooks/queries/useInvestigatorMutations";
import { usePeople } from "@client/hooks/queries/useInvestigatorQueries";
import { showErrorToast } from "@client/lib/error-toast";
import type {
  ConfidenceLabel,
  CreateInvestigatorPersonInput,
  InvestigatorPerson,
  PersonType,
  UpdateInvestigatorPersonInput,
} from "@shared/types";
import { ConfidenceLabel as ConfidenceLabelValues } from "@shared/types";
import { ExternalLink, Pencil, Plus, Trash2, Users } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { EmptyState } from "../layout";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring Manager",
  interviewer: "Interviewer",
  executive: "Executive",
  founder: "Founder",
  employee: "Employee",
};

const PERSON_TYPE_ORDER: PersonType[] = [
  "executive",
  "founder",
  "hiring_manager",
  "recruiter",
  "interviewer",
  "employee",
];

const CONFIDENCE_CONFIG: Record<
  ConfidenceLabel,
  { label: string; className: string }
> = {
  high: {
    label: "High confidence",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  medium: {
    label: "Medium confidence",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  low: {
    label: "Low confidence",
    className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  },
  unknown: {
    label: "Unknown",
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  },
};

// ---------------------------------------------------------------------------
// Person form (shared by Add and Edit)
// ---------------------------------------------------------------------------

interface PersonFormState {
  fullName: string;
  personType: PersonType;
  title: string;
  profileUrl: string;
  roleContext: string;
  notes: string;
  confidenceLabel: ConfidenceLabel;
}

function emptyForm(): PersonFormState {
  return {
    fullName: "",
    personType: "employee",
    title: "",
    profileUrl: "",
    roleContext: "",
    notes: "",
    confidenceLabel: "medium",
  };
}

function personToForm(p: InvestigatorPerson): PersonFormState {
  return {
    fullName: p.fullName,
    personType: p.personType,
    title: p.title ?? "",
    profileUrl: p.profileUrl ?? "",
    roleContext: p.roleContext ?? "",
    notes: p.notes ?? "",
    confidenceLabel: p.confidenceLabel,
  };
}

interface PersonDialogProps {
  mode: "add" | "edit";
  initial?: PersonFormState;
  open: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (form: PersonFormState) => void;
}

const PersonDialog: React.FC<PersonDialogProps> = ({
  mode,
  initial,
  open,
  isPending,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<PersonFormState>(initial ?? emptyForm());
  const set = (k: keyof PersonFormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add Person" : "Edit Person"}
          </DialogTitle>
        </DialogHeader>
        <form id="person-form" onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Full name</Label>
              <input
                id="p-name"
                required
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="Jane Smith"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focu
s-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-type">Role type</Label>
                <Select
                  value={form.personType}
                  onValueChange={(v) => set("personType", v)}
                >
                  <SelectTrigger id="p-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSON_TYPE_ORDER.map((t) => (
                      <SelectItem key={t} value={t}>
                        {PERSON_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-conf">Confidence</Label>
                <Select
                  value={form.confidenceLabel}
                  onValueChange={(v) => set("confidenceLabel", v)}
                >
                  <SelectTrigger id="p-conf">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(ConfidenceLabelValues) as ConfidenceLabel[]
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CONFIDENCE_CONFIG[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-title">Job title</Label>
              <input
                id="p-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="VP of Engineering"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focu
s-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-url">Profile URL (LinkedIn, etc.)</Label>
              <input
                id="p-url"
                type="url"
                value={form.profileUrl}
                onChange={(e) => set("profileUrl", e.target.value)}
                placeholder="https://linkedin.com/in/…"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focu
s-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-context">Role context</Label>
              <input
                id="p-context"
                value={form.roleContext}
                onChange={(e) => set("roleContext", e.target.value)}
                placeholder="Owns hiring for the backend team"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focu
s-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-notes">Notes</Label>
              <textarea
                id="p-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Interview prep notes, impressions…"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-vi
sible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="person-form"
            disabled={!form.fullName.trim() || isPending}
          >
            {isPending ? "Saving…" : mode === "add" ? "Add person" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Person card
// ---------------------------------------------------------------------------

interface PersonCardProps {
  person: InvestigatorPerson;
  dossierId: string;
}

const PersonCard: React.FC<PersonCardProps> = ({ person, dossierId }) => {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateMutation = useUpdatePerson();
  const deleteMutation = useDeletePerson();
  const confidenceCfg =
    CONFIDENCE_CONFIG[person.confidenceLabel] ?? CONFIDENCE_CONFIG.unknown;

  const handleEdit = async (form: PersonFormState) => {
    const data: UpdateInvestigatorPersonInput = {
      fullName: form.fullName || undefined,
      personType: form.personType,
      title: form.title || null,
      profileUrl: form.profileUrl || null,
      roleContext: form.roleContext || null,
      notes: form.notes || null,
      confidenceLabel: form.confidenceLabel,
    };
    try {
      await updateMutation.mutateAsync({
        dossierId,
        personId: person.id,
        data,
      });
      setEditOpen(false);
    } catch (err) {
      showErrorToast(err, "Failed to update person");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ dossierId, personId: person.id });
    } catch (err) {
      showErrorToast(err, "Failed to delete person");
    }
  };

  const notes = person.notes ?? "";
  const MAX_NOTES = 180;
  const notesToShow =
    !expanded && notes.length > MAX_NOTES
      ? `${notes.slice(0, MAX_NOTES)}…`
      : notes;

  return (
    <>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{person.fullName}</span>
              <Badge
                variant="outline"
                className={cn("text-xs shrink-0", confidenceCfg.className)}
              >
                {confidenceCfg.label}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {person.title && <span>{person.title}</span>}
              <Badge
                variant="outline"
                className="text-xs border-muted text-muted-foreground"
              >
                {PERSON_TYPE_LABELS[person.personType] ?? person.personType}
              </Badge>
              {person.sourceIds.length > 0 && (
                <span>
                  {person.sourceIds.length} source
                  {person.sourceIds.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {person.profileUrl && (
              <a
                href={person.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
              >
                <ExternalLink className="h-3 w-3" />
                Profile
              </a>
            )}
          </div>

          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {confirmDelete ? (
              <div className="flex items-center gap-1 text-xs">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Role context */}
        {person.roleContext && (
          <p className="text-xs text-muted-foreground italic">
            {person.roleContext}
          </p>
        )}

        {/* Notes */}
        {notes && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {notesToShow}
            </p>
            {notes.length > MAX_NOTES && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}
      </div>

      <PersonDialog
        mode="edit"
        initial={personToForm(person)}
        open={editOpen}
        isPending={updateMutation.isPending}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface PeoplePanelProps {
  dossierId: string;
}

export const PeoplePanel: React.FC<PeoplePanelProps> = ({ dossierId }) => {
  const [addOpen, setAddOpen] = useState(false);
  const { data: people, isLoading } = usePeople(dossierId, { enabled: true });
  const createMutation = useCreatePerson();

  const handleAdd = async (form: PersonFormState) => {
    const input: CreateInvestigatorPersonInput = {
      fullName: form.fullName,
      personType: form.personType,
      title: form.title || null,
      profileUrl: form.profileUrl || null,
      roleContext: form.roleContext || null,
      notes: form.notes || null,
      confidenceLabel: form.confidenceLabel,
    };
    try {
      await createMutation.mutateAsync({ dossierId, input });
      setAddOpen(false);
    } catch (err) {
      showErrorToast(err, "Failed to add person");
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  const groups: Record<string, InvestigatorPerson[]> = {};
  for (const p of people ?? []) {
    if (!groups[p.personType]) groups[p.personType] = [];
    groups[p.personType].push(p);
  }

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add person
        </Button>
      </div>

      {!people || people.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No people yet"
          description="People are discovered during research runs, or you can add them manually."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add person
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {PERSON_TYPE_ORDER.filter((t) => groups[t]?.length).map((type) => (
            <div key={type} className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {PERSON_TYPE_LABELS[type]}
                <span className="rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal">
                  {groups[type].length}
                </span>
              </h3>
              {groups[type].map((p) => (
                <PersonCard key={p.id} person={p} dossierId={dossierId} />
              ))}
            </div>
          ))}
        </div>
      )}

      <PersonDialog
        mode="add"
        open={addOpen}
        isPending={createMutation.isPending}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
      />
    </>
  );
};
