import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createTransactionSchema, updateTransactionSchema } from '@al/shared';
import {
  CurrentUser,
  Public,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { appEnv } from '../config/env';
import { FinanceService } from './finance.service';

@ApiTags('Financeiro')
@ApiBearerAuth()
@RequireModule('mod-finance-fiscal')
@Controller('finance')
export class FinanceController {
  constructor(
    @Inject(FinanceService) private readonly financeService: FinanceService,
  ) {}

  @Get('summary')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Resumo financeiro, DRE por categoria e fluxo em centavos' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.financeService.getSummary(user.organizationId);
  }

  @Get('transactions')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Listar contas a pagar e receber com filtros' })
  list(
    @Query('type') type: string | undefined,
    @Query('status') status: string | undefined,
    @Query('q') q: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.financeService.listTransactions(user.organizationId, {
      type,
      status,
      q,
    });
  }

  @Post('transactions')
  @RequirePermission('finance:write')
  @ApiOperation({ summary: 'Criar lançamento financeiro (com PIX Asaas/Sandbox ou baixa imediata)' })
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.financeService.createTransaction(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Patch('transactions/:id')
  @RequirePermission('finance:write')
  @ApiOperation({ summary: 'Editar lançamento financeiro (descrição, valor, vencimento, status)' })
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.financeService.updateTransaction(
      user.organizationId,
      id,
      user.userId,
      parsed.data,
    );
  }

  @Delete('transactions/:id')
  @RequirePermission('finance:write')
  @ApiOperation({ summary: 'Cancelar lançamento financeiro preservando trilha de auditoria' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.financeService.cancelTransaction(
      user.organizationId,
      id,
      user.userId,
    );
  }

  @Post('transactions/:id/confirm')
  @RequirePermission('finance:write')
  @ApiOperation({ summary: 'Confirmar recebimento/pagamento manualmente' })
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.financeService.confirmTransaction(
      user.organizationId,
      id,
      user.userId,
      'human',
    );
  }
}

@ApiTags('Webhooks')
@Controller('webhooks/asaas')
export class AsaasWebhookController {
  constructor(
    @Inject(FinanceService) private readonly financeService: FinanceService,
  ) {}

  @Public()
  @Post(':orgSlug')
  @ApiOperation({ summary: 'Webhook idempotente do gateway Asaas' })
  handleWebhook(
    @Param('orgSlug') orgSlug: string,
    @Headers('asaas-access-token') token: string | undefined,
    @Body() body: { event?: string; payment?: { id?: string } },
  ) {
    if (token !== appEnv.ASAAS_WEBHOOK_TOKEN) {
      throw new UnauthorizedException('Token do webhook Asaas inválido.');
    }
    if (!body.event || !body.payment?.id) {
      throw new BadRequestException('Payload Asaas incompleto.');
    }
    return this.financeService.handleAsaasWebhook(
      orgSlug,
      body.event,
      body.payment.id,
    );
  }
}
