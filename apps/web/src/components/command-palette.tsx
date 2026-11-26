'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  Laptop,
  PlusCircle,
  Search,
  Sparkles,
  User,
  Wrench,
  X,
} from 'lucide-react';
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

interface CopilotResponse {
  answer: string;
  sources: Array<{ documentTitle: string; rankScore?: number }>;
  provider: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'search' | 'copilot'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({
    customers: [],
    assets: [],
    serviceOrders: [],
  });
  const [copilotAnswer, setCopilotAnswer] = useState<CopilotResponse | null>(
    null,
  );
  const [asking, setAsking] = useState(false);

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
    if (!open || mode !== 'search' || query.trim().length < 2) {
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
  }, [open, mode, query]);

  async function handleAskCopilot(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || query.trim().length < 2) return;
    setAsking(true);
    try {
      const res = await apiFetch<CopilotResponse>('/ai/copilot/ask', {
        method: 'POST',
        token,
        body: JSON.stringify({ question: query }),
      });
      setCopilotAnswer(res);
    } catch {
      setCopilotAnswer({
        answer: 'Não foi possível consultar o Copiloto (verifique se mod-ai-agents está ativo).',
        sources: [],
        provider: 'error',
      });
    } finally {
      setAsking(false);
    }
  }

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
        <span>Busca & Copiloto IA</span>
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
            className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
              <button
                type="button"
                onClick={() => setMode('search')}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  mode === 'search'
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary'
                }`}
              >
                Busca Rápida
              </button>
              <button
                type="button"
                onClick={() => setMode('copilot')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
                  mode === 'copilot'
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                Copiloto IA
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar busca"
                className="ml-auto"
              >
                <X className="h-4 w-4 text-text-muted" />
              </button>
            </div>

            {mode === 'search' ? (
              <>
                <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
                  <Search className="h-4 w-4 text-text-muted" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar OS, cliente, telefone, serial ou QR..."
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
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
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-4 space-y-3">
                <form onSubmit={handleAskCopilot} className="flex gap-2">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='Ex: "Quais peças estão com estoque baixo?" ou "Qual a garantia?"'
                    className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={asking}
                    className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
                  >
                    {asking ? 'Pensando...' : 'Perguntar'}
                  </button>
                </form>

                {copilotAnswer && (
                  <div className="rounded-lg border border-border bg-bg p-3.5 text-sm space-y-2">
                    <p className="whitespace-pre-wrap">{copilotAnswer.answer}</p>
                    {copilotAnswer.sources.length > 0 && (
                      <p className="font-mono text-[11px] text-text-muted">
                        Fontes RAG:{' '}
                        {copilotAnswer.sources
                          .map((s) => s.documentTitle)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
