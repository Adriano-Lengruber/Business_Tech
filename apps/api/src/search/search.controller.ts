import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { assets, customers, desc, ilike, isNull, or, serviceOrders, and } from '@al/database';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';

@ApiTags('Busca Global')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Busca global rápida (⌘K) em Clientes, Ativos e OS' })
  async globalSearch(
    @Query('q') q: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const term = q?.trim() ?? '';
    if (term.length < 2) {
      return { customers: [], assets: [], serviceOrders: [] };
    }

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [custRows, assetRows, osRows] = await Promise.all([
        tx
          .select({
            id: customers.id,
            name: customers.name,
            phoneE164: customers.phoneE164,
          })
          .from(customers)
          .where(
            and(
              isNull(customers.deletedAt),
              or(
                ilike(customers.name, `%${term}%`),
                ilike(customers.phoneE164, `%${term}%`),
              ),
            ),
          )
          .limit(5),
        tx
          .select({
            id: assets.id,
            category: assets.category,
            brand: assets.brand,
            model: assets.model,
            qrToken: assets.qrToken,
          })
          .from(assets)
          .where(
            or(
              ilike(assets.model, `%${term}%`),
              ilike(assets.brand, `%${term}%`),
              ilike(assets.serialNumber, `%${term}%`),
              ilike(assets.qrToken, `%${term}%`),
            ),
          )
          .limit(5),
        tx
          .select({
            id: serviceOrders.id,
            code: serviceOrders.code,
            status: serviceOrders.status,
            reportedSymptoms: serviceOrders.reportedSymptoms,
          })
          .from(serviceOrders)
          .where(
            or(
              ilike(serviceOrders.code, `%${term}%`),
              ilike(serviceOrders.reportedSymptoms, `%${term}%`),
            ),
          )
          .orderBy(desc(serviceOrders.createdAt))
          .limit(5),
      ]);

      return {
        customers: custRows,
        assets: assetRows,
        serviceOrders: osRows,
      };
    });
  }
}
