import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, auditLogs, eq, tenantModules } from '@al/database';
import {
  MODULE_CATALOG,
  MODULE_CODES,
  toggleModuleSchema,
  type ModuleCode,
} from '@al/shared';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';

@ApiTags('Módulos & Entitlements')
@ApiBearerAuth()
@Controller('modules')
export class EntitlementsController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar catálogo de módulos e status para o tenant' })
  async list(@CurrentUser() user: AuthenticatedUser) {
    const rows = await this.database.withTenant(user.organizationId, (tx) =>
      tx
        .select()
        .from(tenantModules)
        .where(eq(tenantModules.organizationId, user.organizationId)),
    );

    const statusMap = new Map(rows.map((r) => [r.moduleCode, r.enabled]));
    return MODULE_CODES.map((code) => ({
      ...MODULE_CATALOG[code],
      enabled: statusMap.get(code) ?? MODULE_CATALOG[code].required,
    }));
  }

  @Patch(':code')
  @RequirePermission('modules:manage')
  @ApiOperation({ summary: 'Ativar ou desativar módulo vendável para a organização' })
  async toggle(
    @Param('code') code: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!MODULE_CODES.includes(code as ModuleCode)) {
      throw new BadRequestException(`Módulo desconhecido: ${code}`);
    }
    const moduleCode = code as ModuleCode;
    const parsed = toggleModuleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    if (MODULE_CATALOG[moduleCode].required && !parsed.data.enabled) {
      throw new BadRequestException('O módulo núcleo (core) não pode ser desativado.');
    }

    return this.database.withTenant(user.organizationId, async (tx) => {
      const existing = await tx
        .select()
        .from(tenantModules)
        .where(
          and(
            eq(tenantModules.organizationId, user.organizationId),
            eq(tenantModules.moduleCode, moduleCode),
          ),
        )
        .limit(1);

      const previousEnabled = existing[0]?.enabled ?? false;

      if (existing.length === 0) {
        await tx.insert(tenantModules).values({
          organizationId: user.organizationId,
          moduleCode,
          enabled: parsed.data.enabled,
        });
      } else {
        await tx
          .update(tenantModules)
          .set({ enabled: parsed.data.enabled, updatedAt: new Date() })
          .where(
            and(
              eq(tenantModules.organizationId, user.organizationId),
              eq(tenantModules.moduleCode, moduleCode),
            ),
          );
      }

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'module.toggled',
        entityType: 'tenant_module',
        entityId: moduleCode,
        beforeState: { enabled: previousEnabled },
        afterState: { enabled: parsed.data.enabled },
      });

      return { moduleCode, enabled: parsed.data.enabled };
    });
  }
}
