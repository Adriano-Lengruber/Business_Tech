'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { MODULE_CATALOG, MODULE_CODES, type ModuleCode } from '@al/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-provider';

export default function RegisterPage() {
  const router = useRouter();
  const [ownerName, setOwnerName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedModules, setSelectedModules] = useState<ModuleCode[]>([
    'core',
    'mod-service-orders',
    'mod-ai-agents',
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleModule(code: ModuleCode) {
    if (MODULE_CATALOG[code].required) return;
    setSelectedModules((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ accessToken: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ownerName,
          organizationName,
          email,
          password,
          enabledModules: selectedModules,
        }),
      });
      window.localStorage.setItem('al_token', res.accessToken);
      router.push('/app');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Erro ao registrar organização. Verifique a API.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="al-grid-bg flex min-h-screen flex-col px-4 py-8">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          ← Voltar ao início
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto my-8 w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-xl sm:p-8">
        <span className="font-mono text-xs font-semibold text-accent">
          ONBOARDING SAAS MODULAR
        </span>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
          Criar organização isolada
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Escolha apenas os módulos que sua equipe precisa ativar agora. Você pode ligar
          ou desligar outros módulos depois sem perder dados.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ownerName" className="block text-xs font-medium text-text-secondary">
                Seu nome
              </label>
              <input
                id="ownerName"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="orgName" className="block text-xs font-medium text-text-secondary">
                Nome da empresa
              </label>
              <input
                id="orgName"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="regEmail" className="block text-xs font-medium text-text-secondary">
                E-mail corporativo
              </label>
              <input
                id="regEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="regPass" className="block text-xs font-medium text-text-secondary">
                Senha (mín. 8 caracteres)
              </label>
              <input
                id="regPass"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="pt-1">
            <span className="block text-xs font-medium text-text-secondary">
              Módulos iniciais habilitados no tenant
            </span>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              {MODULE_CODES.map((code) => {
                const mod = MODULE_CATALOG[code];
                const active = selectedModules.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={mod.required}
                    onClick={() => toggleModule(code)}
                    className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                      active
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-bg hover:bg-surface-muted'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <span className="block truncate text-sm font-medium">{mod.name}</span>
                      <span className="font-mono text-[10px] text-text-muted">
                        {mod.required ? 'OBRIGATÓRIO' : active ? 'INCLUSO' : 'OPCIONAL'}
                      </span>
                    </div>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        active
                          ? 'border-accent bg-accent text-accent-foreground'
                          : 'border-border bg-surface'
                      }`}
                    >
                      {active && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? 'Provisionando tenant...' : 'Criar organização e entrar'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
