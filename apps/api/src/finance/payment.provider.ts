import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { appEnv } from '../config/env';

export interface CreateChargeInput {
  amountCents: number;
  description: string;
  dueDate: Date;
  externalReference: string;
}

export interface CreatedChargeResult {
  provider: 'asaas' | 'local_sandbox';
  chargeId: string;
  pixCopyPaste: string;
  invoiceUrl: string;
}

@Injectable()
export class AsaasPaymentProvider {
  private readonly logger = new Logger(AsaasPaymentProvider.name);

  async createPixCharge(input: CreateChargeInput): Promise<CreatedChargeResult> {
    if (appEnv.ASAAS_API_KEY) {
      try {
        const res = await fetch(`${appEnv.ASAAS_BASE_URL}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            access_token: appEnv.ASAAS_API_KEY,
          },
          body: JSON.stringify({
            billingType: 'PIX',
            value: input.amountCents / 100,
            dueDate: input.dueDate.toISOString().slice(0, 10),
            description: input.description,
            externalReference: input.externalReference,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            id: string;
            invoiceUrl?: string;
          };
          return {
            provider: 'asaas',
            chargeId: data.id,
            pixCopyPaste: `asaas-pix-${data.id}`,
            invoiceUrl: data.invoiceUrl ?? '',
          };
        }
        this.logger.warn(`Asaas API respondeu ${res.status}; usando sandbox local.`);
      } catch (err) {
        this.logger.warn(`Asaas indisponível: ${(err as Error).message}`);
      }
    }

    const chargeId = `pay_sbx_${randomUUID().slice(0, 12)}`;
    const amountStr = (input.amountCents / 100).toFixed(2);
    const pixCopyPaste = `00020126580014BR.GOV.BCB.PIX0136${chargeId}520400005303986540${amountStr.length}${amountStr}5802BR5915AL BUSINESS OS6009SAO PAULO62070503***6304ABCD`;

    return {
      provider: 'local_sandbox',
      chargeId,
      pixCopyPaste,
      invoiceUrl: `${appEnv.APP_URL}/app/finance?charge=${chargeId}`,
    };
  }
}
