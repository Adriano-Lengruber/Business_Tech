import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import {
  and,
  assets,
  auditLogs,
  customers,
  desc,
  eq,
  ilike,
  isNull,
  maintenanceContracts,
  or,
  serviceOrders,
  warrantyCases,
} from '@al/database';
import { createCustomerSchema, updateCustomerSchema } from '@al/shared';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';

@ApiTags('Clientes (CRM)')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  @RequirePermission('customers:read')
  @ApiOperation({ summary: 'Buscar clientes por nome, telefone ou CPF/CNPJ' })
  async search(
    @Query('q') q: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const term = q?.trim();
    return this.database.withTenant(user.organizationId, (tx) => {
      const baseFilter = isNull(customers.deletedAt);
      if (!term) {
        return tx
          .select({
            id: customers.id,
            type: customers.type,
            name: customers.name,
            phoneE164: customers.phoneE164,
            email: customers.email,
            tags: customers.tags,
            aiSegment: customers.aiSegment,
            createdAt: customers.createdAt,
          })
          .from(customers)
          .where(baseFilter)
          .orderBy(desc(customers.createdAt))
          .limit(30);
      }

      const cleanDoc = term.replace(/\D/g, '');
      const docHash = cleanDoc
        ? createHash('sha256').update(cleanDoc).digest('hex')
        : null;

      return tx
        .select({
          id: customers.id,
          type: customers.type,
          name: customers.name,
          phoneE164: customers.phoneE164,
          email: customers.email,
          tags: customers.tags,
          aiSegment: customers.aiSegment,
          createdAt: customers.createdAt,
        })
        .from(customers)
        .where(
          and(
            baseFilter,
            or(
              ilike(customers.name, `%${term}%`),
              ilike(customers.phoneE164, `%${term}%`),
              ...(docHash ? [ilike(customers.documentHash, docHash)] : []),
            ),
          ),
        )
        .orderBy(desc(customers.createdAt))
        .limit(30);
    });
  }

  @Post()
  @RequirePermission('customers:write')
  @ApiOperation({ summary: 'Cadastro expresso de cliente (balcão)' })
  async create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const input = parsed.data;
    const digitsPhone = input.phoneE164.replace(/\D/g, '');
    const normalizedPhone = digitsPhone.startsWith('55')
      ? `+${digitsPhone}`
      : `+55${digitsPhone}`;

    const cleanDoc = input.document?.replace(/\D/g, '');
    const docHash = cleanDoc
      ? createHash('sha256').update(cleanDoc).digest('hex')
      : null;

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [created] = await tx
        .insert(customers)
        .values({
          organizationId: user.organizationId,
          type: input.type,
          name: input.name.trim(),
          phoneE164: normalizedPhone,
          email: input.email ? input.email.trim().toLowerCase() : null,
          documentHash: docHash,
          tags: input.tags,
          lgpdConsentAt: new Date(),
        })
        .returning({
          id: customers.id,
          type: customers.type,
          name: customers.name,
          phoneE164: customers.phoneE164,
          email: customers.email,
          tags: customers.tags,
          createdAt: customers.createdAt,
        });

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'customer.created',
        entityType: 'customer',
        entityId: created!.id,
        afterState: { name: created!.name, phoneE164: created!.phoneE164 },
      });

      return created;
    });
  }

  @Get(':id/timeline')
  @RequirePermission('customers:read')
  @ApiOperation({
    summary: 'Visão CRM 360° consolidada: ativos, OSs, garantias e contratos do cliente',
  })
  async timeline(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.database.withTenant(user.organizationId, async (tx) => {
      const [cust] = await tx
        .select({
          id: customers.id,
          type: customers.type,
          name: customers.name,
          phoneE164: customers.phoneE164,
          email: customers.email,
          tags: customers.tags,
          createdAt: customers.createdAt,
        })
        .from(customers)
        .where(eq(customers.id, id))
        .limit(1);

      if (!cust) {
        throw new NotFoundException('Cliente não encontrado.');
      }

      const [custAssets, custOrders, custWarranties, custContracts] =
        await Promise.all([
          tx
            .select()
            .from(assets)
            .where(eq(assets.customerId, id))
            .orderBy(desc(assets.createdAt)),
          tx
            .select({
              id: serviceOrders.id,
              code: serviceOrders.code,
              status: serviceOrders.status,
              priority: serviceOrders.priority,
              reportedSymptoms: serviceOrders.reportedSymptoms,
              createdAt: serviceOrders.createdAt,
            })
            .from(serviceOrders)
            .where(eq(serviceOrders.customerId, id))
            .orderBy(desc(serviceOrders.createdAt)),
          tx
            .select()
            .from(warrantyCases)
            .where(eq(warrantyCases.customerId, id))
            .orderBy(desc(warrantyCases.createdAt)),
          tx
            .select()
            .from(maintenanceContracts)
            .where(eq(maintenanceContracts.customerId, id))
            .orderBy(desc(maintenanceContracts.createdAt)),
        ]);

      return {
        customer: cust,
        assets: custAssets,
        serviceOrders: custOrders,
        warranties: custWarranties,
        contracts: custContracts,
        stats: {
          assetsCount: custAssets.length,
          vipAssetsCount: custAssets.filter((a) => a.acquiredFromStore).length,
          ordersCount: custOrders.length,
          activeWarrantiesCount: custWarranties.filter(
            (w) => w.status === 'ACTIVE',
          ).length,
          activeContractsCount: custContracts.filter(
            (c) => c.status === 'ACTIVE',
          ).length,
        },
      };
    });
  }

  @Patch(':id')
  @RequirePermission('customers:write')
  @ApiOperation({ summary: 'Atualizar dados cadastrais do cliente' })
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(customers)
        .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
        .limit(1);
      if (!existing) throw new NotFoundException('Cliente não encontrado.');

      const input = parsed.data;
      let nextPhone = existing.phoneE164;
      if (input.phoneE164) {
        const digits = input.phoneE164.replace(/\D/g, '');
        nextPhone = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
      }

      const [updated] = await tx
        .update(customers)
        .set({
          type: input.type ?? existing.type,
          name: input.name !== undefined ? input.name.trim() : existing.name,
          phoneE164: nextPhone,
          email:
            input.email !== undefined
              ? input.email
                ? input.email.trim().toLowerCase()
                : null
              : existing.email,
          tags: input.tags !== undefined ? input.tags : existing.tags,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning({
          id: customers.id,
          type: customers.type,
          name: customers.name,
          phoneE164: customers.phoneE164,
          email: customers.email,
          tags: customers.tags,
          createdAt: customers.createdAt,
        });

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'customer.updated',
        entityType: 'customer',
        entityId: id,
      });

      return updated!;
    });
  }

  @Delete(':id')
  @RequirePermission('customers:write')
  @ApiOperation({ summary: 'Arquivar (soft delete) cliente preservando OS/NF históricas' })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.database.withTenant(user.organizationId, async (tx) => {
      const [existing] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
        .limit(1);
      if (!existing) throw new NotFoundException('Cliente não encontrado.');

      await tx
        .update(customers)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(customers.id, id));

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'customer.archived',
        entityType: 'customer',
        entityId: id,
      });

      return { archived: true, id };
    });
  }
}
