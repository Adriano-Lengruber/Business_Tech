import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  AiGateway,
  PrivacyPolicyViolationError,
  AgentToolRegistry,
  chunkText,
  EMBEDDING_DIMENSIONS,
  generateDeterministicFallbackEmbedding,
  reciprocalRankFusion,
} from '../index.js';

test('AiGateway blocks cloud fallback when organization is in strict_local mode', () => {
  const gateway = new AiGateway({
    localBaseUrl: 'http://localhost:11434/v1',
    localChatModel: 'qwen2.5:7b',
    localReasoningModel: 'qwen2.5:14b',
    cloudBaseUrl: 'https://api.openai.com/v1',
    cloudApiKey: 'sk-test',
    cloudModel: 'gpt-4o-mini',
  });

  const localRoute = gateway.resolveModel({
    task: 'whatsapp_support',
    privacyMode: 'strict_local',
  });
  assert.equal(localRoute.isLocal, true);
  assert.equal(localRoute.modelId, 'qwen2.5:7b');

  assert.throws(
    () =>
      gateway.resolveModel({
        task: 'whatsapp_support',
        privacyMode: 'strict_local',
        preferCloud: true,
      }),
    PrivacyPolicyViolationError,
  );
});

test('AgentToolRegistry enforces module entitlements and AI risk matrix', async () => {
  const registry = new AgentToolRegistry();

  registry.register({
    name: 'get_repair_status',
    description: 'Consulta status de OS',
    moduleCode: 'mod-service-orders',
    riskLevel: 'READ_ONLY',
    inputSchema: z.object({ code: z.string() }),
    execute: async ({ code }) => ({ code, status: 'DIAGNOSIS' }),
  });

  registry.register({
    name: 'refund_payment',
    description: 'Estorna pagamento',
    moduleCode: 'mod-finance-fiscal',
    riskLevel: 'CRITICAL',
    inputSchema: z.object({ txId: z.string() }),
    execute: async () => ({ refunded: true }),
  });

  registry.register({
    name: 'publish_social_post',
    description: 'Publica post em rede social',
    moduleCode: 'mod-social-growth',
    riskLevel: 'WRITE_SENSITIVE',
    inputSchema: z.object({ postId: z.string() }),
    execute: async ({ postId }) => ({ published: postId }),
  });

  // Tenant sem mod-3d-print nem mod-social-growth
  const available = registry.listForTenant(['core', 'mod-service-orders']);
  assert.equal(available.length, 1);
  assert.equal(available[0]?.name, 'get_repair_status');

  // READ_ONLY executa automaticamente
  const readResult = await registry.invoke('get_repair_status', { code: 'OS-1' }, {
    organizationId: 'org-1',
    enabledModules: ['core', 'mod-service-orders'],
  });
  assert.equal(readResult.status, 'EXECUTED');

  // WRITE_SENSITIVE exige aprovação humana
  const pendingResult = await registry.invoke('publish_social_post', { postId: 'p-1' }, {
    organizationId: 'org-1',
    enabledModules: ['core', 'mod-social-growth'],
  });
  assert.equal(pendingResult.status, 'REQUIRES_APPROVAL');

  // CRITICAL é bloqueada para execução autônoma
  const blockedResult = await registry.invoke('refund_payment', { txId: 'tx-1' }, {
    organizationId: 'org-1',
    enabledModules: ['core', 'mod-finance-fiscal'],
    humanApproved: true,
  });
  assert.equal(blockedResult.status, 'BLOCKED');
});

test('RAG utilities chunk text, normalize 1024-d fallback embeddings and fuse ranks via RRF', () => {
  const sample = 'Parágrafo um sobre garantia.\n\nParágrafo dois sobre superaquecimento e pasta térmica.';
  const chunks = chunkText(sample, 45, 10);
  assert.ok(chunks.length >= 2);

  const vec = generateDeterministicFallbackEmbedding('garantia de 90 dias notebook');
  assert.equal(vec.length, EMBEDDING_DIMENSIONS);
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  assert.ok(Math.abs(norm - 1) < 0.01);

  const fused = reciprocalRankFusion(
    [
      { id: 'c1', documentId: 'd1', documentTitle: 'Doc 1', content: 'A' },
      { id: 'c2', documentId: 'd1', documentTitle: 'Doc 1', content: 'B' },
    ],
    [
      { id: 'c2', documentId: 'd1', documentTitle: 'Doc 1', content: 'B' },
      { id: 'c3', documentId: 'd2', documentTitle: 'Doc 2', content: 'C' },
    ],
  );
  // c2 appears in both lexical and vector hits, so RRF ranks it first
  assert.equal(fused[0]?.id, 'c2');
  assert.ok((fused[0]?.rankScore ?? 0) > (fused[1]?.rankScore ?? 0));
});
