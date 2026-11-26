import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, type LanguageModelV1 } from 'ai';

export type AiPrivacyMode = 'strict_local' | 'hybrid_anonymized' | 'cloud_allowed';

export type AiTaskType =
  | 'triage'
  | 'whatsapp_support'
  | 'diagnosis'
  | 'marketing_copy'
  | 'executive_briefing';

export type AiProviderKind = 'ollama' | 'lm_studio' | 'cloud_openai_compatible';

export interface AiGatewayConfig {
  localBaseUrl: string;
  localChatModel: string;
  localReasoningModel: string;
  cloudBaseUrl?: string;
  cloudApiKey?: string;
  cloudModel?: string;
}

export class PrivacyPolicyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrivacyPolicyViolationError';
  }
}

export interface ResolvedModelRoute {
  providerKind: AiProviderKind;
  modelId: string;
  isLocal: boolean;
  model: LanguageModelV1;
}

export class AiGateway {
  constructor(private readonly config: AiGatewayConfig) {}

  resolveModel(params: {
    task: AiTaskType;
    privacyMode: AiPrivacyMode;
    preferCloud?: boolean;
    containsCustomerPii?: boolean;
  }): ResolvedModelRoute {
    const wantsCloud = Boolean(params.preferCloud);

    if (wantsCloud) {
      if (params.privacyMode === 'strict_local') {
        throw new PrivacyPolicyViolationError(
          'Organização em modo strict_local não permite envio de dados para APIs em nuvem.',
        );
      }
      if (params.privacyMode === 'hybrid_anonymized' && params.containsCustomerPii) {
        throw new PrivacyPolicyViolationError(
          'Dados pessoais (PII) não podem ser enviados para nuvem sem anonimização prévia.',
        );
      }
      if (!this.config.cloudBaseUrl || !this.config.cloudApiKey || !this.config.cloudModel) {
        throw new Error('Provedor de IA em nuvem solicitado, mas não configurado.');
      }

      const cloudProvider = createOpenAICompatible({
        name: 'cloud-fallback',
        baseURL: this.config.cloudBaseUrl,
        apiKey: this.config.cloudApiKey,
      });

      return {
        providerKind: 'cloud_openai_compatible',
        modelId: this.config.cloudModel,
        isLocal: false,
        model: cloudProvider(this.config.cloudModel),
      };
    }

    const localProvider = createOpenAICompatible({
      name: 'local-ollama',
      baseURL: this.config.localBaseUrl,
      apiKey: 'ollama',
    });

    const modelId =
      params.task === 'diagnosis' || params.task === 'executive_briefing'
        ? this.config.localReasoningModel
        : this.config.localChatModel;

    return {
      providerKind: 'ollama',
      modelId,
      isLocal: true,
      model: localProvider(modelId),
    };
  }

  async generateGroundedReply(params: {
    task: AiTaskType;
    privacyMode: AiPrivacyMode;
    system: string;
    prompt: string;
    timeoutMs?: number;
  }) {
    const route = this.resolveModel({
      task: params.task,
      privacyMode: params.privacyMode,
    });

    const result = await generateText({
      model: route.model,
      system: params.system,
      prompt: params.prompt,
      abortSignal: AbortSignal.timeout(params.timeoutMs ?? 8000),
    });

    return {
      text: result.text.trim(),
      providerKind: route.providerKind,
      modelId: route.modelId,
      isLocal: route.isLocal,
    };
  }
}
