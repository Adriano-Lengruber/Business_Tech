'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  Boxes,
  Code2,
  DollarSign,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Package,
  PlusCircle,
  Printer,
  Repeat,
  ShieldCheck,
  ShoppingCart,
  Wrench,
  Zap,
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

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: 'Operação' | 'Comercial & Fiscal' | 'Verticais & IA' | 'Sistema';
  show: boolean;
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg text-sm text-text-secondary">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 font-mono text-sm font-bold text-accent animate-pulse">
          AL
        </span>
        <span>Carregando workspace multi-tenant...</span>
      </div>
    );
  }

  const rawNavItems: NavItem[] = [
    {
      href: '/app',
      label: 'Visão Geral & BI',
      icon: LayoutDashboard,
      group: 'Operação',
      show: true,
    },
    {
      href: '/app/os/new',
      label: 'Balcão — Nova OS',
      icon: PlusCircle,
      group: 'Operação',
      show: session.enabledModules.includes('mod-service-orders'),
    },
    {
      href: '/app/inbox',
      label: 'Inbox WhatsApp',
      icon: MessageSquare,
      group: 'Operação',
      show: true,
    },
    {
      href: '/app/automations',
      label: 'Automações',
      icon: Zap,
      group: 'Operação',
      show: true,
    },
    {
      href: '/app/inventory',
      label: 'Estoque & Peças',
      icon: Package,
      group: 'Comercial & Fiscal',
      show: session.enabledModules.includes('mod-inventory-pos'),
    },
    {
      href: '/app/pos',
      label: 'PDV Balcão',
      icon: ShoppingCart,
      group: 'Comercial & Fiscal',
      show: session.enabledModules.includes('mod-inventory-pos'),
    },
    {
      href: '/app/finance',
      label: 'Financeiro & PIX',
      icon: DollarSign,
      group: 'Comercial & Fiscal',
      show: session.enabledModules.includes('mod-finance-fiscal'),
    },
    {
      href: '/app/fiscal',
      label: 'Notas Fiscais',
      icon: FileCheck2,
      group: 'Comercial & Fiscal',
      show: session.enabledModules.includes('mod-finance-fiscal'),
    },
    {
      href: '/app/contracts',
      label: 'Contratos & SLA',
      icon: Repeat,
      group: 'Comercial & Fiscal',
      show: session.enabledModules.includes('mod-contracts-sla'),
    },
    {
      href: '/app/print3d',
      label: 'Impressão 3D',
      icon: Printer,
      group: 'Verticais & IA',
      show: session.enabledModules.includes('mod-3d-print'),
    },
    {
      href: '/app/projects',
      label: 'Projetos & Dev',
      icon: Code2,
      group: 'Verticais & IA',
      show: session.enabledModules.includes('mod-projects-dev'),
    },
    {
      href: '/app/social',
      label: 'Social & Leads',
      icon: Megaphone,
      group: 'Verticais & IA',
      show: session.enabledModules.includes('mod-social-growth'),
    },
    {
      href: '/app/knowledge',
      label: 'Base RAG & IA',
      icon: BookOpen,
      group: 'Verticais & IA',
      show: session.enabledModules.includes('mod-ai-agents'),
    },
    {
      href: '/app/modules',
      label: 'Módulos SaaS',
      icon: Boxes,
      group: 'Sistema',
      show: true,
    },
  ];
  const navItems = rawNavItems.filter((item) => item.show);

  const groups: Array<NavItem['group']> = [
    'Operação',
    'Comercial & Fiscal',
    'Verticais & IA',
    'Sistema',
  ];

  return (
    <div className="flex min-h-screen bg-bg text-text-primary">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/95 md:flex">
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent font-mono text-xs font-bold text-accent-foreground shadow-sm">
            AL
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold">
              {session.user.organizationName}
            </p>
            <p className="flex items-center gap-1 truncate font-mono text-[10px] text-text-muted">
              <ShieldCheck className="h-3 w-3 text-success" />
              {session.user.role.toUpperCase()} · RLS
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => {
            const items = navItems.filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active =
                      item.href === '/app'
                        ? pathname === '/app'
                        : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all ${
                          active
                            ? 'bg-accent/14 text-accent shadow-[inset_2px_0_0_0_var(--al-accent)]'
                            : 'text-text-secondary hover:bg-surface-muted/80 hover:text-text-primary'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2.5 rounded-xl bg-surface-muted/60 px-3 py-2">
            <p className="truncate text-xs font-medium text-text-primary">
              {session.user.name}
            </p>
            <p className="truncate font-mono text-[11px] text-text-muted">
              {session.user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            <LogOut className="h-3.5 w-3.5" />
            Encerrar sessão
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface/90 px-4 backdrop-blur-md sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate font-display text-base font-semibold tracking-tight sm:text-lg">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-text-secondary">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CommandPalette />
            {session.enabledModules.includes('mod-service-orders') && (
              <Link
                href="/app/os/new"
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover"
              >
                <Wrench className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nova OS</span>
              </Link>
            )}
            <ThemeToggle />
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-border bg-surface px-4 py-2 md:hidden">
          {navItems.map((item) => {
            const active =
              item.href === '/app'
                ? pathname === '/app'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  active
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border text-text-secondary'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          {children(session, loadSession)}
        </main>
      </div>
    </div>
  );
}
