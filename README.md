# AL Business OS

> **Sistema Operacional de Negócio (ERP + CRM + Portal + IA Agêntica)** — Modular, *Local-First AI* e Multi-Tenant.

Projetado para eliminar trabalho administrativo e escalar da operação **Solo Operator** (1 pessoa no balcão) até múltiplas unidades ou comercialização como **plataforma SaaS modular** nos segmentos de:

- **Assistência Técnica de Informática** (notebooks, desktops, servidores, periféricos)
- **Desenvolvimento de Software & Consultoria Técnica**
- **Impressão 3D sob demanda** (catálogo STL/3MF, custo máquina/filamento, fila)
- **Varejo & PDV Multi-segmento**
- **Crescimento & Social Media Automatizado**

---

## Princípios Arquiteturais

1. **Local-First & Hybrid AI:** Prioridade absoluta para modelos locais (**Ollama / LM Studio** + **Faster-Whisper** para áudio), garantindo privacidade, conformidade LGPD e zero custo variável por token em tarefas operacionais, com *fallback* opcional para APIs em nuvem.
2. **Human-in-the-Loop (Matriz de Risco):** A IA classifica, resume, responde dúvidas com *grounding* em dados reais e prepara rascunhos. Ações financeiras, fiscais, descontos fora de política ou exclusões exigem confirmação humana.
3. **SaaS Modular por Entitlements:** O núcleo (`@al/core`) é obrigatório; os demais domínios são módulos plugáveis e vendáveis separadamente por organização (`tenant_modules`).
4. **Multi-Tenancy Real:** Isolamento de dados garantido no nível do PostgreSQL via **Row-Level Security (RLS)**.
5. **Ambiente 100% Isolado:** Dependências gerenciadas estritamente no workspace via `pnpm` e serviços auxiliares (PostgreSQL + `pgvector`, Redis, MinIO, Evolution API, Ollama, Whisper) encapsulados em Docker Compose.

---

## Estrutura do Monorepo

```text
/apps
  /web              → Next.js (Landing Page, Auth/Onboarding, ERP Operacional, Portal do Cliente)
  /api              → NestJS + Fastify (API REST/OpenAPI, Webhooks, Event Bus, BullMQ Workers)
/packages
  /design-system    → Tokens visuais (design-tokens.json), tema claro/escuro e componentes UI
  /shared           → Schemas Zod, catálogo de módulos, matriz de risco IA e tipos compartilhados
  /ai-core          → AI Gateway (Ollama/LM Studio/Cloud), Tool Registry, RAG e Evals
  /database         → Schemas Drizzle ORM, migrations versionadas, políticas RLS e seeds
/infra
  /docker           → Docker Compose com profiles (core, whatsapp, ai-local)
/docs               → Documentação técnica, PRD, ADRs, ERD, IA/Ciência de Dados e Design System
```

---

## Mapa da Documentação (`/docs`)

| Documento | Conteúdo |
|---|---|
| [01 — Visão de Produto & PRD](docs/01-visao-e-prd.md) | Personas, módulos vendáveis, requisitos funcionais e fluxo de balcão + WhatsApp. |
| [02 — Arquitetura & ADRs](docs/02-arquitetura-e-adrs.md) | Diagramas C4, Monólito Modular, Event Bus, RLS e decisões arquiteturais (ADRs). |
| [03 — Engenharia & Modelo de Dados](docs/03-modelo-dados-e-engenharia-dados.md) | ERD completo, índices, `pgvector`, pipeline analítico e modelagem para Data Science. |
| [04 — IA Agêntica & Ciência de Dados](docs/04-ia-agentica-e-ciencia-dados.md) | AI Gateway local-first, RAG, Tools, Matriz de Risco, Handoff WhatsApp e Evals. |
| [05 — Design System & UX](docs/05-design-system.md) | Tokens Light/Dark, tipografia, densidade por tela, componentes e modo Solo Operator. |
| [06 — Ambiente Isolado & Operação](docs/06-guia-ambiente-e-operacao.md) | Setup no Windows/Docker, Git Flow, Conventional Commits, segurança e backups. |

---

## Início Rápido (Ambiente Isolado)

> Consulte o passo a passo completo em [docs/06-guia-ambiente-e-operacao.md](docs/06-guia-ambiente-e-operacao.md).

```powershell
# 1. Copiar variáveis de ambiente (nunca commitar o arquivo .env)
Copy-Item .env.example .env

# 2. Subir infraestrutura base (PostgreSQL+pgvector, Redis, MinIO)
pnpm.cmd infra:up

# 3. Opcional: subir WhatsApp (Evolution API) e/ou IA Local (Ollama + Whisper)
pnpm.cmd infra:up:whatsapp
pnpm.cmd infra:up:ai
```
