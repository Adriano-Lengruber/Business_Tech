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
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  calculate3dPrintQuote,
  createFilamentSchema,
  createPrint3dJobSchema,
  updatePrint3dStatusSchema,
} from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { Print3dService } from './print3d.service';

@ApiTags('Impressão 3D')
@ApiBearerAuth()
@RequireModule('mod-3d-print')
@Controller('print3d')
export class Print3dController {
  constructor(
    @Inject(Print3dService) private readonly service: Print3dService,
  ) {}

  @Get('filaments')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar carretéis de filamento e resina' })
  listFilaments(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listFilaments(user.organizationId);
  }

  @Post('filaments')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Cadastrar filamento/resina' })
  createFilament(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createFilamentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.createFilament(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Post('quote-preview')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Simular orçamento 3D (material + energia + hora máquina)' })
  quotePreview(
    @Body()
    body: {
      weightGrams?: number;
      printTimeMinutes?: number;
      filamentCostPerKgCents?: number;
      profitMarginPercent?: number;
    },
  ) {
    return calculate3dPrintQuote({
      weightGrams: Number(body.weightGrams) || 0,
      printTimeMinutes: Number(body.printTimeMinutes) || 0,
      filamentCostPerKgCents: Number(body.filamentCostPerKgCents) || 12000,
      profitMarginPercent: Number(body.profitMarginPercent ?? 120),
    });
  }

  @Get('jobs')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar fila de impressões 3D' })
  listJobs(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listJobs(user.organizationId);
  }

  @Post('jobs')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Adicionar peça à fila 3D com custo/preço calculados' })
  createJob(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createPrint3dJobSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.createJob(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Post('jobs/:id/stl')
  @RequirePermission('os:write')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de arquivo STL/3MF para bucket S3 privado' })
  async uploadStl(
    @Param('id') id: string,
    @Req()
    req: FastifyRequest & {
      file: () => Promise<
        { filename: string; toBuffer: () => Promise<Buffer> } | undefined
      >;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const file = await req.file();
    if (!file) throw new BadRequestException('Nenhum arquivo STL/3MF enviado.');
    const buffer = await file.toBuffer();
    return this.service.attachStl(user.organizationId, id, file.filename, buffer);
  }

  @Patch('jobs/:id/status')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Avançar status do job 3D (deduz filamento ao iniciar)' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = updatePrint3dStatusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.updateJobStatus(
      user.organizationId,
      id,
      user.userId,
      parsed.data,
    );
  }
}
