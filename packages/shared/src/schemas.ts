import { z } from 'zod';
import { MODULE_CODES } from './modules.js';
import { OS_PRIORITIES, OS_STATUSES } from './os-status.js';
import {
  FINANCIAL_TYPES,
  PAYMENT_METHODS,
  QUOTE_ITEM_TYPES,
  QUOTE_TIERS,
} from './finance.js';
import {
  FISCAL_DOC_TYPES,
  INVENTORY_MOVEMENT_TYPES,
  TAX_REGIMES,
} from './inventory-pos.js';
import {
  FILAMENT_TYPES,
  PRINT_3D_STATUSES,
  PROJECT_TASK_STATUSES,
  PROJECT_TYPES,
  SOCIAL_PLATFORMS,
} from './specialized.js';

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

export const createProductSchema = z.object({
  sku: z.string().min(2, 'SKU obrigatório').max(60),
  barcode: z.string().max(60).optional(),
  name: z.string().min(2, 'Nome do produto obrigatório').max(180),
  category: z.string().min(2).max(80).default('hardware'),
  brand: z.string().max(80).optional(),
  unit: z.string().max(16).default('UN'),
  costCents: z.coerce.number().int().min(0).default(0),
  priceCents: z.coerce.number().int().min(0),
  stockQty: z.coerce.number().int().min(0).default(0),
  minStockQty: z.coerce.number().int().min(0).default(2),
  ncm: z.string().max(12).optional(),
  cfopDefault: z.string().max(8).default('5102'),
  csosnDefault: z.string().max(8).default('102'),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const createStockMovementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(INVENTORY_MOVEMENT_TYPES),
  quantityDelta: z.coerce.number().int().refine((n) => n !== 0, 'Quantidade não pode ser zero'),
  unitCostCents: z.coerce.number().int().min(0).default(0),
  note: z.string().max(400).optional(),
});
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

export const createSupplierSchema = z.object({
  name: z.string().min(2).max(180),
  cnpj: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(24).optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(365).default(3),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
        unitCostCents: z.coerce.number().int().min(0),
      }),
    )
    .min(1),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const createPosSaleSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('pix'),
  discountCents: z.coerce.number().int().min(0).default(0),
  paidImmediately: z.boolean().default(true),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
        unitPriceCents: z.coerce.number().int().min(0).optional(),
      }),
    )
    .min(1, 'Adicione ao menos 1 item ao carrinho'),
});
export type CreatePosSaleInput = z.infer<typeof createPosSaleSchema>;

export const consumeOsPartSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive().default(1),
  note: z.string().max(300).optional(),
});
export type ConsumeOsPartInput = z.infer<typeof consumeOsPartSchema>;

export const upsertFiscalProfileSchema = z.object({
  taxRegime: z.enum(TAX_REGIMES).default('SIMPLES_NACIONAL'),
  stateUf: z.string().length(2).default('SP'),
  cityCode: z.string().max(12).default('3550308'),
  nfeSeries: z.coerce.number().int().min(1).default(1),
  nfceSeries: z.coerce.number().int().min(1).default(1),
  nfseSeries: z.coerce.number().int().min(1).default(1),
  providerName: z.enum(['sandbox', 'focus_nfe', 'plugnotas']).default('sandbox'),
  simulateRejection: z.boolean().default(false),
});
export type UpsertFiscalProfileInput = z.infer<typeof upsertFiscalProfileSchema>;

export const emitFiscalDocSchema = z.object({
  docType: z.enum(FISCAL_DOC_TYPES),
  referenceType: z.enum(['sale', 'service_order']),
  referenceId: z.string().uuid(),
  simulateRejection: z.boolean().default(false),
});
export type EmitFiscalDocInput = z.infer<typeof emitFiscalDocSchema>;

export const createFilamentSchema = z.object({
  name: z.string().min(2).max(120),
  materialType: z.enum(FILAMENT_TYPES).default('PLA'),
  color: z.string().min(2).max(60),
  brand: z.string().max(80).optional(),
  costPerKgCents: z.coerce.number().int().positive(),
  stockGrams: z.coerce.number().int().min(0).default(1000),
  minGrams: z.coerce.number().int().min(0).default(250),
});
export type CreateFilamentInput = z.infer<typeof createFilamentSchema>;

export const createPrint3dJobSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  filamentId: z.string().uuid(),
  modelName: z.string().min(2).max(180),
  weightGrams: z.coerce.number().int().positive(),
  printTimeMinutes: z.coerce.number().int().positive(),
  profitMarginPercent: z.coerce.number().min(0).max(500).default(120),
  notes: z.string().max(1000).optional(),
});
export type CreatePrint3dJobInput = z.infer<typeof createPrint3dJobSchema>;

export const updatePrint3dStatusSchema = z.object({
  status: z.enum(PRINT_3D_STATUSES),
});
export type UpdatePrint3dStatusInput = z.infer<typeof updatePrint3dStatusSchema>;

export const createProjectSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(180),
  projectType: z.enum(PROJECT_TYPES).default('software_dev'),
  budgetCents: z.coerce.number().int().min(0).default(0),
  retainerHoursMonthly: z.coerce.number().min(0).max(1000).default(0),
  hourlyRateCents: z.coerce.number().int().min(0).default(15000),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const createProjectTaskSchema = z.object({
  title: z.string().min(2).max(180),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  estimatedMinutes: z.coerce.number().int().min(0).default(60),
});
export type CreateProjectTaskInput = z.infer<typeof createProjectTaskSchema>;

export const updateProjectTaskStatusSchema = z.object({
  status: z.enum(PROJECT_TASK_STATUSES),
});
export type UpdateProjectTaskStatusInput = z.infer<
  typeof updateProjectTaskStatusSchema
>;

export const logTimeEntrySchema = z.object({
  taskId: z.string().uuid().optional().nullable(),
  minutes: z.coerce.number().int().positive().max(1440),
  description: z.string().min(2).max(300),
  billable: z.boolean().default(true),
});
export type LogTimeEntryInput = z.infer<typeof logTimeEntrySchema>;

export const createSocialPostSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS).default('instagram'),
  title: z.string().min(2).max(160),
  caption: z.string().min(4).max(2200),
  hashtags: z.string().max(400).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
});
export type CreateSocialPostInput = z.infer<typeof createSocialPostSchema>;

export const createLeadSchema = z.object({
  source: z
    .enum(['landing_page', 'whatsapp', 'social_comment', 'walk_in'])
    .default('landing_page'),
  sourceRefId: z.string().max(120).optional().nullable(),
  name: z.string().min(2).max(160),
  phoneE164: z.string().max(24).optional(),
  notes: z.string().max(1000).optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
