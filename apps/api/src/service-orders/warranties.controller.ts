import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  auditLogs,
  customers,
  desc,
  eq,
  serviceOrderEvents,
  serviceOrders,
  sql,
  warrantyCases,
} from '@al/database';
import {
  createWarrantyCaseSchema,
  updateWarrantyStatusSchema,
} from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';

@ApiTags('Garantias & RMA')
@ApiBearerAuth()
@RequireModule('mod-service-orders')
@Controller()
export class WarrantiesController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get('warranties')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar todas as garantias e RMAs ativos do tenant' })
  listAll(@CurrentUser() user: AuthenticatedUser) {
    return this.database.withTenant(user.organizationId, (tx) =>
      tx
        .select({
          warranty: warrantyCases,
          customerName: customers.name,
          osCode: serviceOrders.code,
        })
        .from(warrantyCases)
        .innerJoin(customers, eq(warrantyCases.customerId, customers.id))
        .innerJoin(
          serviceOrders,
          eq(warrantyCases.serviceOrderId, serviceOrders.id),
        )
        .orderBy(desc(warrantyCases.createdAt))
        .limit(50),
    );
  }

  @Get('service-orders/:osId/warranties')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar garantias e retornos RMA vinculados à OS' })
  listByOs(
    @Param('osId') osId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.database.withTenant(user.organizationId, (tx) =>
      tx
        .select()
        .from(warrantyCases)
        .where(eq(warrantyCases.serviceOrderId, osId))
        .orderBy(desc(warrantyCases.createdAt)),
    );
  }

  @Post('service-orders/:osId/warranties')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Registrar garantia de serviço ou RMA de peça na OS' })
  createForOs(
    @Param('osId') osId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = createWarrantyCaseSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [os] = await tx
        .select()
        .from(serviceOrders)
        .where(eq(serviceOrders.id, osId))
        .limit(1);

      if (!os) {
        throw new NotFoundException('OS não encontrada.');
      }

      const countRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(warrantyCases);
      const nextNum = (countRes[0]?.count ?? 0) + 1;
      const code = `GAR-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;
      const expiresAt = new Date(Date.now() + input.warrantyDays * 86400000);

      const [created] = await tx
        .insert(warrantyCases)
        .values({
          organizationId: user.organizationId,
          serviceOrderId: osId,
          assetId: os.assetId,
          customerId: os.customerId,
          code,
          kind: input.kind,
          status: 'ACTIVE',
          warrantyDays: input.warrantyDays,
          expiresAt,
          supplierName: input.supplierName?.trim() || null,
          partDescription: input.partDescription?.trim() || null,
          notes: input.notes?.trim() || null,
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'warranty.created',
        entityType: 'warranty_case',
        entityId: created!.id,
        afterState: { code, osCode: os.code, days: input.warrantyDays },
      });

      return created!;
    });
  }

  @Patch('warranties/:id/status')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Acionar garantia / atualizar status RMA com impacto na OS' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = updateWarrantyStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(warrantyCases)
        .where(eq(warrantyCases.id, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException('Registro de garantia não encontrado.');
      }

      const [updated] = await tx
        .update(warrantyCases)
        .set({
          status: input.status,
          resolutionNotes: input.resolutionNotes?.trim() || existing.resolutionNotes,
          updatedAt: new Date(),
        })
        .where(eq(warrantyCases.id, id))
        .returning();

      if (input.status === 'CLAIMED') {
        await tx
          .update(serviceOrders)
          .set({ status: 'WARRANTY', updatedAt: new Date() })
          .where(eq(serviceOrders.id, existing.serviceOrderId));

        await tx.insert(serviceOrderEvents).values({
          organizationId: user.organizationId,
          serviceOrderId: existing.serviceOrderId,
          eventType: 'warranty.claimed',
          toStatus: 'WARRANTY',
          note: `Garantia ${existing.code} acionada: ${input.resolutionNotes?.trim() || 'Retorno em análise'}`,
          actorType: 'human',
          actorId: user.userId,
        });
      }

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'warranty.status_changed',
        entityType: 'warranty_case',
        entityId: id,
        beforeState: { status: existing.status },
        afterState: { status: input.status },
      });

      return updated!;
    });
  }
}
