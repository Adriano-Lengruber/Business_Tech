import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics & BI Gerencial')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService)
    private readonly analytics: AnalyticsService,
  ) {}

  @Get('overview')
  @RequirePermission('os:read')
  @ApiOperation({
    summary: 'Indicadores gráficos em tempo real de OS, fluxo de caixa e conversão',
  })
  getOverview(
    @Query('days') days: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const windowDays = days === '30' ? 30 : 7;
    return this.analytics.getOverview(user.organizationId, windowDays);
  }
}
