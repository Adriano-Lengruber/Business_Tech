'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Box,
  Code2,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Printer,
  Wrench,
} from 'lucide-react';
import { OS_STATUS_LABELS, type ModuleCode, type OsStatus } from '@al/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-provider';

interface SessionResponse {
  user: {
    userId: string;
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
    role: string;
  };
  enabledModules: ModuleCode[];
}

interface ModuleItem {
  code: ModuleCode;
  name: string;
  description: string;
  required: boolean;
  enabled: boolean;
}

interface ServiceOrderRow {
  id: string;
  code: string;
  status: OsStatus;
  priority: string;
  reportedSymptoms: string;
  preliminaryDiagnosis: string | null;
  customerName: string;
  customerPhone: string;
  assetBrand: string | null;
  assetModel: string | null;
}

const MODULE_ICONS: Record<ModuleCode, typeof LayoutDashboard> = {
  core: LayoutDashboard,
  'mod-service-orders': Wrench,
  'mod-ai-agents': Bot,
  'mod-inventory-pos': Package,
  'mod-finance-fiscal': DollarSign,
  'mod-3d-print': Printer,
  'mod-projects-dev': Code2,
  'mod-social-growth': Megaphone,
};

export default function AppDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [orders, setOrders] = useState<ServiceOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWorkspace = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const [meData, modData] = await Promise.all([
        apiFetch<SessionResponse>('/auth/me', { token }),
        apiFetch<ModuleItem[]>('/modules', { token }),
      ]);
      setSession(meData);
      setModules(modData);

      if (meData.enabledModules.includes('mod-service-orders')) {
        const osRows = await apiFetch<ServiceOrderRow[]>('/service-orders', {
          token,
        });
        setOrders(osRows);
      } else {
        setOrders([]);
      }
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.localStorage.removeItem('al_token');
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Falha ao carregar painel');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function handleToggleModule(mod: ModuleItem) {
    const token = window.localStorage.getItem('al_token');
    if (!token || mod.required) return;
    try {
      await apiFetch(`/modules/${mod.code}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ enabled: !mod.enabled }),
      });
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar módulo');
    }
  }

  function handleLogout() {
    window.localStorage.removeItem('al_token');
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-text-secondary">
        Carregando workspace multi-tenant...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg text-text-primary">
      <aside className="hidden w-64 flex-col border-r border-border bg-surface p-4 md:flex">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent font-mono text-xs font-bold text-accent-foreground">
            AL
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {session?.user.organizationName}
            </p>
            <p className="truncate font-mono text-[11px] text-text-muted">
              {session?.user.role.toUpperCase()} · RLS ATIVO
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {modules
            .filter((m) => m.enabled)
            .map((mod) => {
              const Icon = MODULE_ICONS[mod.code] ?? Box;
              return (
                <div
                  key={mod.code}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                >
                  <Icon className="h-4 w-4 text-accent" />
                  <span className="truncate">{mod.name}</span>
                </div>
              );
            })}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface-muted hover:text-text-primary"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </aside>

      <div className="flex-1">
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
          <div>
            <h1 className="text-base font-semibold">Modo Solo Operator — Minha Fila de Hoje</h1>
            <p className="text-xs text-text-secondary">
              Logado como {session?.user.name} ({session?.user.email})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium md:hidden"
            >
              Sair
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
          {error && (
            <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          )}

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Módulos Contratados / Entitlements do Tenant
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map((mod) => (
                <div
                  key={mod.code}
                  className="flex flex-col justify-between rounded-lg border border-border bg-surface p-3.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{mod.name}</span>
                      <button
                        type="button"
                        disabled={mod.required}
                        onClick={() => handleToggleModule(mod)}
                        className={`rounded px-2 py-0.5 font-mono text-[11px] font-medium transition-colors ${
                          mod.enabled
                            ? 'bg-success/15 text-success'
                            : 'bg-surface-muted text-text-muted'
                        } ${mod.required ? 'cursor-not-allowed opacity-75' : 'hover:opacity-80'}`}
                      >
                        {mod.required ? 'CORE' : mod.enabled ? 'ATIVO' : 'INATIVO'}
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-text-secondary">
                      {mod.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                Ordens de Serviço Ativas (Isoladas por RLS)
              </h2>
              <span className="font-mono text-xs text-text-secondary tabular-nums">
                {orders.length} registro(s)
              </span>
            </div>

            {!session?.enabledModules.includes('mod-service-orders') ? (
              <div className="mt-3 rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
                O módulo <strong>Assistência Técnica & OS</strong> está desativado para esta organização. Ative-o acima para liberar a fila de balcão e bancada.
              </div>
            ) : orders.length === 0 ? (
              <div className="mt-3 rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
                Nenhuma OS cadastrada ainda para este tenant.
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-muted/60 text-xs text-text-secondary">
                    <tr>
                      <th className="px-4 py-3 font-medium">OS</th>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Equipamento</th>
                      <th className="px-4 py-3 font-medium">Sintoma</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((os) => (
                      <tr key={os.id} className="hover:bg-surface-muted/40">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-accent tabular-nums">
                          {os.code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{os.customerName}</div>
                          <div className="font-mono text-xs text-text-muted tabular-nums">
                            {os.customerPhone}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {[os.assetBrand, os.assetModel].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-text-secondary">
                          {os.reportedSymptoms}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                            {OS_STATUS_LABELS[os.status] ?? os.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
