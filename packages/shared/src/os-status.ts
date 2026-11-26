export const OS_STATUSES = [
  'PRE_REGISTRATION',
  'AWAITING_RECEIPT',
  'RECEIVED',
  'TRIAGE',
  'DIAGNOSIS',
  'AWAITING_QUOTE',
  'QUOTE_SENT',
  'AWAITING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'AWAITING_PART',
  'IN_REPAIR',
  'AWAITING_TEST',
  'TESTING',
  'READY',
  'AWAITING_PICKUP',
  'DELIVERED',
  'POST_SERVICE',
  'WARRANTY',
  'CANCELED',
  'UNREPAIRABLE',
  'ABANDONED',
] as const;

export type OsStatus = (typeof OS_STATUSES)[number];

export const OS_STATUS_LABELS: Record<OsStatus, string> = {
  PRE_REGISTRATION: 'Pré-cadastro',
  AWAITING_RECEIPT: 'Aguardando recebimento',
  RECEIVED: 'Recebido',
  TRIAGE: 'Triagem',
  DIAGNOSIS: 'Diagnóstico',
  AWAITING_QUOTE: 'Aguardando orçamento',
  QUOTE_SENT: 'Orçamento enviado',
  AWAITING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Reprovado',
  AWAITING_PART: 'Aguardando peça',
  IN_REPAIR: 'Em reparo',
  AWAITING_TEST: 'Aguardando teste',
  TESTING: 'Testando',
  READY: 'Pronto',
  AWAITING_PICKUP: 'Aguardando retirada',
  DELIVERED: 'Entregue',
  POST_SERVICE: 'Pós-atendimento',
  WARRANTY: 'Garantia',
  CANCELED: 'Cancelado',
  UNREPAIRABLE: 'Sem reparo',
  ABANDONED: 'Equipamento abandonado',
};

export const OS_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type OsPriority = (typeof OS_PRIORITIES)[number];
