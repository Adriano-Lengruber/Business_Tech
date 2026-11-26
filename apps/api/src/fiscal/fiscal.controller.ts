import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { emitFiscalDocSchema, upsertFiscalProfileSchema } from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { FiscalService } from './fiscal.service';

@ApiTags('Fiscal (NF-e / NFC-e / NFS-e)')
@ApiBearerAuth()
@RequireModule('mod-finance-fiscal')
@Controller('fiscal')
export class FiscalController {
  constructor(
    @Inject(FiscalService) private readonly fiscalService: FiscalService,
  ) {}

  @Get('profile')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Obter configuração tributária do tenant' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.fiscalService.getProfile(user.organizationId);
  }

  @Put('profile')
  @RequirePermission('fiscal:manage')
  @ApiOperation({ summary: 'Atualizar regime tributário, UF e séries fiscais' })
  upsertProfile(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = upsertFiscalProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.fiscalService.upsertProfile(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Get('documents')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Listar documentos fiscais emitidos' })
  listDocuments(@CurrentUser() user: AuthenticatedUser) {
    return this.fiscalService.listDocuments(user.organizationId);
  }

  @Post('documents')
  @RequirePermission('fiscal:manage')
  @ApiOperation({ summary: 'Emitir NF-e / NFC-e / NFS-e via adaptador fiscal' })
  emit(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = emitFiscalDocSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.fiscalService.emit(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Post('documents/:id/diagnose-rejection')
  @RequirePermission('ai:use_copilot')
  @ApiOperation({ summary: 'Acionar Agente Fiscal de IA para diagnosticar rejeição SEFAZ' })
  diagnose(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fiscalService.diagnoseRejection(user.organizationId, id);
  }
}
