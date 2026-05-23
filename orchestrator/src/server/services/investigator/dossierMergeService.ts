import { randomUUID } from "node:crypto";
import { conflict, notFound } from "@infra/errors";
import { db, schema } from "@server/db/index";
import * as dossierRepo from "@server/repositories/investigatorDossierRepository";
import { getActiveTenantId } from "@server/tenancy/context";
import type { InvestigatorDossier } from "@shared/types";
import { and, eq, sql } from "drizzle-orm";

const {
  investigatorDossierJobs,
  investigatorSources,
  investigatorPeople,
  investigatorSalaryObservations,
  investigatorSummaries,
  investigatorResearchRuns,
  investigatorTimelineEvents,
  investigatorDossiers,
} = schema;

/**
 * Merge sourceDossier into targetDossier:
 *  - Reassign all child records to target (single transaction)
 *  - Archive the source dossier
 *  - Write a dossier_merged timeline event on target
 */
export async function mergeDossiers(
  targetDossierId: string,
  sourceDossierId: string,
): Promise<InvestigatorDossier> {
  if (targetDossierId === sourceDossierId) {
    throw conflict("Cannot merge a dossier with itself");
  }

  const tenantId = getActiveTenantId();
  const [target, source] = await Promise.all([
    dossierRepo.findById(targetDossierId),
    dossierRepo.findById(sourceDossierId),
  ]);
  if (!target) throw notFound("Target dossier not found");
  if (!source) throw notFound("Source dossier not found");

  const now = new Date().toISOString();
  const nowSec = Math.floor(Date.now() / 1000);

  db.transaction((tx) => {
    // 1. Dossier-job links: delete source rows that would violate the unique
    //    constraint (target already has the same job linked).
    tx.delete(investigatorDossierJobs)
      .where(
        and(
          eq(investigatorDossierJobs.tenantId, tenantId),
          eq(investigatorDossierJobs.dossierId, sourceDossierId),
          sql`EXISTS (
            SELECT 1 FROM investigator_dossier_jobs idj2
            WHERE idj2.tenant_id = ${tenantId}
              AND idj2.dossier_id = ${targetDossierId}
              AND idj2.job_id = investigator_dossier_jobs.job_id
          )`,
        ),
      )
      .run();

    // 2. Reassign remaining dossier-job links.
    tx.update(investigatorDossierJobs)
      .set({ dossierId: targetDossierId, updatedAt: now })
      .where(
        and(
          eq(investigatorDossierJobs.tenantId, tenantId),
          eq(investigatorDossierJobs.dossierId, sourceDossierId),
        ),
      )
      .run();

    // 3. Reassign sources.
    tx.update(investigatorSources)
      .set({ dossierId: targetDossierId, updatedAt: now })
      .where(
        and(
          eq(investigatorSources.tenantId, tenantId),
          eq(investigatorSources.dossierId, sourceDossierId),
        ),
      )
      .run();

    // 4. Reassign people.
    tx.update(investigatorPeople)
      .set({ dossierId: targetDossierId, updatedAt: now })
      .where(
        and(
          eq(investigatorPeople.tenantId, tenantId),
          eq(investigatorPeople.dossierId, sourceDossierId),
        ),
      )
      .run();

    // 5. Reassign salary observations.
    tx.update(investigatorSalaryObservations)
      .set({ dossierId: targetDossierId, updatedAt: now })
      .where(
        and(
          eq(investigatorSalaryObservations.tenantId, tenantId),
          eq(investigatorSalaryObservations.dossierId, sourceDossierId),
        ),
      )
      .run();

    // 6. Reassign summaries.
    tx.update(investigatorSummaries)
      .set({ dossierId: targetDossierId, updatedAt: now })
      .where(
        and(
          eq(investigatorSummaries.tenantId, tenantId),
          eq(investigatorSummaries.dossierId, sourceDossierId),
        ),
      )
      .run();

    // 7. Reassign research runs.
    tx.update(investigatorResearchRuns)
      .set({ dossierId: targetDossierId, updatedAt: now })
      .where(
        and(
          eq(investigatorResearchRuns.tenantId, tenantId),
          eq(investigatorResearchRuns.dossierId, sourceDossierId),
        ),
      )
      .run();

    // 8. Reassign timeline events.
    tx.update(investigatorTimelineEvents)
      .set({ dossierId: targetDossierId, updatedAt: now })
      .where(
        and(
          eq(investigatorTimelineEvents.tenantId, tenantId),
          eq(investigatorTimelineEvents.dossierId, sourceDossierId),
        ),
      )
      .run();

    // 9. Archive the source dossier.
    tx.update(investigatorDossiers)
      .set({ status: "archived", updatedAt: now })
      .where(
        and(
          eq(investigatorDossiers.tenantId, tenantId),
          eq(investigatorDossiers.id, sourceDossierId),
        ),
      )
      .run();

    // 10. Write dossier_merged timeline event on target.
    tx.insert(investigatorTimelineEvents)
      .values({
        id: randomUUID(),
        tenantId,
        dossierId: targetDossierId,
        runId: null,
        eventType: "dossier_merged",
        payload: {
          sourceDossierId,
          sourceCompanyName: source.companyName,
        },
        occurredAt: nowSec,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  const updated = await dossierRepo.findById(targetDossierId);
  if (!updated) throw notFound("Target dossier not found after merge");
  return updated;
}
