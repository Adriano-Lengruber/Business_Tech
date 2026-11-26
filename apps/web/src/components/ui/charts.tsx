'use client';

import { useState } from 'react';
import { Card } from './primitives';

export interface DailyCashflowPoint {
  dateKey: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

export interface StageCountPoint {
  key: string;
  label: string;
  count: number;
  tone: 'neutral' | 'info' | 'warning' | 'accent' | 'success' | 'danger';
}

export interface QuoteFunnelStats {
  totalQuotes: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  conversionRatePct: number;
  approvedValueCents: number;
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function formatBrlExact(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function CashflowBarChart({
  data,
  totalIncomeCents,
  totalExpenseCents,
}: {
  data: DailyCashflowPoint[];
  totalIncomeCents: number;
  totalExpenseCents: number;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxVal = Math.max(
    10000,
    ...data.flatMap((d) => [d.incomeCents, d.expenseCents]),
  );

  const activePoint =
    hoveredIndex !== null ? data[hoveredIndex] : data[data.length - 1];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Fluxo Financeiro (7 dias)
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-xl font-bold tabular-nums text-text-primary">
              {formatBrlExact(totalIncomeCents - totalExpenseCents)}
            </span>
            <span className="text-xs text-text-secondary">
              saldo líquido confirmado
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent" />
            Entradas ({formatBrl(totalIncomeCents)})
          </span>
          <span className="inline-flex items-center gap-1.5 text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-sm bg-copper" />
            Saídas ({formatBrl(totalExpenseCents)})
          </span>
        </div>
      </div>

      {/* Hover summary bar */}
      <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface-muted/60 px-3 py-1.5 text-xs">
        <span className="font-mono text-text-secondary">
          {activePoint ? `Dia ${activePoint.label}` : 'Sem movimentos'}
        </span>
        {activePoint && (
          <div className="flex items-center gap-4 font-mono tabular-nums">
            <span className="text-accent">
              +{formatBrlExact(activePoint.incomeCents)}
            </span>
            <span className="text-copper">
              -{formatBrlExact(activePoint.expenseCents)}
            </span>
            <span className="font-semibold text-text-primary">
              Líq: {formatBrlExact(activePoint.netCents)}
            </span>
          </div>
        )}
      </div>

      {/* SVG-like responsive column bars */}
      <div className="relative mt-4 h-44">
        {/* Horizontal dashed reference lines */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-6">
          {[1, 0.5, 0].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <span className="w-14 text-right font-mono text-[10px] tabular-nums text-text-muted">
                {formatBrl(Math.round(maxVal * step))}
              </span>
              <div className="h-px flex-1 border-t border-dashed border-border/80" />
            </div>
          ))}
        </div>

        {/* Columns */}
        <div className="relative z-10 flex h-full items-end gap-2 pl-16 pb-6">
          {data.map((point, idx) => {
            const incomePct = Math.max(
              point.incomeCents > 0 ? 6 : 2,
              Math.round((point.incomeCents / maxVal) * 100),
            );
            const expensePct = Math.max(
              point.expenseCents > 0 ? 6 : 2,
              Math.round((point.expenseCents / maxVal) * 100),
            );
            const isActive = hoveredIndex === idx;

            return (
              <div
                key={point.dateKey}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`group flex h-full flex-1 flex-col items-center justify-end rounded-lg px-1 pt-2 transition-colors ${
                  isActive ? 'bg-surface-muted/80' : ''
                }`}
              >
                <div className="flex h-full w-full items-end justify-center gap-1.5">
                  <div
                    className="w-3.5 rounded-t-md bg-accent transition-all duration-300 group-hover:bg-accent-hover sm:w-4"
                    style={{ height: `${incomePct}%` }}
                    title={`Entradas ${point.label}: ${formatBrlExact(point.incomeCents)}`}
                  />
                  <div
                    className="w-3.5 rounded-t-md bg-copper/85 transition-all duration-300 group-hover:bg-copper sm:w-4"
                    style={{ height: `${expensePct}%` }}
                    title={`Saídas ${point.label}: ${formatBrlExact(point.expenseCents)}`}
                  />
                </div>
                <span className="absolute bottom-0 font-mono text-[11px] text-text-muted">
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export function PipelineHorizontalChart({
  stages,
  totalOpen,
}: {
  stages: StageCountPoint[];
  totalOpen: number;
}) {
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  const barColor: Record<StageCountPoint['tone'], string> = {
    neutral: 'bg-text-muted',
    info: 'bg-info',
    warning: 'bg-warning',
    accent: 'bg-accent',
    success: 'bg-success',
    danger: 'bg-danger',
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Funil Operacional da Bancada
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Distribuição das{' '}
            <span className="font-mono font-semibold text-text-primary">
              {totalOpen}
            </span>{' '}
            OS ativas por etapa
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {stages.map((stage) => {
          const widthPct =
            stage.count > 0
              ? Math.max(8, Math.round((stage.count / maxCount) * 100))
              : 0;

          return (
            <div key={stage.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-secondary">
                  {stage.label}
                </span>
                <span className="font-mono font-semibold tabular-nums text-text-primary">
                  {stage.count}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor[stage.tone]}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function ConversionRingChart({ funnel }: { funnel: QuoteFunnelStats }) {
  const size = 112;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, funnel.conversionRatePct));
  const offset = circumference - (pct / 100) * circumference;

  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
        Conversão de Orçamentos
      </p>

      <div className="mt-4 flex items-center gap-5">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--al-surface-muted)"
              strokeWidth={stroke}
              fill="none"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--al-accent)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              fill="none"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-bold tabular-nums text-text-primary">
              {pct}%
            </span>
            <span className="text-[10px] text-text-muted">aprovação</span>
          </div>
        </div>

        <div className="flex-1 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Aprovados</span>
            <span className="font-mono font-semibold text-success">
              {funnel.approvedCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Em negociação</span>
            <span className="font-mono font-semibold text-warning">
              {funnel.pendingCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Recusados</span>
            <span className="font-mono font-semibold text-danger">
              {funnel.rejectedCount}
            </span>
          </div>
          <div className="border-t border-border pt-2 flex items-center justify-between">
            <span className="text-text-muted">Receita aprovada</span>
            <span className="font-mono font-semibold text-text-primary">
              {formatBrlExact(funnel.approvedValueCents)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
