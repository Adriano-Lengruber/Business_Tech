import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { appEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './storage/storage.module';
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
import { ServiceOrdersService } from './service-orders/service-orders.service';
import { IntakePdfService } from './service-orders/intake-pdf.service';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
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
    PortalController,
  ],
  providers: [
    AuthService,
    ServiceOrdersService,
    IntakePdfService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ModuleEntitlementGuard },
  ],
})
export class AppModule {}
