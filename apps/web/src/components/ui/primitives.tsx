import type { ReactNode } from 'react';
import { OS_STATUS_LABELS, type OsStatus } from '@al/shared';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface transition-colors ${className}`}
    >
      {children}
    </div>
  );
}

export function StatKpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: 'neutral' | 'accent' | 'warning' | 'danger' | 'success';
}) {
  const toneRing: Record<string, string> = {
    neutral: 'border-border bg-surface-muted text-text-secondary',
    accent: 'border-accent/30 bg-accent/10 text-accent',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    danger: 'border-danger/30 bg-danger/10 text-danger',
    success: 'border-success/30 bg-success/10 text-success',
  };

  return (
    <Card className="p-4 hover:border-text-muted/40">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg border ${toneRing[tone]}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2.5 font-mono text-2xl font-bold tracking-tight tabular-nums text-text-primary">
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </Card>
  );
}

const STATUS_STYLE_MAP: Record<string, string> = {
  PRE_REGISTRATION: 'border-border bg-surface-muted text-text-secondary',
  AWAITING_RECEIPT: 'border-border bg-surface-muted text-text-secondary',
  RECEIVED: 'border-info/30 bg-info/10 text-info',
  TRIAGE: 'border-info/30 bg-info/10 text-info',
  DIAGNOSIS: 'border-accent/35 bg-accent/12 text-accent',
  AWAITING_QUOTE: 'border-warning/35 bg-warning/10 text-warning',
  QUOTE_SENT: 'border-warning/35 bg-warning/10 text-warning',
  AWAITING_APPROVAL: 'border-warning/35 bg-warning/10 text-warning',
  APPROVED: 'border-success/35 bg-success/10 text-success',
  AWAITING_PART: 'border-copper/40 bg-copper/10 text-copper',
  IN_REPAIR: 'border-accent/40 bg-accent/15 text-accent',
  AWAITING_TEST: 'border-info/35 bg-info/10 text-info',
  TESTING: 'border-info/35 bg-info/10 text-info',
  READY: 'border-success/40 bg-success/15 text-success',
  AWAITING_PICKUP: 'border-success/40 bg-success/15 text-success',
  DELIVERED: 'border-border bg-surface-muted text-text-muted',
  POST_SERVICE: 'border-border bg-surface-muted text-text-secondary',
  WARRANTY: 'border-danger/40 bg-danger/12 text-danger',
  REJECTED: 'border-danger/35 bg-danger/10 text-danger',
  CANCELED: 'border-border bg-surface-muted text-text-muted',
  UNREPAIRABLE: 'border-danger/35 bg-danger/10 text-danger',
  ABANDONED: 'border-danger/35 bg-danger/10 text-danger',
};

export function StatusPill({ status }: { status: string }) {
  const label = OS_STATUS_LABELS[status as OsStatus] ?? status;
  const cls =
    STATUS_STYLE_MAP[status] ?? 'border-border bg-surface-muted text-text-secondary';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    URGENT: {
      label: 'Urgente',
      cls: 'border-danger/40 bg-danger/12 text-danger',
    },
    HIGH: {
      label: 'Alta',
      cls: 'border-warning/40 bg-warning/12 text-warning',
    },
    NORMAL: {
      label: 'Normal',
      cls: 'border-border bg-surface-muted text-text-secondary',
    },
    LOW: {
      label: 'Baixa',
      cls: 'border-border bg-surface text-text-muted',
    },
  };
  const item = map[priority] ?? map.NORMAL!;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium ${item.cls}`}
    >
      {item.label}
    </span>
  );
}
