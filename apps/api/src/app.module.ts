import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { appEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import {
  JwtAuthGuard,
  ModuleEntitlementGuard,
  PermissionsGuard,
} from './common/guards/auth-rbac-module.guard';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { EntitlementsController } from './modules/entitlements.controller';
import { ServiceOrdersController } from './service-orders/service-orders.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    DatabaseModule,
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
    ServiceOrdersController,
  ],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ModuleEntitlementGuard },
  ],
})
export class AppModule {}
