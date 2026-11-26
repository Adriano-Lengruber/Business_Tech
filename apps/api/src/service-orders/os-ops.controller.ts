import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  and,
  auditLogs,
  desc,
  eq,
  isNull,
  serviceOrderEvents,
  serviceOrders,
  serviceOrderTimeEntries,
} from '@al/database';
import { saveOsSignatureSchema, startOsTimerSchema } from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';

@ApiTags('Bancada — Cronômetro & Assinatura Digital')
@ApiBearerAuth()
@RequireModule('mod-service-orders')
@Controller('service-orders/:osId')
export class OsOpsController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Post('signature')
  @RequirePermission('os:write')
  @ApiOperation({
    summary: 'Salvar assinatura digital canvas do cliente (recebimento/entrega)',
  })
  saveSignature(
    @Param('osId') osId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = saveOsSignatureSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [os] = await tx
        .select({ id: serviceOrders.id, code: serviceOrders.code })
        .from(serviceOrders)
        .where(eq(serviceOrders.id, osId))
        .limit(1);

      if (!os) {
        throw new NotFoundException('OS não encontrada.');
      }

      const signedAt = new Date();
      const [updated] = await tx
        .update(serviceOrders)
        .set({
          signatureDataUrl: parsed.data.signatureDataUrl,
          signatureSignedAt: signedAt,
          updatedAt: signedAt,
        })
        .where(eq(serviceOrders.id, osId))
        .returning({
          id: serviceOrders.id,
          signatureSignedAt: serviceOrders.signatureSignedAt,
        });

      await tx.insert(serviceOrderEvents).values({
        organizationId: user.organizationId,
        serviceOrderId: osId,
        eventType: 'repair.signature_captured',
        note: 'Assinatura digital coletada no balcão/dispositivo.',
        actorType: 'human',
        actorId: user.userId,
      });

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'service_order.signature_captured',
        entityType: 'service_order',
        entityId: osId,
        afterState: { code: os.code, signedAt: signedAt.toISOString() },
      });

      return updated!;
    });
  }

  @Get('timers')
  @RequirePermission('os:read')
  @ApiOperation({
    summary: 'Listar apontamentos de tempo ativo vs. espera da OS',
  })
  listTimers(
    @Param('osId') osId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.database.withTenant(user.organizationId, async (tx) => {
      const entries = await tx
        .select()
        .from(serviceOrderTimeEntries)
        .where(eq(serviceOrderTimeEntries.serviceOrderId, osId))
        .orderBy(desc(serviceOrderTimeEntries.startedAt));

      const runningEntry = entries.find((e) => !e.endedAt) ?? null;
      const activeSeconds = entries
        .filter((e) => e.mode === 'active_bench')
        .reduce((acc, e) => acc + e.durationSeconds, 0);
      const waitSeconds = entries
        .filter((e) => e.mode !== 'active_bench')
        .reduce((acc, e) => acc + e.durationSeconds, 0);

      return {
        entries,
        runningEntry,
        activeMinutes: Math.round(activeSeconds / 60),
        waitMinutes: Math.round(waitSeconds / 60),
      };
    });
  }

  @Post('timers/start')
  @RequirePermission('os:write')
  @ApiOperation({
    summary: 'Iniciar cronômetro de bancada (ativo) ou espera (cliente/peça)',
  })
  startTimer(
    @Param('osId') osId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = startOsTimerSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [os] = await tx
        .select({ id: serviceOrders.id })
        .from(serviceOrders)
        .where(eq(serviceOrders.id, osId))
        .limit(1);

      if (!os) {
        throw new NotFoundException('OS não encontrada.');
      }

      const now = new Date();
      // Fecha eventual timer em aberto antes de abrir o novo
      const openRows = await tx
        .select()
        .from(serviceOrderTimeEntries)
        .where(
          and(
            eq(serviceOrderTimeEntries.serviceOrderId, osId),
            isNull(serviceOrderTimeEntries.endedAt),
          ),
        );

      for (const open of openRows) {
        const elapsed = Math.max(
          1,
          Math.round((now.getTime() - open.startedAt.getTime()) / 1000),
        );
        await tx
          .update(serviceOrderTimeEntries)
          .set({ endedAt: now, durationSeconds: elapsed })
          .where(eq(serviceOrderTimeEntries.id, open.id));
      }

      const [started] = await tx
        .insert(serviceOrderTimeEntries)
        .values({
          organizationId: user.organizationId,
          serviceOrderId: osId,
          userId: user.userId,
          mode: parsed.data.mode,
          startedAt: now,
          note: parsed.data.note?.trim() || null,
        })
        .returning();

      return started!;
    });
  }

  @Post('timers/stop')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Pausar/encerrar cronômetro em andamento na OS' })
  stopTimer(
    @Param('osId') osId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.database.withTenant(user.organizationId, async (tx) => {
      const openRows = await tx
        .select()
        .from(serviceOrderTimeEntries)
        .where(
          and(
            eq(serviceOrderTimeEntries.serviceOrderId, osId),
            isNull(serviceOrderTimeEntries.endedAt),
          ),
        );

      const now = new Date();
      const stopped = [];
      for (const open of openRows) {
        const elapsed = Math.max(
          1,
          Math.round((now.getTime() - open.startedAt.getTime()) / 1000),
        );
        const [row] = await tx
          .update(serviceOrderTimeEntries)
          .set({ endedAt: now, durationSeconds: elapsed })
          .where(eq(serviceOrderTimeEntries.id, open.id))
          .returning();
        stopped.push(row!);
      }

      return { stoppedCount: stopped.length, stopped };
    });
  }
}
