import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  copilotAskSchema,
  ingestKnowledgeDocSchema,
  searchKnowledgeSchema,
} from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { AuthService } from '../auth/auth.service';
import { KnowledgeService } from './knowledge.service';

@ApiTags('IA, RAG & Briefing Executivo')
@ApiBearerAuth()
@RequireModule('mod-ai-agents')
@Controller('ai')
export class KnowledgeController {
  constructor(
    @Inject(KnowledgeService)
    private readonly knowledgeService: KnowledgeService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Get('briefing')
  @RequirePermission('ai:use_copilot')
  @ApiOperation({ summary: 'Daily AI Briefing Executivo instantâneo com dados reais e links' })
  getBriefing(
    @CurrentUser() user: AuthenticatedUser,
    @Query('refreshAi') refreshAi?: string,
  ) {
    return this.knowledgeService.getDailyBriefing(
      user.organizationId,
      refreshAi === 'true',
    );
  }

  @Post('copilot/ask')
  @RequirePermission('ai:use_copilot')
  @ApiOperation({ summary: 'Copiloto Operacional (Ctrl+K) aterrado em Tools + RAG' })
  async askCopilot(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = copilotAskSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const enabledModules = await this.authService.getEnabledModules(
      user.organizationId,
    );
    return this.knowledgeService.askCopilot(
      user.organizationId,
      enabledModules,
      parsed.data.question,
    );
  }

  @Get('knowledge/documents')
  @RequirePermission('ai:use_copilot')
  @ApiOperation({ summary: 'Listar documentos indexados na Base de Conhecimento' })
  listDocs(@CurrentUser() user: AuthenticatedUser) {
    return this.knowledgeService.listDocuments(user.organizationId);
  }

  @Post('knowledge/documents')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Ingerir manual, política ou SOP com chunking e embeddings' })
  ingestDoc(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = ingestKnowledgeDocSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.knowledgeService.ingestDocument(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Post('knowledge/search')
  @RequirePermission('ai:use_copilot')
  @ApiOperation({ summary: 'Busca híbrida RRF (PostgreSQL FTS + pgvector cosine)' })
  search(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = searchKnowledgeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.knowledgeService.hybridSearch(
      user.organizationId,
      parsed.data.query,
      parsed.data.limit,
    );
  }

  @Get('telemetry')
  @RequirePermission('ai:use_copilot')
  @ApiOperation({ summary: 'Telemetria de execuções dos agentes de IA' })
  telemetry(@CurrentUser() user: AuthenticatedUser) {
    return this.knowledgeService.listTelemetry(user.organizationId);
  }
}
