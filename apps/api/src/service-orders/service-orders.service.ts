import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  and,
  assets,
  auditLogs,
  conversations,
  customers,
  desc,
  eq,
  financialTransactions,
  hardwareDiagnosticSnapshots,
  inArray,
  organizations,
  osDiagnostics,
  quoteItems,
  quotes,
  serviceOrderAttachments,
  serviceOrderEvents,
  serviceOrders,
  sql,
} from '@al/database';
import type {
  CreateServiceOrderInput,
  UpdateServiceOrderStatusInput,
} from '@al/shared';
import { appEnv } from '../config/env';
import { decryptSecret, encryptSecret } from '../common/crypto/encryption';
import { DatabaseService } from '../database/database.module';
import { StorageService } from '../storage/storage.module';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { IntakePdfService } from './intake-pdf.service';

@Injectable()
export class ServiceOrdersService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(WhatsappService) private readonly whatsapp: WhatsappService,
    @Inject(IntakePdfService) private readonly pdfService: IntakePdfService,
  ) {}

  async list(organizationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select({
          id: serviceOrders.id,
          code: serviceOrders.code,
          status: serviceOrders.status,
          priority: serviceOrders.priority,
          reportedSymptoms: serviceOrders.reportedSymptoms,
          preliminaryDiagnosis: serviceOrders.preliminaryDiagnosis,
          createdAt: serviceOrders.createdAt,
          customerId: customers.id,
          customerName: customers.name,
          customerPhone: customers.phoneE164,
          assetModel: assets.model,
          assetBrand: assets.brand,
          assetQrToken: assets.qrToken,
        })
        .from(serviceOrders)
        .innerJoin(customers, eq(serviceOrders.customerId, customers.id))
        .leftJoin(assets, eq(serviceOrders.assetId, assets.id))
        .orderBy(desc(serviceOrders.createdAt))
        .limit(50),
    );
  }

  async getDashboardQueue(organizationId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const osRows = await tx
        .select({
          status: serviceOrders.status,
          priority: serviceOrders.priority,
        })
        .from(serviceOrders);

      const waitingHumanRows = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.botState, 'WAITING_HUMAN'));

      return {
        waitingHumanCount: waitingHumanRows.length,
        urgentCount: osRows.filter(
          (r) => r.priority === 'URGENT' || r.priority === 'HIGH',
        ).length,
        inBenchCount: osRows.filter((r) =>
          ['RECEIVED', 'TRIAGE', 'DIAGNOSIS', 'IN_REPAIR', 'TESTING'].includes(
            r.status,
          ),
        ).length,
        readyForPickupCount: osRows.filter((r) =>
          ['READY', 'AWAITING_PICKUP'].includes(r.status),
        ).length,
      };
    });
  }

  async getById(organizationId: string, id: string) {
    const result = await this.database.withTenant(organizationId, async (tx) => {
      const rows = await tx
        .select({
          os: serviceOrders,
          customer: customers,
          asset: assets,
          orgName: organizations.name,
        })
        .from(serviceOrders)
        .innerJoin(customers, eq(serviceOrders.customerId, customers.id))
        .innerJoin(organizations, eq(serviceOrders.organizationId, organizations.id))
        .leftJoin(assets, eq(serviceOrders.assetId, assets.id))
        .where(eq(serviceOrders.id, id))
        .limit(1);

      if (!rows[0]) return null;

      const events = await tx
        .select()
        .from(serviceOrderEvents)
        .where(eq(serviceOrderEvents.serviceOrderId, id))
        .orderBy(desc(serviceOrderEvents.createdAt));

      const attachments = await tx
        .select()
        .from(serviceOrderAttachments)
        .where(eq(serviceOrderAttachments.serviceOrderId, id))
        .orderBy(desc(serviceOrderAttachments.createdAt));

      const { devicePasswordEncrypted, ...safeOs } = rows[0].os;

      return {
        ...rows[0],
        os: {
          ...safeOs,
          hasDevicePassword: Boolean(devicePasswordEncrypted),
        },
        events,
        attachments,
      };
    });

    if (!result) {
      throw new NotFoundException('Ordem de serviço não encontrada.');
    }

    const attachmentsWithUrls = await Promise.all(
      result.attachments.map(async (att) => {
        let signedUrl: string | null = null;
        try {
          signedUrl = await this.storage.getSignedDownloadUrl(att.storageKey);
        } catch {
          signedUrl = null;
        }
        return { ...att, signedUrl };
      }),
    );

    return { ...result, attachments: attachmentsWithUrls };
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateServiceOrderInput,
  ) {
    const portalToken = randomBytes(16).toString('hex');
    const portalTokenHash = createHash('sha256')
      .update(portalToken)
      .digest('hex');

    const created = await this.database.withTenant(organizationId, async (tx) => {
      const countResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(serviceOrders);
      const nextNum = (countResult[0]?.count ?? 0) + 1;
      const year = new Date().getFullYear();
      const code = `OS-${year}-${String(nextNum).padStart(4, '0')}`;

      const [os] = await tx
        .insert(serviceOrders)
        .values({
          organizationId,
          code,
          customerId: input.customerId,
          assetId: input.assetId ?? null,
          status: 'RECEIVED',
          priority: input.priority,
          reportedSymptoms: input.reportedSymptoms.trim(),
          preliminaryDiagnosis: input.preliminaryDiagnosis?.trim() || null,
          devicePasswordEncrypted: input.devicePassword?.trim()
            ? encryptSecret(input.devicePassword.trim())
            : null,
          devicePasswordHint: input.devicePasswordHint?.trim() || null,
          intakeChecklist: input.intakeChecklist,
          portalTokenHash,
          promisedAt: input.promisedAt ? new Date(input.promisedAt) : null,
        })
        .returning();

      const { devicePasswordEncrypted: _hiddenCipher, ...safeOs } = os!;

      await tx.insert(serviceOrderEvents).values({
        organizationId,
        serviceOrderId: os!.id,
        eventType: 'repair.received',
        toStatus: 'RECEIVED',
        note: 'Equipamento recebido no balcão.',
        actorType: 'human',
        actorId: userId,
      });

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'service_order.created',
        entityType: 'service_order',
        entityId: os!.id,
        afterState: { code: os!.code, status: os!.status, priority: os!.priority },
      });

      return {
        ...safeOs,
        hasDevicePassword: Boolean(_hiddenCipher),
      };
    });

    const portalUrl = `${appEnv.APP_URL}/portal/${created.code}?token=${portalToken}`;

    if (input.notifyWhatsapp) {
      await this.whatsapp
        .enqueueOsNotification({
          organizationId,
          serviceOrderId: created.id,
          eventType: 'repair.received',
          portalUrl,
        })
        .catch(() => undefined);
    }

    return {
      ...created,
      portalToken,
      portalUrl,
    };
  }

  async revealDevicePassword(
    organizationId: string,
    id: string,
    userId: string,
  ) {
    return this.database.withTenant(organizationId, async (tx) => {
      const [row] = await tx
        .select({
          id: serviceOrders.id,
          code: serviceOrders.code,
          devicePasswordEncrypted: serviceOrders.devicePasswordEncrypted,
          devicePasswordHint: serviceOrders.devicePasswordHint,
        })
        .from(serviceOrders)
        .where(eq(serviceOrders.id, id))
        .limit(1);

      if (!row) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }

      if (!row.devicePasswordEncrypted) {
        return {
          hasPassword: false,
          password: null,
          hint: row.devicePasswordHint ?? null,
        };
      }

      const password = decryptSecret(row.devicePasswordEncrypted);

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'service_order.password_revealed',
        entityType: 'service_order',
        entityId: id,
        afterState: { code: row.code },
        reason: 'Técnico visualizou credencial de desbloqueio em bancada',
      });

      return {
        hasPassword: true,
        password,
        hint: row.devicePasswordHint ?? null,
      };
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    userId: string,
    input: UpdateServiceOrderStatusInput,
  ) {
    const updated = await this.database.withTenant(organizationId, async (tx) => {
      const existing = await tx
        .select()
        .from(serviceOrders)
        .where(eq(serviceOrders.id, id))
        .limit(1);

      if (!existing[0]) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }

      const prev = existing[0];
      const [row] = await tx
        .update(serviceOrders)
        .set({
          status: input.status,
          updatedAt: new Date(),
          ...(input.status === 'DELIVERED' ? { closedAt: new Date() } : {}),
        })
        .where(eq(serviceOrders.id, id))
        .returning();

      await tx.insert(serviceOrderEvents).values({
        organizationId,
        serviceOrderId: id,
        eventType: 'repair.status_changed',
        fromStatus: prev.status,
        toStatus: input.status,
        note: input.note?.trim() || null,
        actorType: 'human',
        actorId: userId,
      });

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'service_order.status_changed',
        entityType: 'service_order',
        entityId: id,
        beforeState: { status: prev.status },
        afterState: { status: input.status },
        reason: input.note?.trim() || null,
      });

      return row!;
    });

    if (input.notifyWhatsapp) {
      await this.whatsapp
        .enqueueOsNotification({
          organizationId,
          serviceOrderId: id,
          eventType: 'repair.status_changed',
        })
        .catch(() => undefined);
    }

    return updated;
  }

  async addAttachment(params: {
    organizationId: string;
    serviceOrderId: string;
    filename: string;
    mimeType: string;
    buffer: Buffer;
    kind?: string;
  }) {
    const year = new Date().getFullYear();
    const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `OS/${year}/${params.serviceOrderId}/${Date.now()}-${safeName}`;

    await this.storage.uploadObject({
      key: storageKey,
      body: params.buffer,
      contentType: params.mimeType,
    });

    const record = await this.database.withTenant(
      params.organizationId,
      async (tx) => {
        const [att] = await tx
          .insert(serviceOrderAttachments)
          .values({
            organizationId: params.organizationId,
            serviceOrderId: params.serviceOrderId,
            kind: params.kind ?? 'intake_photo',
            filename: safeName,
            mimeType: params.mimeType,
            storageKey,
            sizeBytes: params.buffer.length,
          })
          .returning();
        return att!;
      },
    );

    const signedUrl = await this.storage
      .getSignedDownloadUrl(storageKey)
      .catch(() => null);

    return { ...record, signedUrl };
  }

  async generateIntakePdf(organizationId: string, id: string): Promise<{
    code: string;
    buffer: Buffer;
  }> {
    const detail = await this.getById(organizationId, id);
    const buffer = await this.pdfService.generate({
      orgName: detail.orgName,
      osCode: detail.os.code,
      status: detail.os.status,
      priority: detail.os.priority,
      createdAt: detail.os.createdAt,
      customerName: detail.customer.name,
      customerPhone: detail.customer.phoneE164,
      assetCategory: detail.asset?.category,
      assetBrand: detail.asset?.brand,
      assetModel: detail.asset?.model,
      assetSerial: detail.asset?.serialNumber,
      assetQrToken: detail.asset?.qrToken,
      reportedSymptoms: detail.os.reportedSymptoms,
      preliminaryDiagnosis: detail.os.preliminaryDiagnosis,
      intakeChecklist: detail.os.intakeChecklist,
    });

    return { code: detail.os.code, buffer };
  }

  async getPublicPortalView(code: string, token: string) {
    if (!token) {
      throw new UnauthorizedException('Token do portal obrigatório.');
    }
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const [match] = await this.database.db
      .select({
        id: serviceOrders.id,
        organizationId: serviceOrders.organizationId,
      })
      .from(serviceOrders)
      .where(
        and(
          eq(serviceOrders.code, code),
          eq(serviceOrders.portalTokenHash, tokenHash),
        ),
      )
      .limit(1);

    if (!match) {
      throw new UnauthorizedException('Link do portal inválido ou expirado.');
    }

    const detail = await this.getById(match.organizationId, match.id);

    const extras = await this.database.withTenant(match.organizationId, async (tx) => {
      const [latestDiag] = await tx
        .select({
          finalDiagnosis: osDiagnostics.finalDiagnosis,
          clientExplanation: osDiagnostics.clientExplanation,
          updatedAt: osDiagnostics.updatedAt,
        })
        .from(osDiagnostics)
        .where(eq(osDiagnostics.serviceOrderId, match.id))
        .orderBy(desc(osDiagnostics.createdAt))
        .limit(1);

      const portalQuotes = await tx
        .select()
        .from(quotes)
        .where(
          and(
            eq(quotes.serviceOrderId, match.id),
            inArray(quotes.status, ['SENT', 'APPROVED', 'REJECTED']),
          ),
        )
        .orderBy(desc(quotes.createdAt));

      const qItems =
        portalQuotes.length > 0
          ? await tx
              .select()
              .from(quoteItems)
              .where(
                inArray(
                  quoteItems.quoteId,
                  portalQuotes.map((q) => q.id),
                ),
              )
          : [];

      const payments = await tx
        .select({
          id: financialTransactions.id,
          description: financialTransactions.description,
          status: financialTransactions.status,
          amountCents: financialTransactions.amountCents,
          paymentMethod: financialTransactions.paymentMethod,
          pixCopyPaste: financialTransactions.pixCopyPaste,
          dueDate: financialTransactions.dueDate,
        })
        .from(financialTransactions)
        .where(eq(financialTransactions.serviceOrderId, match.id))
        .orderBy(desc(financialTransactions.createdAt));

      const hwSnaps = await tx
        .select({
          stage: hardwareDiagnosticSnapshots.stage,
          ramGb: hardwareDiagnosticSnapshots.ramGb,
          storageSummary: hardwareDiagnosticSnapshots.storageSummary,
          smartHealthPct: hardwareDiagnosticSnapshots.smartHealthPct,
          cpuTempCelsius: hardwareDiagnosticSnapshots.cpuTempCelsius,
        })
        .from(hardwareDiagnosticSnapshots)
        .where(eq(hardwareDiagnosticSnapshots.serviceOrderId, match.id))
        .orderBy(desc(hardwareDiagnosticSnapshots.createdAt));

      const beforeHw = hwSnaps.find((s) => s.stage === 'BEFORE') ?? null;
      const afterHw = hwSnaps.find((s) => s.stage === 'AFTER') ?? null;

      return {
        latestDiag: latestDiag ?? null,
        hardwareComparison:
          beforeHw || afterHw ? { before: beforeHw, after: afterHw } : null,
        quotes: portalQuotes.map((q) => ({
          id: q.id,
          code: q.code,
          tier: q.tier,
          status: q.status,
          warrantyDays: q.warrantyDays,
          validUntil: q.validUntil,
          paymentTerms: q.paymentTerms,
          clientNotes: q.clientNotes,
          subtotalCents: q.subtotalCents,
          discountCents: q.discountCents,
          totalCents: q.totalCents,
          acceptedAt: q.acceptedAt,
          acceptanceHash: q.acceptanceHash,
          items: qItems
            .filter((i) => i.quoteId === q.id)
            .map((i) => ({
              id: i.id,
              itemType: i.itemType,
              description: i.description,
              quantity: i.quantity,
              unitPriceCents: i.unitPriceCents,
              totalPriceCents: i.totalPriceCents,
            })),
        })),
        payments,
      };
    });

    return {
      organizationName: detail.orgName,
      code: detail.os.code,
      status: detail.os.status,
      priority: detail.os.priority,
      reportedSymptoms: detail.os.reportedSymptoms,
      preliminaryDiagnosis: detail.os.preliminaryDiagnosis,
      promisedAt: detail.os.promisedAt,
      createdAt: detail.os.createdAt,
      customerFirstName: detail.customer.name.split(' ')[0],
      asset: detail.asset
        ? {
            category: detail.asset.category,
            brand: detail.asset.brand,
            model: detail.asset.model,
            qrToken: detail.asset.qrToken,
          }
        : null,
      diagnostic: extras.latestDiag,
      hardwareComparison: extras.hardwareComparison,
      quotes: extras.quotes,
      payments: extras.payments,
      events: detail.events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        note: e.note,
        createdAt: e.createdAt,
      })),
      attachments: detail.attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        signedUrl: a.signedUrl,
      })),
    };
  }
}
