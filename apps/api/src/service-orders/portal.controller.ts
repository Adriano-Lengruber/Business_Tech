import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { portalQuoteDecisionSchema } from '@al/shared';
import { Public } from '../common/decorators/auth.decorators';
import { ServiceOrdersService } from './service-orders.service';
import { QuotesService } from './quotes.service';

@ApiTags('Portal do Cliente')
@Controller('portal')
export class PortalController {
  constructor(
    @Inject(ServiceOrdersService)
    private readonly service: ServiceOrdersService,
    @Inject(QuotesService)
    private readonly quotesService: QuotesService,
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

  @Public()
  @Post(':code/quotes/:quoteId/decide')
  @ApiOperation({
    summary: 'Aprovação ou recusa digital do orçamento pelo cliente com prova de aceite',
  })
  decideQuote(
    @Param('code') code: string,
    @Param('quoteId') quoteId: string,
    @Query('token') token: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    const parsed = portalQuoteDecisionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.quotesService.decideFromPortal({
      osCode: code,
      token,
      quoteId,
      input: parsed.data,
      clientIp: req.ip || '127.0.0.1',
      userAgent: userAgent ?? 'unknown',
    });
  }
}
