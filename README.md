# AL Business OS

> **Sistema Operacional de Negócio (ERP + CRM + Portal do Cliente + IA Agêntica)** — Modular, Multi-Tenant com PostgreSQL RLS e *Local-First AI*.

O **AL Business OS** nasce para eliminar trabalho administrativo, evitar perda de informações no balcão e automatizar o atendimento ao cliente com segurança jurídica e operacional. Ele foi arquitetado desde o primeiro commit para atender inicialmente uma operação **Solo Operator** (1 pessoa gerindo atendimento, bancada e financeiro) e escalar sem refatoração estrutural para múltiplas equipes, unidades ou comercialização como **plataforma SaaS modular**.

---

## Sumário

1. [Problema que o Sistema Resolve](#1-problema-que-o-sistema-resolve)
2. [Módulos da Plataforma (SaaS Entitlements)](#2-módulos-da-plataforma-saas-entitlements)
3. [Arquitetura e Stack Tecnológica](#3-arquitetura-e-stack-tecnológica)
4. [Segurança, Multi-Tenancy (RLS) e LGPD](#4-segurança-multi-tenancy-rls-e-lgpd)
5. [Inteligência Artificial Local-First e Matriz de Risco](#5-inteligência-artificial-local-first-e-matriz-de-risco)
6. [Estrutura do Monorepo](#6-estrutura-do-monorepo)
7. [Como Rodar em Ambiente Isolado (Windows / Docker)](#7-como-rodar-em-ambiente-isolado-windows--docker)
8. [Banco de Dados, Migrations e Seed](#8-banco-de-dados-migrations-e-seed)
9. [Testes e Qualidade](#9-testes-e-qualidade)
10. [Documentação Detalhada e Roadmap](#10-documentação-detalhada-e-roadmap)

---

## 1. Problema que o Sistema Resolve

Operações de assistência técnica, desenvolvimento sob demanda, impressão 3D e varejo de tecnologia costumam sofrer com ferramentas desconectadas: planilhas para estoque, papel ou CRUDs lentos para Ordem de Serviço e WhatsApp pessoal lotado de clientes perguntando *"já ficou pronto?"*.

### Fluxo Modelo: Do Balcão ao WhatsApp em Segundos
1. **Recepção Expresso no Balcão:** Busca imediata de cliente por nome, telefone ou CPF/CNPJ (ou cadastro em 3 campos). Vínculo de equipamento existente ou novo ativo com geração de **QR Code**.
2. **Entrada com Evidências:** Checklist físico, fotos tiradas direto na entrada (armazenadas em bucket privado S3-compatible) e pré-diagnóstico opcional.
3. **Notificação Instantânea:** Ao salvar a OS, um worker assíncrono (**BullMQ**) gera o **Termo de Entrada em PDF** e envia uma mensagem automática no **WhatsApp** do cliente com resumo do equipamento, protocolo e **Link Mágico** para o Portal do Cliente.
4. **Atendimento Agêntico com Handoff Humano:** Dúvidas enviadas pelo cliente no WhatsApp (texto ou áudio transcrito localmente via **Faster-Whisper**) são respondidas pela IA usando apenas ferramentas de leitura autorizadas e RAG. Caso o cliente peça desconto, fale em garantia complexa ou solicite falar com um humano, a conversa muda para `WAITING_HUMAN`, o bot silencia automaticamente e o Inbox exibe um resumo pronto para o técnico assumir.

---

## 2. Módulos da Plataforma (SaaS Entitlements)

Cada organização (`tenant`) ativa apenas os módulos necessários para o seu negócio. A UI (menus/widgets), os endpoints (`@RequireModule`) e as ferramentas expostas aos agentes de IA se adaptam dinamicamente:

| Código | Módulo | O que entrega | Status |
|---|---|---|---|
| `core` | **Núcleo CRM & Inbox** *(Obrigatório)* | Multi-tenant RLS, Auth/RBAC, Clientes PF/PJ, Timeline Unificada, Inbox Omnichannel e Portal do Cliente. | Implementado (Fase 0/1) |
| `mod-service-orders` | **Assistência Técnica & OS** | Balcão expresso, Ativos com QR Code, fotos S3, Termo PDF, Workflow de 22 status, Portal do Cliente. | MVP Implementado (Fase 1) |
| `mod-ai-agents` | **Agentes de IA & WhatsApp** | AI Gateway local-first (Ollama), WhatsApp Adapter (Evolution/Sandbox), BullMQ Debounce e Handoff Humano. | MVP Implementado (Fase 1) |
| `mod-inventory-pos` | **Estoque, Compras & PDV** | Catálogo multi-segmento, controle por lote/serial, fornecedores e frente de caixa (PDV). | Planejado (Fase 3) |
| `mod-finance-fiscal` | **Financeiro & Fiscal BR** | Contas a pagar/receber, DRE gerencial, gateway Asaas (PIX/Boleto/Cartão) e camada fiscal NF-e/NFS-e/NFC-e. | Planejado (Fase 2–3) |
| `mod-3d-print` | **Estúdio de Impressão 3D** | Biblioteca STL/3MF com preview Three.js, cálculo automático de custo (filamento + energia + máquina) e fila de impressoras. | Planejado (Fase 5) |
| `mod-projects-dev` | **Projetos & Software** | Kanban/Sprints, apontamento de horas (*timesheet*), marcos e contratos de horas mensais (*retainer*). | Planejado (Fase 5) |
| `mod-social-growth` | **Social Media & Growth IA** | Calendário editorial, geração de posts a partir de entregas reais, agendamento, métricas e conversão de comentários/DMs em Leads. | Planejado (Fase 5) |

---

## 3. Arquitetura e Stack Tecnológica

| Camada | Tecnologia | Papel |
|---|---|---|
| **Monorepo** | `Turborepo` + `pnpm@12.10.1` | Build incremental e isolamento estrito de dependências (`shamefully-hoist=false`). |
| **Frontend Unificado** | `Next.js 15 (App Router)` + `React 19` + `TypeScript` + `Tailwind CSS` | Landing Page comercial, Login/Onboarding SaaS, Painel ERP e Portal do Cliente compartilhando os mesmos tokens visuais. |
| **Backend Modular** | `NestJS 11` + `Fastify` + `Swagger/OpenAPI` + `Zod` | Monólito modular orientado a eventos com Guards de RBAC e Entitlements. |
| **Banco de Dados & RAG** | `PostgreSQL 16` + `pgvector` + `pg_trgm` + `Drizzle ORM` | Dados transacionais, busca textual tolerante a erros, vetores HNSW para RAG e RLS nativo. |
| **Filas & Eventos** | `Redis 7` + `BullMQ` | Notificações WhatsApp, debounce de mensagens, transcrição de áudio e agendamentos. |
| **Object Storage** | `RustFS` *(S3-compatible, dev)* / `Cloudflare R2` ou `S3` *(prod)* | Fotos de entrada, Termos PDF, laudos e modelos STL fora do banco, com URLs assinadas. |
| **IA & Áudio Local** | `Vercel AI SDK` + `Ollama / LM Studio` + `Faster-Whisper` | Execução local-first sem envio de dados sensíveis para fora, com fallback opcional em nuvem. |
| **WhatsApp** | Adapter `MessagingProvider` (`Evolution API` / `Meta Cloud API`) | Troca transparente de provedor entre fase de validação e escala SaaS. |

---

## 4. Segurança, Multi-Tenancy (RLS) e LGPD

- **Isolamento no Banco de Dados (Row-Level Security):** Toda tabela de negócio possui `organization_id` protegido por `FORCE ROW LEVEL SECURITY`. A função `withTenantContext(db, organizationId, fn)` em [`packages/database/src/client.ts`](packages/database/src/client.ts) executa transações sob a role não-privilegiada `al_app` com `set_config('app.current_tenant_id', ...)`.
- **RBAC Granular:** Papéis `owner`, `admin`, `technician`, `attendant` e `viewer` verificados server-side por `PermissionsGuard`.
- **Privacidade de IA (`ai_privacy_mode`):** Organizações em `strict_local` bloqueiam qualquer chamada de LLM para APIs externas no nível do `AiGateway`.
- **Auditoria Imutável (`audit_logs`):** Registra autor (`human`, `ai_agent` ou `automation`), ação, entidade e estados anterior/posterior.

---

## 5. Inteligência Artificial Local-First e Matriz de Risco

Toda ferramenta exposta à IA passa pelo `AgentToolRegistry` ([`packages/ai-core/src/tool-registry.ts`](packages/ai-core/src/tool-registry.ts)):

| Nível de Risco | Política | Exemplos |
|---|---|---|
| `READ_ONLY` | Execução automática auditada | Consultar status da OS, buscar FAQ/RAG, verificar estoque |
| `WRITE_SAFE` | Configurável / reversível | Criar rascunho de orçamento, abrir tarefa interna, escalar para humano |
| `WRITE_SENSITIVE` | Exige aprovação humana | Publicar post social, alterar prazo prometido, disparo em massa |
| `CRITICAL` | Bloqueada para execução autônoma | Estornar pagamento, aplicar desconto fora da política, emitir NF-e, excluir dados |

---

## 6. Estrutura do Monorepo

```text
/apps
  /web              → Next.js 15 (Landing Page, Auth/Onboarding, ERP Operacional, Portal do Cliente)
  /api              → NestJS 11 + Fastify (API REST/OpenAPI, Guards, Workers BullMQ, Webhooks)
/packages
  /design-system    → design-tokens.json (paleta grafite/cobalt Light & Dark, tipografia, espaçamentos)
  /shared           → Catálogo de módulos, RBAC, matriz de risco IA, status de OS e schemas Zod
  /ai-core          → AiGateway (Ollama/Fallback), AgentToolRegistry e testes de política
  /database         → Schemas Drizzle, migrations SQL versionadas, RLS wrapper e seed
/infra
  /docker           → Docker Compose com perfis (core, whatsapp, ai-local) e init SQL
/docs               → Documentação técnica completa (PRD, C4/ADRs, Dados, IA, Design System, Operação)
```

---

## 7. Como Rodar em Ambiente Isolado (Windows / Docker)

Todas as dependências Node ficam isoladas dentro do workspace (`pnpm`) e os bancos/serviços rodam em containers Docker sem conflitar com ferramentas instaladas no sistema operacional.

> **Nota no Windows PowerShell:** se a política local bloquear `pnpm.ps1`, utilize `pnpm.cmd`.

### Pré-requisitos
- **Node.js 24** (ver [`.nvmrc`](.nvmrc)) e **pnpm 10+** (`pnpm.cmd -v`)
- **Docker Desktop** ativo

### Passo a passo
```powershell
# 1. Copie as variáveis de ambiente (ajuste portas no .env se já usar Postgres/Redis locais)
Copy-Item .env.example .env

# 2. Instale as dependências isoladas do monorepo
pnpm.cmd install

# 3. Suba a infraestrutura base (PostgreSQL+pgvector, Redis, RustFS S3)
pnpm.cmd infra:up

# 3b. Opcional: subir Evolution API (WhatsApp) e/ou IA Local (Ollama + Whisper)
pnpm.cmd infra:up:whatsapp
pnpm.cmd infra:up:ai

# 4. Compile os pacotes internos, aplique migrations e popule dados iniciais
pnpm.cmd build
pnpm.cmd db:migrate
pnpm.cmd db:seed

# 5. Inicie Frontend (:3000) e API (:3001) simultaneamente
pnpm.cmd dev
```

### URLs e Credenciais de Desenvolvimento (Seed)
- **Aplicação Web / Landing:** `http://localhost:3000`
- **Login ERP:** `http://localhost:3000/login` — E-mail: `adriano@altech.local` | Senha: `Admin@12345`
- **API & Swagger OpenAPI:** `http://localhost:3001/api/v1` · `http://localhost:3001/api/docs`
- **Console S3 (RustFS):** `http://localhost:9001` (`rustfsadmin` / `change_me_s3_secret`)

---

## 8. Banco de Dados, Migrations e Seed

- **Executar migrations pendentes:** `pnpm.cmd db:migrate` (registra histórico na tabela `_al_migrations`).
- **Popular ambiente demo:** `pnpm.cmd db:seed` (cria organização *AL Tech & Soluções*, usuário *owner*, módulos ativos e registros iniciais idempotentes).

---

## 9. Testes e Qualidade

```powershell
# Verificação de tipos TypeScript em todos os pacotes e apps
pnpm.cmd typecheck

# Suíte de testes automatizados (RBAC, AI Gateway/Risk Matrix, Guards e isolamento real PostgreSQL RLS)
pnpm.cmd test
```

---

## 10. Documentação Detalhada e Roadmap

| Documento | Descrição |
|---|---|
| [01 — Visão de Produto & PRD](docs/01-visao-e-prd.md) | Personas, módulos vendáveis, fluxo balcão + WhatsApp e roadmap em 6 fases. |
| [02 — Arquitetura & ADRs](docs/02-arquitetura-e-adrs.md) | Diagramas C4, Monólito Modular, Entitlements, RLS e ADRs 001–006. |
| [03 — Engenharia & Modelo de Dados](docs/03-modelo-dados-e-engenharia-dados.md) | ERD completo, índices `GIN`/`HNSW`, *append-only ledgers* e preparação para Data Science. |
| [04 — IA Agêntica & Ciência de Dados](docs/04-ia-agentica-e-ciencia-dados.md) | Roteamento *local-first*, RAG híbrido, máquina de estados WhatsApp + Handoff e Evals. |
| [05 — Design System & UX](docs/05-design-system.md) | Tokens Light/Dark, tipografia, densidade adaptativa e modo *Solo Operator*. |
| [06 — Ambiente Isolado & Operação](docs/06-guia-ambiente-e-operacao.md) | Isolamento Windows/Docker, Git Flow, Conventional Commits e backup/LGPD. |
