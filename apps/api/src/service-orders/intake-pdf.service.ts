import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { OS_STATUS_LABELS, type OsStatus } from '@al/shared';

export interface IntakePdfData {
  orgName: string;
  osCode: string;
  status: string;
  priority: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  assetCategory?: string | null;
  assetBrand?: string | null;
  assetModel?: string | null;
  assetSerial?: string | null;
  assetQrToken?: string | null;
  reportedSymptoms: string;
  preliminaryDiagnosis?: string | null;
  intakeChecklist: Record<string, unknown>;
  portalUrl?: string;
}

@Injectable()
export class IntakePdfService {
  async generate(data: IntakePdfData): Promise<Buffer> {
    const qrPayload = data.portalUrl || data.assetQrToken || data.osCode;
    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      margin: 1,
      width: 110,
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 44 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(18)
        .fillColor('#0F172A')
        .text(data.orgName, { continued: false });
      doc
        .fontSize(10)
        .fillColor('#475569')
        .text('Termo de Recebimento e Entrada de Ordem de Serviço');

      doc.image(qrBuffer, 455, 42, { width: 92 });

      doc
        .moveDown(0.8)
        .fontSize(14)
        .fillColor('#2563EB')
        .text(`Protocolo: ${data.osCode}`);
      doc
        .fontSize(10)
        .fillColor('#334155')
        .text(
          `Status: ${OS_STATUS_LABELS[data.status as OsStatus] ?? data.status}   |   Prioridade: ${data.priority}   |   Data: ${data.createdAt.toLocaleString('pt-BR')}`,
        );

      doc.moveTo(44, 145).lineTo(551, 145).strokeColor('#E2E8F0').stroke();

      // Customer
      doc.y = 160;
      doc.fontSize(11).fillColor('#0F172A').text('1. Dados do Cliente');
      doc
        .fontSize(10)
        .fillColor('#334155')
        .text(`Nome: ${data.customerName}`)
        .text(`WhatsApp / Telefone: ${data.customerPhone}`);

      // Asset
      doc.moveDown(0.8);
      doc.fontSize(11).fillColor('#0F172A').text('2. Equipamento / Ativo');
      const equipName =
        [data.assetCategory, data.assetBrand, data.assetModel]
          .filter(Boolean)
          .join(' — ') || 'Não especificado';
      doc
        .fontSize(10)
        .fillColor('#334155')
        .text(`Equipamento: ${equipName}`)
        .text(`Número de Série: ${data.assetSerial || 'Não informado'}`)
        .text(`Etiqueta QR: ${data.assetQrToken || '—'}`);

      // Symptoms & Diagnosis
      doc.moveDown(0.8);
      doc.fontSize(11).fillColor('#0F172A').text('3. Sintomas Relatados e Pré-Avaliação');
      doc
        .fontSize(10)
        .fillColor('#334155')
        .text(`Sintomas: ${data.reportedSymptoms}`);
      if (data.preliminaryDiagnosis) {
        doc.text(`Pré-diagnóstico técnico: ${data.preliminaryDiagnosis}`);
      }

      // Checklist
      doc.moveDown(0.8);
      doc.fontSize(11).fillColor('#0F172A').text('4. Checklist de Entrada');
      const cl = data.intakeChecklist;
      doc
        .fontSize(10)
        .fillColor('#334155')
        .text(
          `Carregador incluso: ${cl.chargerIncluded ? 'Sim' : 'Não'}   |   Capa/Mochila: ${cl.caseOrBagIncluded ? 'Sim' : 'Não'}`,
        )
        .text(
          `Marcas/Arranhões prévios: ${cl.scratchesNoted ? 'Sim' : 'Não'}   |   Backup solicitado: ${cl.backupRequested ? 'Sim' : 'Não'}   |   Formatação autorizada: ${cl.formatAuthorized ? 'Sim' : 'Não'}`,
        );
      if (typeof cl.externalConditionNotes === 'string' && cl.externalConditionNotes) {
        doc.text(`Observações físicas: ${cl.externalConditionNotes}`);
      }

      // Terms
      doc.moveDown(1.2);
      doc
        .fontSize(8.5)
        .fillColor('#64748B')
        .text(
          'Condições gerais: A abertura da OS autoriza a inspeção técnica do equipamento. Serviços adicionais ou troca de peças dependem de aprovação prévia do orçamento pelo cliente. Acompanhe o andamento em tempo real pelo QR Code acima ou pelo WhatsApp.',
        );

      doc.moveDown(2.2);
      doc
        .fontSize(9)
        .fillColor('#334155')
        .text('________________________________________          ________________________________________')
        .text('           Assinatura do Cliente                                  Responsável pelo Recebimento');

      doc.end();
    });
  }
}
