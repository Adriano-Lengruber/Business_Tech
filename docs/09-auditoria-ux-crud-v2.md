# Auditoria Completa de Consistência Funcional, CRUD & UX — AL Business OS (v2)

Data: 2026-11-26 | Escopo: Auditoria tela a tela de todas as rotas `/app/*`, APIs `@al/api` e modelo de dados `@al/database`

## 1. Diagnóstico Crítico Inicial (Reportado & Confirmado no Código)

### 1.1 Cadastro de Produto, Estoque & Fornecedores (`/app/inventory`)
- **Problema encontrado:**
  1. Formulário de criação de produto reduzido a uma linha rasa (`SKU`, `Nome`, `Categoria`, `Custo`, `Preço`, `Qtd`) sem **descrição técnica**, **foto do produto (S3)**, **tabelas de preço (Balcão/Varejo, Atacado/B2B, Cliente VIP Loja)**, **preço mínimo / margem calculada**, **garantia padrão** ou **vinculação de fornecedores**.
  2. **Zero UI de CRUD de Fornecedores:** a tabela `suppliers` e a rota `POST /inventory/suppliers` existiam no backend, mas `/app/inventory` não tinha nenhuma aba/modal para cadastrar, editar ou excluir fornecedores (apenas listava os do seed em um `<select>` de Pedido de Compra).
  3. **Zero Edição/Exclusão/Histórico por Produto:** faltavam `PATCH /inventory/products/:id`, `DELETE /inventory/products/:id` (soft-disable), upload de imagem `POST /inventory/products/:id/image`, e consulta de histórico de movimentações (`GET /inventory/products/:id/movements`).
  4. **Comparação B2B x Marketplace PF desconectada do catálogo:** cotações precisam vincular o produto opcionalmente e mostrar links/fornecedores salvos.

### 1.2 Despesas do Financeiro vs. Gráfico "Fluxo Financeiro" no Dashboard (`/app` ↔ `/app/finance`)
- **Causa Raiz Exata Identificada:**
  1. `FinanceService.createTransaction` (`apps/api/src/finance/finance.service.ts`) grava todo lançamento novo (incluindo despesas `payable`) com `status: 'PENDING'` e `dueDate = +3 dias`, sem opção no formulário para informar data de vencimento/pagamento, método de pagamento ou "Já pago à vista".
  2. `FinanceService.getSummary` soma **todas** as despesas (`PENDING` + `CONFIRMED`) no card `Despesas / Contas a Pagar` de `/app/finance`.
  3. Em contrapartida, `AnalyticsService.getOverview` (`apps/api/src/analytics/analytics.service.ts`) filtrava o gráfico `Fluxo Financeiro (7 dias)` estritamente para `row.status === 'CONFIRMED' || row.status === 'PAID'`. Consequentemente, despesas recém-lançadas como `PENDING` no Financeiro **desapareciam** do gráfico do Dashboard!
- **Solução Definitiva:**
  - `AnalyticsService.getOverview` passa a aceitar janela configurável (`7d` ou `30d`) e contabilizar **Entradas Realizadas**, **Saídas Pagas**, **A Receber Pendente** e **Despesas Pendentes/Agendadas** no `dailyCashflow` + `revenueSummary`, garantindo paridade matemática visível entre `/app/finance` e `/app`.
  - No formulário de `/app/finance`: seletor de `status` inicial ("Pago / Confirmado agora" vs "A Pagar / Pendente"), seletor de `paymentMethod` (`pix`, `credit_card`, `debit_card`, `cash`, `boleto`, `bank_transfer`), data de vencimento/pagamento (`dueDate`), filtros por tipo/status/busca, edição/cancelamento (`PATCH`/`DELETE`), botão explícito **"Dar Baixa / Pagar"** e painel **DRE Simplificado (Receita Bruta - Despesas - Custo Estoque)**.

## 2. Varredura Sistemática das Demais Telas (`/app/*`)

| Tela / Módulo | Status Antes da Auditoria | Lacunas Críticas Encontradas | Ação Planejada (Fase 12) |
|---|---|---|---|
| **Dashboard (`/app`)** | Bom visual + Briefing rápido | Gráfico de Fluxo Financeiro omitia despesas `PENDING`; sem toggle 7d/30d nem breakdown Confirmado vs Previsto | Sincronizar série pendente + confirmada no `CashflowBarChart` + toggle 7d/30d |
| **Estoque & Fornecedores (`/app/inventory`)** | Formulário mínimo de 1 linha; sem foto; sem edição; sem CRUD fornecedores | Falta descrição, foto S3, preços Varejo/Atacado/VIP, vínculo de fornecedor, CRUD Fornecedores, edição produto e histórico Kardex | Rebuild completo em 4 abas: Catálogo Rico + Upload Foto S3, Fornecedores CRUD, Pedidos de Compra, Cotação B2B x PF |
| **Financeiro (`/app/finance`)** | Formulário raso (sem data/método/status), sem filtros/busca/cancelamento | Despesas ficam invisíveis no dashboard; sem baixa rápida de despesas; sem edição/cancelamento | Rebuild completo com filtros, baixa rápida, já-pago toggle, método, vencimento e DRE |
| **Clientes 360° & Catálogo (`/app/customers`)** | Boa Timeline 360°, criação PF/PJ e catálogo | Faltam edição (`PATCH /customers/:id`), inativação segura, e edição/exclusão de itens do catálogo de serviços | Adicionar `PATCH/DELETE` de Cliente e Serviço Padronizado com UI inline |
| **PDV / Balcão (`/app/pos`)** | Carrinho funcional, baixa de estoque e emissão NFC-e | Sem seleção de cliente na venda, sem escolha de tabela de preço (Varejo vs Atacado vs VIP), sem detalhamento de itens das vendas recentes | Enriquecer com seletor de Cliente opcional, seletor de tabela de preço e visualização rápida de itens |
| **Impressão 3D (`/app/print3d`)** | Preview STL + Orçamento + Fila 3D | Não mostra resumo financeiro/material total nem permite cancelar/remover job erroneamente lançado | Adicionar ação de cancelar/excluir job e resumo de gramas/filamento |
| **Projetos & Dev (`/app/projects`)** | Kanban funcional + Retainer | Sem edição rápida de horas contratadas / exclusão de tarefa | Adicionar exclusão/edição simples de tarefa e feedback visual |
| **Social Growth (`/app/social`)** | Geração IA + Publicação + Lead | Sem exclusão/edição de rascunho gerado antes de publicar | Adicionar edição/exclusão de rascunho de post |
| **Contratos (`/app/contracts`)** | Bom (MRR, horas, preventiva) | Falta inativar/pausar contrato e registrar consumo rápido de horas | Garantir estado limpo + testes automatizados |
| **Automações (`/app/automations`)** | Bom (Regras, trigger, run-due) | Falta excluir regra criada por engano | Adicionar `DELETE /automations/rules/:id` + UI |
| **Ordens de Serviço (`/app/os/new`, `/app/os/[id]`)** | Muito completo (Diagnóstico, Orcamento Tier, PIN cifrado, Hardware Diff, Garantia, Timers, Assinatura, Checklist) | Cobertura de testes de interface ainda manual | Cobrir ponta a ponta com Playwright E2E |
| **Fiscal (`/app/fiscal`)** | Parametrização tributária + Diagnóstico IA | Falta explicação didática de regimes (MEI vs Simples Nacional) | Melhorar microcopy explicativo sem quebrar API |

## 3. Estratégia de Dados & Testes Automatizados (Zero Dependência Manual)
- **Seed Rico (`packages/database/src/seed.ts`):** popular múltiplos clientes PF/PJ, 5+ fornecedores reais alinhados ao guia MEI, 8+ produtos completos com descrição, NCM e fornecedor preferencial, movimentações financeiras de entradas e saídas distribuídas nos últimos 7 dias (confirmadas E pendentes), contratos, OS em diversos estágios, projetos e jobs 3D.
- **Testes API + Banco (`vitest` / `tsx --test`):** validar cálculos de fluxo de caixa consolidado (confirmado + pendente), CRUD completo de produto + fornecedor + estoque + finanças + cliente.
- **Testes Browser E2E (`Playwright`):** rodar navegador headless real simulando o usuário: Login -> Criar Fornecedor -> Criar Produto completo com tabela VIP & fornecedor -> Lançar Despesa no Financeiro -> Validar que o gráfico Fluxo Financeiro no `/app` reflete o valor -> Navegar nas abas críticas sem erros de console/HTTP 500.
