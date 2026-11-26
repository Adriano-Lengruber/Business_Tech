'use client';

import { useState } from 'react';
import { CheckSquare, Lock, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

export interface ChecklistTemplateRow {
  id: string;
  category: string;
  title: string;
  blockClosingIfIncomplete: boolean;
  items: Array<{ key: string; label: string; required: boolean }>;
}

export interface OsChecklistState {
  id: string;
  templateId: string | null;
  title: string;
  blockClosingIfIncomplete: boolean;
  completedRequired: boolean;
  items: Array<{ key: string; label: string; required: boolean }>;
  responses: Record<string, { checked: boolean; note?: string }>;
}

export function ChecklistTab({
  osId,
  checklist,
  templates,
  onReload,
}: {
  osId: string;
  checklist: OsChecklistState | null;
  templates: ChecklistTemplateRow[];
  onReload: () => Promise<void>;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templates[0]?.id ?? '',
  );
  const [saving, setSaving] = useState(false);

  async function handleApplyTemplate() {
    const token = window.localStorage.getItem('al_token');
    const tplId = selectedTemplateId || templates[0]?.id;
    if (!token || !tplId) return;
    setSaving(true);
    try {
      await apiFetch(`/service-orders/${osId}/checklist`, {
        method: 'POST',
        token,
        body: JSON.stringify({ templateId: tplId, responses: {} }),
      });
      await onReload();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleItem(key: string, checked: boolean) {
    const token = window.localStorage.getItem('al_token');
    if (!token || !checklist) return;
    setSaving(true);
    try {
      await apiFetch(`/service-orders/${osId}/checklist`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          responses: {
            [key]: { checked },
          },
        }),
      });
      await onReload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <CheckSquare className="h-4 w-4 text-accent" />
            Checklist Técnico de Saída por Categoria
          </h3>
          <p className="text-xs text-text-secondary">
            Garante qualidade antes de liberar ou entregar o equipamento ao cliente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedTemplateId || templates[0]?.id || ''}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="rounded-xl border border-border bg-bg px-3 py-1.5 text-xs"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving || templates.length === 0}
            onClick={() => void handleApplyTemplate()}
            className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            {checklist ? 'Trocar Template' : 'Aplicar Checklist'}
          </button>
        </div>
      </div>

      {!checklist ? (
        <div className="rounded-xl border border-dashed border-border bg-bg p-6 text-center text-xs text-text-secondary">
          Nenhum checklist aplicado nesta OS ainda. Selecione um modelo acima (Notebook, Desktop ou 3D) para iniciar a validação.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-muted/50 px-4 py-2.5 text-xs">
            <span className="font-semibold text-text-primary">
              {checklist.title}
            </span>
            {checklist.completedRequired ? (
              <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-success">
                <ShieldCheck className="h-3.5 w-3.5" />
                LIBERADO PARA ENTREGA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-warning">
                <Lock className="h-3.5 w-3.5" />
                {checklist.blockClosingIfIncomplete
                  ? 'ITENS OBRIGATÓRIOS PENDENTES (BLOQUEIA ENTREGA)'
                  : 'ITENS PENDENTES'}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {checklist.items.map((item) => {
              const checked = checklist.responses[item.key]?.checked === true;
              return (
                <label
                  key={item.key}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors ${
                    checked
                      ? 'border-success/35 bg-success/[0.06]'
                      : 'border-border bg-bg hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={saving}
                      onChange={(e) =>
                        void handleToggleItem(item.key, e.target.checked)
                      }
                      className="h-4 w-4 accent-teal-500"
                    />
                    <span className={checked ? 'line-through text-text-muted' : ''}>
                      {item.label}
                    </span>
                  </div>
                  {item.required && (
                    <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-text-muted">
                      OBRIGATÓRIO
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
