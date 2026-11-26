import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { eq, organizations } from '@al/database';
import {
  createLeadSchema,
  createSocialPostSchema,
  type SocialPlatform,
} from '@al/shared';
import {
  CurrentUser,
  Public,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { DatabaseService } from '../database/database.module';
import { SocialService } from './social.service';

@ApiTags('Social Growth & Leads')
@ApiBearerAuth()
@RequireModule('mod-social-growth')
@Controller('social')
export class SocialController {
  constructor(
    @Inject(SocialService) private readonly service: SocialService,
  ) {}

  @Get('posts')
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar calendário e métricas de postagens sociais' })
  listPosts(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listPosts(user.organizationId);
  }

  @Post('posts')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Criar rascunho ou postagem agendada' })
  createPost(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createSocialPostSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.createPost(
      user.organizationId,
      user.userId,
      parsed.data,
    );
  }

  @Post('posts/ai-generate')
  @RequirePermission('ai:use_copilot')
  @ApiOperation({
    summary: 'Gerar rascunho de post com IA baseado em casos reais (aguarda aprovação humana)',
  })
  aiGenerate(
    @Body() body: { platform?: SocialPlatform; topicHint?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.aiGenerateDraft(
      user.organizationId,
      body.platform ?? 'instagram',
      body.topicHint,
    );
  }

  @Post('posts/:id/approve-publish')
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Aprovar humanamente e publicar postagem (WRITE_SENSITIVE)' })
  approvePublish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approveAndPublish(
      user.organizationId,
      id,
      user.userId,
    );
  }

  @Post('posts/:id/convert-lead')
  @RequirePermission('customers:write')
  @ApiOperation({ summary: 'Converter comentário/DM do post em Lead no CRM' })
  convertLead(
    @Param('id') id: string,
    @Body() body: { name?: string; phoneE164?: string; notes?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!body.name?.trim()) {
      throw new BadRequestException('Nome do lead é obrigatório.');
    }
    return this.service.convertCommentToLead(
      user.organizationId,
      id,
      user.userId,
      {
        name: body.name,
        phoneE164: body.phoneE164,
        notes: body.notes,
      },
    );
  }
}

@ApiTags('CRM Leads')
@Controller('leads')
export class LeadsController {
  constructor(
    @Inject(SocialService) private readonly service: SocialService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @ApiBearerAuth()
  @Get()
  @RequirePermission('customers:read')
  @ApiOperation({ summary: 'Listar leads do CRM (Landing Page, WhatsApp, Social)' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listLeads(user.organizationId);
  }

  @ApiBearerAuth()
  @Post()
  @RequirePermission('customers:write')
  @ApiOperation({ summary: 'Cadastrar lead manualmente no CRM' })
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createLeadSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.createLead(user.organizationId, parsed.data);
  }

  @Public()
  @Post('public/:orgSlug')
  @ApiOperation({ summary: 'Captação pública de Lead da Landing Page direto no CRM' })
  async capturePublic(
    @Param('orgSlug') orgSlug: string,
    @Body() body: unknown,
  ) {
    const parsed = createLeadSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const [org] = await this.database.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    if (!org) throw new NotFoundException('Organização não encontrada.');
    return this.service.createLead(org.id, {
      ...parsed.data,
      source: 'landing_page',
    });
  }
}
