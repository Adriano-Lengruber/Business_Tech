'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  Check,
  Clock,
  Copy,
  DollarSign,
  Edit3,
  PieChart,
  PlusCircle,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { Card, StatKpiCard } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

interface FinanceSummary {
  confirmedReceivableCents: number;
  pendingReceivableCents: number;
  overdueReceivableCents: number;
  confirmedPayableCents: number;
  pendingPayableCents: number;
  payableCents: number;
  netCashflowCents: number;
  realizedCashflowCents?: number;
  projectedCashflowCents: number;
  categoryBreakdown: Array<{
    category: string;
    receivableCents: number;
    payableCents: number;
  }>;
}

interface TransactionRow {
  id: string;
  type: 'receivable' | 'payable' | 'pos_sale';
  category: string;
  description: string;
  paymentMethod: string;
  status: string;
  amountCents: number;
  dueDate: string;
  paidAt: string | null;
  pixCopyPaste: string | null;
}

const CATEGORY_PRESETS = [
  'Serviços Técnicos',
  'PDV / Varejo',
  'Peças & Estoque',
  'Aluguel & Energia',
  'Internet & Software',
  'Ferramentas & Bancada',
  'Impostos / DAS MEI',
  'Marketing & Tráfego',
];

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  card: 'Cartão Crédito/Débito',
  cash: 'Dinheiro',
  boleto: 'Boleto',
  transfer: 'Transferência / TED',
};

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function FinanceContent({ session }: { session: ErpSession }) {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  // Form create
  const [type, setType] = useState<'receivable' | 'payable'>('payable');
  const [category, setCategory] = useState('Peças & Estoque');
  const [description, setDescription] = useState('');
  const [amountBrl, setAmountBrl] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [paidImmediately, setPaidImmediately] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Inline edit modal
  const [editingTx, setEditingTx] = useState<TransactionRow | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAmountBrl, setEditAmountBrl] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = session.enabledModules.includes('mod-finance-fiscal');

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !enabled) return;
    const qs = new URLSearchParams();
    if (filterType !== 'all') qs.set('type', filterType);
    if (filterStatus !== 'all') qs.set('status', filterStatus);
    if (searchTerm.trim()) qs.set('q', searchTerm.trim());

    const [sum, rows] = await Promise.all([
      apiFetch<FinanceSummary>('/finance/summary', { token }),
      apiFetch<TransactionRow[]>(`/finance/transactions?${qs.toString()}`, { token }),
    ]);
    setSummary(sum);
    setTransactions(rows);
  }, [enabled, filterType, filterStatus, searchTerm]);

  useEffect(() => {
    void load().catch((e) => setError(String(e)));
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setError(null);
    setFeedback(null);
    const amountCents = Math.round(Number(amountBrl.replace(',', '.')) * 100);
    if (!amountCents || amountCents <= 0) {
      setError('Informe um valor válido maior que zero.');
      return;
    }

    try {
      await apiFetch('/finance/transactions', {
        method: 'POST',
        token,
        body: JSON.stringify({
          type,
          category,
          description,
          paymentMethod,
          amountCents,
          dueDate,
          paidImmediately,
        }),
      });
      setDescription('');
      setAmountBrl('');
      setFeedback(
        paidImmediately
          ? 'Lançamento registrado como CONFIRMADO/PAGO e sincronizado no gráfico do Dashboard!'
          : 'Lançamento agendado como PENDENTE e sincronizado no Fluxo Previsto do Dashboard!',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar lançamento');
    }
  }

  async function handleConfirm(id: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/finance/transactions/${id}/confirm`, {
      method: 'POST',
      token,
    });
    setFeedback('Baixa confirmada! Fluxo realizado atualizado.');
    await load();
  }

  async function handleCancel(id: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/finance/transactions/${id}`, {
      method: 'DELETE',
      token,
    });
    setFeedback('Lançamento cancelado.');
    await load();
  }

  function openEdit(tx: TransactionRow) {
    setEditingTx(tx);
    setEditDesc(tx.description);
    setEditCategory(tx.category);
    setEditAmountBrl((tx.amountCents / 100).toFixed(2));
    setEditDueDate(tx.dueDate.slice(0, 10));
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !editingTx) return;
    const cents = Math.round(Number(editAmountBrl.replace(',', '.')) * 100);
    if (!cents || cents <= 0) return;
    await apiFetch(`/finance/transactions/${editingTx.id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        description: editDesc,
        category: editCategory,
        amountCents: cents,
        dueDate: editDueDate,
      }),
    });
    setEditingTx(null);
    setFeedback('Lançamento atualizado!');
    await load();
  }

  if (!enabled) {
    return (
      <Card className="p-6 text-sm text-text-secondary">
        O módulo <strong>Financeiro & Fiscal BR</strong> está desativado para esta organização.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-3 text-xs font-medium text-success">
          {feedback}
        </div>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatKpiCard
            label="Receita Confirmada"
            value={formatBrl(summary.confirmedReceivableCents)}
            hint="Já recebido em caixa"
            tone="success"
            icon={<ArrowDownLeft className="h-4 w-4" />}
          />
          <StatKpiCard
            label="A Receber (Pendente)"
            value={formatBrl(summary.pendingReceivableCents)}
            hint={`${formatBrl(summary.overdueReceivableCents)} vencido(s)`}
            tone="accent"
            icon={<Clock className="h-4 w-4" />}
          />
          <StatKpiCard
            label="Despesas Pagas"
            value={formatBrl(summary.confirmedPayableCents)}
            hint="Saídas confirmadas"
            tone="warning"
            icon={<ArrowUpRight className="h-4 w-4" />}
          />
          <StatKpiCard
            label="Despesas A Pagar"
            value={formatBrl(summary.pendingPayableCents)}
            hint="Previstas no gráfico do Dashboard"
            tone={summary.pendingPayableCents > 0 ? 'danger' : 'neutral'}
            icon={<Wallet className="h-4 w-4" />}
          />
          <StatKpiCard
            label="Saldo Realizado"
            value={formatBrl(summary.realizedCashflowCents ?? summary.netCashflowCents)}
            hint={`Projetado: ${formatBrl(summary.projectedCashflowCents)}`}
            tone={(summary.realizedCashflowCents ?? summary.netCashflowCents) >= 0 ? 'success' : 'danger'}
            icon={<DollarSign className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Formulário completo de lançamento */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
              <PlusCircle className="h-4 w-4 text-accent" />
              Novo Lançamento Financeiro (Receita ou Despesa)
            </h2>
            <p className="text-xs text-text-secondary">
              Todo lançamento confirmado ou pendente reflete automaticamente nos totais e no gráfico <strong>Fluxo Financeiro</strong> do Dashboard.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-text-secondary">
              Tipo de Movimentação
            </label>
            <select
              value={type}
              onChange={(e) => {
                const nextType = e.target.value as 'receivable' | 'payable';
                setType(nextType);
                setCategory(
                  nextType === 'payable' ? 'Peças & Estoque' : 'Serviços Técnicos',
                );
              }}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="payable">Despesa / Conta a Pagar</option>
              <option value="receivable">Receita / A Receber</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-text-secondary">
              Categoria (Plano de Contas)
            </label>
            <input
              list="finance-category-presets"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              placeholder="Categoria"
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <datalist id="finance-category-presets">
              {CATEGORY_PRESETS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-text-secondary">
              Descrição do Lançamento *
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Compra SSD fornecedor Agis / Conta de energia"
              required
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-text-secondary">
              Forma de Pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="pix">PIX</option>
              <option value="card">Cartão</option>
              <option value="cash">Dinheiro</option>
              <option value="boleto">Boleto</option>
              <option value="transfer">Transferência</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-text-secondary">
              Vencimento / Data
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={paidImmediately}
                onChange={(e) => setPaidImmediately(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              <span>
                <strong>Já pago / recebido agora</strong> (registra diretamente como{' '}
                <code className="font-mono text-accent">CONFIRMED</code>; desmarque para agendar como conta pendente)
              </span>
            </label>

            <div className="flex items-center gap-2">
              <input
                value={amountBrl}
                onChange={(e) => setAmountBrl(e.target.value)}
                placeholder="Valor R$ (ex: 150,00)"
                required
                className="w-40 rounded-xl border border-border bg-bg px-3 py-2 font-mono text-sm"
              />
              <button
                type="submit"
                className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
              >
                Registrar Lançamento
              </button>
            </div>
          </div>
        </form>
      </Card>

      {/* Filtros & Busca */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium"
          >
            <option value="all">Todos os tipos</option>
            <option value="payable">Somente Despesas (A Pagar)</option>
            <option value="receivable">Somente Receitas (A Receber)</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium"
          >
            <option value="all">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="CONFIRMED">Confirmado / Pago</option>
            <option value="OVERDUE">Vencido</option>
            <option value="CANCELED">Cancelado</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar descrição ou categoria..."
            className="w-full rounded-xl border border-border bg-surface py-2 pl-8 pr-3 text-xs"
          />
        </div>
      </div>

      {/* Modal rápido de edição */}
      {editingTx && (
        <Card className="border-accent/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">
              Editar Lançamento Financeiro
            </h3>
            <button
              type="button"
              onClick={() => setEditingTx(null)}
              className="rounded-lg p-1 text-text-muted hover:bg-surface-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSaveEdit} className="grid gap-3 sm:grid-cols-4">
            <input
              required
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Descrição"
              className="sm:col-span-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <input
              required
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              placeholder="Categoria"
              className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="w-36 rounded-xl border border-border bg-bg px-2.5 py-2 font-mono text-xs"
              />
              <input
                required
                value={editAmountBrl}
                onChange={(e) => setEditAmountBrl(e.target.value)}
                placeholder="Valor R$"
                className="w-28 rounded-xl border border-border bg-bg px-2.5 py-2 font-mono text-sm"
              />
              <button
                type="submit"
                className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
              >
                Salvar
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabela de Lançamentos */}
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/60 text-xs text-text-secondary">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Descrição & Categoria</th>
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-surface-muted/30">
                <td className="px-4 py-3">
                  {tx.type === 'payable' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                      <ArrowUpRight className="h-3.5 w-3.5" /> Despesa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <ArrowDownLeft className="h-3.5 w-3.5" /> Receita
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{tx.description}</div>
                  <div className="text-xs text-text-muted">{tx.category}</div>
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">
                  {PAYMENT_LABELS[tx.paymentMethod] ?? tx.paymentMethod}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                  {new Date(tx.dueDate).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 font-mono font-semibold tabular-nums">
                  {formatBrl(tx.amountCents)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                      tx.status === 'CONFIRMED'
                        ? 'bg-success/15 text-success'
                        : tx.status === 'CANCELED'
                          ? 'bg-surface-muted text-text-muted'
                          : 'bg-warning/15 text-warning'
                    }`}
                  >
                    {tx.status === 'CONFIRMED'
                      ? 'PAGO / CONF.'
                      : tx.status === 'CANCELED'
                        ? 'CANCELADO'
                        : 'PENDENTE'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {tx.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => void handleConfirm(tx.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/20"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Dar Baixa
                      </button>
                    )}
                    {tx.status !== 'CANCELED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(tx)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface-muted"
                        >
                          <Edit3 className="h-3 w-3" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCancel(tx.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-danger hover:bg-danger/10"
                        >
                          <Ban className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    {tx.pixCopyPaste && tx.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(tx.pixCopyPaste!);
                          setCopiedId(tx.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 font-mono text-xs hover:bg-surface-muted"
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
      </Card>

      {/* DRE Simplificado por Categoria */}
      {summary && summary.categoryBreakdown.length > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-accent" />
            <h3 className="font-display text-sm font-semibold">
              DRE Operacional por Categoria
            </h3>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {summary.categoryBreakdown.map((cat) => (
              <div
                key={cat.category}
                className="rounded-xl border border-border bg-bg p-3 text-xs space-y-1"
              >
                <p className="font-semibold text-text-primary">{cat.category}</p>
                <div className="flex justify-between font-mono">
                  <span className="text-text-secondary">Receitas:</span>
                  <span className="text-success">{formatBrl(cat.receivableCents)}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-text-secondary">Despesas:</span>
                  <span className="text-danger">{formatBrl(cat.payableCents)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function FinancePage() {
  return (
    <ErpShell
      title="Financeiro Operacional, DRE & PIX (Asaas)"
      subtitle="Contas a pagar/receber sincronizadas com o Fluxo Financeiro do Dashboard, baixa manual e geração de cobrança"
    >
      {(session) => <FinanceContent session={session} />}
    </ErpShell>
  );
}
