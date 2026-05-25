import { dossierStatusConfig } from "@client/components/investigator/statusConfig";
import { useUpdateDossier } from "@client/hooks/queries/useInvestigatorMutations";
import { showErrorToast } from "@client/lib/error-toast";
import type {
  DossierStatus,
  UpdateInvestigatorDossierInput,
} from "@shared/types";
import type React from "react";
import { useState } from "react";
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

interface EditDossierDialogProps {
  dossierId: string;
  currentName: string;
  currentUrl: string | null;
  currentStatus: DossierStatus;
  currentTags: string[];
  open: boolean;
  onClose: () => void;
}

export const EditDossierDialog: React.FC<EditDossierDialogProps> = ({
  dossierId,
  currentName,
  currentUrl,
  currentStatus,
  currentTags,
  open,
  onClose,
}) => {
  const [companyName, setCompanyName] = useState(currentName);
  const [companyUrl, setCompanyUrl] = useState(currentUrl ?? "");
  const [status, setStatus] = useState<DossierStatus>(currentStatus);
  const [tagsInput, setTagsInput] = useState(currentTags.join(", "));
  const mutation = useUpdateDossier();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const input: UpdateInvestigatorDossierInput = {
      companyName: companyName.trim() || undefined,
      companyUrl: companyUrl.trim() || null,
      status,
      tags,
    };
    try {
      await mutation.mutateAsync({ id: dossierId, input });
      onClose();
    } catch (err) {
      showErrorToast(err, "Failed to update dossier");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Dossier</DialogTitle>
        </DialogHeader>
        <form id="edit-dossier-form" onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-company-name">Company name</Label>
              <input
                id="edit-company-name"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-company-url">Website</Label>
              <input
                id="edit-company-url"
                type="url"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="https://"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as DossierStatus)}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(dossierStatusConfig) as DossierStatus[]).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {dossierStatusConfig[value].label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <input
                id="edit-tags"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="fintech, startup, remote"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
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
            form="edit-dossier-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};