import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { FiscalDocType } from '@al/shared';

export interface IssueFiscalDocParams {
  docType: FiscalDocType;
  series: number;
  number: number;
  totalCents: number;
  stateUf: string;
  taxRegime: string;
  providerName: string;
  simulateRejection?: boolean;
}

export interface IssueFiscalDocResult {
  status: 'AUTHORIZED' | 'REJECTED';
  accessKey: string | null;
  rejectionReason: string | null;
  xmlUrl: string | null;
  pdfUrl: string | null;
  issuedAt: Date | null;
}

@Injectable()
export class SandboxFiscalProvider {
  async issue(params: IssueFiscalDocParams): Promise<IssueFiscalDocResult> {
    if (params.simulateRejection) {
      return {
        status: 'REJECTED',
        accessKey: null,
        rejectionReason:
          'Rejeição SEFAZ 778: Informado NCM inexistente ou incompatível com o CFOP 5102 para o regime Simples Nacional.',
        xmlUrl: null,
        pdfUrl: null,
        issuedAt: null,
      };
    }

    const digits = randomBytes(22).toString('hex').slice(0, 44).replace(/[a-f]/g, '7');
    return {
      status: 'AUTHORIZED',
      accessKey: digits,
      rejectionReason: null,
      xmlUrl: `https://sandbox.fiscal.local/xml/${params.docType}-${params.series}-${params.number}.xml`,
      pdfUrl: `https://sandbox.fiscal.local/danfe/${params.docType}-${params.series}-${params.number}.pdf`,
      issuedAt: new Date(),
    };
  }
}
