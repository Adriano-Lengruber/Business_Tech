export type AiRiskLevel =
  | 'READ_ONLY'
  | 'WRITE_SAFE'
  | 'WRITE_SENSITIVE'
  | 'CRITICAL';

export type ApprovalPolicy =
  | 'AUTO'
  | 'CONFIGURABLE'
  | 'HUMAN_REQUIRED'
  | 'BLOCKED_AUTONOMOUS';

export const AI_RISK_MATRIX: Record<AiRiskLevel, ApprovalPolicy> = {
  READ_ONLY: 'AUTO',
  WRITE_SAFE: 'CONFIGURABLE',
  WRITE_SENSITIVE: 'HUMAN_REQUIRED',
  CRITICAL: 'BLOCKED_AUTONOMOUS',
};

export type ConversationBotState =
  | 'BOT_ACTIVE'
  | 'WAITING_HUMAN'
  | 'HUMAN_ACTIVE'
  | 'PAUSED'
  | 'RESOLVED';
