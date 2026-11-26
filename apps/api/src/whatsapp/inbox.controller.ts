import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { eq, organizations } from '@al/database';
import {
  replyConversationSchema,
  simulateInboundWhatsappSchema,
  type ConversationBotState,
} from '@al/shared';
import {
  CurrentUser,
  Public,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { appEnv } from '../config/env';
import { DatabaseService } from '../database/database.module';
import { WhatsappService } from './whatsapp.service';

@ApiTags('Inbox WhatsApp & IA')
@ApiBearerAuth()
@Controller('inbox')
export class InboxController {
  constructor(
    @Inject(WhatsappService) private readonly whatsappService: WhatsappService,
  ) {}

  @Get('conversations')
  @RequirePermission('inbox:read')
  @ApiOperation({ summary: 'Listar conversas do Inbox omnichannel com estado do bot' })
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.whatsappService.listConversations(user.organizationId);
  }

  @Get('conversations/:id/messages')
  @RequirePermission('inbox:read')
  @ApiOperation({ summary: 'Listar mensagens de uma conversa' })
  listMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.whatsappService.listMessages(user.organizationId, id);
  }

  @Post('conversations/:id/reply')
  @RequirePermission('inbox:reply')
  @ApiOperation({ summary: 'Responder manualmente ao cliente (pausa o bot -> HUMAN_ACTIVE)' })
  async reply(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = replyConversationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.whatsappService.sendHumanReply({
      organizationId: user.organizationId,
      conversationId: id,
      userId: user.userId,
      text: parsed.data.text,
    });
  }

  @Post('conversations/:id/bot-state')
  @RequirePermission('inbox:handoff')
  @ApiOperation({ summary: 'Alternar estado do bot (ex: devolver para IA ou resolver)' })
  async changeBotState(
    @Param('id') id: string,
    @Body() body: { botState?: ConversationBotState },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (
      !body.botState ||
      !['BOT_ACTIVE', 'WAITING_HUMAN', 'HUMAN_ACTIVE', 'PAUSED', 'RESOLVED'].includes(
        body.botState,
      )
    ) {
      throw new BadRequestException('botState inválido');
    }
    return this.whatsappService.updateBotState(
      user.organizationId,
      id,
      body.botState,
    );
  }

  @Post('simulate-inbound')
  @RequireModule('mod-ai-agents')
  @RequirePermission('inbox:reply')
  @ApiOperation({ summary: 'Simular mensagem recebida do WhatsApp para testar Debounce + Agente + Handoff' })
  async simulateInbound(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = simulateInboundWhatsappSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.whatsappService.recordInboundAndDebounce({
      organizationId: user.organizationId,
      phoneE164: parsed.data.phoneE164,
      text: parsed.data.text,
      isAudio: parsed.data.isAudio,
    });
  }
}

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    @Inject(WhatsappService) private readonly whatsappService: WhatsappService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Public()
  @Post('evolution/:orgSlug')
  @ApiOperation({ summary: 'Receber eventos messages.upsert da Evolution API' })
  async handleEvolutionWebhook(
    @Param('orgSlug') orgSlug: string,
    @Headers('apikey') apiKey: string | undefined,
    @Body() payload: Record<string, unknown>,
  ) {
    if (apiKey !== appEnv.EVOLUTION_API_KEY) {
      throw new UnauthorizedException('API Key do webhook inválida.');
    }

    const [org] = await this.database.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    if (!org) {
      throw new BadRequestException('Organização não encontrada.');
    }

    const data = payload.data as Record<string, unknown> | undefined;
    const key = data?.key as Record<string, unknown> | undefined;
    if (key?.fromMe === true) {
      return { ignored: true };
    }

    const remoteJid = String(key?.remoteJid ?? '');
    const phoneDigits = remoteJid.split('@')[0] ?? '';
    const msgContent = data?.message as Record<string, unknown> | undefined;
    const text =
      (msgContent?.conversation as string | undefined) ??
      ((msgContent?.extendedTextMessage as Record<string, unknown> | undefined)
        ?.text as string | undefined) ??
      '';

    if (!phoneDigits || !text) {
      return { ignored: true };
    }

    return this.whatsappService.recordInboundAndDebounce({
      organizationId: org.id,
      phoneE164: `+${phoneDigits}`,
      text,
      providerMessageId: String(key?.id ?? ''),
    });
  }
}
