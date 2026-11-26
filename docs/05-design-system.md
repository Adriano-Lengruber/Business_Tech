# 05 — Design System Unificado ("Atelier Precision") e UX Operacional

> **Regra de Ouro:** Landing Page, Auth, ERP Operacional, Gráficos BI, Portal do Cliente e PDFs consomem os mesmos tokens em [packages/design-system/design-tokens.json](file:///c:/dev/OS_Tech_AI/packages/design-system/design-tokens.json).

---

## 1. Direção de Arte: Atelier Obsidian & Mineral Paper

Afastamento deliberado de templates genéricos em ardósia + azul-padrão:
- **Identidade cromática autoral:**
  - **Modo Escuro (`Atelier Obsidian`):** fundo `#09090B`, superfícies `#111114` com divisórias sutis `#25252B` e acento técnico em **Verde-Esmeralda/Teal (`#14B8A6`)** + **Cobre/Âmbar (`#F59E0B`)** para alertas operacionais.
  - **Modo Claro (`Mineral Paper`):** papel mineral quente `#F7F6F2`, cartões brancos `#FFFFFF`, bordas `#E5E3DC` e acento `#0D9488`.
- **Tipografia com contraste técnico:**
  - **Títulos / Display:** `Plus Jakarta Sans` (`-0.02em` tracking)
  - **Interface / Leitura:** `Inter`
  - **Protocolos, R$, Latência, Códigos e Serial:** `JetBrains Mono` com `font-variant-numeric: tabular-nums`.

---

## 2. Visualização de Dados (BI Nativo) & Velocidade Percebida

- **Briefing Executivo Instantâneo (< 100ms):** cálculo determinístico imediato no backend com cache e enriquecimento assíncrono opcional via Ollama local, eliminando bloqueios de 6 segundos no carregamento do `/app`.
- **Gráficos Integrados no Dashboard:**
  1. `CashflowBarChart`: entradas vs. saídas nos últimos 7 dias com tooltip interativo em `R$`.
  2. `PipelineHorizontalChart`: distribuição real das Ordens de Serviço por etapa operacional e identificação imediata de gargalos.
  3. `ConversionRingChart`: funil de aprovação de orçamentos (aprovados, pendentes, reprovados).
- **Alternância Lista / Kanban no Pipeline de OS:** técnicos e gestores podem alternar instantaneamente entre fila tabular densa e quadro Kanban por etapa com atualização rápida de status.

---

## 3. Privacidade & Segurança de Bancada (LGPD)

- Campo **Senha / PIN de Desbloqueio do Equipamento** criptografado com **AES-256-GCM** (`device_password_encrypted`), nunca retornado em listagens, **nunca impresso no PDF de recebimento**, oculto no Portal do Cliente e auditado em `audit_logs` a cada revelação na bancada.
