import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { assets, customers, desc, eq, serviceOrders } from '@al/database';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';

@ApiTags('Ordens de Serviço')
@ApiBearerAuth()
@RequireModule('mod-service-orders')
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar OS do tenant (protegido por RLS e Entitlement)' })
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.database.withTenant(user.organizationId, (tx) =>
      tx
        .select({
          id: serviceOrders.id,
          code: serviceOrders.code,
          status: serviceOrders.status,
          priority: serviceOrders.priority,
          reportedSymptoms: serviceOrders.reportedSymptoms,
          preliminaryDiagnosis: serviceOrders.preliminaryDiagnosis,
          createdAt: serviceOrders.createdAt,
          customerName: customers.name,
          customerPhone: customers.phoneE164,
          assetModel: assets.model,
          assetBrand: assets.brand,
        })
        .from(serviceOrders)
        .innerJoin(customers, eq(serviceOrders.customerId, customers.id))
        .leftJoin(assets, eq(serviceOrders.assetId, assets.id))
        .orderBy(desc(serviceOrders.createdAt))
        .limit(50),
    );
  }
}
