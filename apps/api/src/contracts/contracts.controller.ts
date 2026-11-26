import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createMaintenanceContractSchema,
  logContractUsageSchema,
} from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { ContractsService } from './contracts.service';

@ApiTags('Contratos B2B, SLA & Preventiva')
@ApiBearerAuth()
@RequireModule('mod-contracts-sla')
@Controller('contracts')
export class ContractsController {
  constructor(
    @Inject(ContractsService)
    private readonly contracts: ContractsService,
  ) {}

  @Get()
  @RequirePermission('customers:read')
  @ApiOperation({ summary: 'Listar contratos B2B, MRR, SLA e agenda preventiva' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.contracts.list(user.organizationId);
  }

  @Post()
  @RequirePermission('customers:write')
  @ApiOperation({ summary: 'Criar contrato recorrente de suporte TI e SLA' })
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createMaintenanceContractSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.contracts.create(user.organizationId, user.userId, parsed.data);
  }

  @Post(':id/log-usage')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Apontar consumo de horas na franquia do contrato' })
  logUsage(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = logContractUsageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.contracts.logUsage(
      user.organizationId,
      id,
      user.userId,
      parsed.data,
    );
  }

  @Post(':id/preventive-done')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Registrar manutenção preventiva concluída e reagendar próxima' })
  preventiveDone(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contracts.recordPreventiveDone(
      user.organizationId,
      id,
      user.userId,
    );
  }

  @Post(':id/bill-month')
  @RequirePermission('finance:write')
  @ApiOperation({ summary: 'Gerar cobrança mensal PIX no financeiro para o contrato' })
  billMonth(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contracts.billMonthlyFee(
      user.organizationId,
      id,
      user.userId,
    );
  }
}
