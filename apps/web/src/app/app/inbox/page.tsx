'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Bot, RefreshCw, Send, UserCheck } from 'lucide-react';
import type { ConversationBotState } from '@al/shared';
import { ErpShell } from '@/components/erp-shell';
import { apiFetch } from '@/lib/api';

interface ConversationRow {
  id: string;
  externalThreadId: string;
  botState: ConversationBotState;
  handoffReason: string | null;
  handoffSummary: string | null;
  lastMessageAt: string | null;
  customerName: string | null;
}

interface MessageRow {
  id: string;
  direction: 'inbound' | 'outbound';
  senderType: 'customer' | 'human_agent' | 'ai_agent' | 'automation';
  contentText: string | null;
  audioTranscript: string | null;
  createdAt: string;
}

const STATE_BADGE: Record<ConversationBotState, { label: string; cls: string }> = {
  BOT_ACTIVE: { label: 'IA ATIVA', cls: 'bg-accent/15 text-accent' },
  WAITING_HUMAN: {
    label: 'AGUARDANDO HUMANO',
    cls: 'bg-warning/20 text-warning',
  },
  HUMAN_ACTIVE: { label: 'HUMANO ASSUMIU', cls: 'bg-success/15 text-success' },
  PAUSED: { label: 'PAUSADO', cls: 'bg-surface-muted text-text-muted' },
  RESOLVED: { label: 'RESOLVIDO', cls: 'bg-surface-muted text-text-muted' },
};

function InboxContent() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [replyText, setReplyText] = useState('');
  const [simPhone, setSimPhone] = useState('+5511999990001');
  const [simText, setSimText] = useState('');
  const [simAudio, setSimAudio] = useState(false);
  const [simStatus, setSimStatus] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const rows = await apiFetch<ConversationRow[]>('/inbox/conversations', {
      token,
    });
    setConversations(rows);
    if (!selectedId && rows[0]) {
      setSelectedId(rows[0].id);
    }
  }, [selectedId]);

  const loadMessages = useCallback(async (convId: string) => {
    const token = window.localStorage.getItem('al_token');
    if (!token) return;
    const rows = await apiFetch<MessageRow[]>(
      `/inbox/conversations/${convId}/messages`,
      { token },
    );
    setMessages(rows);
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) {
      void loadMessages(selectedId);
    }
  }, [selectedId, loadMessages]);

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  async function handleHumanReply(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !selectedId || !replyText.trim()) return;
    await apiFetch(`/inbox/conversations/${selectedId}/reply`, {
      method: 'POST',
      token,
      body: JSON.stringify({ text: replyText }),
    });
    setReplyText('');
    await Promise.all([loadConversations(), loadMessages(selectedId)]);
  }

  async function handleChangeBotState(botState: ConversationBotState) {
    const token = window.localStorage.getItem('al_token');
    if (!token || !selectedId) return;
    await apiFetch(`/inbox/conversations/${selectedId}/bot-state`, {
      method: 'POST',
      token,
      body: JSON.stringify({ botState }),
    });
    await loadConversations();
  }

  async function handleSimulateInbound(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem('al_token');
    if (!token || !simText.trim()) return;
    const res = await apiFetch<{ conversationId: string; debouncedMs: number }>(
      '/inbox/simulate-inbound',
      {
        method: 'POST',
        token,
        body: JSON.stringify({
          phoneE164: simPhone,
          text: simText,
          isAudio: simAudio,
        }),
      },
    );
    setSimText('');
    setSelectedId(res.conversationId);
    setSimStatus(
      `Mensagem enfileirada com debounce de ${res.debouncedMs / 1000}s. Atualizando resposta do agente...`,
    );
    await Promise.all([loadConversations(), loadMessages(res.conversationId)]);
    setTimeout(() => {
      void Promise.all([loadConversations(), loadMessages(res.conversationId)]);
      setSimStatus(null);
    }, res.debouncedMs + 1200);
  }

  return (
    <div className="space-y-4">
      {/* Simulador de WhatsApp para testar Debounce + Agente IA + Handoff ao vivo */}
      <form
        onSubmit={handleSimulateInbound}
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-xs"
      >
        <span className="font-mono font-semibold text-accent">
          Simular Cliente WhatsApp:
        </span>
        <input
          value={simPhone}
          onChange={(e) => setSimPhone(e.target.value)}
          placeholder="+5511999990001"
          className="w-36 rounded border border-border bg-bg px-2.5 py-1.5 font-mono"
        />
        <input
          value={simText}
          onChange={(e) => setSimText(e.target.value)}
          placeholder='Ex: "Qual o status do meu notebook?" ou "Quero falar com atendente"'
          className="min-w-[240px] flex-1 rounded border border-border bg-bg px-2.5 py-1.5"
        />
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={simAudio}
            onChange={(e) => setSimAudio(e.target.checked)}
          />
          Áudio
        </label>
        <button
          type="submit"
          className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-foreground hover:bg-accent-hover"
        >
          Enviar p/ Fila BullMQ
        </button>
        {simStatus && <span className="text-text-secondary">{simStatus}</span>}
      </form>

      <div className="grid min-h-[540px] overflow-hidden rounded-2xl border border-border bg-surface lg:grid-cols-3">
        {/* Coluna 1: Conversas */}
        <div className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-xs font-semibold uppercase text-text-muted">
              Conversas ({conversations.length})
            </span>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="text-text-muted hover:text-text-primary"
              aria-label="Atualizar conversas"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="divide-y divide-border">
            {conversations.map((c) => {
              const badge = STATE_BADGE[c.botState] ?? STATE_BADGE.BOT_ACTIVE;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    selectedId === c.id ? 'bg-accent/10' : 'hover:bg-surface-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {c.customerName ?? c.externalThreadId}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-text-muted">
                    {c.externalThreadId}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coluna 2-3: Chat + Controles de Handoff */}
        <div className="flex flex-col lg:col-span-2">
          {!selectedConv ? (
            <div className="m-auto p-6 text-sm text-text-muted">
              Selecione uma conversa ao lado ou dê entrada em uma nova OS.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {selectedConv.customerName ?? selectedConv.externalThreadId}
                  </p>
                  <p className="font-mono text-xs text-text-muted">
                    {selectedConv.externalThreadId}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedConv.botState !== 'BOT_ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => void handleChangeBotState('BOT_ACTIVE')}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-muted"
                    >
                      <Bot className="h-3.5 w-3.5 text-accent" />
                      Devolver para IA
                    </button>
                  )}
                  {selectedConv.botState !== 'HUMAN_ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => void handleChangeBotState('HUMAN_ACTIVE')}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-muted"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-success" />
                      Assumir Humano
                    </button>
                  )}
                </div>
              </div>

              {selectedConv.botState === 'WAITING_HUMAN' &&
                selectedConv.handoffSummary && (
                  <div className="border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-xs">
                    <p className="flex items-center gap-1.5 font-semibold text-warning">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Escalonamento para Humano — Bot Pausado
                    </p>
                    <p className="mt-1 text-text-secondary">
                      {selectedConv.handoffSummary}
                    </p>
                  </div>
                )}

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((m) => {
                  const isOutbound = m.direction === 'outbound';
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm ${
                          isOutbound
                            ? 'bg-accent/15 text-text-primary'
                            : 'border border-border bg-bg text-text-primary'
                        }`}
                      >
                        <p className="mb-1 font-mono text-[10px] uppercase text-text-muted">
                          {m.senderType === 'customer'
                            ? 'Cliente'
                            : m.senderType === 'ai_agent'
                              ? 'Agente IA'
                              : m.senderType === 'automation'
                                ? 'Automação OS'
                                : 'Atendente Humano'}
                        </p>
                        <p className="whitespace-pre-wrap">
                          {m.audioTranscript || m.contentText}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleHumanReply}
                className="flex gap-2 border-t border-border p-3"
              >
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Responder como atendente humano (pausa o bot automaticamente)..."
                  className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
                >
                  <Send className="h-4 w-4" />
                  Enviar
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <ErpShell
      title="Inbox WhatsApp & Agente IA"
      subtitle="Atendimento automatizado com debounce, grounding em OS e handoff humano"
    >
      {() => <InboxContent />}
    </ErpShell>
  );
}
