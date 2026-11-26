import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface HardwareSnapshotView {
  stage: string;
  source: string;
  cpuModel: string | null;
  ramGb: number | null;
  storageSummary: string | null;
  smartHealthPct: number | null;
  batteryHealthPct: number | null;
  osVersion: string | null;
  cpuTempCelsius: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface DiagnosticReportData {
  orgName: string;
  osCode: string;
  customerName: string;
  assetLabel: string;
  assetSerial: string | null;
  assetQrToken: string | null;
  before: HardwareSnapshotView | null;
  after: HardwareSnapshotView | null;
  diagnosis: {
    observedFacts: string;
    finalDiagnosis: string | null;
    clientExplanation: string | null;
    testsPerformed: Array<{ name: string; passed: boolean; notes?: string }>;
  } | null;
}

@Injectable()
export class DiagnosticReportPdfService {
  async generate(data: DiagnosticReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 44 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(17).fillColor('#0F172A').text(data.orgName);
      doc
        .fontSize(10)
        .fillColor('#0D9488')
        .text('Certificado de Bancada & Laudo Técnico Comparativo (Antes / Depois)');

      doc
        .moveDown(0.5)
        .fontSize(12)
        .fillColor('#0F172A')
        .text(`Protocolo OS: ${data.osCode}`);
      doc
        .fontSize(9.5)
        .fillColor('#475569')
        .text(
          `Cliente: ${data.customerName}   |   Equipamento: ${data.assetLabel}`,
        )
        .text(
          `Serial: ${data.assetSerial || 'Não informado'}   |   QR: ${data.assetQrToken || '—'}   |   Emitido em: ${new Date().toLocaleString('pt-BR')}`,
        );

      doc.moveDown(0.8);
      doc.moveTo(44, doc.y).lineTo(551, doc.y).strokeColor('#CBD5E1').stroke();
      doc.moveDown(0.8);

      // Section 1: Before vs After comparison
      doc
        .fontSize(11)
        .fillColor('#0F172A')
        .text('1. Comparativo Técnico de Hardware (Antes x Depois)');
      doc.moveDown(0.4);

      const rows: Array<[string, string, string]> = [
        [
          'Processador',
          data.before?.cpuModel ?? '—',
          data.after?.cpuModel ?? '—',
        ],
        [
          'Memória RAM',
          data.before?.ramGb != null ? `${data.before.ramGb} GB` : '—',
          data.after?.ramGb != null ? `${data.after.ramGb} GB` : '—',
        ],
        [
          'Armazenamento',
          data.before?.storageSummary ?? '—',
          data.after?.storageSummary ?? '—',
        ],
        [
          'Saúde SMART SSD/HD',
          data.before?.smartHealthPct != null
            ? `${data.before.smartHealthPct}%`
            : '—',
          data.after?.smartHealthPct != null
            ? `${data.after.smartHealthPct}%`
            : '—',
        ],
        [
          'Saúde da Bateria',
          data.before?.batteryHealthPct != null
            ? `${data.before.batteryHealthPct}%`
            : '—',
          data.after?.batteryHealthPct != null
            ? `${data.after.batteryHealthPct}%`
            : '—',
        ],
        [
          'Temperatura CPU',
          data.before?.cpuTempCelsius != null
            ? `${data.before.cpuTempCelsius}°C`
            : '—',
          data.after?.cpuTempCelsius != null
            ? `${data.after.cpuTempCelsius}°C`
            : '—',
        ],
        [
          'Sistema Operacional',
          data.before?.osVersion ?? '—',
          data.after?.osVersion ?? '—',
        ],
      ];

      // Simple aligned table
      const colX = [44, 190, 370];
      doc.fontSize(9).fillColor('#0D9488');
      const headerY = doc.y;
      doc.text('Indicador', colX[0], headerY, { width: 140 });
      doc.text('Entrada (Antes)', colX[1], headerY, { width: 170 });
      doc.text('Entrega (Depois)', colX[2], headerY, { width: 175 });
      doc.moveDown(0.35);

      for (const [metric, beforeVal, afterVal] of rows) {
        const y = doc.y;
        doc.fontSize(9).fillColor('#1E293B').text(metric, colX[0], y, { width: 140 });
        doc.fillColor('#64748B').text(beforeVal, colX[1], y, { width: 170 });
        doc.fillColor('#0F172A').text(afterVal, colX[2], y, { width: 175 });
        doc.moveDown(0.25);
      }

      // Section 2: Structural Diagnosis
      doc.moveDown(0.8);
      doc.fontSize(11).fillColor('#0F172A').text('2. Diagnóstico Técnico e Testes Executados');
      doc.moveDown(0.3);

      if (data.diagnosis) {
        doc
          .fontSize(9.5)
          .fillColor('#334155')
          .text(`Fatos observados: ${data.diagnosis.observedFacts}`);
        if (data.diagnosis.finalDiagnosis) {
          doc.text(`Conclusão técnica: ${data.diagnosis.finalDiagnosis}`);
        }
        if (data.diagnosis.clientExplanation) {
          doc.text(`Resumo para o cliente: ${data.diagnosis.clientExplanation}`);
        }
        if (data.diagnosis.testsPerformed.length > 0) {
          doc.moveDown(0.3);
          for (const t of data.diagnosis.testsPerformed) {
            doc.text(
              `• ${t.name}: ${t.passed ? 'APROVADO' : 'ATENÇÃO / FALHA'}${t.notes ? ` (${t.notes})` : ''}`,
            );
          }
        }
      } else {
        doc
          .fontSize(9.5)
          .fillColor('#64748B')
          .text('Nenhum laudo estruturado adicional registrado até o momento.');
      }

      doc.moveDown(1.2);
      doc
        .fontSize(8.5)
        .fillColor('#64748B')
        .text(
          'Observação técnica: Os indicadores acima refletem apenas os sensores e testes consentidos executados em bancada no momento de cada coleta.',
        );

      doc.moveDown(2);
      doc
        .fontSize(9)
        .fillColor('#334155')
        .text('________________________________________          ________________________________________')
        .text('           Técnico Responsável                                   Conferência do Cliente');

      doc.end();
    });
  }
}
