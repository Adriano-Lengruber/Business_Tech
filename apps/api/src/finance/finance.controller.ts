import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createTransactionSchema } from '@al/shared';
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
  @ApiOperation({ summary: 'Resumo financeiro e margem em centavos' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.financeService.getSummary(user.organizationId);
  }

  @Get('transactions')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Listar contas a pagar e receber' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.financeService.listTransactions(user.organizationId);
  }

  @Post('transactions')
  @RequirePermission('finance:write')
  @ApiOperation({ summary: 'Criar lançamento financeiro (com PIX Asaas/Sandbox)' })
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
