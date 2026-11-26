import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createPosSaleSchema } from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { PosService } from './pos.service';

@ApiTags('PDV / Vendas')
@ApiBearerAuth()
@RequireModule('mod-inventory-pos')
@Controller('pos')
export class PosController {
  constructor(@Inject(PosService) private readonly posService: PosService) {}

  @Get('sales')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Listar vendas do PDV' })
  listSales(@CurrentUser() user: AuthenticatedUser) {
    return this.posService.listSales(user.organizationId);
  }

  @Post('sales')
  @RequirePermission('pos:sell')
  @ApiOperation({
    summary: 'Finalizar venda no PDV com baixa atômica de estoque e lançamento no caixa',
  })
  createSale(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createPosSaleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.posService.createSale(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }
}
