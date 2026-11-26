import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  AiGateway,
  PrivacyPolicyViolationError,
  AgentToolRegistry,
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
