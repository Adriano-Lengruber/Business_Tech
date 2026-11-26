import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createApiKeySchema,
  createTeamMemberSchema,
  createWebhookEndpointSchema,
} from '@al/shared';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { SecurityService } from './security.service';

@ApiTags('Segurança, Auditoria, Equipe & Webhooks')
@ApiBearerAuth()
@Controller()
export class SecurityController {
  constructor(
    @Inject(SecurityService) private readonly security: SecurityService,
  ) {}

  @Get('security/audit-logs')
  @RequirePermission('audit:read')
  @ApiOperation({
    summary: 'Consultar trilha de auditoria imutável (LGPD e governança)',
  })
  listAuditLogs(
    @Query('action') action: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.security.listAuditLogs(user.organizationId, action);
  }

  @Get('security/team')
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Listar membros da organização e papéis RBAC' })
  listTeam(@CurrentUser() user: AuthenticatedUser) {
    return this.security.listTeam(user.organizationId);
  }

  @Post('security/team')
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Cadastrar membro na equipe com papel RBAC específico' })
  addTeamMember(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createTeamMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.security.addTeamMember(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Get('integrations')
  @RequirePermission('modules:manage')
  @ApiOperation({ summary: 'Listar API Keys e Webhooks cadastrados no tenant' })
  listIntegrations(@CurrentUser() user: AuthenticatedUser) {
    return this.security.listIntegrations(user.organizationId);
  }

  @Post('integrations/api-keys')
  @RequirePermission('modules:manage')
  @ApiOperation({ summary: 'Gerar API Key (armazena hash SHA-256)' })
  createApiKey(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createApiKeySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.security.createApiKey(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Delete('integrations/api-keys/:id')
  @RequirePermission('modules:manage')
  @ApiOperation({ summary: 'Revogar API Key do tenant' })
  revokeApiKey(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.security.revokeApiKey(user.organizationId, id, user.userId);
  }

  @Post('integrations/webhooks')
  @RequirePermission('modules:manage')
  @ApiOperation({ summary: 'Cadastrar Webhook assinado (HMAC-SHA256)' })
  createWebhook(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createWebhookEndpointSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.security.createWebhook(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Post('integrations/webhooks/:id/test')
  @RequirePermission('modules:manage')
  @ApiOperation({ summary: 'Disparar ping de teste assinado para o Webhook' })
  testWebhook(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.security.testWebhook(user.organizationId, id, user.userId);
  }
}
