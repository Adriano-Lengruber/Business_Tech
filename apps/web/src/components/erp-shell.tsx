'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Boxes,
  DollarSign,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  PlusCircle,
  ShoppingCart,
  Wrench,
} from 'lucide-react';
import type { ModuleCode } from '@al/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { CommandPalette } from './command-palette';
import { ThemeToggle } from './theme-provider';

export interface ErpSession {
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

export function ErpShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: (session: ErpSession, reloadSession: () => Promise<void>) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<ErpSession | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const data = await apiFetch<ErpSession>('/auth/me', { token });
      setSession(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.localStorage.removeItem('al_token');
        router.replace('/login');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogout() {
    window.localStorage.removeItem('al_token');
    router.replace('/login');
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-text-secondary">
        Carregando workspace multi-tenant...
      </div>
    );
  }

  const navItems = [
    { href: '/app', label: 'Minha Fila de Hoje', icon: LayoutDashboard, show: true },
    {
      href: '/app/os/new',
      label: 'Balcão — Nova OS',
      icon: PlusCircle,
      show: session.enabledModules.includes('mod-service-orders'),
    },
    {
      href: '/app/inbox',
      label: 'Inbox WhatsApp & IA',
      icon: MessageSquare,
      show: true,
    },
    {
      href: '/app/inventory',
      label: 'Estoque & Compras',
      icon: Package,
      show: session.enabledModules.includes('mod-inventory-pos'),
    },
    {
      href: '/app/pos',
      label: 'PDV (Vendas)',
      icon: ShoppingCart,
      show: session.enabledModules.includes('mod-inventory-pos'),
    },
    {
      href: '/app/finance',
      label: 'Financeiro & PIX',
      icon: DollarSign,
      show: session.enabledModules.includes('mod-finance-fiscal'),
    },
    {
      href: '/app/fiscal',
      label: 'Notas Fiscais (SEFAZ)',
      icon: FileCheck2,
      show: session.enabledModules.includes('mod-finance-fiscal'),
    },
    {
      href: '/app/modules',
      label: 'Módulos SaaS',
      icon: Boxes,
      show: true,
    },
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen bg-bg text-text-primary">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface p-4 md:flex">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-mono text-xs font-bold text-accent-foreground">
            AL
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {session.user.organizationName}
            </p>
            <p className="truncate font-mono text-[11px] text-text-muted">
              {session.user.role.toUpperCase()} · RLS ATIVO
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active =
              item.href === '/app'
                ? pathname === '/app'
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border pt-3">
          <p className="truncate px-2 text-xs font-medium text-text-primary">
            {session.user.name}
          </p>
          <p className="truncate px-2 pb-3 text-[11px] text-text-muted">
            {session.user.email}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface-muted hover:text-text-primary"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{title}</h1>
            {subtitle && (
              <p className="truncate text-xs text-text-secondary">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CommandPalette />
            {session.enabledModules.includes('mod-service-orders') && (
              <Link
                href="/app/os/new"
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
              >
                <Wrench className="h-3.5 w-3.5" />
                Nova OS
              </Link>
            )}
            <ThemeToggle />
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-border bg-surface px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
          {children(session, loadSession)}
        </main>
      </div>
    </div>
  );
}
