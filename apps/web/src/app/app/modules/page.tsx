'use client';

import { useEffect, useState } from 'react';
import type { ModuleCode } from '@al/shared';
import { ErpShell } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface ModuleItem {
  code: ModuleCode;
  name: string;
  description: string;
  required: boolean;
  enabled: boolean;
}

function ModulesContent({ onChanged }: { onChanged: () => Promise<void> }) {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const data = await apiFetch<ModuleItem[]>('/modules', { token });
    setModules(data);
  };

  useEffect(() => {
    void load().catch((e) => setError(String(e)));
  }, []);

  async function toggle(mod: ModuleItem) {
    const token = window.localStorage.getItem('al_token');
    if (!token || mod.required) return;
    setError(null);
    try {
      await apiFetch(`/modules/${mod.code}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ enabled: !mod.enabled }),
      });
      await load();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alternar módulo');
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}
      <p className="text-sm text-text-secondary">
        Ative ou desative módulos contratados para este tenant. Os menus, endpoints da API e ferramentas dos agentes de IA são filtrados imediatamente.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <div
            key={mod.code}
            className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-text-muted">{mod.code}</span>
                <button
                  type="button"
                  disabled={mod.required}
                  onClick={() => void toggle(mod)}
                  className={`rounded px-2.5 py-0.5 font-mono text-xs font-semibold ${
                    mod.enabled
                      ? 'bg-success/15 text-success'
                      : 'bg-surface-muted text-text-muted'
                  } ${mod.required ? 'cursor-not-allowed opacity-75' : 'hover:opacity-80'}`}
                >
                  {mod.required ? 'OBRIGATÓRIO' : mod.enabled ? 'ATIVO' : 'INATIVO'}
                </button>
              </div>
              <h3 className="mt-2 font-semibold">{mod.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                {mod.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ModulesPage() {
  return (
    <ErpShell
      title="Módulos SaaS & Entitlements"
      subtitle="Controle modular por organização"
    >
      {(_session, reloadSession) => <ModulesContent onChanged={reloadSession} />}
    </ErpShell>
  );
}
