import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Boxes,
  Cpu,
  MessageSquare,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { MODULE_CATALOG, MODULE_CODES } from '@al/shared';
import { ThemeToggle } from '@/components/theme-provider';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground font-mono text-sm font-bold">
              AL
            </span>
            <span>AL Business OS</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-text-secondary md:flex">
            <a href="#fluxo" className="hover:text-text-primary transition-colors">
              Fluxo Agêntico
            </a>
            <a href="#modulos" className="hover:text-text-primary transition-colors">
              Módulos SaaS
            </a>
            <a href="#privacidade" className="hover:text-text-primary transition-colors">
              IA Local & LGPD
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              Criar conta
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
              <Cpu className="h-3.5 w-3.5 text-accent" />
              IA Local-First (Ollama + Whisper) · Multi-Tenant RLS · Modular
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              O sistema operacional agêntico para assistência técnica, 3D, software e varejo.
            </h1>
            <p className="text-lg leading-relaxed text-text-secondary">
              Receba o equipamento no balcão em segundos, notifique o cliente no WhatsApp na hora,
              automatize dúvidas com IA auditável e passe o atendimento para um humano sempre que precisar.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
              >
                Começar com módulos sob medida
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
              >
                Acessar painel operacional
              </Link>
            </div>
          </div>
        </section>

        <section id="fluxo" className="border-y border-border bg-surface/60 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              Do balcão ao WhatsApp em 1 clique — sem perder o toque humano
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              Cada evento da Ordem de Serviço aciona automações confiáveis com trilha de auditoria e trava automática de escalonamento.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface p-5">
                <Wrench className="h-5 w-5 text-accent" />
                <h3 className="mt-3 font-semibold">1. Intake Expresso no Balcão</h3>
                <p className="mt-1.5 text-sm text-text-secondary">
                  Cadastro rápido por telefone/CPF, vínculo do ativo com QR Code, fotos de entrada e pré-diagnóstico.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <MessageSquare className="h-5 w-5 text-accent" />
                <h3 className="mt-3 font-semibold">2. Notificação + Portal Seguro</h3>
                <p className="mt-1.5 text-sm text-text-secondary">
                  Cliente recebe no WhatsApp o resumo do equipamento, termo PDF e link mágico para acompanhar em tempo real.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <Bot className="h-5 w-5 text-accent" />
                <h3 className="mt-3 font-semibold">3. Agente IA + Handoff Humano</h3>
                <p className="mt-1.5 text-sm text-text-secondary">
                  IA transcreve áudios e responde dúvidas com dados reais da OS. Pediu desconto ou técnico? Pausa o bot e alerta o Inbox.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="modulos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Plataforma Modular: ative apenas o que sua operação usa
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                Todos os módulos compartilham o mesmo CRM, histórico do cliente e Copiloto de IA.
              </p>
            </div>
            <Boxes className="hidden h-6 w-6 text-text-muted sm:block" />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULE_CODES.map((code) => {
              const mod = MODULE_CATALOG[code];
              return (
                <div
                  key={code}
                  className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-text-muted">
                        {mod.code}
                      </span>
                      {mod.required && (
                        <span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                          Núcleo
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-semibold">{mod.name}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                      {mod.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="privacidade" className="border-t border-border bg-surface/40 py-14">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-success" />
              <div>
                <h3 className="font-semibold">Privacidade por Arquitetura (LGPD + RLS)</h3>
                <p className="mt-1 max-w-xl text-sm text-text-secondary">
                  Isolamento de empresas imposto pelo PostgreSQL Row-Level Security e política <code>strict_local</code> para manter dados de clientes fora de APIs externas por padrão.
                </p>
              </div>
            </div>
            <Link
              href="/register"
              className="shrink-0 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface-muted"
            >
              Testar ambiente multi-tenant
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
