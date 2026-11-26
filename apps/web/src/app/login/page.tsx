'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    <div className="flex min-h-screen flex-col bg-bg px-4 py-8">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-text-secondary hover:text-text-primary">
          ← Voltar ao site
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto my-auto w-full max-w-md rounded-xl border border-border bg-surface p-6 sm:p-8">
        <div className="mb-6">
          <span className="font-mono text-xs text-accent">AL BUSINESS OS</span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Entrar na operação</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Acesse seu painel modular com credenciais locais do seed ou sua conta SaaS.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? 'Autenticando...' : 'Entrar no sistema'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Ainda não tem organização?{' '}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Criar conta modular
          </Link>
        </p>
      </div>
    </div>
  );
}
