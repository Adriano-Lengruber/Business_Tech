'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Copy } from 'lucide-react';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface FinanceSummary {
  confirmedReceivableCents: number;
  pendingReceivableCents: number;
  overdueReceivableCents: number;
  payableCents: number;
  netCashflowCents: number;
}

interface TransactionRow {
  id: string;
  type: 'receivable' | 'payable';
  category: string;
  description: string;
  paymentMethod: string;
  status: string;
  amountCents: number;
  dueDate: string;
  pixCopyPaste: string | null;
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function FinanceContent({ session }: { session: ErpSession }) {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [type, setType] = useState<'receivable' | 'payable'>('receivable');
  const [category, setCategory] = useState('Serviços Técnicos');
  const [description, setDescription] = useState('');
  const [amountBrl, setAmountBrl] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = session.enabledModules.includes('mod-finance-fiscal');

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !enabled) return;
    const [sum, rows] = await Promise.all([
      apiFetch<FinanceSummary>('/finance/summary', { token }),
      apiFetch<TransactionRow[]>('/finance/transactions', { token }),
    ]);
    setSummary(sum);
    setTransactions(rows);
  }, [enabled]);

  useEffect(() => {
    void load().catch((e) => setError(String(e)));
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setError(null);
    const amountCents = Math.round(
      Number(amountBrl.replace(',', '.')) * 100,
    );
    if (!amountCents || amountCents <= 0) {
      setError('Informe um valor válido.');
      return;
    }

    await apiFetch('/finance/transactions', {
      method: 'POST',
      token,
      body: JSON.stringify({
        type,
        category,
        description,
        paymentMethod: 'pix',
        amountCents,
      }),
    });
    setDescription('');
    setAmountBrl('');
    await load();
  }

  async function handleConfirm(id: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/finance/transactions/${id}/confirm`, {
      method: 'POST',
      token,
    });
    await load();
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-secondary">
        O módulo <strong>Financeiro & Fiscal BR</strong> está desativado para esta organização.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs text-text-secondary">Receita Confirmada</p>
            <p className="mt-1 font-mono text-xl font-bold text-success tabular-nums">
              {formatBrl(summary.confirmedReceivableCents)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs text-text-secondary">Contas a Receber</p>
            <p className="mt-1 font-mono text-xl font-bold text-accent tabular-nums">
              {formatBrl(summary.pendingReceivableCents)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs text-text-secondary">Despesas / Contas a Pagar</p>
            <p className="mt-1 font-mono text-xl font-bold text-danger tabular-nums">
              {formatBrl(summary.payableCents)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs text-text-secondary">Saldo Líquido Realizado</p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums">
              {formatBrl(summary.netCashflowCents)}
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-5"
      >
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'receivable' | 'payable')}
          className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
        >
          <option value="receivable">A Receber (PIX)</option>
          <option value="payable">A Pagar (Despesa)</option>
        </select>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Categoria"
          required
          className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição do lançamento"
          required
          className="rounded-xl border border-border bg-bg px-3 py-2 text-sm sm:col-span-2"
        />
        <div className="flex gap-2">
          <input
            value={amountBrl}
            onChange={(e) => setAmountBrl(e.target.value)}
            placeholder="Valor (ex: 150,00)"
            required
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm font-mono"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            Lançar
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/60 text-xs text-text-secondary">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações / PIX</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="px-4 py-3">
                  {tx.type === 'receivable' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <ArrowDownLeft className="h-3.5 w-3.5" /> Receber
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-danger">
                      <ArrowUpRight className="h-3.5 w-3.5" /> Pagar
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{tx.description}</div>
                  <div className="text-xs text-text-muted">{tx.category}</div>
                </td>
                <td className="px-4 py-3 font-mono font-semibold tabular-nums">
                  {formatBrl(tx.amountCents)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                      tx.status === 'CONFIRMED'
                        ? 'bg-success/15 text-success'
                        : 'bg-warning/15 text-warning'
                    }`}
                  >
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {tx.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => void handleConfirm(tx.id)}
                        className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs hover:bg-surface-muted"
                      >
                        <Check className="h-3.5 w-3.5 text-success" />
                        Confirmar
                      </button>
                    )}
                    {tx.pixCopyPaste && (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(tx.pixCopyPaste!);
                          setCopiedId(tx.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 font-mono text-xs hover:bg-surface-muted"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedId === tx.id ? 'Copiado!' : 'PIX'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FinancePage() {
  return (
    <ErpShell
      title="Financeiro Operacional & PIX (Asaas)"
      subtitle="Contas a pagar/receber, geração automática de cobrança na aprovação e fluxo líquido"
    >
      {(session) => <FinanceContent session={session} />}
    </ErpShell>
  );
}
