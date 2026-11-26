import { z } from 'zod';
import { MODULE_CODES } from './modules.js';

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
  enabledModules: z.array(z.enum(MODULE_CODES)).default(['core', 'mod-service-orders']),
});

export type RegisterOrganizationInput = z.infer<typeof registerOrganizationSchema>;

export const toggleModuleSchema = z.object({
  enabled: z.boolean(),
});

export type ToggleModuleInput = z.infer<typeof toggleModuleSchema>;
