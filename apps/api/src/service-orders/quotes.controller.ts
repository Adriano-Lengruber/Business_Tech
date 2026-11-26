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
import { createQuoteSchema } from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { QuotesService } from './quotes.service';

@ApiTags('Orçamentos')
@ApiBearerAuth()
@RequireModule('mod-service-orders')
@Controller()
export class QuotesController {
  constructor(
    @Inject(QuotesService) private readonly quotesService: QuotesService,
  ) {}

  @Get('service-orders/:osId/quotes')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar orçamentos (Econômico/Recomendado/Premium) da OS' })
  listForOrder(
    @Param('osId') osId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.listForOrder(user.organizationId, osId);
  }

  @Post('service-orders/:osId/quotes')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Criar orçamento calculado em centavos e opcionalmente enviar' })
  create(
    @Param('osId') osId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = createQuoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.quotesService.create(
      user.organizationId,
      osId,
      user.userId,
      parsed.data,
    );
  }

  @Post('quotes/:id/send')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Enviar orçamento para aprovação no Portal do Cliente' })
  send(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotesService.sendQuote(user.organizationId, id, user.userId);
  }
}
