import type {
  CreateInvestigatorDossierInput,
  InvestigatorDossier,
  InvestigatorDossierDetail,
  InvestigatorDossierListFilters,
  InvestigatorDossierListItem,
  InvestigatorLinkedJob,
  UpdateInvestigatorDossierInput,
} from "@shared/types";
import { fetchApi, withQuery } from "../core";

export function listDossiers(
  filters?: InvestigatorDossierListFilters,
): Promise<InvestigatorDossierListItem[]> {
  return fetchApi<InvestigatorDossierListItem[]>(
    withQuery("/investigator/dossiers", {
      q: filters?.q,
      status: filters?.status,
      tag: filters?.tag,
      linkedJobId: filters?.linkedJobId,
      hasPeople:
        filters?.hasPeople !== undefined
          ? String(filters.hasPeople)
          : undefined,
      stale: filters?.stale !== undefined ? String(filters.stale) : undefined,
      sort: filters?.sort,
    }),
  );
}

export function getDossier(id: string): Promise<InvestigatorDossierDetail> {
  return fetchApi<InvestigatorDossierDetail>(`/investigator/dossiers/${id}`);
}

export function listLinkedJobs(
  dossierId: string,
): Promise<InvestigatorLinkedJob[]> {
  return fetchApi<InvestigatorLinkedJob[]>(
    `/investigator/dossiers/${dossierId}/jobs`,
  );
}

export function createDossier(
  input: CreateInvestigatorDossierInput,
): Promise<InvestigatorDossier> {
  return fetchApi<InvestigatorDossier>("/investigator/dossiers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDossier(
  id: string,
  input: UpdateInvestigatorDossierInput,
): Promise<InvestigatorDossier> {
  return fetchApi<InvestigatorDossier>(`/investigator/dossiers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function linkJob(
  dossierId: string,
  input: { jobId: string; linkReason?: string },
): Promise<InvestigatorDossier> {
  return fetchApi<InvestigatorDossier>(
    `/investigator/dossiers/${dossierId}/jobs`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function unlinkJob(
  dossierId: string,
  jobId: string,
): Promise<InvestigatorDossier> {
  return fetchApi<InvestigatorDossier>(
    `/investigator/dossiers/${dossierId}/jobs/${jobId}`,
    { method: "DELETE" },
  );
}

export function createDossierFromJob(
  jobId: string,
): Promise<InvestigatorDossier> {
  return fetchApi<InvestigatorDossier>("/investigator/dossiers/from-job", {
    method: "POST",
    body: JSON.stringify({ jobId }),
  });
}

export function mergeDossiers(
  targetId: string,
  sourceId: string,
): Promise<InvestigatorDossier> {
  return fetchApi<InvestigatorDossier>(
    `/investigator/dossiers/${targetId}/merge`,
    {
      method: "POST",
      body: JSON.stringify({ sourceDossierId: sourceId, confirm: true }),
    },
  );
}
