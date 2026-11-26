import { z } from 'zod';
import {
  AI_RISK_MATRIX,
  type AiRiskLevel,
  type ModuleCode,
} from '@al/shared';

export interface ToolExecutionContext {
  organizationId: string;
  enabledModules: readonly ModuleCode[];
  allowWriteSafe?: boolean;
  humanApproved?: boolean;
}

export interface AgentToolDefinition<TInput extends z.ZodTypeAny, TOutput> {
  name: string;
  description: string;
  moduleCode: ModuleCode;
  riskLevel: AiRiskLevel;
  inputSchema: TInput;
  execute: (input: z.infer<TInput>, ctx: ToolExecutionContext) => Promise<TOutput>;
}

export type ToolInvocationResult<TOutput> =
  | { status: 'EXECUTED'; data: TOutput }
  | { status: 'REQUIRES_APPROVAL'; reason: string; riskLevel: AiRiskLevel }
  | { status: 'BLOCKED'; reason: string; riskLevel: AiRiskLevel };

export class AgentToolRegistry {
  private readonly tools = new Map<string, AgentToolDefinition<z.ZodTypeAny, unknown>>();

  register<TInput extends z.ZodTypeAny, TOutput>(
    tool: AgentToolDefinition<TInput, TOutput>,
  ): void {
    this.tools.set(
      tool.name,
      tool as unknown as AgentToolDefinition<z.ZodTypeAny, unknown>,
    );
  }

  listForTenant(enabledModules: readonly ModuleCode[]): Array<AgentToolDefinition<z.ZodTypeAny, unknown>> {
    const allowed = new Set(enabledModules);
    return Array.from(this.tools.values()).filter((tool) =>
      allowed.has(tool.moduleCode),
    );
  }

  async invoke<TOutput = unknown>(
    toolName: string,
    rawInput: unknown,
    ctx: ToolExecutionContext,
  ): Promise<ToolInvocationResult<TOutput>> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        status: 'BLOCKED',
        reason: `Tool "${toolName}" não registrada.`,
        riskLevel: 'CRITICAL',
      };
    }

    if (!ctx.enabledModules.includes(tool.moduleCode)) {
      return {
        status: 'BLOCKED',
        reason: `Módulo "${tool.moduleCode}" não está ativo para esta organização.`,
        riskLevel: tool.riskLevel,
      };
    }

    const policy = AI_RISK_MATRIX[tool.riskLevel];
    if (policy === 'BLOCKED_AUTONOMOUS') {
      return {
        status: 'BLOCKED',
        reason: `Ação crítica (${toolName}) não pode ser executada por agente autônomo.`,
        riskLevel: tool.riskLevel,
      };
    }

    if (policy === 'HUMAN_REQUIRED' && !ctx.humanApproved) {
      return {
        status: 'REQUIRES_APPROVAL',
        reason: `Ação sensível (${toolName}) aguarda aprovação humana.`,
        riskLevel: tool.riskLevel,
      };
    }

    if (policy === 'CONFIGURABLE' && !ctx.allowWriteSafe && !ctx.humanApproved) {
      return {
        status: 'REQUIRES_APPROVAL',
        reason: `Ação de escrita (${toolName}) aguarda confirmação para este tenant.`,
        riskLevel: tool.riskLevel,
      };
    }

    const parsed = tool.inputSchema.parse(rawInput);
    const data = (await tool.execute(parsed, ctx)) as TOutput;
    return { status: 'EXECUTED', data };
  }
}
