import * as investigatorApi from "@client/api/investigator";
import type {
  CreateInvestigatorDossierInput,
  CreateInvestigatorPersonInput,
  CreateInvestigatorSalaryObservationInput,
  CreateInvestigatorSourceInput,
  RegenerateInvestigatorSummaryInput,
  StartInvestigatorRunInput,
  UpdateInvestigatorDossierInput,
  UpdateInvestigatorPersonInput,
  UpdateInvestigatorSalaryObservationInput,
  UpdateInvestigatorSourceInput,
} from "@shared/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/client/lib/queryKeys";

// ---------------------------------------------------------------------------
// Dossier mutations
// ---------------------------------------------------------------------------

export function useCreateDossier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvestigatorDossierInput) =>
      investigatorApi.createDossier(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossiers(),
      });
    },
  });
}

export function useUpdateDossier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateInvestigatorDossierInput;
    }) => investigatorApi.updateDossier(id, input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossier(variables.id),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossiers(),
      });
    },
  });
}

export function useLinkJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      input,
    }: {
      dossierId: string;
      input: { jobId: string; linkReason?: string };
    }) => investigatorApi.linkJob(dossierId, input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossier(variables.dossierId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossiers(),
      });
    },
  });
}

export function useUnlinkJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dossierId, jobId }: { dossierId: string; jobId: string }) =>
      investigatorApi.unlinkJob(dossierId, jobId),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossier(variables.dossierId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossiers(),
      });
    },
  });
}

export function useCreateDossierFromJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => investigatorApi.createDossierFromJob(jobId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossiers(),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Run mutations
// ---------------------------------------------------------------------------

export function useStartRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      input,
    }: {
      dossierId: string;
      input: StartInvestigatorRunInput;
    }) => investigatorApi.startRun(dossierId, input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.runs(variables.dossierId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossier(variables.dossierId),
      });
    },
  });
}

export function useCancelRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dossierId, runId }: { dossierId: string; runId: string }) =>
      investigatorApi.cancelRun(dossierId, runId),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.runs(variables.dossierId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.run(
          variables.dossierId,
          variables.runId,
        ),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Source mutations
// ---------------------------------------------------------------------------

export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      input,
    }: {
      dossierId: string;
      input: CreateInvestigatorSourceInput;
    }) => investigatorApi.createSource(dossierId, input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.sources(variables.dossierId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossier(variables.dossierId),
      });
    },
  });
}

export function useUpdateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      sourceId,
      data,
    }: {
      dossierId: string;
      sourceId: string;
      data: UpdateInvestigatorSourceInput;
    }) => investigatorApi.updateSource(dossierId, sourceId, data),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.sources(variables.dossierId),
      });
    },
  });
}

export function useDeleteSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      sourceId,
    }: {
      dossierId: string;
      sourceId: string;
    }) => investigatorApi.deleteSource(dossierId, sourceId),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.sources(variables.dossierId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossier(variables.dossierId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// People mutations
// ---------------------------------------------------------------------------

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      input,
    }: {
      dossierId: string;
      input: CreateInvestigatorPersonInput;
    }) => investigatorApi.createPerson(dossierId, input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.people(variables.dossierId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossier(variables.dossierId),
      });
    },
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      personId,
      data,
    }: {
      dossierId: string;
      personId: string;
      data: UpdateInvestigatorPersonInput;
    }) => investigatorApi.updatePerson(dossierId, personId, data),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.people(variables.dossierId),
      });
    },
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      personId,
    }: {
      dossierId: string;
      personId: string;
    }) => investigatorApi.deletePerson(dossierId, personId),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.people(variables.dossierId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossier(variables.dossierId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Salary mutations
// ---------------------------------------------------------------------------

export function useCreateSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      input,
    }: {
      dossierId: string;
      input: CreateInvestigatorSalaryObservationInput;
    }) => investigatorApi.createObservation(dossierId, input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.salary(variables.dossierId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossier(variables.dossierId),
      });
    },
  });
}

export function useUpdateSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      id,
      data,
    }: {
      dossierId: string;
      id: string;
      data: UpdateInvestigatorSalaryObservationInput;
    }) => investigatorApi.updateObservation(dossierId, id, data),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.salary(variables.dossierId),
      });
    },
  });
}

export function useDeleteSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dossierId, id }: { dossierId: string; id: string }) =>
      investigatorApi.deleteObservation(dossierId, id),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.salary(variables.dossierId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossier(variables.dossierId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Summary mutations
// ---------------------------------------------------------------------------

export function useRegenerateSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      input,
    }: {
      dossierId: string;
      input: RegenerateInvestigatorSummaryInput;
    }) => investigatorApi.regenerateSummary(dossierId, input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.summaries(variables.dossierId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.dossier(variables.dossierId),
      });
    },
  });
}

export function useEditSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dossierId,
      summaryId,
      data,
    }: {
      dossierId: string;
      summaryId: string;
      data: { bodyMarkdown?: string; reviewState?: string };
    }) => investigatorApi.editSummary(dossierId, summaryId, data),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigator.summaries(variables.dossierId),
      });
    },
  });
}
