import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import {
  assets,
  auditLogs,
  customers,
  desc,
  eq,
  hardwareDiagnosticSnapshots,
  organizations,
  osDiagnostics,
  serviceOrders,
} from '@al/database';
import { createHardwareSnapshotSchema } from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';
import { DiagnosticReportPdfService } from './diagnostic-report-pdf.service';

@ApiTags('Diagnóstico Técnico Comparativo')
@ApiBearerAuth()
@RequireModule('mod-service-orders')
@Controller('service-orders/:osId')
export class HardwareSnapshotsController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(DiagnosticReportPdfService)
    private readonly reportPdf: DiagnosticReportPdfService,
  ) {}

  @Get('hardware-snapshots')
  @RequirePermission('os:read')
  @ApiOperation({
    summary: 'Listar snapshots Antes/Depois de hardware e diff comparativo da OS',
  })
  async listSnapshots(
    @Param('osId') osId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.database.withTenant(user.organizationId, async (tx) => {
      const snapshots = await tx
        .select()
        .from(hardwareDiagnosticSnapshots)
        .where(eq(hardwareDiagnosticSnapshots.serviceOrderId, osId))
        .orderBy(desc(hardwareDiagnosticSnapshots.createdAt));

      const before = snapshots.find((s) => s.stage === 'BEFORE') ?? null;
      const after = snapshots.find((s) => s.stage === 'AFTER') ?? null;

      return {
        snapshots,
        before,
        after,
        diff: {
          ramDeltaGb:
            before?.ramGb != null && after?.ramGb != null
              ? after.ramGb - before.ramGb
              : null,
          tempDeltaCelsius:
            before?.cpuTempCelsius != null && after?.cpuTempCelsius != null
              ? after.cpuTempCelsius - before.cpuTempCelsius
              : null,
          smartDeltaPct:
            before?.smartHealthPct != null && after?.smartHealthPct != null
              ? after.smartHealthPct - before.smartHealthPct
              : null,
          storageChanged:
            before?.storageSummary && after?.storageSummary
              ? before.storageSummary !== after.storageSummary
              : false,
        },
      };
    });
  }

  @Post('hardware-snapshots')
  @RequirePermission('os:write')
  @ApiOperation({
    summary: 'Registrar snapshot estruturado de hardware (Antes ou Depois do reparo)',
  })
  async createSnapshot(
    @Param('osId') osId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = createHardwareSnapshotSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [os] = await tx
        .select({ id: serviceOrders.id, assetId: serviceOrders.assetId, code: serviceOrders.code })
        .from(serviceOrders)
        .where(eq(serviceOrders.id, osId))
        .limit(1);

      if (!os) {
        throw new NotFoundException('OS não encontrada.');
      }

      const [snapshot] = await tx
        .insert(hardwareDiagnosticSnapshots)
        .values({
          organizationId: user.organizationId,
          serviceOrderId: osId,
          assetId: os.assetId,
          stage: input.stage,
          source: input.source,
          cpuModel: input.cpuModel?.trim() || null,
          ramGb: input.ramGb ?? null,
          storageSummary: input.storageSummary?.trim() || null,
          smartHealthPct: input.smartHealthPct ?? null,
          batteryHealthPct: input.batteryHealthPct ?? null,
          osVersion: input.osVersion?.trim() || null,
          cpuTempCelsius: input.cpuTempCelsius ?? null,
          notes: input.notes?.trim() || null,
          capturedByUserId: user.userId,
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'hardware_snapshot.recorded',
        entityType: 'service_order',
        entityId: osId,
        afterState: {
          osCode: os.code,
          stage: input.stage,
          ramGb: input.ramGb,
          cpuTempCelsius: input.cpuTempCelsius,
        },
      });

      return snapshot!;
    });
  }

  @Get('diagnostic-report-pdf')
  @RequirePermission('os:read')
  @ApiOperation({
    summary: 'Gerar Certificado de Bancada & Laudo Técnico Comparativo em PDF',
  })
  async downloadReportPdf(
    @Param('osId') osId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() reply: FastifyReply,
  ) {
    const report = await this.database.withTenant(
      user.organizationId,
      async (tx) => {
        const [osRow] = await tx
          .select({
            os: serviceOrders,
            customerName: customers.name,
            orgName: organizations.name,
            asset: assets,
          })
          .from(serviceOrders)
          .innerJoin(customers, eq(serviceOrders.customerId, customers.id))
          .innerJoin(
            organizations,
            eq(serviceOrders.organizationId, organizations.id),
          )
          .leftJoin(assets, eq(serviceOrders.assetId, assets.id))
          .where(eq(serviceOrders.id, osId))
          .limit(1);

        if (!osRow) return null;

        const snapshots = await tx
          .select()
          .from(hardwareDiagnosticSnapshots)
          .where(eq(hardwareDiagnosticSnapshots.serviceOrderId, osId))
          .orderBy(desc(hardwareDiagnosticSnapshots.createdAt));

        const [latestDiag] = await tx
          .select()
          .from(osDiagnostics)
          .where(eq(osDiagnostics.serviceOrderId, osId))
          .orderBy(desc(osDiagnostics.createdAt))
          .limit(1);

        return {
          osRow,
          before: snapshots.find((s) => s.stage === 'BEFORE') ?? null,
          after: snapshots.find((s) => s.stage === 'AFTER') ?? null,
          latestDiag: latestDiag ?? null,
        };
      },
    );

    if (!report) {
      throw new NotFoundException('OS não encontrada.');
    }

    const assetLabel = report.osRow.asset
      ? [
          report.osRow.asset.category,
          report.osRow.asset.brand,
          report.osRow.asset.model,
        ]
          .filter(Boolean)
          .join(' — ')
      : 'Equipamento geral';

    const buffer = await this.reportPdf.generate({
      orgName: report.osRow.orgName,
      osCode: report.osRow.os.code,
      customerName: report.osRow.customerName,
      assetLabel,
      assetSerial: report.osRow.asset?.serialNumber ?? null,
      assetQrToken: report.osRow.asset?.qrToken ?? null,
      before: report.before,
      after: report.after,
      diagnosis: report.latestDiag
        ? {
            observedFacts: report.latestDiag.observedFacts,
            finalDiagnosis: report.latestDiag.finalDiagnosis,
            clientExplanation: report.latestDiag.clientExplanation,
            testsPerformed: report.latestDiag.testsPerformed,
          }
        : null,
    });

    return reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `inline; filename="${report.osRow.os.code}-laudo-comparativo.pdf"`,
      )
      .send(buffer);
  }
}
