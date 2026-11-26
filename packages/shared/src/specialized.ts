export const FILAMENT_TYPES = [
  'PLA',
  'PETG',
  'ABS',
  'TPU',
  'RESIN',
  'NYLON',
] as const;
export type FilamentType = (typeof FILAMENT_TYPES)[number];

export const PRINT_3D_STATUSES = [
  'QUEUED',
  'PRINTING',
  'POST_PROCESSING',
  'READY',
  'DELIVERED',
  'FAILED',
] as const;
export type Print3dStatus = (typeof PRINT_3D_STATUSES)[number];

export const PROJECT_TYPES = [
  'software_dev',
  'automation_ai',
  'consulting',
  'infrastructure',
  '3d_modeling',
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TASK_STATUSES = [
  'BACKLOG',
  'IN_PROGRESS',
  'REVIEW',
  'DONE',
] as const;
export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number];

export const SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'linkedin',
  'youtube_shorts',
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_POST_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'SCHEDULED',
  'PUBLISHED',
  'FAILED',
] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export interface Print3dQuoteInput {
  weightGrams: number;
  printTimeMinutes: number;
  filamentCostPerKgCents: number;
  printerWatts?: number;
  kwhPriceCents?: number;
  machineHourlyRateCents?: number;
  failureMarginPercent?: number;
  profitMarginPercent?: number;
}

export interface Print3dQuoteResult {
  materialCostCents: number;
  energyCostCents: number;
  machineCostCents: number;
  baseCostCents: number;
  totalCostCents: number;
  suggestedPriceCents: number;
}

export function calculate3dPrintQuote(
  input: Print3dQuoteInput,
): Print3dQuoteResult {
  const hours = Math.max(0, input.printTimeMinutes) / 60;
  const watts = input.printerWatts ?? 180;
  const kwhCents = input.kwhPriceCents ?? 95;
  const machineRateCents = input.machineHourlyRateCents ?? 400;
  const failurePct = input.failureMarginPercent ?? 10;
  const profitPct = input.profitMarginPercent ?? 100;

  const materialCostCents = Math.round(
    (Math.max(0, input.weightGrams) / 1000) * input.filamentCostPerKgCents,
  );
  const energyCostCents = Math.round(hours * (watts / 1000) * kwhCents);
  const machineCostCents = Math.round(hours * machineRateCents);

  const baseCostCents = materialCostCents + energyCostCents + machineCostCents;
  const totalCostCents = Math.round(baseCostCents * (1 + failurePct / 100));
  const suggestedPriceCents = Math.round(totalCostCents * (1 + profitPct / 100));

  return {
    materialCostCents,
    energyCostCents,
    machineCostCents,
    baseCostCents,
    totalCostCents,
    suggestedPriceCents,
  };
}

export interface RetainerBalanceResult {
  contractedMinutes: number;
  loggedMinutes: number;
  remainingMinutes: number;
  utilizationPercent: number;
  isNearLimit: boolean;
}

export function calculateRetainerBalance(
  contractedMinutes: number,
  loggedMinutes: number,
): RetainerBalanceResult {
  const safeContracted = Math.max(0, contractedMinutes);
  const safeLogged = Math.max(0, loggedMinutes);
  const remainingMinutes = Math.max(0, safeContracted - safeLogged);
  const utilizationPercent =
    safeContracted > 0
      ? Math.round((safeLogged / safeContracted) * 10000) / 100
      : 0;

  return {
    contractedMinutes: safeContracted,
    loggedMinutes: safeLogged,
    remainingMinutes,
    utilizationPercent,
    isNearLimit: utilizationPercent >= 80,
  };
}
