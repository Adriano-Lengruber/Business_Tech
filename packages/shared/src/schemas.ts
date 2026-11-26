import { z } from 'zod';
import { MODULE_CODES } from './modules.js';
import { OS_PRIORITIES, OS_STATUSES } from './os-status.js';
import {
  FINANCIAL_TYPES,
  PAYMENT_METHODS,
  QUOTE_ITEM_TYPES,
  QUOTE_TIERS,
} from './finance.js';

export const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerOrganizationSchema = z.object({
  ownerName: z.string().min(2, 'Nome muito curto').max(120),
  email: z.string().email('Informe um e-mail válido'),
  password: z
    .string()
    .min(8, 'A senha deve ter ao menos 8 caracteres')
    .max(128),
  organizationName: z.string().min(2, 'Nome da empresa obrigatório').max(140),
  cnpj: z.string().max(18).optional(),
  enabledModules: z
    .array(z.enum(MODULE_CODES))
    .default(['core', 'mod-service-orders']),
});
export type RegisterOrganizationInput = z.infer<typeof registerOrganizationSchema>;

export const toggleModuleSchema = z.object({
  enabled: z.boolean(),
});
export type ToggleModuleInput = z.infer<typeof toggleModuleSchema>;

export const createCustomerSchema = z.object({
  type: z.enum(['PF', 'PJ']).default('PF'),
  name: z.string().min(2, 'Nome obrigatório').max(180),
  phoneE164: z
    .string()
    .min(8, 'Telefone/WhatsApp obrigatório')
    .max(24),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  document: z.string().max(20).optional(),
  tags: z.array(z.string().max(40)).default([]),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const createAssetSchema = z.object({
  customerId: z.string().uuid('Cliente inválido'),
  category: z.string().min(2).max(60),
  brand: z.string().max(80).optional(),
  model: z.string().max(120).optional(),
  serialNumber: z.string().max(120).optional(),
  specs: z.record(z.unknown()).default({}),
});
export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const createServiceOrderSchema = z.object({
  customerId: z.string().uuid('Cliente obrigatório'),
  assetId: z.string().uuid().optional().nullable(),
  priority: z.enum(OS_PRIORITIES).default('NORMAL'),
  reportedSymptoms: z
    .string()
    .min(4, 'Descreva os sintomas relatados pelo cliente')
    .max(4000),
  preliminaryDiagnosis: z.string().max(4000).optional(),
  intakeChecklist: z
    .object({
      chargerIncluded: z.boolean().default(false),
      caseOrBagIncluded: z.boolean().default(false),
      scratchesNoted: z.boolean().default(false),
      backupRequested: z.boolean().default(false),
      formatAuthorized: z.boolean().default(false),
      externalConditionNotes: z.string().max(1000).optional(),
    })
    .default({}),
  promisedAt: z.string().datetime().optional().nullable(),
  notifyWhatsapp: z.boolean().default(true),
});
export type CreateServiceOrderInput = z.infer<typeof createServiceOrderSchema>;

export const updateServiceOrderStatusSchema = z.object({
  status: z.enum(OS_STATUSES),
  note: z.string().max(1000).optional(),
  notifyWhatsapp: z.boolean().default(true),
});
export type UpdateServiceOrderStatusInput = z.infer<
  typeof updateServiceOrderStatusSchema
>;

export const simulateInboundWhatsappSchema = z.object({
  phoneE164: z.string().min(8).max(24),
  text: z.string().min(1).max(3000),
  isAudio: z.boolean().default(false),
});
export type SimulateInboundWhatsappInput = z.infer<
  typeof simulateInboundWhatsappSchema
>;

export const replyConversationSchema = z.object({
  text: z.string().min(1, 'Digite uma mensagem').max(3000),
});
export type ReplyConversationInput = z.infer<typeof replyConversationSchema>;

export const upsertDiagnosticSchema = z.object({
  category: z.string().min(2).max(60).default('geral'),
  observedFacts: z.string().min(4, 'Descreva os fatos observados').max(4000),
  testsPerformed: z
    .array(
      z.object({
        name: z.string().min(1).max(160),
        passed: z.boolean(),
        notes: z.string().max(400).optional(),
      }),
    )
    .default([]),
  finalDiagnosis: z.string().max(4000).optional(),
  confidenceLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  clientExplanation: z.string().max(3000).optional(),
  moveToAwaitingQuote: z.boolean().default(false),
});
export type UpsertDiagnosticInput = z.infer<typeof upsertDiagnosticSchema>;

export const createQuoteSchema = z.object({
  tier: z.enum(QUOTE_TIERS).default('recommended'),
  warrantyDays: z.coerce.number().int().min(0).max(3650).default(90),
  validDays: z.coerce.number().int().min(1).max(180).default(7),
  paymentTerms: z.string().max(240).default('PIX à vista ou até 3x no cartão'),
  clientNotes: z.string().max(2000).optional(),
  sendImmediately: z.boolean().default(false),
  items: z
    .array(
      z.object({
        itemType: z.enum(QUOTE_ITEM_TYPES),
        description: z.string().min(2).max(240),
        quantity: z.coerce.number().positive().max(1000).default(1),
        unitCostCents: z.coerce.number().int().min(0).default(0),
        unitPriceCents: z.coerce.number().int().min(0),
      }),
    )
    .min(1, 'Adicione ao menos 1 item ao orçamento'),
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export const portalQuoteDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  paymentMethod: z.enum(PAYMENT_METHODS).default('pix'),
  customerNote: z.string().max(1000).optional(),
});
export type PortalQuoteDecisionInput = z.infer<typeof portalQuoteDecisionSchema>;

export const createTransactionSchema = z.object({
  type: z.enum(FINANCIAL_TYPES),
  category: z.string().min(2).max(80),
  description: z.string().min(2).max(240),
  paymentMethod: z.enum(PAYMENT_METHODS).default('pix'),
  amountCents: z.coerce.number().int().positive('Valor deve ser maior que zero'),
  dueDate: z.string().datetime().optional(),
  serviceOrderId: z.string().uuid().optional().nullable(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
