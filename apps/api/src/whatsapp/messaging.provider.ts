import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { appEnv } from '../config/env';

export interface SendTextMessageParams {
  toPhoneE164: string;
  text: string;
}

export interface SendMessageResult {
  providerMessageId: string;
  deliveredVia: 'evolution_api' | 'local_sandbox';
}

export interface MessagingProvider {
  sendText(params: SendTextMessageParams): Promise<SendMessageResult>;
}

@Injectable()
export class EvolutionMessagingProvider implements MessagingProvider {
  private readonly logger = new Logger(EvolutionMessagingProvider.name);

  async sendText(params: SendTextMessageParams): Promise<SendMessageResult> {
    const cleanNumber = params.toPhoneE164.replace(/\D/g, '');
    const url = `${appEnv.EVOLUTION_API_URL}/message/sendText/${appEnv.EVOLUTION_INSTANCE}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: appEnv.EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: cleanNumber,
          text: params.text,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as { key?: { id?: string } };
        return {
          providerMessageId: data.key?.id ?? `evo-${randomUUID()}`,
          deliveredVia: 'evolution_api',
        };
      }

      this.logger.warn(
        `Evolution API respondeu ${res.status}; registrando envio no Inbox local_sandbox.`,
      );
    } catch {
      this.logger.debug(
        'Evolution API offline/não pareada; usando modo local_sandbox para persistência no Inbox.',
      );
    }

    return {
      providerMessageId: `sandbox-${randomUUID()}`,
      deliveredVia: 'local_sandbox',
    };
  }
}
