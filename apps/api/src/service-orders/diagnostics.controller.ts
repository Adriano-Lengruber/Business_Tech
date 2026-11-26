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
import {
  aiAgentRuns,
  assets,
  auditLogs,
  desc,
  eq,
  organizations,
  osDiagnostics,
  serviceOrderEvents,
  serviceOrders,
} from '@al/database';
import { AiGateway, type AiPrivacyMode } from '@al/ai-core';
import { upsertDiagnosticSchema } from '@al/shared';
import {
  CurrentUser,
  RequireModule,
  RequirePermission,
  type AuthenticatedUser,
} from '../common/decorators/auth.decorators';
import { appEnv } from '../config/env';
import { DatabaseService } from '../database/database.module';

@ApiTags('Diagnóstico Técnico')
@ApiBearerAuth()
@RequireModule('mod-service-orders')
@Controller('service-orders/:osId/diagnostics')
export class DiagnosticsController {
  private readonly aiGateway = new AiGateway({
    localBaseUrl: appEnv.OLLAMA_BASE_URL,
    localChatModel: appEnv.OLLAMA_CHAT_MODEL,
    localReasoningModel: appEnv.OLLAMA_REASONING_MODEL,
  });

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  @RequirePermission('os:read')
  @ApiOperation({ summary: 'Listar diagnósticos técnicos da OS' })
  list(@Param('osId') osId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.database.withTenant(user.organizationId, (tx) =>
      tx
        .select()
        .from(osDiagnostics)
        .where(eq(osDiagnostics.serviceOrderId, osId))
        .orderBy(desc(osDiagnostics.createdAt)),
    );
  }

  @Post()
  @RequirePermission('os:write')
  @ApiOperation({ summary: 'Registrar diagnóstico técnico estruturado (fatos vs testes)' })
  async save(
    @Param('osId') osId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = upsertDiagnosticSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const input = parsed.data;

    return this.database.withTenant(user.organizationId, async (tx) => {
      const [os] = await tx
        .select()
        .from(serviceOrders)
        .where(eq(serviceOrders.id, osId))
        .limit(1);

      if (!os) {
        throw new NotFoundException('OS não encontrada.');
      }

      const [diag] = await tx
        .insert(osDiagnostics)
        .values({
          organizationId: user.organizationId,
          serviceOrderId: osId,
          category: input.category,
          observedFacts: input.observedFacts.trim(),
          testsPerformed: input.testsPerformed,
          finalDiagnosis: input.finalDiagnosis?.trim() || null,
          confidenceLevel: input.confidenceLevel,
          clientExplanation: input.clientExplanation?.trim() || null,
          createdByUserId: user.userId,
        })
        .returning();

      if (input.moveToAwaitingQuote && os.status !== 'AWAITING_QUOTE') {
        await tx
          .update(serviceOrders)
          .set({ status: 'AWAITING_QUOTE', updatedAt: new Date() })
          .where(eq(serviceOrders.id, osId));

        await tx.insert(serviceOrderEvents).values({
          organizationId: user.organizationId,
          serviceOrderId: osId,
          eventType: 'repair.status_changed',
          fromStatus: os.status,
          toStatus: 'AWAITING_QUOTE',
          note: 'Diagnóstico técnico concluído; aguardando geração de orçamento.',
          actorType: 'human',
          actorId: user.userId,
        });
      }

      await tx.insert(auditLogs).values({
        organizationId: user.organizationId,
        actorType: 'human',
        actorId: user.userId,
        action: 'diagnostic.recorded',
        entityType: 'os_diagnostic',
        entityId: diag!.id,
        afterState: {
          serviceOrderId: osId,
          confidenceLevel: input.confidenceLevel,
        },
      });

      return diag!;
    });
  }

  @Post('ai-assist')
  @RequirePermission('ai:use_copilot')
  @ApiOperation({
    summary: 'Gerar hipóteses técnicas e explicação em linguagem simples para o cliente (Local-First)',
  })
  async aiAssist(
    @Param('osId') osId: string,
    @Body() body: { observedFacts?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const startMs = Date.now();
    const ctx = await this.database.withTenant(user.organizationId, async (tx) => {
      const [row] = await tx
        .select({
          os: serviceOrders,
          asset: assets,
          privacyMode: organizations.aiPrivacyMode,
        })
        .from(serviceOrders)
        .innerJoin(organizations, eq(serviceOrders.organizationId, organizations.id))
        .leftJoin(assets, eq(serviceOrders.assetId, assets.id))
        .where(eq(serviceOrders.id, osId))
        .limit(1);
      return row;
    });

    if (!ctx) {
      throw new NotFoundException('OS não encontrada.');
    }

    const facts = body.observedFacts?.trim() || ctx.os.reportedSymptoms;
    const equip =
      [ctx.asset?.category, ctx.asset?.brand, ctx.asset?.model]
        .filter(Boolean)
        .join(' ') || 'equipamento';

    let hypotheses: string[] = [];
    let clientExplanation = '';
    let provider = 'grounded-fallback';
    let model = 'deterministic-template';

    try {
      const aiRes = await this.aiGateway.generateGroundedReply({
        task: 'diagnosis',
        privacyMode: (ctx.privacyMode ?? 'strict_local') as AiPrivacyMode,
        system: [
          'Você é um copiloto de diagnóstico técnico.',
          'Separe estritamente HIPÓTESES de FATOS OBSERVADOS e nunca invente defeitos não ligados aos sintomas.',
          'Responda em JSON válido: {"hypotheses": ["..."], "clientExplanation": "..."}',
        ].join('\n'),
        prompt: `Equipamento: ${equip}. Sintomas/Fatos: ${facts}`,
        timeoutMs: 9000,
      });

      const parsed = JSON.parse(aiRes.text) as {
        hypotheses?: string[];
        clientExplanation?: string;
      };
      if (Array.isArray(parsed.hypotheses) && parsed.clientExplanation) {
        hypotheses = parsed.hypotheses.slice(0, 4);
        clientExplanation = parsed.clientExplanation;
        provider = aiRes.providerKind;
        model = aiRes.modelId;
      }
    } catch {
      // Fallback determinístico seguro sem mascarar incerteza
    }

    if (hypotheses.length === 0) {
      hypotheses = [
        `Hipótese 1: Verificar integridade física e alimentação elétrica de ${equip}.`,
        'Hipótese 2: Validar sistema térmico, armazenamento (SMART) e memórias antes de orçar troca de peça.',
      ];
      clientExplanation = `Identificamos os seguintes sinais iniciais no seu ${equip}: "${facts}". Nossa bancada está realizando os testes técnicos para confirmar a causa exata antes de enviar o orçamento final.`;
    }

    await this.database.withTenant(user.organizationId, (tx) =>
      tx.insert(aiAgentRuns).values({
        organizationId: user.organizationId,
        serviceOrderId: osId,
        agentName: 'diagnostic-copilot',
        provider,
        model,
        latencyMs: Date.now() - startMs,
        riskLevel: 'READ_ONLY',
      }),
    );

    return { hypotheses, clientExplanation, provider, model };
  }
}
