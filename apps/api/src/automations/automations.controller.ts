import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createAutomationRuleSchema } from '@al/shared';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { AutomationsService } from './automations.service';

@ApiTags('Automações & Regras por Evento')
@ApiBearerAuth()
@Controller('automations')
export class AutomationsController {
  constructor(
    @Inject(AutomationsService)
    private readonly automations: AutomationsService,
  ) {}

  @Get()
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar regras de automação e histórico idempotente' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.automations.listOverview(user.organizationId);
  }

  @Post('rules')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Criar nova regra de evento-condição-ação' })
  createRule(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createAutomationRuleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.automations.createRule(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Patch('rules/:id/toggle')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Ativar ou pausar regra de automação' })
  toggle(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.automations.toggleRule(user.organizationId, id);
  }

  @Post('run-now')
  @RequirePermission('os:write')
  @ApiOperation({
    summary: 'Avaliar todas as regras ativas agora (idempotente sem duplicidade)',
  })
  runNow(@CurrentUser() user: AuthenticatedUser) {
    return this.automations.runActiveRules(user.organizationId, user.userId);
  }
}
