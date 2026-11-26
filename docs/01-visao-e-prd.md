# 01 — Visão de Produto, PRD e Estratégia SaaS Modular

> **Produto:** AL Business OS  
> **Versão do Documento:** 1.0  
> **Escopo:** Definição funcional, personas, arquitetura de módulos vendáveis e requisitos de aceite.

---

## 1. Tese do Produto

Pequenas e médias operações de tecnologia no Brasil sofrem com ferramentas fragmentadas: usam um sistema engessado para Ordem de Serviço, planilhas para controle de filamento/projetos, WhatsApp pessoal desorganizado para atendimento e nenhuma inteligência sobre margem real ou recompra.

O **AL Business OS** resolve isso unificando **CRM + Operação + Comunicação Agêntica + Financeiro** em uma plataforma com duas características raras no mercado:
1. **IA Local-First e Acionável:** o sistema não apenas "tem um chat de IA", ele executa triagem, transcreve áudios de clientes no WhatsApp, consulta status reais no banco, gera termos e resumos, e sabe a hora exata de passar a bola para um humano.
2. **Modularidade Comercial (SaaS Entitlements):** cada empresa ativa e paga apenas pelos módulos que fazem sentido para sua operação, mantendo uma única base de código e uma timeline unificada do cliente.

---

## 2. Personas

| Persona | Contexto | Dor Principal | O que o AL Business OS entrega |
|---|---|---|---|
| **Gestor / Solo Operator** | Dono que acumula atendimento, bancada, compras e financeiro. | Perder tempo repetindo status no WhatsApp, esquecer cobranças e não saber o lucro real. | Modo *Minha Fila de Hoje*, entrada de OS em < 60s, briefing diário e automação de cobrança/follow-up. |
| **Técnico / Especialista** | Executa diagnósticos, reparos ou impressões 3D. | Falta de histórico do equipamento, sintomas mal anotados no balcão e retrabalho. | Checklist guiado, histórico completo por QR Code do ativo, fotos de entrada e copiloto diagnóstico via RAG. |
| **Atendente / Comercial** | Recebe leads, faz intake no balcão e acompanha aprovações. | Múltiplas abas abertas e clientes cobrando retorno. | Inbox omnichannel unificada com resumo automático gerado pela IA quando há escalonamento humano. |
| **Cliente Final** | Pessoa física ou empresa que deixou um dispositivo ou contratou um serviço. | Ansiedade por falta de notícias e orçamentos confusos. | Confirmação imediata no WhatsApp, link mágico do Portal do Cliente com timeline clara e aprovação digital. |

---

## 3. Catálogo de Módulos Vendáveis (Platform Entitlements)

A plataforma é dividida entre o **Núcleo Obrigatório** e **Módulos Plugáveis** controlados por organização (`tenant_modules`):

| Código do Módulo | Nome Comercial | Capacidades Incluídas | Público-Alvo Ideal |
|---|---|---|---|
| `core` *(Obrigatório)* | **Núcleo CRM & Inbox** | Multi-tenant, Auth/RBAC, Cadastro de Clientes PF/PJ, Timeline Unificada, Leads, Agenda, Notificações, Auditoria e Portal do Cliente. | Todas as contas. |
| `mod-service-orders` | **Assistência Técnica & OS** | Ativos com QR Code, Intake rápido com fotos, Workflow de 22 status configuráveis, Diagnóstico técnico, Orçamentos (Econômico/Recomendado/Premium), Termos PDF e Garantia/RMA. | Lojas e laboratórios de manutenção. |
| `mod-ai-agents` | **Agentes de IA & WhatsApp** | AI Gateway (Ollama/Nuvem), Agente de Atendimento WhatsApp 24/7 com transcrição de áudio, Handoff humano, Copiloto `⌘K`, RAG de manuais e Briefing Diário. | Operações que querem automatizar triagem e suporte. |
| `mod-inventory-pos` | **Estoque, Compras & PDV** | Catálogo genérico multi-segmento, controle por lote/serial, estoque mínimo, fornecedores, pedidos de compra e PDV com leitor de código de barras. | Assistências que vendem peças/periféricos e varejo. |
| `mod-finance-fiscal` | **Financeiro & Fiscal BR** | Contas a pagar/receber, fluxo de caixa, DRE gerencial, margem por OS/produto, gateway Asaas (PIX/Boleto/Cartão) e camada fiscal (NF-e/NFC-e/NFS-e). | Negócios buscando gestão financeira e fiscal integrada. |
| `mod-3d-print` | **Estúdio de Impressão 3D** | Biblioteca de modelos STL/3MF com preview Three.js, controle de filamentos/resinas, calculadora automática de custo (material + energia + máquina + falha) e fila de impressoras. | Makers, estúdios 3D e prototipagem. |
| `mod-projects-dev` | **Projetos & Software** | Escopo, sprints/Kanban, apontamento de horas (timesheet), marcos de entrega, contratos de horas mensais (*retainer*) e rentabilidade por projeto. | Consultorias, devs e integradores de automação. |
| `mod-social-growth` | **Social Media & Growth IA** | Calendário editorial, geração de pautas/legendas a partir de casos reais do ERP, aprovação humana, agendamento de postagens, métricas e conversão de comentários/DMs em Leads. | Empresas que querem transformar produção em marketing recorrente. |

---

## 4. Fluxos Críticos do MVP (Fatia Vertical Prioritária)

### 4.1 Fluxo de Balcão → WhatsApp Agêntico → Handoff Humano

1. **Recepção no Balcão (`< 60 segundos`):**
   - Atendente busca cliente por telefone, CPF/CNPJ ou nome. Se novo, cria cadastro expresso (Nome + WhatsApp obrigatórios; demais campos opcionais).
   - Seleciona equipamento já cadastrado (exibindo histórico anterior) ou cadastra novo ativo gerando código interno/QR Code.
   - Registra sintomas relatados, checklist rápido de estado físico, fotos tiradas do celular/webcam e pré-diagnóstico opcional.
   - Ao salvar a OS (`status = RECEIVED`), dispara o evento de domínio `repair.received`.
2. **Notificação Automática Imediata:**
   - Worker assíncrono gera o **Termo de Entrada em PDF** (com fotos e regras de garantia/backup) e cria um token de acesso seguro (Link Mágico) para o **Portal do Cliente**.
   - Adapter WhatsApp envia mensagem estruturada com: número da OS, resumo do equipamento/sintomas, link de acompanhamento em tempo real e instrução de que dúvidas simples podem ser respondidas ali mesmo.
3. **Atendimento Contínuo por IA no WhatsApp:**
   - Quando o cliente envia texto ou áudio no WhatsApp, o áudio é transcrito localmente (Whisper) e mensagens enviadas em rajada sofrem *debounce* (4 segundos).
   - O **Agente de Atendimento** verifica se a conversa está no estado `BOT_ACTIVE` e responde exclusivamente com base em **Tools de leitura autorizadas** (status real da OS, prazo registrado, orçamento enviado) e **RAG da loja** (endereço, horário, políticas de garantia).
   - **Proibição estrita:** o agente nunca inventa diagnóstico técnico não validado, prazo não cadastrado ou desconto.
4. **Escalonamento para Humano (Handoff):**
   - Acionado automaticamente se: (a) cliente pedir falar com pessoa/técnico, (b) tema envolver negociação, reclamação, RMA ou dúvida técnica complexa, ou (c) confiança da resposta for baixa.
   - A conversa muda para `WAITING_HUMAN`, o bot é silenciado, a IA gera um **resumo de 3 linhas** com contexto da OS para o atendente e o alerta aparece no Inbox do ERP.
   - Ao atendente responder no Inbox (`HUMAN_ACTIVE`), o bot permanece pausado até encerramento ou devolução manual.

---

## 5. Roadmap em Fatias Verticais

| Fase | Entrega Principal | Critério de Sucesso |
|---|---|---|
| **Fase 0 — Fundação** | Monorepo, Docker isolado, PostgreSQL + RLS, Auth/RBAC, Entitlements, Design System e Event Bus. | Ambiente sobe com 1 comando; testes de isolamento multi-tenant passam. |
| **Fase 1 — Core Balcão + WhatsApp IA** | Clientes, Ativos + QR, OS (Intake + Fotos + PDF), Portal do Cliente, Evolution API + Inbox + Agente de Dúvidas + Handoff. | Operação real no balcão funcionando ponta a ponta com clientes reais. |
| **Fase 2 — Diagnóstico, Orçamento & Financeiro** | Diagnóstico estruturado, Orçamento 3 opções com aceite digital, Contas a pagar/receber e Asaas (PIX/Boleto). | Cliente aprova orçamento e paga via PIX direto pelo Portal/WhatsApp. |
| **Fase 3 — Estoque, PDV & Fiscal** | Estoque serializado, Compras, PDV balcão e camada fiscal desacoplada (NF-e/NFS-e/NFC-e). | Venda de peças/produtos e baixa automática na OS sem divergência de caixa. |
| **Fase 4 — Landing Page & Billing SaaS** | Site comercial de conversão, Onboarding guiado e gestão de planos/assinaturas por módulo. | Novos tenants conseguem assinar, escolher módulos e operar sozinhos. |
| **Fase 5 — Módulos Especializados** | Impressão 3D (`mod-3d-print`), Projetos/Software (`mod-projects-dev`) e Social Media (`mod-social-growth`). | Cada módulo opera plugado ao CRM e financeiro sem acoplamento no core. |
| **Fase 6 — Inteligência & Marketplaces** | Previsão de demanda de peças, churn score, Briefing Executivo avançado e integração Mercado Livre/Shopee. | Modelos analíticos rodando sobre o histórico consolidado do ERP. |

---

## 6. Critérios Globais de Aceitação (Definition of Done)

Nenhuma funcionalidade é considerada concluída sem atender:
1. Schema Zod compartilhado e validação *server-side*.
2. Isolamento multi-tenant (`tenant_id` + política RLS) e verificação de RBAC + Módulo Ativo (`@RequireModule`).
3. Registro de trilha de auditoria (autor humano, automação ou agente IA).
4. Estados de interface completos (loading, empty state útil, erro tratado pelo Design System, responsivo mobile-first).
5. Testes automatizados para regras críticas (transições de OS, cálculos financeiros/estoque, idempotência de webhooks e tools de IA).
