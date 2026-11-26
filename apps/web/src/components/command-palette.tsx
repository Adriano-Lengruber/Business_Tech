'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Laptop, PlusCircle, Search, User, Wrench, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface SearchResult {
  customers: Array<{ id: string; name: string; phoneE164: string }>;
  assets: Array<{
    id: string;
    category: string;
    brand: string | null;
    model: string | null;
    qrToken: string;
  }>;
  serviceOrders: Array<{
    id: string;
    code: string;
    status: string;
    reportedSymptoms: string;
  }>;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({
    customers: [],
    assets: [],
    serviceOrders: [],
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults({ customers: [], assets: [], serviceOrders: [] });
      return;
    }
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const timer = setTimeout(() => {
      apiFetch<SearchResult>(`/search?q=${encodeURIComponent(query)}`, { token })
        .then(setResults)
        .catch(() => undefined);
    }, 180);
    return () => clearTimeout(timer);
  }, [open, query]);

  function go(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-md border border-border bg-bg px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-muted sm:inline-flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Busca Global</span>
        <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px]">
          Ctrl+K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
              <Search className="h-4 w-4 text-text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar OS, cliente, telefone, serial ou QR..."
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar busca"
              >
                <X className="h-4 w-4 text-text-muted" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 text-sm">
              {query.trim().length < 2 ? (
                <div className="space-y-1 p-1">
                  <p className="px-2 py-1 font-mono text-[11px] text-text-muted">
                    ATALHOS RÁPIDOS
                  </p>
                  <button
                    type="button"
                    onClick={() => go('/app/os/new')}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-surface-muted"
                  >
                    <PlusCircle className="h-4 w-4 text-accent" />
                    Dar entrada de OS no balcão
                  </button>
                  <button
                    type="button"
                    onClick={() => go('/app/inbox')}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-surface-muted"
                  >
                    <Wrench className="h-4 w-4 text-accent" />
                    Abrir Inbox WhatsApp & IA
                  </button>
                  <button
                    type="button"
                    onClick={() => go('/app/finance')}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-surface-muted"
                  >
                    <DollarSign className="h-4 w-4 text-accent" />
                    Abrir Financeiro & PIX
                  </button>
                </div>
              ) : (
                <div className="space-y-2 p-1">
                  {results.serviceOrders.map((os) => (
                    <button
                      key={os.id}
                      type="button"
                      onClick={() => go(`/app/os/${os.id}`)}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-surface-muted"
                    >
                      <span className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-accent" />
                        <span className="font-mono font-semibold">{os.code}</span>
                        <span className="truncate text-xs text-text-secondary">
                          {os.reportedSymptoms}
                        </span>
                      </span>
                    </button>
                  ))}
                  {results.customers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-text-secondary"
                    >
                      <User className="h-4 w-4 text-text-muted" />
                      <span className="font-medium text-text-primary">{c.name}</span>
                      <span className="font-mono">{c.phoneE164}</span>
                    </div>
                  ))}
                  {results.assets.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-text-secondary"
                    >
                      <Laptop className="h-4 w-4 text-text-muted" />
                      <span>
                        {[a.category, a.brand, a.model].filter(Boolean).join(' ')}
                      </span>
                      <span className="font-mono text-accent">{a.qrToken}</span>
                    </div>
                  ))}
                  {results.serviceOrders.length === 0 &&
                    results.customers.length === 0 &&
                    results.assets.length === 0 && (
                      <p className="p-3 text-center text-xs text-text-muted">
                        Nenhum registro encontrado para &quot;{query}&quot;.
                      </p>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
