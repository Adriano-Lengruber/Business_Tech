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
import {
  addSourcingOfferSchema,
  createSourcingRequestSchema,
} from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { SourcingService } from './sourcing.service';

@ApiTags('Cotação Inteligente (Fornecedor B2B vs Marketplace PF)')
@ApiBearerAuth()
@RequireModule('mod-inventory-pos')
@Controller('sourcing')
export class SourcingController {
  constructor(
    @Inject(SourcingService) private readonly sourcing: SourcingService,
  ) {}

  @Get('requests')
  @RequirePermission('inventory:read')
  @ApiOperation({
    summary: 'Listar cotações comparando distribuidores B2B vs. marketplaces PF',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sourcing.listRequests(user.organizationId);
  }

  @Post('requests')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Criar nova pesquisa de preço / cotação de compra' })
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createSourcingRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.sourcing.createRequest(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Post('requests/:id/offers')
  @RequirePermission('inventory:write')
  @ApiOperation({
    summary: 'Registrar oferta B2B ou Marketplace PF calculando custo posto unitário',
  })
  addOffer(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = addSourcingOfferSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.sourcing.addOffer(user.organizationId, id, parsed.data);
  }

  @Post('requests/:id/ai-recommend')
  @RequirePermission('inventory:read')
  @ApiOperation({
    summary: 'Analisar melhor opção de compra (B2B vs PF) com agente de compras',
  })
  recommend(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sourcing.recommendWithAi(user.organizationId, id);
  }

  @Patch('requests/:id/select/:offerId')
  @RequirePermission('inventory:write')
  @ApiOperation({ summary: 'Definir oferta vencedora da cotação' })
  selectOffer(
    @Param('id') id: string,
    @Param('offerId') offerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sourcing.selectOffer(
      user.organizationId,
      id,
      offerId,
      user.userId,
    );
  }
}
