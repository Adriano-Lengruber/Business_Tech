export const MODULE_CODES = [
  'core',
  'mod-service-orders',
  'mod-ai-agents',
  'mod-inventory-pos',
  'mod-finance-fiscal',
  'mod-3d-print',
  'mod-projects-dev',
  'mod-social-growth',
  'mod-contracts-sla',
] as const;

export type ModuleCode = (typeof MODULE_CODES)[number];

export interface ModuleDefinition {
  readonly code: ModuleCode;
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
  readonly dependsOn: readonly ModuleCode[];
}

export const MODULE_CATALOG: Record<ModuleCode, ModuleDefinition> = {
  core: {
    code: 'core',
    name: 'Núcleo CRM & Inbox',
    description:
      'Multi-tenant, Auth/RBAC, CRM PF/PJ, Timeline Unificada, Leads, Agenda e Portal do Cliente.',
    required: true,
    dependsOn: [],
  },
  'mod-service-orders': {
    code: 'mod-service-orders',
    name: 'Assistência Técnica & OS',
    description:
      'Ativos com QR Code, intake rápido, workflow de OS, diagnóstico, orçamentos e garantia/RMA.',
    required: false,
    dependsOn: ['core'],
  },
  'mod-ai-agents': {
    code: 'mod-ai-agents',
    name: 'Agentes de IA & WhatsApp',
    description:
      'AI Gateway local-first, WhatsApp 24/7 com transcrição de áudio, handoff humano, RAG e Copiloto.',
    required: false,
    dependsOn: ['core'],
  },
  'mod-inventory-pos': {
    code: 'mod-inventory-pos',
    name: 'Estoque, Compras & PDV',
    description:
      'Catálogo multi-segmento, controle por lote/serial, fornecedores e frente de caixa (PDV).',
    required: false,
    dependsOn: ['core'],
  },
  'mod-finance-fiscal': {
    code: 'mod-finance-fiscal',
    name: 'Financeiro & Fiscal BR',
    description:
      'Contas a pagar/receber, DRE, integração Asaas (PIX/Boleto/Cartão) e camada fiscal NF-e/NFS-e/NFC-e.',
    required: false,
    dependsOn: ['core'],
  },
  'mod-3d-print': {
    code: 'mod-3d-print',
    name: 'Estúdio de Impressão 3D',
    description:
      'Catálogo STL/3MF com preview 3D, filamentos/resinas, calculadora de custo e fila de impressoras.',
    required: false,
    dependsOn: ['core'],
  },
  'mod-projects-dev': {
    code: 'mod-projects-dev',
    name: 'Projetos & Software',
    description:
      'Escopo, Kanban/sprints, apontamento de horas, marcos e contratos mensais (retainer).',
    required: false,
    dependsOn: ['core'],
  },
  'mod-social-growth': {
    code: 'mod-social-growth',
    name: 'Social Media & Growth IA',
    description:
      'Calendário editorial, geração de posts por IA, agendamento, métricas e captura de leads.',
    required: false,
    dependsOn: ['core', 'mod-ai-agents'],
  },
  'mod-contracts-sla': {
    code: 'mod-contracts-sla',
    name: 'Contratos B2B, Preventiva & SLA',
    description:
      'Contratos mensais de suporte TI, franquia de horas, ativos cobertos, SLA e agenda preventiva.',
    required: false,
    dependsOn: ['core'],
  },
};
