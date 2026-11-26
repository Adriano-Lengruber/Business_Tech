# 05 — Design System Unificado e UX Operacional

> **Regra de Ouro:** Landing Page, Fluxo de Login/Onboarding, ERP Operacional, Portal do Cliente e PDFs (Termos/Orçamentos) consomem os **mesmos tokens** definidos em [packages/design-system/design-tokens.json](file:///c:/dev/OS_Tech_AI/packages/design-system/design-tokens.json).

---

## 1. Direção de Arte: Minimalismo Técnico Premium

Inspirado na clareza funcional de **Linear**, **Vercel** e **Stripe**:
- **Zero ruído decorativo:** espaço em branco intencional na Landing Page; densidade organizada e escaneável no ERP.
- **Modo Claro e Escuro nativos:** técnico na bancada prefere dark mode confortável por horas; documentos impressos/PDFs usam a variante clara de alto contraste.
- **Paleta Neutra Sofisticada (Grafite/Ardósia):** evita cinzas lavados genéricos, combinada a um **Accent Azul-Cobalto/Índigo Técnico (`#2563EB` / `#3B82F6`)** e cores semânticas contidas para status de OS e alertas financeiros.

---

## 2. Tipografia e Escala

- **UI & Headings:** `Inter` ou `Geist Sans` (`font-display: swap`).
- **Dados Tabulares, Códigos de OS, Valores Financeiros & Serial Numbers:** `JetBrains Mono` ou `Geist Mono` com `font-variant-numeric: tabular-nums` (fundamental para colunas de preços e horários alinharem perfeitamente).
- **Escala Modular:**
  - `display`: `48px / 1.1` (Hero da Landing Page)
  - `h1`: `30px / 1.2` | `h2`: `24px / 1.25` | `h3`: `18px / 1.35`
  - `body`: `14px / 1.5` (ERP) e `16px / 1.6` (Landing Page)
  - `caption`: `12px / 1.4` (badges, timestamps, metadados)

---

## 3. Densidade Adaptativa por Camada

| Superfície | Densidade | Foco Principal |
|---|---|---|
| **Landing Page** | Baixa (respiro amplo) | Clareza da proposta de valor, prova visual do sistema e conversão. |
| **Auth & Onboarding** | Minimalista (1 tarefa por tela) | Zero distrações, validação instantânea, checklist visual de ativação. |
| **ERP — Balcão / OS** | Média-Alta (escaneável) | Entrada em < 60s, fotos rápidas no mobile, atalhos de teclado e status visível. |
| **ERP — Inbox WhatsApp** | Split-view 3 colunas | Lista de conversas (com badge `IA` vs `Humano`) + Chat + Painel lateral com OS/Cliente. |
| **Portal do Cliente** | Mobile-first focado | Linha do tempo visual da OS, botão claro de aprovação de orçamento e download de termo. |

---

## 4. Modo *Solo Operator* e Atalhos Globais

Quando o gestor opera sozinho no balcão, velocidade é tudo:
- **`⌘K` / `Ctrl+K` (Command Palette):** busca global instantânea (cliente, telefone, número de série, OS) + entrada direta para o **Copiloto de IA** ("Quais OS estão prontas aguardando retirada?").
- **Atalhos Diretos:** `N` (Nova OS), `C` (Novo Cliente), `V` (Nova Venda/PDV), `/` (Focar Busca).
- **"Minha Fila de Hoje" (Dashboard Inicial):** agrupa automaticamente o trabalho por prioridade real em vez de dezenas de gráficos desconectados:
  1. **Urgente / Handoff:** clientes no WhatsApp aguardando humano + OS vencendo hoje.
  2. **Próximos:** diagnósticos e reparos na fila da bancada.
  3. **Aguardando Terceiros:** aprovações de orçamento pendentes e peças em trânsito.
  4. **Financeiro & Oportunidades:** cobranças vencidas e follow-ups sugeridos pela IA.

---

## 5. Catálogo Mínimo de Componentes (`@al/design-system`)

Todos os componentes devem implementar estados `default`, `hover`, `focus-visible`, `disabled`, `loading` e `error`, com contraste mínimo WCAG AA:
- `Button` (`primary`, `secondary`, `ghost`, `destructive`), `Input`, `Textarea`, `Select`, `Combobox` (busca assíncrona de cliente/ativo), `Switch`, `Checkbox`
- `DataTable` (ordenação, paginação, skeleton loading, empty state com CTA)
- `StatusBadge` (mapeado aos estados de OS, pagamento e estado do bot `BOT_ACTIVE` / `WAITING_HUMAN` / `HUMAN_ACTIVE`)
- `Dialog`, `Drawer` (ótimo para detalhes rápidos sem sair da lista), `Toast`
- `CommandPalette` (`cmdk`), `Timeline` (unificada do cliente e da OS) e `FileDropzone` (fotos e GED)
