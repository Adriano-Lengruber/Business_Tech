'use client';

import { useState } from 'react';
import { Card } from './primitives';

export interface DailyCashflowPoint {
  dateKey: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  pendingIncomeCents: number;
  pendingExpenseCents: number;
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
  pendingIncomeCents = 0,
  pendingExpenseCents = 0,
  days = 7,
  onDaysChange,
}: {
  data: DailyCashflowPoint[];
  totalIncomeCents: number;
  totalExpenseCents: number;
  pendingIncomeCents?: number;
  pendingExpenseCents?: number;
  days?: 7 | 30;
  onDaysChange?: (days: 7 | 30) => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxVal = Math.max(
    10000,
    ...data.flatMap((d) => [
      d.incomeCents + (d.pendingIncomeCents ?? 0),
      d.expenseCents + (d.pendingExpenseCents ?? 0),
    ]),
  );

  const activePoint =
    hoveredIndex !== null ? data[hoveredIndex] : data[data.length - 1];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Fluxo Financeiro ({days} dias)
            </p>
            {onDaysChange && (
              <div className="inline-flex rounded-lg border border-border bg-bg p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => onDaysChange(7)}
                  className={`rounded px-1.5 py-0.5 font-mono font-semibold ${
                    days === 7
                      ? 'bg-accent text-accent-foreground'
                      : 'text-text-secondary'
                  }`}
                >
                  7d
                </button>
                <button
                  type="button"
                  onClick={() => onDaysChange(30)}
                  className={`rounded px-1.5 py-0.5 font-mono font-semibold ${
                    days === 30
                      ? 'bg-accent text-accent-foreground'
                      : 'text-text-secondary'
                  }`}
                >
                  30d
                </button>
              </div>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
            <span className="font-mono text-xl font-bold tabular-nums text-text-primary">
              {formatBrlExact(totalIncomeCents - totalExpenseCents)}
            </span>
            <span className="text-xs text-text-secondary">
              realizado · prev:{' '}
              <strong className="font-mono">
                {formatBrlExact(
                  totalIncomeCents +
                    pendingIncomeCents -
                    (totalExpenseCents + pendingExpenseCents),
                )}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent" />
            Entradas ({formatBrl(totalIncomeCents)})
          </span>
          <span className="inline-flex items-center gap-1.5 text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-sm bg-copper" />
            Saídas Pagas ({formatBrl(totalExpenseCents)})
          </span>
          {pendingExpenseCents > 0 && (
            <span className="inline-flex items-center gap-1.5 text-warning">
              <span className="h-2.5 w-2.5 rounded-sm border border-warning bg-warning/35" />
              A Pagar ({formatBrl(pendingExpenseCents)})
            </span>
          )}
        </div>
      </div>

      {/* Hover summary bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted/60 px-3 py-1.5 text-xs">
        <span className="font-mono text-text-secondary">
          {activePoint ? `Dia ${activePoint.label}` : 'Sem movimentos'}
        </span>
        {activePoint && (
          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
            <span className="text-accent">
              +{formatBrlExact(activePoint.incomeCents)}
              {activePoint.pendingIncomeCents > 0
                ? ` (+${formatBrl(activePoint.pendingIncomeCents)} prev)`
                : ''}
            </span>
            <span className="text-copper">
              -{formatBrlExact(activePoint.expenseCents)}
              {activePoint.pendingExpenseCents > 0
                ? ` (-${formatBrl(activePoint.pendingExpenseCents)} pend)`
                : ''}
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
        <div className="relative z-10 flex h-full items-end gap-1.5 pl-16 pb-6">
          {data.map((point, idx) => {
            const totalDayIn = point.incomeCents + (point.pendingIncomeCents ?? 0);
            const totalDayOut = point.expenseCents + (point.pendingExpenseCents ?? 0);
            const incomePct = Math.max(
              totalDayIn > 0 ? 8 : 2,
              Math.round((totalDayIn / maxVal) * 100),
            );
            const expensePct = Math.max(
              totalDayOut > 0 ? 8 : 2,
              Math.round((totalDayOut / maxVal) * 100),
            );
            const paidOutShare =
              totalDayOut > 0
                ? Math.round((point.expenseCents / totalDayOut) * 100)
                : 100;
            const paidInShare =
              totalDayIn > 0
                ? Math.round((point.incomeCents / totalDayIn) * 100)
                : 100;
            const isActive = hoveredIndex === idx;
            const showLabel = days === 7 || idx % 5 === 0 || idx === data.length - 1;

            return (
              <div
                key={point.dateKey}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`group flex h-full flex-1 flex-col items-center justify-end rounded-lg px-0.5 pt-2 transition-colors ${
                  isActive ? 'bg-surface-muted/80' : ''
                }`}
              >
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div
                    className="flex w-2.5 flex-col justify-end overflow-hidden rounded-t-md bg-accent/30 transition-all duration-300 sm:w-3.5"
                    style={{ height: `${incomePct}%` }}
                    title={`Entradas ${point.label}: Pago ${formatBrlExact(point.incomeCents)} | Previsto ${formatBrlExact(point.pendingIncomeCents ?? 0)}`}
                  >
                    <div
                      className="w-full bg-accent group-hover:bg-accent-hover"
                      style={{ height: `${paidInShare}%` }}
                    />
                  </div>
                  <div
                    className="flex w-2.5 flex-col justify-end overflow-hidden rounded-t-md bg-warning/45 transition-all duration-300 sm:w-3.5"
                    style={{ height: `${expensePct}%` }}
                    title={`Saídas ${point.label}: Pago ${formatBrlExact(point.expenseCents)} | A Pagar ${formatBrlExact(point.pendingExpenseCents ?? 0)}`}
                  >
                    <div
                      className="w-full bg-copper group-hover:opacity-95"
                      style={{ height: `${paidOutShare}%` }}
                    />
                  </div>
                </div>
                {showLabel && (
                  <span className="absolute bottom-0 font-mono text-[10px] text-text-muted">
                    {point.label}
                  </span>
                )}
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
