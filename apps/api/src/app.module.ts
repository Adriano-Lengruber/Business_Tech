import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { appEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './storage/storage.module';
import { AiModule } from './ai/ai.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import {
  JwtAuthGuard,
  ModuleEntitlementGuard,
  PermissionsGuard,
} from './common/guards/auth-rbac-module.guard';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { EntitlementsController } from './modules/entitlements.controller';
import { CustomersController } from './customers/customers.controller';
import { AssetsController } from './assets/assets.controller';
import { ServiceOrdersController } from './service-orders/service-orders.controller';
import { PortalController } from './service-orders/portal.controller';
import { DiagnosticsController } from './service-orders/diagnostics.controller';
import { QuotesController } from './service-orders/quotes.controller';
import { QuotesService } from './service-orders/quotes.service';
import { ServiceOrdersService } from './service-orders/service-orders.service';
import { IntakePdfService } from './service-orders/intake-pdf.service';
import {
  AsaasWebhookController,
  FinanceController,
} from './finance/finance.controller';
import { FinanceService } from './finance/finance.service';
import { AsaasPaymentProvider } from './finance/payment.provider';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { PosController } from './pos/pos.controller';
import { PosService } from './pos/pos.service';
import { FiscalController } from './fiscal/fiscal.controller';
import { FiscalService } from './fiscal/fiscal.service';
import { SandboxFiscalProvider } from './fiscal/fiscal.provider';
import { Print3dController } from './print3d/print3d.controller';
import { Print3dService } from './print3d/print3d.service';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';
import { LeadsController, SocialController } from './social/social.controller';
import { SocialService } from './social/social.service';
import { SearchController } from './search/search.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    AiModule,
    BullModule.forRoot({
      connection: {
        url: appEnv.REDIS_URL,
      },
    }),
    WhatsappModule,
    JwtModule.register({
      global: true,
      secret: appEnv.BETTER_AUTH_SECRET,
      signOptions: {
        issuer: appEnv.JWT_ISSUER,
        expiresIn: '12h',
      },
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    EntitlementsController,
    CustomersController,
    AssetsController,
    ServiceOrdersController,
    DiagnosticsController,
    QuotesController,
    PortalController,
    FinanceController,
    AsaasWebhookController,
    InventoryController,
    PosController,
    FiscalController,
    Print3dController,
    ProjectsController,
    SocialController,
    LeadsController,
    SearchController,
  ],
  providers: [
    AuthService,
    ServiceOrdersService,
    IntakePdfService,
    QuotesService,
    FinanceService,
    AsaasPaymentProvider,
    InventoryService,
    PosService,
    FiscalService,
    SandboxFiscalProvider,
    Print3dService,
    ProjectsService,
    SocialService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ModuleEntitlementGuard },
  ],
})
export class AppModule {}
