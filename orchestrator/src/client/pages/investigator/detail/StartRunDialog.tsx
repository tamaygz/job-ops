import { investigatorRunKindLabels } from "@client/components/investigator/runMetadata";
import { useStartRun } from "@client/hooks/queries/useInvestigatorMutations";
import { showErrorToast } from "@client/lib/error-toast";
import type { StartInvestigatorRunInput } from "@shared/types";
import { RESEARCH_QUESTION_TEMPLATES } from "@shared/types";
import { Loader2, Play } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";

interface StartRunDialogProps {
  dossierId: string;
  open: boolean;
  onClose: () => void;
}

const RUN_KIND_TO_TEMPLATE_SCOPE: Record<string, "company" | "people" | null> =
  {
    company_brief: "company",
    people_scan: "people",
    dossier_refresh: null,
  };

export const StartRunDialog: React.FC<StartRunDialogProps> = ({
  dossierId,
  open,
  onClose,
}) => {
  const [runKind, setRunKind] = useState<string>("company_brief");
  const [researchQuestion, setResearchQuestion] = useState("");
  const mutation = useStartRun();
  const navigate = useNavigate();

  const templateScope = RUN_KIND_TO_TEMPLATE_SCOPE[runKind] ?? null;
  const filteredTemplates = useMemo(
    () =>
      templateScope
        ? RESEARCH_QUESTION_TEMPLATES.filter(
            (t) => t.scope === templateScope || t.scope === "both",
          )
        : RESEARCH_QUESTION_TEMPLATES,
    [templateScope],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuestion = researchQuestion.trim();
    const input: StartInvestigatorRunInput = {
      runKind: runKind as StartInvestigatorRunInput["runKind"],
      ...(trimmedQuestion ? { researchQuestion: trimmedQuestion } : {}),
    };
    try {
      const run = await mutation.mutateAsync({ dossierId, input });
      toast.success("Research started", {
        description: "Open the run log to follow each recorded research step.",
        action: {
          label: "See details",
          onClick: () => navigate(`/investigator/${dossierId}/runs/${run.id}`),
        },
      });
      onClose();
    } catch (err) {
      showErrorToast(err, "Failed to start research run");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Research</DialogTitle>
          <DialogDescription>
            Choose the scope of the next investigator research run.
          </DialogDescription>
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
            <div className="space-y-1.5">
              <Label htmlFor="research-question">
                Driving question{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {filteredTemplates.map((template) => (
                  <Button
                    key={template.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs"
                    onClick={() => setResearchQuestion(template.question)}
                  >
                    {template.label}
                  </Button>
                ))}
              </div>
              <Textarea
                id="research-question"
                placeholder="e.g. What should I focus on to prepare for this interview?"
                value={researchQuestion}
                onChange={(e) => setResearchQuestion(e.target.value)}
                rows={2}
                maxLength={500}
                className="resize-none text-sm"
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
