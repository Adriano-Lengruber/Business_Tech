import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  aiAgentRuns,
  auditLogs,
  conversations,
  desc,
  eq,
  financialTransactions,
  knowledgeChunks,
  knowledgeDocuments,
  leads,
  organizations,
  products,
  serviceOrders,
  sql,
} from '@al/database';
import {
  AgentToolRegistry,
  AiGateway,
  chunkText,
  generateEmbeddingLocalFirst,
  reciprocalRankFusion,
  type AiPrivacyMode,
  type RankedChunkHit,
} from '@al/ai-core';
import {
  checkStockAlert,
  OS_STATUS_LABELS,
  type IngestKnowledgeDocInput,
  type ModuleCode,
  type OsStatus,
} from '@al/shared';
import { appEnv } from '../config/env';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class KnowledgeService {
  private readonly aiGateway = new AiGateway({
    localBaseUrl: appEnv.OLLAMA_BASE_URL,
    localChatModel: appEnv.OLLAMA_CHAT_MODEL,
    localReasoningModel: appEnv.OLLAMA_REASONING_MODEL,
  });
  private readonly briefingCache = new Map<
    string,
    {
      narrative: string;
      provider: string;
      model: string;
      expiresAt: number;
    }
  >();

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) { }

  async listDocuments(organizationId: string) {
    return this.database.withTenant(organizationId, async (tx) => {
      const docs = await tx
        .select()
        .from(knowledgeDocuments)
        .orderBy(desc(knowledgeDocuments.createdAt));

      const chunkCounts = await tx
        .select({
          documentId: knowledgeChunks.documentId,
          count: sql<number>`count(*)::int`,
        })
        .from(knowledgeChunks)
        .groupBy(knowledgeChunks.documentId);

      const countMap = new Map(chunkCounts.map((c) => [c.documentId, c.count]));
      return docs.map((d) => ({
        ...d,
        chunksCount: countMap.get(d.id) ?? 0,
      }));
    });
  }

  async ingestDocument(
    organizationId: string,
    userId: string,
    input: IngestKnowledgeDocInput,
  ) {
    const sha256 = createHash('sha256').update(input.content).digest('hex');
    const chunks = chunkText(input.content, 700, 100);

    const embeddedChunks = await Promise.all(
      chunks.map(async (chunk) => {
        const emb = await generateEmbeddingLocalFirst({
          text: chunk.content,
          ollamaBaseUrl: appEnv.OLLAMA_BASE_URL,
          embeddingModel: appEnv.OLLAMA_EMBEDDING_MODEL,
        });
        return { ...chunk, embedding: emb.embedding, provider: emb.provider };
      }),
    );

    return this.database.withTenant(organizationId, async (tx) => {
      const [doc] = await tx
        .insert(knowledgeDocuments)
        .values({
          organizationId,
          title: input.title.trim(),
          sourceType: input.sourceType,
          sha256,
          storageKey: `kb/${organizationId}/${Date.now()}-${sha256.slice(0, 8)}.txt`,
        })
        .returning();

      if (embeddedChunks.length > 0) {
        await tx.insert(knowledgeChunks).values(
          embeddedChunks.map((c) => ({
            organizationId,
            documentId: doc!.id,
            chunkIndex: c.index,
            content: c.content,
            embedding: c.embedding,
            metadata: {
              source: doc!.title,
              sourceType: input.sourceType,
              embeddingProvider: c.provider,
            },
          })),
        );
      }

      await tx.insert(auditLogs).values({
        organizationId,
        actorType: 'human',
        actorId: userId,
        action: 'knowledge.document_ingested',
        entityType: 'knowledge_document',
        entityId: doc!.id,
        afterState: { title: doc!.title, chunks: embeddedChunks.length },
      });

      return { ...doc!, chunksCount: embeddedChunks.length };
    });
  }

  async hybridSearch(
    organizationId: string,
    query: string,
    limit = 4,
  ): Promise<RankedChunkHit[]> {
    const emb = await generateEmbeddingLocalFirst({
      text: query,
      ollamaBaseUrl: appEnv.OLLAMA_BASE_URL,
      embeddingModel: appEnv.OLLAMA_EMBEDDING_MODEL,
    });
    const vectorLiteral = `[${emb.embedding.join(',')}]`;

    return this.database.withTenant(organizationId, async (tx) => {
      // 1. Busca Lexical (PostgreSQL Portuguese FTS + ILIKE fallback)
      const lexicalRes = await tx.execute(sql`
        SELECT
          kc.id,
          kc.document_id AS "documentId",
          kd.title AS "documentTitle",
          kc.content
        FROM knowledge_chunks kc
        INNER JOIN knowledge_documents kd ON kc.document_id = kd.id
        WHERE to_tsvector('portuguese', kc.content) @@ plainto_tsquery('portuguese', ${query})
           OR kc.content ILIKE ${'%' + query.trim() + '%'}
           OR kd.title ILIKE ${'%' + query.trim() + '%'}
        ORDER BY ts_rank(to_tsvector('portuguese', kc.content), plainto_tsquery('portuguese', ${query})) DESC
        LIMIT ${limit * 2}
      `);

      // 2. Busca Semântica (pgvector cosine distance)
      const vectorRes = await tx.execute(sql`
        SELECT
          kc.id,
          kc.document_id AS "documentId",
          kd.title AS "documentTitle",
          kc.content
        FROM knowledge_chunks kc
        INNER JOIN knowledge_documents kd ON kc.document_id = kd.id
        WHERE kc.embedding IS NOT NULL
        ORDER BY kc.embedding <=> ${vectorLiteral}::vector
        LIMIT ${limit * 2}
      `);

      const lexicalHits = (lexicalRes.rows ?? []) as unknown as RankedChunkHit[];
      const vectorHits = (vectorRes.rows ?? []) as unknown as RankedChunkHit[];

      return reciprocalRankFusion(lexicalHits, vectorHits).slice(0, limit);
    });
  }

  async getDailyBriefing(organizationId: string, refreshAi = false) {
    const startMs = Date.now();

    const snapshot = await this.database.withTenant(
      organizationId,
      async (tx) => {
        const [org] = await tx
          .select()
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1);

        const osRows = await tx
          .select({ status: serviceOrders.status, priority: serviceOrders.priority })
          .from(serviceOrders);

        const waitingHumanRows = await tx
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.botState, 'WAITING_HUMAN'));

        const txRows = await tx
          .select({
            type: financialTransactions.type,
            status: financialTransactions.status,
            amountCents: financialTransactions.amountCents,
            dueDate: financialTransactions.dueDate,
          })
          .from(financialTransactions);

        const prodRows = await tx
          .select({
            name: products.name,
            stockQty: products.stockQty,
            minStockQty: products.minStockQty,
          })
          .from(products);

        const newLeads = await tx
          .select({ id: leads.id })
          .from(leads)
          .where(eq(leads.stage, 'NEW'));

        const now = Date.now();
        const openOsCount = osRows.filter(
          (o) => !['DELIVERED', 'CANCELED', 'UNREPAIRABLE'].includes(o.status),
        ).length;
        const urgentOsCount = osRows.filter(
          (o) =>
            !['DELIVERED', 'CANCELED'].includes(o.status) &&
            (o.priority === 'URGENT' || o.priority === 'HIGH'),
        ).length;
        const overdueReceivableCents = txRows
          .filter(
            (t) =>
              t.type === 'receivable' &&
              (t.status === 'OVERDUE' ||
                (t.status === 'PENDING' && t.dueDate.getTime() < now)),
          )
          .reduce((sum, t) => sum + t.amountCents, 0);
        const lowStockCount = prodRows.filter(
          (p) => checkStockAlert(p.stockQty, p.minStockQty) !== 'OK',
        ).length;

        return {
          orgName: org?.name ?? 'AL Business OS',
          privacyMode: (org?.aiPrivacyMode ?? 'strict_local') as AiPrivacyMode,
          openOsCount,
          urgentOsCount,
          waitingHumanCount: waitingHumanRows.length,
          overdueReceivableCents,
          lowStockCount,
          newLeadsCount: newLeads.length,
        };
      },
    );

    const overdueBrl = (snapshot.overdueReceivableCents / 100).toLocaleString(
      'pt-BR',
      { style: 'currency', currency: 'BRL' },
    );

    let narrative = `Bom dia. A ${snapshot.orgName} possui ${snapshot.openOsCount} OS aberta(s) (${snapshot.urgentOsCount} prioritária(s)), ${snapshot.waitingHumanCount} atendimento(s) no WhatsApp aguardando humano, ${snapshot.lowStockCount} item(ns) com estoque baixo, ${snapshot.newLeadsCount} lead(s) novo(s) e ${overdueBrl} em cobranças vencidas.`;
    let provider = 'grounded-instant';
    let model = 'deterministic-briefing';
    let aiStatus: 'instant_grounded' | 'ai_enriched' = 'instant_grounded';

    const cached = this.briefingCache.get(organizationId);
    const nowMs = Date.now();

    if (cached && cached.expiresAt > nowMs && !refreshAi) {
      narrative = cached.narrative;
      provider = cached.provider;
      model = cached.model;
      aiStatus = 'ai_enriched';
    } else if (refreshAi) {
      try {
        const res = await this.aiGateway.generateGroundedReply({
          task: 'executive_briefing',
          privacyMode: snapshot.privacyMode,
          system:
            'Você é o Analista Executivo do ERP. Gere um briefing matinal de 2 a 3 frases em PT-BR usando APENAS os números fornecidos. Nunca invente valores.',
          prompt: JSON.stringify(snapshot),
          timeoutMs: 2500,
        });
        if (res.text) {
          narrative = res.text;
          provider = res.providerKind;
          model = res.modelId;
          aiStatus = 'ai_enriched';
          this.briefingCache.set(organizationId, {
            narrative,
            provider,
            model,
            expiresAt: nowMs + 10 * 60 * 1000,
          });
        }
      } catch {
        // Mantém resposta instantânea determinística quando Ollama local estiver offline
      }
    } else {
      // Atualiza cache em segundo plano sem bloquear a resposta do painel
      void this.aiGateway
        .generateGroundedReply({
          task: 'executive_briefing',
          privacyMode: snapshot.privacyMode,
          system:
            'Você é o Analista Executivo do ERP. Gere um briefing matinal de 2 a 3 frases em PT-BR usando APENAS os números fornecidos. Nunca invente valores.',
          prompt: JSON.stringify(snapshot),
          timeoutMs: 2500,
        })
        .then((res) => {
          if (res.text) {
            this.briefingCache.set(organizationId, {
              narrative: res.text,
              provider: res.providerKind,
              model: res.modelId,
              expiresAt: Date.now() + 10 * 60 * 1000,
            });
          }
        })
        .catch(() => undefined);
    }

    await this.database.withTenant(organizationId, (tx) =>
      tx.insert(aiAgentRuns).values({
        organizationId,
        agentName: 'executive-analyst',
        provider,
        model,
        latencyMs: Date.now() - startMs,
        riskLevel: 'READ_ONLY',
      }),
    );

    return {
      ...snapshot,
      aiStatus,
      generatedInMs: Date.now() - startMs,
      narrative,
      highlights: [
        {
          label: 'WhatsApp Aguardando Humano',
          value: String(snapshot.waitingHumanCount),
          href: '/app/inbox',
          severity: snapshot.waitingHumanCount > 0 ? 'warning' : 'ok',
        },
        {
          label: 'OS Abertas / Prioritárias',
          value: `${snapshot.openOsCount} (${snapshot.urgentOsCount} alta)`,
          href: '/app',
          severity: snapshot.urgentOsCount > 0 ? 'accent' : 'ok',
        },
        {
          label: 'Estoque Baixo / Crítico',
          value: String(snapshot.lowStockCount),
          href: '/app/inventory',
          severity: snapshot.lowStockCount > 0 ? 'warning' : 'ok',
        },
        {
          label: 'Cobranças Vencidas',
          value: overdueBrl,
          href: '/app/finance',
          severity: snapshot.overdueReceivableCents > 0 ? 'danger' : 'ok',
        },
      ],
    };
  }

  async askCopilot(
    organizationId: string,
    enabledModules: readonly ModuleCode[],
    question: string,
  ) {
    const startMs = Date.now();
    const registry = new AgentToolRegistry();

    registry.register({
      name: 'get_os_summary',
      description: 'Lista as ordens de serviço abertas e seus status reais',
      moduleCode: 'mod-service-orders',
      riskLevel: 'READ_ONLY',
      inputSchema: z.object({}),
      execute: async () =>
        this.database.withTenant(organizationId, (tx) =>
          tx
            .select({
              code: serviceOrders.code,
              status: serviceOrders.status,
              priority: serviceOrders.priority,
              symptoms: serviceOrders.reportedSymptoms,
            })
            .from(serviceOrders)
            .orderBy(desc(serviceOrders.createdAt))
            .limit(10),
        ),
    });

    registry.register({
      name: 'get_low_stock_products',
      description: 'Lista produtos com estoque igual ou abaixo do mínimo',
      moduleCode: 'mod-inventory-pos',
      riskLevel: 'READ_ONLY',
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await this.database.withTenant(organizationId, (tx) =>
          tx.select().from(products),
        );
        return rows.filter(
          (p) => checkStockAlert(p.stockQty, p.minStockQty) !== 'OK',
        );
      },
    });

    registry.register({
      name: 'get_finance_summary',
      description: 'Resumo de contas a receber e pagar em centavos',
      moduleCode: 'mod-finance-fiscal',
      riskLevel: 'READ_ONLY',
      inputSchema: z.object({}),
      execute: async () =>
        this.database.withTenant(organizationId, (tx) =>
          tx
            .select({
              type: financialTransactions.type,
              status: financialTransactions.status,
              amountCents: financialTransactions.amountCents,
              description: financialTransactions.description,
            })
            .from(financialTransactions)
            .orderBy(desc(financialTransactions.createdAt))
            .limit(15),
        ),
    });

    const [osRes, stockRes, finRes, ragHits] = await Promise.all([
      registry.invoke<Array<{ code: string; status: string; priority: string; symptoms: string }>>(
        'get_os_summary',
        {},
        { organizationId, enabledModules },
      ),
      registry.invoke<Array<{ sku: string; name: string; stockQty: number; minStockQty: number }>>(
        'get_low_stock_products',
        {},
        { organizationId, enabledModules },
      ),
      registry.invoke<Array<{ type: string; status: string; amountCents: number; description: string }>>(
        'get_finance_summary',
        {},
        { organizationId, enabledModules },
      ),
      this.hybridSearch(organizationId, question, 3),
    ]);

    const osData = osRes.status === 'EXECUTED' ? osRes.data : [];
    const lowStock = stockRes.status === 'EXECUTED' ? stockRes.data : [];
    const finData = finRes.status === 'EXECUTED' ? finRes.data : [];

    const orgRow = await this.database.withTenant(organizationId, async (tx) => {
      const [o] = await tx
        .select({ privacyMode: organizations.aiPrivacyMode })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      return o;
    });

    let answer = '';
    let provider = 'grounded-fallback';
    let model = 'deterministic-copilot';

    try {
      const aiRes = await this.aiGateway.generateGroundedReply({
        task: 'triage',
        privacyMode: (orgRow?.privacyMode ?? 'strict_local') as AiPrivacyMode,
        system: [
          'Você é o Copiloto Operacional do AL Business OS.',
          'Responda em PT-BR com base EXCLUSIVA nos dados JSON e trechos da base de conhecimento abaixo. Cite o título do documento quando usar o RAG.',
          'Se não houver evidência suficiente, responda exatamente: "Não encontrei informação suficiente no sistema."',
          `OS: ${JSON.stringify(osData)}`,
          `Estoque Baixo: ${JSON.stringify(lowStock)}`,
          `Financeiro: ${JSON.stringify(finData)}`,
          `RAG: ${JSON.stringify(ragHits.map((h) => ({ fonte: h.documentTitle, trecho: h.content })))}`,
        ].join('\n'),
        prompt: question,
        timeoutMs: 7000,
      });
      if (aiRes.text) {
        answer = aiRes.text;
        provider = aiRes.providerKind;
        model = aiRes.modelId;
      }
    } catch {
      // Fallback determinístico aterrado
    }

    if (!answer) {
      const q = question.toLowerCase();
      if (q.includes('estoque') || q.includes('peça') || q.includes('peca') || q.includes('repor')) {
        answer =
          lowStock.length > 0
            ? `Itens com estoque baixo/crítico: ${lowStock
              .map((p) => `${p.name} (${p.sku}: ${p.stockQty} un, mín ${p.minStockQty})`)
              .join('; ')}.`
            : 'Nenhum produto está abaixo do estoque mínimo no momento.';
      } else if (q.includes('os') || q.includes('ordem') || q.includes('bancada') || q.includes('diagnóstico')) {
        answer =
          osData.length > 0
            ? `Ordens recentes no sistema: ${osData
              .slice(0, 5)
              .map(
                (o) =>
                  `${o.code} (${OS_STATUS_LABELS[o.status as OsStatus] ?? o.status})`,
              )
              .join(', ')}.`
            : 'Nenhuma OS encontrada para esta organização.';
      } else if (q.includes('receber') || q.includes('pagar') || q.includes('caixa') || q.includes('finance')) {
        const pendingRec = finData
          .filter((f) => f.type === 'receivable' && f.status === 'PENDING')
          .reduce((s, f) => s + f.amountCents, 0);
        answer = `Contas a receber em aberto: ${(pendingRec / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${finData.length} lançamentos recentes).`;
      } else if (ragHits.length > 0) {
        const top = ragHits[0]!;
        answer = `Segundo "${top.documentTitle}": ${top.content}`;
      } else {
        answer = 'Não encontrei informação suficiente no sistema.';
      }
    }

    await this.database.withTenant(organizationId, (tx) =>
      tx.insert(aiAgentRuns).values({
        organizationId,
        agentName: 'operational-copilot',
        provider,
        model,
        latencyMs: Date.now() - startMs,
        toolsCalled: [
          { name: 'get_os_summary', count: osData.length },
          { name: 'get_low_stock_products', count: lowStock.length },
          { name: 'search_knowledge_base', count: ragHits.length },
        ],
        riskLevel: 'READ_ONLY',
      }),
    );

    return {
      answer,
      sources: ragHits.map((h) => ({
        documentTitle: h.documentTitle,
        rankScore: h.rankScore,
      })),
      provider,
      model,
    };
  }

  listTelemetry(organizationId: string) {
    return this.database.withTenant(organizationId, (tx) =>
      tx
        .select()
        .from(aiAgentRuns)
        .orderBy(desc(aiAgentRuns.createdAt))
        .limit(40),
    );
  }
}
