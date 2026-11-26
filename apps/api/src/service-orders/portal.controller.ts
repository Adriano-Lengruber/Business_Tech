import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/auth.decorators';
import { ServiceOrdersService } from './service-orders.service';

@ApiTags('Portal do Cliente')
@Controller('portal')
export class PortalController {
  constructor(
    @Inject(ServiceOrdersService)
    private readonly service: ServiceOrdersService,
  ) {}

  @Public()
  @Get(':code')
  @ApiOperation({ summary: 'Consulta pública segura da OS via Link Mágico' })
  getPortalView(
    @Param('code') code: string,
    @Query('token') token: string,
  ) {
    return this.service.getPublicPortalView(code, token);
  }
}
