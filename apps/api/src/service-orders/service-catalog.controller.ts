import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { desc, serviceCatalogItems, sql } from '@al/database';
import { createServiceCatalogItemSchema } from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';

@ApiTags('Catálogo de Serviços Padronizados')
@ApiBearerAuth()
@RequireModule('mod-service-orders')
@Controller('service-catalog')
export class ServiceCatalogController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  @RequirePermission('os:read')
  @ApiOperation({
    summary: 'Listar serviços padronizados de bancada com preço-base e garantia',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.database.withTenant(user.organizationId, (tx) =>
      tx
        .select()
        .from(serviceCatalogItems)
        .orderBy(desc(serviceCatalogItems.createdAt)),
    );
  }

  @Post()
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Cadastrar serviço padronizado no catálogo da loja' })
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createServiceCatalogItemSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;

    return this.database.withTenant(user.organizationId, async (tx) => {
      const countRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(serviceCatalogItems);
      const nextNum = (countRes[0]?.count ?? 0) + 1;
      const code = `SRV-${String(nextNum).padStart(3, '0')}`;

      const [created] = await tx
        .insert(serviceCatalogItems)
        .values({
          organizationId: user.organizationId,
          code,
          name: input.name.trim(),
          category: input.category,
          defaultLaborCents: input.defaultLaborCents,
          estimatedCostCents: input.estimatedCostCents,
          defaultWarrantyDays: input.defaultWarrantyDays,
          estimatedHours: input.estimatedHours,
        })
        .returning();

      return created!;
    });
  }
}
