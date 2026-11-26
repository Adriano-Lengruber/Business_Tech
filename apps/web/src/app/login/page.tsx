'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-provider';

interface AuthResponse {
  accessToken: string;
  user: {
    userId: string;
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
    role: string;
  };
  enabledModules: string[];
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('adriano@altech.local');
  const [password, setPassword] = useState('Admin@12345');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      window.localStorage.setItem('al_token', data.accessToken);
      router.push('/app');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível conectar à API. Verifique se o backend está rodando.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="al-grid-bg flex min-h-screen flex-col px-4 py-8">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          ← Voltar ao início
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto my-auto w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-xl sm:p-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent font-mono text-xs font-bold text-accent-foreground">
              AL
            </span>
            <span className="font-mono text-xs font-semibold text-accent">
              AL BUSINESS OS
            </span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">
            Entrar na operação
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Acesse seu workspace isolado por Row-Level Security.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-text-secondary">
              E-mail corporativo
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-text-secondary">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? 'Autenticando...' : 'Entrar no painel'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1 text-text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            JWT + RLS Ativo
          </span>
          <Link href="/register" className="font-medium text-accent hover:underline">
            Criar nova empresa →
          </Link>
        </div>
      </div>
    </div>
  );
}
