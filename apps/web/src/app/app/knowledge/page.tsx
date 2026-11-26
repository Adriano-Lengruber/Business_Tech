'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BookOpen, Search, Sparkles } from 'lucide-react';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface KnowledgeDocRow {
  id: string;
  title: string;
  sourceType: string;
  chunksCount: number;
  createdAt: string;
}

interface SearchHit {
  id: string;
  documentTitle: string;
  content: string;
  rankScore?: number;
}

interface TelemetryRow {
  id: string;
  agentName: string;
  provider: string;
  model: string;
  latencyMs: number;
  riskLevel: string;
  createdAt: string;
}

function KnowledgeContent({ session }: { session: ErpSession }) {
  const [docs, setDocs] = useState<KnowledgeDocRow[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState('policy');
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);

  const enabled = session.enabledModules.includes('mod-ai-agents');

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !enabled) return;
    const [d, t] = await Promise.all([
      apiFetch<KnowledgeDocRow[]>('/ai/knowledge/documents', { token }),
      apiFetch<TelemetryRow[]>('/ai/telemetry', { token }),
    ]);
    setDocs(d);
    setTelemetry(t);
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleIngest(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch('/ai/knowledge/documents', {
      method: 'POST',
      token,
      body: JSON.stringify({ title, sourceType, content }),
    });
    setTitle('');
    setContent('');
    await load();
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !searchQuery.trim()) return;
    const res = await apiFetch<SearchHit[]>('/ai/knowledge/search', {
      method: 'POST',
      token,
      body: JSON.stringify({ query: searchQuery, limit: 4 }),
    });
    setHits(res);
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-secondary">
        O módulo <strong>Agentes de IA & WhatsApp</strong> está desativado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleIngest}
          className="rounded-2xl border border-border bg-surface p-5 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-accent" />
            Indexar Manual, Política ou SOP no RAG
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do documento *"
              className="rounded-xl border border-border bg-bg px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="policy">Política</option>
              <option value="manual">Manual Técnico</option>
              <option value="sop">SOP Bancada</option>
              <option value="faq">FAQ</option>
            </select>
          </div>
          <textarea
            required
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Cole aqui o texto do manual, garantia ou procedimento técnico (mín. 20 caracteres)..."
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            Gerar Chunks + Embeddings (pgvector)
          </button>
        </form>

        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Search className="h-4 w-4 text-accent" />
            Testar Busca Híbrida (RRF Lexical + Vetorial)
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ex: qual o prazo de garantia ou procedimento térmico?"
              className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
            >
              Buscar
            </button>
          </form>
          <div className="space-y-2">
            {hits.map((h) => (
              <div
                key={h.id}
                className="rounded-md border border-border bg-bg p-3 text-xs space-y-1"
              >
                <div className="flex justify-between font-mono text-accent">
                  <span>Fonte: {h.documentTitle}</span>
                  <span>RRF: {h.rankScore}</span>
                </div>
                <p className="text-text-secondary">{h.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold">Documentos Indexados ({docs.length})</h2>
          <div className="space-y-2">
            {docs.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded border border-border bg-bg px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{d.title}</p>
                  <p className="font-mono text-xs text-text-muted">
                    {d.sourceType} · {d.chunksCount} chunk(s)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-accent" />
            Telemetria dos Agentes IA ({telemetry.length})
          </h2>
          <div className="space-y-2">
            {telemetry.slice(0, 8).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded border border-border bg-bg px-3 py-2 font-mono text-xs"
              >
                <span>
                  {t.agentName} ({t.provider})
                </span>
                <span className="text-text-muted">
                  {t.latencyMs}ms · {t.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <ErpShell
      title="IA Local-First, Base RAG & Telemetria"
      subtitle="Manuais indexados com pgvector + RRF e observabilidade de agentes"
    >
      {(session) => <KnowledgeContent session={session} />}
    </ErpShell>
  );
}
