import {
  investigatorRunKindLabels,
} from "@client/components/investigator/runMetadata";
import { useStartRun } from "@client/hooks/queries/useInvestigatorMutations";
import { showErrorToast } from "@client/lib/error-toast";
import type { StartInvestigatorRunInput } from "@shared/types";
import { Loader2, Play } from "lucide-react";
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

interface StartRunDialogProps {
  dossierId: string;
  open: boolean;
  onClose: () => void;
}

export const StartRunDialog: React.FC<StartRunDialogProps> = ({
  dossierId,
  open,
  onClose,
}) => {
  const [runKind, setRunKind] = useState<string>("company_brief");
  const mutation = useStartRun();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: StartInvestigatorRunInput = {
      runKind: runKind as StartInvestigatorRunInput["runKind"],
    };
    try {
      await mutation.mutateAsync({ dossierId, input });
      onClose();
    } catch (err) {
      showErrorToast(err, "Failed to start research run");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Start Research</DialogTitle>
        </DialogHeader>
        <form id="start-run-form" onSubmit={handleSubmit}>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="run-kind">Research type</Label>
              <Select value={runKind} onValueChange={setRunKind}>
                <SelectTrigger id="run-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(investigatorRunKindLabels).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="start-run-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};