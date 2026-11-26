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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { assets, auditLogs, customers, desc, eq } from '@al/database';
import { createAssetSchema, updateAssetVipSchema } from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';

@ApiTags('Equipamentos / Ativos')
@ApiBearerAuth()
@RequireModule('mod-service-orders')
@Controller('assets')
export class AssetsController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar equipamentos/ativos (opcional por customerId)' })
  async list(
    @Query('customerId') customerId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.database.withTenant(user.organizationId, (tx) => {
      const base = tx
        .select()
        .from(assets)
        .orderBy(desc(assets.createdAt))
        .limit(50);
      if (customerId) {
        return tx
          .select()
          .from(assets)
          .where(eq(assets.customerId, customerId))
          .orderBy(desc(assets.createdAt));
      }
      return base;
    });
  }

  @Get('qr/:qrToken')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Buscar ativo e proprietário pelo token de QR Code' })
  async findByQr(
    @Param('qrToken') qrToken: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const rows = await this.database.withTenant(user.organizationId, (tx) =>
      tx
        .select({
          asset: assets,
          customerName: customers.name,
          customerPhone: customers.phoneE164,
        })
        .from(assets)
        .innerJoin(customers, eq(assets.customerId, customers.id))
        .where(eq(assets.qrToken, qrToken))
        .limit(1),
    );

    if (!rows[0]) {
      throw new NotFoundException('Equipamento não encontrado para este QR Code.');
    }
    const qrDataUrl = await QRCode.toDataURL(qrToken, { margin: 1, width: 160 });
    return { ...rows[0], qrDataUrl };
  }

  @Post()
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Cadastrar equipamento/ativo com geração automática de QR Token' })
  async create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createAssetSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const input = parsed.data;
    const qrToken = `qr-al-${randomBytes(5).toString('hex')}`;

    const created = await this.database.withTenant(user.organizationId, async (tx) => {
      const [asset] = await tx
        .insert(assets)
        .values({
          organizationId: user.organizationId,
          customerId: input.customerId,
          category: input.category.trim(),
          brand: input.brand?.trim() || null,
          model: input.model?.trim() || null,
          serialNumber: input.serialNumber?.trim() || null,
          qrToken,
          acquiredFromStore: input.acquiredFromStore,
          purchasedAt: input.acquiredFromStore ? new Date() : null,
          storeSaleRef: input.storeSaleRef?.trim() || null,
          vipDiscountPct: input.acquiredFromStore
            ? input.vipDiscountPct || 20
            : input.vipDiscountPct,
          specs: input.specs,
        })
        .returning();

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'asset.created',
        entityType: 'asset',
        entityId: asset!.id,
        afterState: { category: asset!.category, model: asset!.model, qrToken },
      });

      return asset!;
    });

    const qrDataUrl = await QRCode.toDataURL(qrToken, { margin: 1, width: 160 });
    return { ...created, qrDataUrl };
  }

  @Patch(':id/vip')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Marcar equipamento como adquirido na loja (Paciente VIP e desconto)' })
  async updateVipStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = updateAssetVipSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(assets)
        .where(eq(assets.id, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException('Equipamento não encontrado.');
      }

      const [updated] = await tx
        .update(assets)
        .set({
          acquiredFromStore: input.acquiredFromStore,
          storeSaleRef: input.storeSaleRef?.trim() || existing.storeSaleRef,
          vipDiscountPct: input.acquiredFromStore ? input.vipDiscountPct : 0,
          purchasedAt:
            input.acquiredFromStore && !existing.purchasedAt
              ? new Date()
              : existing.purchasedAt,
        })
        .where(eq(assets.id, id))
        .returning();

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'asset.vip_updated',
        entityType: 'asset',
        entityId: id,
        beforeState: {
          acquiredFromStore: existing.acquiredFromStore,
          vipDiscountPct: existing.vipDiscountPct,
        },
        afterState: {
          acquiredFromStore: updated!.acquiredFromStore,
          vipDiscountPct: updated!.vipDiscountPct,
        },
      });

      return updated!;
    });
  }
}
