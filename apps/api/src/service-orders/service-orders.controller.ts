import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createServiceOrderSchema,
  updateServiceOrderStatusSchema,
} from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { ServiceOrdersService } from './service-orders.service';

@ApiTags('Ordens de Serviço')
@ApiBearerAuth()
@RequireModule('mod-service-orders')
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(
    @Inject(ServiceOrdersService)
    private readonly service: ServiceOrdersService,
  ) {}

  @Get()
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar OS do tenant (RLS + Entitlement)' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.organizationId);
  }

  @Get('dashboard-queue')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Contadores da fila Solo Operator (Hoje)' })
  dashboardQueue(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getDashboardQueue(user.organizationId);
  }

  @Get(':id')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Obter detalhe completo da OS, eventos e anexos S3' })
  getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getById(user.organizationId, id);
  }

  @Post()
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Dar entrada de OS no balcão e disparar notificação WhatsApp' })
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createServiceOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.service.create(user.organizationId, user.userId, parsed.data);
  }

  @Patch(':id/status')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Atualizar status da OS com auditoria e notificação' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = updateServiceOrderStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.service.updateStatus(
      user.organizationId,
      id,
      user.userId,
      parsed.data,
    );
  }

  @Post(':id/attachments')
  @RequirePermission('os:write')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enviar foto de entrada da OS para bucket S3 privado' })
  async uploadAttachment(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { file: () => Promise<{ filename: string; mimetype: string; toBuffer: () => Promise<Buffer> } | undefined> },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Apenas imagens e PDFs são permitidos.');
    }

    const buffer = await file.toBuffer();
    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('Arquivo excede o limite de 10MB.');
    }

    return this.service.addAttachment({
      organizationId: user.organizationId,
      serviceOrderId: id,
      filename: file.filename,
      mimeType: file.mimetype,
      buffer,
    });
  }

  @Get(':id/intake-pdf')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Gerar e baixar Termo de Recebimento em PDF' })
  async downloadIntakePdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() reply: FastifyReply,
  ) {
    const { code, buffer } = await this.service.generateIntakePdf(
      user.organizationId,
      id,
    );
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${code}-termo-entrada.pdf"`)
      .send(buffer);
  }
}
