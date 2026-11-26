import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  auditLogs,
  desc,
  eq,
  filaments,
  print3dJobs,
  sql,
} from '@al/database';
import {
  calculate3dPrintQuote,
  type CreateFilamentInput,
  type CreatePrint3dJobInput,
  type UpdatePrint3dStatusInput,
} from '@al/shared';
import { DatabaseService } from '../database/database.module';
import { StorageService } from '../storage/storage.module';

@Injectable()
export class Print3dService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  listFilaments(organizationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx.select().from(filaments).orderBy(desc(filaments.createdAt)),
    );
  }

  async createFilament(
    organizationId: string,
    userId: string,
    input: CreateFilamentInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [fil] = await tx
        .insert(filaments)
        .values({
          organizationId,
          name: input.name.trim(),
          materialType: input.materialType,
          color: input.color.trim(),
          brand: input.brand?.trim() || null,
          costPerKgCents: input.costPerKgCents,
          stockGrams: input.stockGrams,
          minGrams: input.minGrams,
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'filament.created',
        entityType: 'filament',
        entityId: fil!.id,
      });

      return fil!;
    });
  }

  listJobs(organizationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select({
          id: print3dJobs.id,
          code: print3dJobs.code,
          modelName: print3dJobs.modelName,
          stlStorageKey: print3dJobs.stlStorageKey,
          status: print3dJobs.status,
          weightGrams: print3dJobs.weightGrams,
          printTimeMinutes: print3dJobs.printTimeMinutes,
          totalCostCents: print3dJobs.totalCostCents,
          salePriceCents: print3dJobs.salePriceCents,
          notes: print3dJobs.notes,
          createdAt: print3dJobs.createdAt,
          filamentName: filaments.name,
          filamentMaterial: filaments.materialType,
          filamentColor: filaments.color,
        })
        .from(print3dJobs)
        .innerJoin(filaments, eq(print3dJobs.filamentId, filaments.id))
        .orderBy(desc(print3dJobs.createdAt))
        .limit(50),
    );
  }

  async createJob(
    organizationId: string,
    userId: string,
    input: CreatePrint3dJobInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [fil] = await tx
        .select()
        .from(filaments)
        .where(eq(filaments.id, input.filamentId))
        .limit(1);

      if (!fil) {
        throw new NotFoundException('Filamento não encontrado.');
      }

      const quote = calculate3dPrintQuote({
        weightGrams: input.weightGrams,
        printTimeMinutes: input.printTimeMinutes,
        filamentCostPerKgCents: fil.costPerKgCents,
        profitMarginPercent: input.profitMarginPercent,
      });

      const countRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(print3dJobs);
      const nextNum = (countRes[0]?.count ?? 0) + 1;
      const code = `3D-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

      const [job] = await tx
        .insert(print3dJobs)
        .values({
          organizationId,
          customerId: input.customerId ?? null,
          filamentId: fil.id,
          code,
          modelName: input.modelName.trim(),
          status: 'QUEUED',
          weightGrams: input.weightGrams,
          printTimeMinutes: input.printTimeMinutes,
          totalCostCents: quote.totalCostCents,
          salePriceCents: quote.suggestedPriceCents,
          notes: input.notes?.trim() || null,
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'print3d_job.created',
        entityType: 'print_3d_job',
        entityId: job!.id,
        afterState: { code, salePriceCents: job!.salePriceCents },
      });

      return { ...job!, breakdown: quote };
    });
  }

  async attachStl(
    organizationId: string,
    jobId: string,
    filename: string,
    buffer: Buffer,
  ) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `3D/${organizationId}/${jobId}/${Date.now()}-${safeName}`;
    await this.storage.uploadObject({
      key: storageKey,
      body: buffer,
      contentType: 'application/octet-stream',
    });

    return this.database.withTenant(organizationId, async (tx) => {
      const [updated] = await tx
        .update(print3dJobs)
        .set({ stlStorageKey: storageKey, updatedAt: new Date() })
        .where(eq(print3dJobs.id, jobId))
        .returning();
      if (!updated) throw new NotFoundException('Job 3D não encontrado.');
      return updated;
    });
  }

  async updateJobStatus(
    organizationId: string,
    jobId: string,
    userId: string,
    input: UpdatePrint3dStatusInput,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [job] = await tx
        .select()
        .from(print3dJobs)
        .where(eq(print3dJobs.id, jobId))
        .limit(1);
      if (!job) throw new NotFoundException('Job 3D não encontrado.');

      // Ao iniciar impressão (QUEUED -> PRINTING), deduz gramas do filamento
      if (job.status === 'QUEUED' && input.status === 'PRINTING') {
        const [fil] = await tx
          .select()
          .from(filaments)
          .where(eq(filaments.id, job.filamentId))
          .limit(1);

        if (!fil || fil.stockGrams < job.weightGrams) {
          throw new BadRequestException(
            `Filamento insuficiente (disponível: ${fil?.stockGrams ?? 0}g, necessário: ${job.weightGrams}g).`,
          );
        }

        await tx
          .update(filaments)
          .set({ stockGrams: fil.stockGrams - job.weightGrams })
          .where(eq(filaments.id, fil.id));
      }

      const [updated] = await tx
        .update(print3dJobs)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(print3dJobs.id, jobId))
        .returning();

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'print3d_job.status_changed',
        entityType: 'print_3d_job',
        entityId: jobId,
        beforeState: { status: job.status },
        afterState: { status: input.status },
      });

      return updated!;
    });
  }
}
