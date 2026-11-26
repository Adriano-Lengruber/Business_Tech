import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  Check,
  Cpu,
  Lock,
  MessageSquare,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { MODULE_CATALOG, MODULE_CODES } from '@al/shared';
import { ThemeToggle } from '@/components/theme-provider';

const SAAS_TIERS = [
  {
    name: 'Bancada Essencial',
    price: 'R$ 89',
    period: '/mês',
    audience: 'Assistências técnicas individuais e balcão ágil',
    highlighted: false,
    modules: [
      'CRM + Histórico permanente por equipamento (QR Code)',
      'Ordem de Serviço com Termo PDF e Checklist de entrada',
      'Portal do cliente com aprovação digital de orçamento',
      'PIN/Senha do equipamento criptografado (AES-256-GCM)',
    ],
  },
  {
    name: 'Oficina Inteligente Pro',
    price: 'R$ 189',
    period: '/mês',
    audience: 'Lojas com equipe técnica, estoque, PDV e IA no WhatsApp',
    highlighted: true,
    modules: [
      'Tudo do plano Essencial + Kanban e BI de lucratividade',
      'Atendente IA no WhatsApp com áudio Whisper + Handoff humano',
      'Estoque com reserva na OS, PDV balcão e PIX / Boleto',
      'Base de conhecimento RAG para diagnósticos padronizados',
    ],
  },
  {
    name: 'Ecossistema Modular',
    price: 'R$ 349',
    period: '/mês',
    audience: 'Operações híbridas: Assistência, 3D, Software e Fiscal',
    highlighted: false,
    modules: [
      'Todos os módulos ativos ou ativação sob demanda por tenant',
      'Impressão 3D (filamentos, g-code/STL e custo por grama)',
      'Projetos de Software & Retainer recorrente B2B',
      'Camada fiscal brasileira (NF-e / NFS-e / NFC-e) + API',
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-display font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent font-mono text-xs font-bold text-accent-foreground">
              AL
            </span>
            <span>AL Business OS</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-text-secondary md:flex">
            <a href="#fluxo" className="transition-colors hover:text-text-primary">
              Fluxo Agêntico
            </a>
            <a href="#modulos" className="transition-colors hover:text-text-primary">
              Módulos
            </a>
            <a href="#planos" className="transition-colors hover:text-text-primary">
              Planos
            </a>
            <a href="#privacidade" className="transition-colors hover:text-text-primary">
              Segurança & IA
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              Criar conta
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero editorial + architectural preview */}
        <section className="al-grid-bg border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:py-24">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1 text-xs font-medium text-accent">
                <Cpu className="h-3.5 w-3.5" />
                IA Local-First (Ollama + Whisper) · Multi-Tenant RLS · LGPD
              </div>
              <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
                Controle de bancada, WhatsApp com IA e gestão financeira sem ruído.
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
                Receba o dispositivo no balcão em segundos, gere o termo PDF com QR Code,
                notifique o cliente no WhatsApp na hora e deixe a IA responder dúvidas com
                dados reais da OS — sempre com handoff imediato para atendimento humano.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover"
                >
                  Começar com módulos sob medida
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
                >
                  Testar painel ao vivo
                </Link>
              </div>
            </div>

            {/* Live product UI preview card (truthful UI anatomy, no fake metrics) */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                    <span className="font-mono text-xs font-semibold text-text-primary">
                      OS-2026-0001 · BANCADA
                    </span>
                  </div>
                  <span className="rounded-full border border-accent/35 bg-accent/12 px-2.5 py-0.5 font-mono text-[10px] font-medium text-accent">
                    EM DIAGNÓSTICO
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="rounded-xl border border-border bg-bg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-text-primary">
                        Dell Inspiron 15 3520
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-success">
                        <Lock className="h-3 w-3" /> PIN AES-256
                      </span>
                    </div>
                    <p className="mt-1 text-text-secondary">
                      Sintoma: desliga sob carga; inspeção térmica em andamento.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-bg p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span className="flex items-center gap-1 font-medium text-accent">
                        <MessageSquare className="h-3.5 w-3.5" />
                        WhatsApp Evolution + IA Local
                      </span>
                      <span className="font-mono">GROUNDED</span>
                    </div>
                    <p className="text-text-secondary">
                      “Olá! Seu notebook entrou em diagnóstico. Assim que o laudo e o
                      orçamento forem liberados, você aprova em 1 clique pelo link seguro.”
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="rounded-xl border border-border bg-surface-muted/50 p-2.5">
                      <span className="block text-[10px] text-text-muted">Entrada</span>
                      <span className="font-mono text-xs font-semibold">Termo PDF</span>
                    </div>
                    <div className="rounded-xl border border-border bg-surface-muted/50 p-2.5">
                      <span className="block text-[10px] text-text-muted">Orçamento</span>
                      <span className="font-mono text-xs font-semibold">Link / PIX</span>
                    </div>
                    <div className="rounded-xl border border-border bg-surface-muted/50 p-2.5">
                      <span className="block text-[10px] text-text-muted">Dados</span>
                      <span className="font-mono text-xs font-semibold">RLS Tenant</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Step Workflow */}
        <section id="fluxo" className="border-b border-border bg-surface/50 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                Fluxo de ponta a ponta
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Projetado para quem opera oficina, atendimento e negócio no mesmo dia
              </h2>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-4">
              <div className="al-card p-5">
                <Wrench className="h-5 w-5 text-accent" />
                <h3 className="mt-3 font-display font-semibold">1. Balcão Expresso</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                  Cadastro rápido, checklist de acessórios, fotos no S3 privado, senha do
                  aparelho criptografada e termo PDF com QR Code.
                </p>
              </div>
              <div className="al-card p-5">
                <MessageSquare className="h-5 w-5 text-accent" />
                <h3 className="mt-3 font-display font-semibold">2. WhatsApp + Portal</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                  Notificação automática a cada mudança de etapa com link do portal para o
                  cliente acompanhar e aprovar orçamentos.
                </p>
              </div>
              <div className="al-card p-5">
                <Bot className="h-5 w-5 text-accent" />
                <h3 className="mt-3 font-display font-semibold">3. IA com Handoff</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                  IA responde com base no status real e SOPs da loja. Pediu atendente ou
                  desconto? Pausa o bot e destaca no Inbox.
                </p>
              </div>
              <div className="al-card p-5">
                <BarChart3 className="h-5 w-5 text-accent" />
                <h3 className="mt-3 font-display font-semibold">4. BI & Rentabilidade</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                  Gráficos de fluxo de caixa, conversão de orçamentos, gargalos do Kanban
                  e controle de estoque/PDV integrados.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Modules Catalog */}
        <section id="modulos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                Arquitetura SaaS Plugável
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Ative apenas os módulos que a sua operação precisa
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">
                Comece enxuto apenas com Assistência Técnica & CRM e habilite Impressão 3D,
                Projetos de Software, PDV ou Fiscal quando o negócio pedir.
              </p>
            </div>
            <Boxes className="hidden h-7 w-7 text-text-muted sm:block" />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULE_CODES.map((code) => {
              const mod = MODULE_CATALOG[code];
              return (
                <div key={code} className="al-card flex flex-col justify-between p-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-text-muted">
                        {mod.code}
                      </span>
                      {mod.required && (
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                          Núcleo
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2.5 font-display text-base font-semibold">
                      {mod.name}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                      {mod.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Modular SaaS Pricing */}
        <section id="planos" className="border-y border-border bg-surface/50 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                Planos & Licenciamento
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Estrutura comercial desenhada para crescer com a oficina
              </h2>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {SAAS_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`flex flex-col justify-between rounded-2xl border p-6 ${
                    tier.highlighted
                      ? 'border-accent bg-surface shadow-lg'
                      : 'border-border bg-surface'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-bold">{tier.name}</h3>
                      {tier.highlighted && (
                        <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">{tier.audience}</p>
                    <div className="mt-5 flex items-baseline gap-1">
                      <span className="font-mono text-3xl font-bold tabular-nums">
                        {tier.price}
                      </span>
                      <span className="text-xs text-text-muted">{tier.period}</span>
                    </div>
                    <ul className="mt-5 space-y-2.5 text-xs text-text-secondary">
                      {tier.modules.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    href="/register"
                    className={`mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                      tier.highlighted
                        ? 'bg-accent text-accent-foreground hover:bg-accent-hover'
                        : 'border border-border bg-bg text-text-primary hover:bg-surface-muted'
                    }`}
                  >
                    Provisionar ambiente
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy / LGPD footer band */}
        <section id="privacidade" className="py-14">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-start gap-3.5">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-success" />
              <div>
                <h3 className="font-display font-semibold">
                  Segurança Multi-Tenant & LGPD por Arquitetura
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-text-secondary">
                  Isolamento de empresas imposto pelo PostgreSQL Row-Level Security, senhas
                  de equipamentos cifradas com AES-256-GCM sem exposição em PDFs e política{' '}
                  <code className="font-mono text-xs text-accent">strict_local</code> para
                  manter dados sensíveis fora de APIs externas por padrão.
                </p>
              </div>
            </div>
            <Link
              href="/register"
              className="shrink-0 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              Criar tenant isolado
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
