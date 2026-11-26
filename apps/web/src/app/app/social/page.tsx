'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Megaphone, Sparkles, UserPlus } from 'lucide-react';
import type { SocialPlatform } from '@al/shared';
import { ErpShell, type ErpSession } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface SocialPostRow {
  id: string;
  platform: SocialPlatform;
  status: string;
  title: string;
  caption: string;
  hashtags: string | null;
  impressions: number;
  likes: number;
  commentsCount: number;
  leadsGenerated: number;
}

interface LeadRow {
  id: string;
  source: string;
  name: string;
  phoneE164: string | null;
  notes: string | null;
  stage: string;
  aiScore: number;
}

function SocialContent({ session }: { session: ErpSession }) {
  const [posts, setPosts] = useState<SocialPostRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [topicHint, setTopicHint] = useState('');
  const [generating, setGenerating] = useState(false);

  const [leadPostId, setLeadPostId] = useState<string | null>(null);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');

  const enabled = session.enabledModules.includes('mod-social-growth');

  const load = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token || !enabled) return;
    const [p, l] = await Promise.all([
      apiFetch<SocialPostRow[]>('/social/posts', { token }),
      apiFetch<LeadRow[]>('/leads', { token }),
    ]);
    setPosts(p);
    setLeads(l);
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAiGenerate(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    setGenerating(true);
    try {
      await apiFetch('/social/posts/ai-generate', {
        method: 'POST',
        token,
        body: JSON.stringify({ platform, topicHint }),
      });
      setTopicHint('');
      await load();
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprovePublish(postId: string) {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    await apiFetch(`/social/posts/${postId}/approve-publish`, {
      method: 'POST',
      token,
    });
    await load();
  }

  async function handleCaptureLead(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !leadPostId) return;
    await apiFetch(`/social/posts/${leadPostId}/convert-lead`, {
      method: 'POST',
      token,
      body: JSON.stringify({ name: leadName, phoneE164: leadPhone }),
    });
    setLeadPostId(null);
    setLeadName('');
    setLeadPhone('');
    await load();
  }

  if (!enabled) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
        O módulo <strong>Social Media & Growth IA</strong> está desativado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleAiGenerate}
        className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-4"
      >
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
          className="rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
          <option value="facebook">Facebook</option>
          <option value="youtube_shorts">YouTube Shorts</option>
        </select>
        <input
          value={topicHint}
          onChange={(e) => setTopicHint(e.target.value)}
          placeholder="Tema ou caso real da semana (ex: upgrade SSD + impressão 3D)..."
          className="min-w-[240px] flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
        >
          <Sparkles className="h-4 w-4" />
          {generating ? 'Gerando...' : 'Gerar Rascunho com IA'}
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="h-4 w-4 text-accent" />
            Postagens & Aprovação Humana ({posts.length})
          </h2>

          {posts.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-border bg-surface p-4 space-y-2.5 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold uppercase text-accent">
                  {p.platform}
                </span>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
                    p.status === 'PUBLISHED'
                      ? 'bg-success/15 text-success'
                      : 'bg-warning/20 text-warning'
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <h3 className="font-semibold">{p.title}</h3>
              <p className="text-xs leading-relaxed text-text-secondary">
                {p.caption}
              </p>
              {p.hashtags && (
                <p className="font-mono text-xs text-accent">{p.hashtags}</p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-xs">
                <div className="flex gap-4 font-mono text-text-muted">
                  <span>Alcance: {p.impressions}</span>
                  <span>Likes: {p.likes}</span>
                  <span>Leads: {p.leadsGenerated}</span>
                </div>
                <div className="flex gap-2">
                  {p.status !== 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => void handleApprovePublish(p.id)}
                      className="inline-flex items-center gap-1 rounded bg-success px-3 py-1 font-semibold text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aprovar & Publicar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setLeadPostId(p.id)}
                    className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 hover:bg-surface-muted"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-accent" />
                    Capturar Lead
                  </button>
                </div>
              </div>

              {leadPostId === p.id && (
                <form
                  onSubmit={handleCaptureLead}
                  className="flex flex-wrap gap-2 rounded bg-bg p-2.5"
                >
                  <input
                    required
                    placeholder="Nome do interessado"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    className="flex-1 rounded border border-border bg-surface px-2.5 py-1.5 text-xs"
                  />
                  <input
                    placeholder="WhatsApp"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    className="w-36 rounded border border-border bg-surface px-2.5 py-1.5 text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                  >
                    Enviar ao CRM
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Leads Capturados no CRM ({leads.length})</h2>
          <div className="space-y-2">
            {leads.map((l) => (
              <div
                key={l.id}
                className="rounded-lg border border-border bg-surface p-3.5 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{l.name}</span>
                  <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[10px] text-accent">
                    {l.stage} · {l.aiScore}pts
                  </span>
                </div>
                <p className="font-mono text-text-muted">
                  Origem: {l.source} {l.phoneE164 ? `· ${l.phoneE164}` : ''}
                </p>
                {l.notes && <p className="text-text-secondary">{l.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SocialPage() {
  return (
    <ErpShell
      title="Social Media & Growth IA"
      subtitle="Geração de conteúdo com aprovação humana, métricas e conversão direta para o CRM"
    >
      {(session) => <SocialContent session={session} />}
    </ErpShell>
  );
}
