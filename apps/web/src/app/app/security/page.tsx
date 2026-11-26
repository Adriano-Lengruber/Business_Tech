'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  Copy,
  KeyRound,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  Webhook,
} from 'lucide-react';
import { ErpShell } from '@/components/erp-shell';
import { Card } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api';

interface AuditRow {
  id: string;
  actorType: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  createdAt: string;
}

interface TeamMemberRow {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
}

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
}

interface WebhookRow {
  id: string;
  name: string;
  targetUrl: string;
  events: string[];
  isActive: boolean;
  lastStatusCode: number | null;
  lastDeliveredAt: string | null;
}

function SecurityContent() {
  const [tab, setTab] = useState<'audit' | 'team' | 'integrations'>('audit');
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [team, setTeam] = useState<TeamMemberRow[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);

  // Team form
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'technician' | 'attendant' | 'viewer'>('technician');

  // Integrations forms
  const [keyName, setKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [hookName, setHookName] = useState('');
  const [hookUrl, setHookUrl] = useState('');
  const [revealedHookSecret, setRevealedHookSecret] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const [logsRes, teamRes, intRes] = await Promise.all([
      apiFetch<AuditRow[]>(
        `/security/audit-logs?action=${encodeURIComponent(actionFilter)}`,
        { token },
      ).catch(() => []),
      apiFetch<TeamMemberRow[]>('/security/team', { token }).catch(() => []),
      apiFetch<{ apiKeys: ApiKeyRow[]; webhooks: WebhookRow[] }>(
        '/integrations',
        { token },
      ).catch(() => ({ apiKeys: [], webhooks: [] })),
    ]);
    setAuditLogs(logsRes);
    setTeam(teamRes);
    setApiKeys(intRes.apiKeys);
    setWebhooks(intRes.webhooks);
  }, [actionFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch('/security/team', {
      method: 'POST',
      token,
      body: JSON.stringify({
        name: memberName,
        email: memberEmail,
        password: memberPassword,
        role: memberRole,
      }),
    });
    setMemberName('');
    setMemberEmail('');
    setMemberPassword('');
    setFeedback('Membro adicionado com papel RBAC ativo.');
    await loadAll();
  }

  async function handleCreateKey(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const res = await apiFetch<{ plainKey: string }>('/integrations/api-keys', {
      method: 'POST',
      token,
      body: JSON.stringify({ name: keyName }),
    });
    setKeyName('');
    setRevealedKey(res.plainKey);
    await loadAll();
  }

  async function handleRevokeKey(id: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/integrations/api-keys/${id}`, {
      method: 'DELETE',
      token,
    });
    await loadAll();
  }

  async function handleCreateWebhook(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const res = await apiFetch<{ signingSecret: string }>(
      '/integrations/webhooks',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ name: hookName, targetUrl: hookUrl }),
      },
    );
    setHookName('');
    setHookUrl('');
    setRevealedHookSecret(res.signingSecret);
    await loadAll();
  }

  async function handleTestWebhook(id: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const res = await apiFetch<{ delivered: boolean; statusCode: number }>(
      `/integrations/webhooks/${id}/test`,
      { method: 'POST', token },
    );
    setFeedback(
      `Teste de Webhook concluído (HTTP ${res.statusCode} · ${res.delivered ? 'Entregue' : 'Destino inacessível/erro'}).`,
    );
    await loadAll();
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="rounded-xl border border-accent/35 bg-accent/10 px-4 py-2.5 text-xs font-medium text-accent">
          {feedback}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { id: 'audit', label: `Trilha de Auditoria (${auditLogs.length})`, icon: Activity },
          { id: 'team', label: `Equipe & RBAC (${team.length})`, icon: Users },
          { id: 'integrations', label: `API Keys & Webhooks`, icon: KeyRound },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as 'audit' | 'team' | 'integrations')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-accent text-accent-foreground'
                  : 'border border-border bg-surface text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <input
              placeholder="Filtrar ação (ex: service_order, password_revealed, contract)..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full max-w-md rounded-xl border border-border bg-surface px-3.5 py-2 text-xs outline-none focus:border-accent"
            />
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-success">
              <ShieldCheck className="h-4 w-4" />
              Log Append-Only Ativo
            </span>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-muted/60 text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Data / Hora</th>
                    <th className="px-4 py-3 font-medium">Ator</th>
                    <th className="px-4 py-3 font-medium">Ação</th>
                    <th className="px-4 py-3 font-medium">Entidade</th>
                    <th className="px-4 py-3 font-medium">Motivo / Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-muted/35">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-text-muted whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-2.5 font-mono uppercase">
                        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px]">
                          {log.actorType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-accent">
                        {log.action}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-text-secondary">
                        {log.entityType}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {log.reason || log.entityId || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'team' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="p-5 lg:col-span-5 h-fit">
            <h3 className="font-display text-sm font-semibold">
              Adicionar Membro da Equipe (RBAC)
            </h3>
            <form onSubmit={handleAddMember} className="mt-4 space-y-3">
              <input
                required
                placeholder="Nome completo *"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
              <input
                required
                type="email"
                placeholder="E-mail *"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
              <input
                required
                type="password"
                minLength={8}
                placeholder="Senha provisória (mín. 8 dígitos) *"
                value={memberPassword}
                onChange={(e) => setMemberPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              />
              <select
                value={memberRole}
                onChange={(e) =>
                  setMemberRole(
                    e.target.value as
                      | 'admin'
                      | 'technician'
                      | 'attendant'
                      | 'viewer',
                  )
                }
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              >
                <option value="technician">Técnico de Bancada</option>
                <option value="attendant">Atendente Balcão / WhatsApp</option>
                <option value="admin">Administrador</option>
                <option value="viewer">Visualizador (Somente Leitura)</option>
              </select>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
              >
                <Plus className="h-3.5 w-3.5" />
                Cadastrar Membro
              </button>
            </form>
          </Card>

          <Card className="p-5 lg:col-span-7 space-y-3">
            <h3 className="font-display text-sm font-semibold">
              Usuários com Acesso ao Tenant
            </h3>
            <div className="space-y-2">
              {team.map((m) => (
                <div
                  key={m.membershipId}
                  className="flex items-center justify-between rounded-xl border border-border bg-bg px-4 py-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-text-primary">{m.name}</p>
                    <p className="font-mono text-text-muted">{m.email}</p>
                  </div>
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-accent">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'integrations' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 font-display text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-accent" />
              API Keys do Tenant (SHA-256)
            </div>
            <form onSubmit={handleCreateKey} className="flex gap-2">
              <input
                required
                placeholder="Nome (ex: Integração n8n / ERP Externo)"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground"
              >
                Gerar Key
              </button>
            </form>

            {revealedKey && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs space-y-1">
                <p className="font-semibold text-warning">
                  Copie agora — esta chave não será exibida novamente:
                </p>
                <div className="flex items-center justify-between gap-2 font-mono text-text-primary">
                  <span className="truncate">{revealedKey}</span>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(revealedKey)}
                    className="rounded border border-border bg-surface px-2 py-1"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {apiKeys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-bg px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-medium">{k.name}</p>
                    <p className="font-mono text-[11px] text-text-muted">
                      {k.keyPrefix}•••••••• · {k.isActive ? 'ATIVA' : 'REVOGADA'}
                    </p>
                  </div>
                  {k.isActive && (
                    <button
                      type="button"
                      onClick={() => void handleRevokeKey(k.id)}
                      className="rounded-lg border border-danger/30 p-1.5 text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 font-display text-sm font-semibold">
              <Webhook className="h-4 w-4 text-accent" />
              Webhooks Assinados (HMAC-SHA256)
            </div>
            <form onSubmit={handleCreateWebhook} className="space-y-2">
              <input
                required
                placeholder="Nome (ex: Automação n8n / Make)"
                value={hookName}
                onChange={(e) => setHookName(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs"
              />
              <div className="flex gap-2">
                <input
                  required
                  type="url"
                  placeholder="https://seu-endpoint.com/webhook"
                  value={hookUrl}
                  onChange={(e) => setHookUrl(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground"
                >
                  Cadastrar
                </button>
              </div>
            </form>

            {revealedHookSecret && (
              <div className="rounded-xl border border-accent/35 bg-accent/10 p-3 text-xs">
                <span className="font-semibold text-accent">
                  Segredo HMAC gerado (cabeçalho X-AL-Signature):
                </span>{' '}
                <code className="font-mono">{revealedHookSecret}</code>
              </div>
            )}

            <div className="space-y-2">
              {webhooks.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{w.name}</p>
                    <p className="truncate font-mono text-[10px] text-text-muted">
                      {w.targetUrl}{' '}
                      {w.lastStatusCode ? `· HTTP ${w.lastStatusCode}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleTestWebhook(w.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] hover:border-accent"
                  >
                    <Send className="h-3 w-3" />
                    Testar
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function SecurityPage() {
  return (
    <ErpShell
      title="Segurança, Equipe & Integrações"
      subtitle="Auditoria LGPD imutável, papéis RBAC, API Keys e Webhooks assinados"
    >
      {() => <SecurityContent />}
    </ErpShell>
  );
}
