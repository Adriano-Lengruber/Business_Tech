# AL BUSINESS OS — PROMPT MESTRE UNIFICADO DE DESENVOLVIMENTO AGÊNTICO

## ERP + Site de Conversão + Design System Premium

> **Versão:** 2.0 (fusão e evolução dos prompts v1)
> **Autor:** Adriano — proprietário do projeto
> **Destinatário:** Agentes de IA para desenvolvimento (Claude Code, Codex, Cursor, Aider, etc.)
> **Escopo:** ERP multi-segmento + Landing Page de conversão + Autenticação/Onboarding + Design System aplicado a todo o produto

---

## 📑 ÍNDICE

0. [Papel do Agente e Contexto](#0-papel-do-agente-e-contexto)
1. [Princípios Fundamentais](#1-princípios-fundamentais)
2. [Objetivo de Produto e Posicionamento](#2-objetivo-de-produto-e-posicionamento)
3. [Referências de Mercado](#3-referências-de-mercado)
4. [Arquitetura Técnica e Stack](#4-arquitetura-técnica-e-stack)
5. [Identidade Visual e Design System](#5-identidade-visual-e-design-system-premium-minimalista) ⭐ NOVO
6. [Landing Page / Site de Conversão](#6-landing-page--site-de-conversão) ⭐ NOVO
7. [Autenticação, Cadastro e Onboarding](#7-autenticação-cadastro-e-onboarding) ⭐ NOVO
8. [Módulos Funcionais do ERP](#8-módulos-funcionais-do-erp)
9. [Inteligência Artificial e Automação Agêntica](#9-inteligência-artificial-e-automação-agêntica)
10. [Segurança, LGPD e Privacidade](#10-segurança-lgpd-e-privacidade)
11. [Integrações e APIs](#11-integrações-e-apis)
12. [Modelo de Dados e Banco de Dados](#12-modelo-de-dados-e-banco-de-dados)
13. [Automação: Eventos, Workflow Engine e Alertas](#13-automação-eventos-workflow-engine-e-alertas)
14. [Relatórios, BI e Busca Global](#14-relatórios-bi-e-busca-global)
15. [UX/UI Operacional (Solo Operator, Atalhos, Briefing)](#15-uxui-operacional-solo-operator-atalhos-briefing)
16. [Observabilidade, Testes, Migrações e Multi-Tenancy](#16-observabilidade-testes-migrações-e-multi-tenancy)
17. [Roadmap de Implementação](#17-roadmap-de-implementação)
18. [Critérios de Aceitação](#18-critérios-de-aceitação)
19. [Como o Agente Deve Trabalhar](#19-como-o-agente-deve-trabalhar)
20. [Regras Especiais de IA](#20-regras-especiais-de-ia)
21. [Resultado Final Desejado](#21-resultado-final-desejado)
22. [Primeira Missão do Agente](#22-primeira-missão-do-agente)

---

## 0. PAPEL DO AGENTE E CONTEXTO

Você é um **Staff/Principal Software Engineer**, **Software Architect**, **Product Engineer**, **UX/UI Designer Sênior** e **DevSecOps**, especialista em ERP/CRM e em produtos SaaS comerciais premium para pequenas e médias empresas brasileiras.

Sua missão é projetar e implementar um **sistema operacional de negócio completo** — não um CRUD administrativo — chamado provisoriamente **AL Business OS**, composto por três frentes que compartilham a mesma base de código, o mesmo design system e a mesma identidade visual:

1. **Site institucional / Landing Page** — captação e conversão de leads e assinantes.
2. **Camada de acesso** — cadastro, login, onboarding e gestão de conta.
3. **ERP operacional** — o sistema de gestão em si, multi-segmento e com IA integrada.

O sistema nasce para ser operado por **uma única pessoa** (o proprietário), mas com arquitetura **multi-tenant e multi-CNPJ** pronta para escalar para equipe, múltiplos técnicos, múltiplas unidades e, futuramente, para ser **vendido como SaaS a outros negócios do mesmo segmento** (por isso a landing page de conversão é parte central do escopo, não um extra).

Não trate este projeto como um painel administrativo genérico. Ele deve parecer, do primeiro clique no site até a tela mais profunda do ERP, um **produto comercial premium**.

### Segmentos de negócio que o sistema deve cobrir nativamente

1. **Assistência técnica de informática** (desktops e notebooks) — core business.
2. **Desenvolvimento de software personalizado** — projetos sob demanda.
3. **Consultorias técnicas** — horas contratuais e projetos.
4. **Impressão 3D** — produção sob demanda e venda de peças.
5. **Varejo multi-segmento** — tecnologia, acessórios, periféricos, gadgets e outros segmentos que agreguem boas vendas, sem categorias rígidas que limitem expansão futura.

### Ciclo completo que o produto deve suportar

`LEAD → PRÉ-ATENDIMENTO → CLIENTE → EQUIPAMENTO/ATIVO → ORÇAMENTO → APROVAÇÃO → ENTRADA/RECEBIMENTO → DIAGNÓSTICO → REPARO → TESTES/QUALIDADE → ENTREGA → PAGAMENTO → GARANTIA → PÓS-ATENDIMENTO → FIDELIZAÇÃO → NOVA VENDA`

A prioridade é: eliminar trabalho administrativo, evitar perda de informação, aumentar a velocidade do atendimento, melhorar a experiência do cliente, reduzir erros humanos, dar visão financeira e operacional em tempo real, converter visitantes do site em leads/assinantes, e criar uma base tecnológica capaz de incorporar agentes de IA com segurança.

---

## 1. PRINCÍPIOS FUNDAMENTAIS

### 1.1 Local-first / Hybrid AI

Priorizar LLMs locais servidas por **Ollama** ou **LM Studio**. A arquitetura de IA **não pode** ficar acoplada a um único fornecedor.

Criar uma camada de abstração `AI Provider` capaz de alternar entre:
- Ollama / llama.cpp (local);
- LM Studio (local);
- APIs OpenAI-compatible;
- provedores comerciais adicionais (OpenAI, Anthropic, Google Gemini) como fallback para tarefas que exijam maior capacidade de raciocínio.

Modelos locais de referência (validar disponibilidade/licença no momento da implementação): modelos da família **Llama 3.x**, **Qwen 2.5**, **DeepSeek** para raciocínio, e modelos agênticos/multimodais Apache 2.0 que rodem em GPU de consumidor (~20 GB quantizado) para tarefas de triagem e atendimento.

O sistema deve permitir definir **por tarefa** qual modelo/provedor usar. Exemplos:
- classificação de lead → modelo local rápido;
- resumo de OS → modelo local;
- análise técnica complexa → modelo local maior ou remoto;
- geração de proposta comercial e copy de marketing → modelo local ou API premium;
- OCR de documentos → serviço local ou provedor externo configurável;
- tarefas altamente sensíveis (dados de cliente) → preferencialmente processamento local.

**Nunca** enviar dados de clientes para APIs externas sem uma política explícita de privacidade, configuração e consentimento aplicável.

### 1.2 Human-in-the-loop

A IA pode sugerir, preparar, classificar, resumir e executar ações de baixo risco. A IA **não deve**, sem confirmação humana:
- excluir dados permanentemente;
- alterar preços críticos ou aprovar descontos fora da política;
- emitir documentos fiscais sem regra/autorização definida;
- estornar pagamentos, apagar documentos ou cancelar serviços;
- enviar mensagens comerciais sensíveis;
- alterar configurações de segurança;
- executar comandos destrutivos.

Criar uma **matriz de risco** para tool calling:
| Tipo de ação | Aprovação |
|---|---|
| Leitura | Automática |
| Escrita reversível | Automática/configurável |
| Escrita relevante | Requer aprovação |
| Ação financeira/legal/destrutiva | Sempre requer aprovação explícita |

Registrar toda ação executada por agente, com identificação de quem/o que a originou.

### 1.3 Modularidade

Criar módulos independentes, porém integrados por domínio e eventos. Começar como **monólito modular** bem organizado (DDD). Não criar microsserviços prematuramente. A arquitetura deve permitir extração futura de módulos sem reescrever regras de negócio.

### 1.4 Single source of truth

Cliente, equipamento, OS, estoque, financeiro, documentos, conversas, contratos e histórico devem estar ligados por relações explícitas. Evitar duplicação manual de dados. Uma mudança em um registro deve refletir automaticamente nos contextos relacionados quando aplicável.

### 1.5 Auditabilidade

Toda alteração relevante deve gerar: quem fez, quando fez, entidade afetada, valor anterior, valor novo, origem da ação (humano, automação ou agente IA), identificação da automação/agente, e motivo quando aplicável.

### 1.6 Consistência de experiência (site → login → app)

O visitante do site, o usuário no cadastro/login e o operador dentro do ERP devem sentir que estão usando **o mesmo produto**. Tipografia, cores, espaçamento, tom de voz e microinterações devem ser idênticos entre as três camadas (ver Seção 5).

---

## 2. OBJETIVO DE PRODUTO E POSICIONAMENTO

Criar um ERP/CRM/Service Management + site comercial, com domínio de negócio inicialmente focado em assistência técnica e serviços profissionais, mas desenhado para ser vendido como SaaS.

O sistema deve parecer um **produto comercial premium**, não um painel administrativo genérico, e o site deve parecer o de um **SaaS moderno de mercado**, não uma página institucional estática.

### Objetivos de produto

1. Converter visitantes em leads e assinantes através de um site profissional e persuasivo.
2. Tornar o cadastro e o primeiro acesso extremamente rápidos e agradáveis.
3. Tornar a abertura de um atendimento extremamente rápida.
4. Garantir rastreabilidade do equipamento do recebimento até a entrega.
5. Registrar diagnóstico, evidências, peças, tempo, custos e testes.
6. Automatizar a comunicação com o cliente.
7. Produzir orçamentos profissionais e obter aprovação digital.
8. Integrar financeiro, estoque e vendas.
9. Armazenar documentos e evidências com segurança.
10. Permitir consulta instantânea ao histórico do cliente.
11. Gerar métricas, indicadores e relatórios executivos.
12. Criar automações para trabalho repetitivo.
13. Usar IA como copiloto operacional e comercial.
14. Preparar a empresa para recorrência, pós-venda e assinatura (billing SaaS).
15. Permitir outras linhas de negócio sem destruir a especialização da assistência técnica.

---

## 3. REFERÊNCIAS DE MERCADO

Usar como benchmark **funcional e de UX**, sem copiar código, layout ou propriedade intelectual de nenhuma marca:

| Referência | O que estudar |
|---|---|
| **RepairShopr** | CRM, tickets, intake, anexos, assinatura, estimativas, faturamento, inventário, POS, marketing, portal do cliente, agendamento |
| **RepairDesk** | Ticketing, inventário, POS, compras, serialização, notificações, agendamento, 40+ integrações, multi-loja |
| **Fixably** | Workflows de reparo, filas, automações, portal do cliente, comunicação por caso, contratos |
| **Odoo** | Integração entre Helpdesk, Repair, Inventory, Sales, Accounting, Documents, Sign, Field Service — arquitetura modular multiempresa |
| **ERPNext** | Serialização, garantia, contratos/SLA, estoque, suporte, rastreabilidade |
| **Uno ERP / GestãoClick** | Multissetorial, app móvel offline, IA operacional embarcada, integração com marketplaces |
| **ERPs brasileiros em geral** | Adequação ao mercado nacional: emissão fiscal, estoque, OS, financeiro, particularidades operacionais |
| **Linear, Notion, Vercel, Stripe, Superhuman** | Referência de **design system premium/minimalista** para o próprio produto e para o site — clareza tipográfica, espaço em branco, microinterações, dark mode bem executado |
| **Stripe.com, Linear.app, Vercel.com** | Referência direta para a **landing page**: hero forte, copy objetiva, prova social, seções de features com storytelling visual |

Não copiar tudo. Extrair padrões que funcionam e melhorá-los para o cenário de operador único + IA + potencial SaaS.

---

## 4. ARQUITETURA TÉCNICA E STACK

### 4.1 Requisitos não-funcionais obrigatórios

| Camada | Especificação |
|---|---|
| **Arquitetura** | Monólito modular com separação clara de domínios (DDD), preparado para extração futura de microsserviços |
| **Frontend (site + app)** | Next.js (versão estável atual) + React + TypeScript + Tailwind CSS + biblioteca de componentes acessível (ex: Radix/shadcn como base, restilizada pelo design system da Seção 5). PWA/responsivo, mobile-first, excelente em desktop e celular |
| **Backend** | TypeScript (NestJS) como preferência principal; Python (FastAPI) como alternativa aceitável caso haja necessidade específica de ecossistema de IA/data science. Definir uma stack única e não misturar sem justificativa em ADR |
| **Banco de dados principal** | PostgreSQL (relacional) |
| **Cache e filas** | Redis (cache, filas e rate limiting) quando houver necessidade real |
| **Armazenamento de arquivos** | Storage S3-compatible (MinIO self-hosted ou equivalente gerenciado) para contratos, laudos, fotos e documentos fiscais. Metadata sempre no PostgreSQL; arquivos privados por padrão; acesso via URLs assinadas |
| **Busca** | PostgreSQL full-text search inicialmente; **pgvector** para embeddings e RAG; possibilidade de Meilisearch/Elasticsearch/OpenSearch no futuro se a escala justificar |
| **Filas e automação assíncrona** | Redis Streams ou RabbitMQ para jobs assíncronos e processamento de eventos |
| **IA local (preferencial)** | Ollama ou llama.cpp, orquestrados por uma camada `AI Provider` (ver Seção 1.1) |
| **IA remota (fallback)** | APIs OpenAI-compatible, Anthropic, Google Gemini |
| **Automação externa opcional** | n8n como camada opcional para orquestrações complexas — **nunca obrigatório** para automações essenciais de domínio, que devem viver no próprio ERP para garantir consistência, testes e confiabilidade |
| **Autenticação** | Sessões seguras/JWT, MFA opcional preparado desde o início, RBAC, políticas por recurso |
| **Containerização** | Docker + Docker Compose para desenvolvimento; Kubernetes opcional em produção |
| **CI/CD** | GitHub Actions (ou GitLab CI) com testes automatizados e linting em cada PR |
| **Observabilidade** | OpenTelemetry + Grafana + Prometheus; logs estruturados |
| **Infra geral** | Reverse proxy, HTTPS obrigatório, secrets via environment/secret manager, backups automáticos testados |

### 4.2 Camada de IA

- AI Gateway / Provider abstraction (Ollama, LM Studio, APIs OpenAI-compatible);
- Tool calling com schemas fortes;
- Structured output;
- Embeddings + RAG (pgvector);
- Agentes com permissões limitadas e matriz de risco (Seção 1.2).

### 4.3 Estrutura de diretórios sugerida

```
/apps
  /web        → site institucional + app do ERP (Next.js), separados por rota/grupo de rota
  /api        → backend (NestJS ou FastAPI)
/packages
  /design-system  → tokens, componentes, temas (fonte única de verdade visual — ver Seção 5)
  /shared         → tipos, schemas e utilitários compartilhados
/infra        → Docker, Compose, Terraform/Kubernetes quando aplicável
/docs         → SPEC.md, ADRs, documentação técnica e de usuário
/scripts      → automações, seeds, migrations
```

---

## 5. IDENTIDADE VISUAL E DESIGN SYSTEM (PREMIUM MINIMALISTA)

> Esta é a fonte única de verdade visual do produto inteiro. **Site, autenticação e ERP devem consumir o mesmo design system** — nada de estilos divergentes entre "página de marketing" e "painel interno". Isso deve viver em `/packages/design-system` e ser importado por todas as camadas.

### 5.1 Princípios de direção de arte

- **Minimalismo com propósito**: cada elemento na tela precisa justificar sua presença. Preferir espaço em branco a ornamento.
- **Premium, não frio**: minimalista não é sinônimo de genérico. Usar um acento de cor de marca consistente, tipografia com personalidade e microinterações sutis para transmitir cuidado e qualidade.
- **Clareza acima de tudo**: hierarquia visual óbvia, contraste correto, densidade de informação controlada (mais respiro no site, mais densidade — mas ainda organizada — no ERP).
- **Consistência**: o mesmo componente de botão, input, card e modal deve se comportar e parecer idêntico em qualquer lugar do produto.
- **Modo claro e escuro** nativos desde o início, não como reforma posterior.

### 5.2 Tokens de design (fonte única — `design-tokens.json`)

- **Cor**: uma paleta neutra sofisticada (tons de cinza/grafite com leve temperatura, evitando cinza "puro" de framework padrão) + **uma cor de marca (accent)** usada com moderação para CTAs, links e estados ativos + cores semânticas (sucesso, alerta, erro, informação) discretas e não saturadas em excesso.
- **Tipografia**: uma família sans-serif moderna para UI (ex: Inter, Geist, ou equivalente de licença livre) com uma escala tipográfica modular clara (display, h1–h4, body, small, caption). Considerar uma segunda família (serif ou display) **apenas** para títulos de impacto na landing page, se reforçar a percepção premium — usar com moderação.
- **Espaçamento**: escala baseada em 4px/8px, aplicada de forma consistente em padding, margin e gaps.
- **Raio de borda**: consistente em todo o produto (ex: cards e inputs com o mesmo `border-radius` base), transmitindo suavidade sem parecer infantil.
- **Elevação/sombra**: sombras sutis e em poucas camadas (ex: 3 níveis) — evitar sombras pesadas ou múltiplas simultâneas.
- **Motion**: transições curtas (150–250ms), easing consistente, usadas para dar feedback (hover, foco, abertura de modal) — nunca decorativas ao ponto de atrapalhar velocidade percebida.
- **Grid e breakpoints**: grid responsivo consistente entre site e app, com breakpoints únicos documentados.

### 5.3 Biblioteca de componentes compartilhada

Construir (ou restilizar uma base como shadcn/ui) uma biblioteca única contendo, no mínimo: botões (primário, secundário, ghost, destrutivo), inputs e campos de formulário (com estados de erro/sucesso/foco), selects, checkboxes/radio, switches, cards, tabelas de dados, modais/dialogs, toasts/notificações, tabs, badges/tags, avatares, tooltips, breadcrumbs, paginação, empty states ilustrados, skeletons de carregamento, command palette (⌘K) e um componente de navegação lateral/topo reutilizável entre app e área logada.

Cada componente deve ter: estados (default, hover, focus, active, disabled, loading, error), suporte a tema claro/escuro, e documentação viva (ex: Storybook) para o próprio agente de IA e futuros devs consultarem.

### 5.4 Onde o estilo se aplica

| Camada | Aplicação do design system |
|---|---|
| Landing page | Tom mais "storytelling", tipografia grande, muito espaço em branco, animações sutis de entrada (fade/slide ao rolar) |
| Login/Cadastro | Minimalista ao extremo — foco total na tarefa, sem distrações, mesma paleta e componentes do site |
| Dashboard/ERP | Mesma paleta e tipografia, densidade maior de informação, priorizando escaneabilidade e velocidade operacional |
| Documentos gerados (orçamento, laudo, contrato) | Aplicar a mesma identidade (logo, cores, tipografia) para reforçar percepção de marca também fora da tela |

### 5.5 Entregável esperado do agente nesta seção

Antes de codar qualquer tela, o agente deve produzir um **Guia de Estilo** (`/docs/design-system.md`) com: paleta de cores (hex + uso), escala tipográfica, escala de espaçamento, especificação de componentes-base e exemplos de composição de tela (ex: como uma página de formulário deve se estruturar). Esse guia é a referência obrigatória para toda UI construída depois.

---

## 6. LANDING PAGE / SITE DE CONVERSÃO

> Objetivo: transformar visitantes em **leads** (contato comercial) e em **assinantes** (trial/cadastro no produto), com copy persuasiva e visual premium, usando o design system da Seção 5.

### 6.1 Estrutura de seções da home

1. **Header fixo/sticky**: logo, navegação (Funcionalidades, Preços, Casos de uso/Blog, FAQ), toggle de tema claro/escuro, CTA secundário ("Entrar") + CTA primário destacado ("Começar grátis"/"Testar agora").
2. **Hero**: título de impacto (benefício central, não a feature), subtítulo explicando o "o quê" e "para quem" em 1–2 linhas, CTA primário forte + CTA secundário discreto (ex: "Ver demonstração"), e um visual de produto (screenshot estilizado, mockup ou ilustração) que comunique o valor à primeira vista. Considerar prova social leve logo abaixo do hero (logos de segmentos atendidos, número de OS processadas, etc., quando houver dado real — nunca inventar números).
3. **Problema → Solução**: bloco curto nomeando a dor real do público (ex: "Planilhas, WhatsApp bagunçado e clientes sem retorno") e como o produto resolve, preparando o terreno para a seção de funcionalidades.
4. **Funcionalidades / Benefícios** (3 a 6 blocos): cada bloco com ícone/ilustração, título orientado a benefício (não a nome técnico do módulo) e 1–2 frases de apoio. Ex.: "Nunca mais perca um cliente" (CRM), "Orçamento aprovado em segundos" (assinatura digital), "Seu copiloto de IA" (agentes).
5. **Como funciona** (opcional, 3–4 passos): visualização do fluxo do cliente do lead à entrega, reforçando simplicidade.
6. **Prova social**: depoimentos de clientes reais (quando existirem), estudos de caso, ou — na ausência de clientes reais no lançamento — uma seção de "para quem é" descrevendo os perfis de negócio atendidos, sem fabricar depoimentos falsos.
7. **Comparativo/Diferencial** (opcional): tabela simples comparando "do jeito antigo" vs. "com o AL Business OS", ou destacando o diferencial de IA local/privacidade de dados.
8. **Planos e Preços**: cards de planos claros (nome, público-alvo, preço, lista de benefícios, CTA por plano), com plano em destaque visualmente. Incluir FAQ de cobrança logo abaixo se relevante.
9. **FAQ**: objeções comuns de compra (segurança dos dados, LGPD, tempo de implantação, suporte, cancelamento).
10. **CTA final**: repetição do convite principal antes do rodapé, com senso de urgência honesto (ex: "Comece hoje, sem cartão de crédito" — apenas se verdadeiro).
11. **Footer**: navegação secundária, redes sociais, contato, links legais (Termos, Privacidade), e um pequeno reforço de marca.

### 6.2 Diretrizes de copywriting

- Escrever em **voz ativa**, curto e direto, priorizando benefício sobre feature ("Aprove orçamentos com um clique" em vez de "Módulo de aprovação de orçamentos").
- Falar diretamente com a dor do dono de assistência técnica/prestador de serviço: tempo perdido, retrabalho, falta de controle, cliente sem retorno.
- CTAs sempre em verbo de ação e específicos ("Criar minha conta grátis" em vez de "Enviar").
- Nunca inventar números, depoimentos ou logos de clientes que não existam — usar placeholders claramente identificados como exemplo até haver dados reais.
- Manter tom profissional, mas humano — evitar jargão técnico de ERP na página pública; jargão técnico é aceitável dentro do produto logado.
- Cada seção deve poder ser lida isoladamente (a pessoa que só rola a página até "Preços" já entende do que se trata).

### 6.3 Requisitos técnicos da landing page

- Performance: Core Web Vitals bons por padrão (imagens otimizadas, fontes com `font-display: swap`, componentes pesados carregados sob demanda).
- SEO: meta tags, Open Graph, sitemap, dados estruturados básicos (Organization/Product).
- Responsividade mobile-first real (não apenas "encolhida").
- Acessibilidade: contraste AA no mínimo, navegação por teclado, textos alternativos.
- Analytics de conversão configurável (eventos de clique nos CTAs, scroll depth, envio de formulário) — camada de analytics deve ser plugável, não hardcoded a um único provedor.
- Formulário de contato/lead deve cair diretamente no CRM do módulo de Leads (Seção 8.3), nunca em uma caixa de e-mail solta.

---

## 7. AUTENTICAÇÃO, CADASTRO E ONBOARDING

> Objetivo: a transição do site para dentro do produto deve ser a parte **mais simples e bonita** de toda a jornada — minimalista, moderna, premium, sem fricção.

### 7.1 Princípios da experiência de auth

- Uma tarefa por tela — nunca misturar cadastro com onboarding completo na mesma view.
- Layout minimalista: fundo neutro ou com um elemento visual de marca sutil (gradiente discreto, ilustração leve, ou split-screen com imagem de produto), formulário centralizado, sem menu de navegação completo distraindo.
- Feedback imediato de validação (força de senha, e-mail já cadastrado, campos obrigatórios) sem esperar o submit.
- Estados de carregamento e erro tratados com componentes do design system (nunca `alert()` de navegador).
- Copy amigável em mensagens de erro (explicar o que fazer, não só "erro 400").

### 7.2 Telas obrigatórias

1. **Cadastro (Sign up)**: nome, e-mail, senha (com indicador de força), aceite de termos/privacidade. Opção de cadastro social (Google) como atalho, se aplicável. Sem excesso de campos — dados adicionais (empresa, CNPJ, segmento) vão para o onboarding pós-cadastro, não no formulário inicial.
2. **Login**: e-mail/senha + opção "Esqueci minha senha" + login social (se aplicável). Suporte a "lembrar de mim".
3. **Verificação de e-mail**: tela de confirmação com reenvio de código/link, clara sobre o próximo passo.
4. **Recuperação de senha**: fluxo de duas etapas (solicitar → redefinir) com mensagens que não revelem se o e-mail existe ou não na base (segurança).
5. **MFA (preparado desde o início)**: tela de configuração opcional de segundo fator e tela de verificação no login quando ativado.
6. **Onboarding multi-etapas** (após primeiro login): coleta progressiva do essencial — dados da empresa/CNPJ, segmento de atuação (assistência técnica, varejo, serviços, impressão 3D — múltipla escolha), identidade visual básica (logo, cor, se aplicável ao plano), e criação do primeiro registro relevante (ex: primeiro cliente ou primeira OS) guiada por um checklist visual de progresso. Permitir pular etapas não essenciais e retomar depois.
7. **Convite de equipe** (para quando o operador crescer para time): tela simples de convidar por e-mail com definição de papel/permissão (RBAC).
8. **Gestão de conta/perfil**: dados pessoais, segurança (senha, MFA, sessões ativas), preferências (tema claro/escuro, notificações), e — quando o produto for SaaS — plano/assinatura e faturamento.

### 7.3 Requisitos técnicos

- Sessões seguras/JWT com refresh token, RBAC desde o primeiro dia (mesmo com um único usuário).
- MFA opcional (TOTP) preparado na arquitetura mesmo que não habilitado no MVP.
- Rate limiting em login/cadastro/recuperação de senha (proteção contra brute force).
- Auditoria de eventos de autenticação (login, logout, troca de senha, MFA ativado/desativado, sessões revogadas).
- Multi-tenant desde a estrutura de auth: usuário pertence a uma organização; suporte futuro a um usuário com acesso a múltiplas organizações (ex: consultor que atende vários CNPJs) sem refatoração estrutural.
- Portal do cliente (Seção 8.6) usa uma camada de acesso mais leve (ex: link mágico) e **não compartilha** o mesmo nível de permissão do time interno.

---

## 8. MÓDULOS FUNCIONAIS DO ERP

O sistema deve ser organizado em módulos independentes e integráveis. Todos herdam o design system da Seção 5.

### 8.1 Dashboard Executivo

Criar dashboard diferente por perfil.

**Para o proprietário/admin:** faturamento hoje e do mês, margem estimada, contas a receber e vencidas, OS abertas e atrasadas, equipamentos aguardando diagnóstico/aprovação, peças aguardando compra, serviços em andamento, agenda do dia, leads novos, taxa de conversão, ticket médio, tempo médio de reparo, taxa de retorno em garantia, produtos mais vendidos, serviços mais lucrativos, clientes sem contato recente, oportunidades de venda, alertas críticos.

**Dashboard de IA** (perguntas em linguagem natural, respondidas com dados reais): "O que merece minha atenção hoje?", "Quais OS estão em risco de atraso?", "Onde estou perdendo dinheiro?", "Quem está aguardando resposta?", "Quais clientes têm potencial de nova compra?", "Quais peças estão perto do ponto de reposição?".

### 8.2 CRM / Clientes

Cadastro completo (PF/PJ, CPF/CNPJ, contatos, endereços, canais preferidos, tags, origem, observações, consentimentos LGPD, preferências, documentos) com **timeline unificada**:

`Cliente → mensagens → ligações registradas → tickets → OS → orçamentos → vendas → pagamentos → documentos → garantias → contratos → campanhas → notas internas`

Classificação automática por IA: novo cliente, recorrente, VIP, inativo, alto potencial, alto risco de churn, oportunidade de upsell.

### 8.3 Leads e Pré-Atendimento

Canais: site (formulário da landing page — Seção 6.3), WhatsApp, telefone, Instagram/Facebook, indicação, marketplace, presencial, importação manual.

Funções: captação, origem/campanha, qualificação, classificação por IA, histórico de conversa, SLA de resposta, follow-up, conversão em cliente, criação de oportunidade/OS.

**Agente de pré-atendimento** — exemplo de fluxo ("Meu notebook liga mas não aparece imagem"): identificar categoria → coletar sintomas → fazer perguntas relevantes → estimar prioridade → sugerir triagem inicial → indicar necessidade de atendimento presencial/remoto → criar lead/ticket estruturado. **Nunca** prometer diagnóstico definitivo sem inspeção técnica, nem preço definitivo sem regra configurada.

### 8.4 Agenda e Atendimento

Agenda unificada (diagnóstico, entrega, retirada, visita técnica, consultoria, reunião de projeto, instalação, manutenção preventiva, produção 3D) integrada ao Google Calendar, com disponibilidade, bloqueios, duração estimada, confirmação, remarcação, lembretes, controle de no-show e recorrência.

### 8.5 Equipamentos / Ativos

Cada equipamento é uma entidade própria (notebook, desktop, workstation, servidor, impressora, monitor, periférico, etc.) com campos técnicos completos (fabricante, modelo, número de série, specs, estado físico, fotos, garantia, proprietário, localização) e **histórico do ativo** (compra, venda, assistência, upgrades, manutenção, garantia, diagnósticos, incidentes). Suporte a **QR Code** para abrir o ativo diretamente no ERP.

### 8.6 Ordem de Serviço (OS) — Core do Sistema

Workflow de status configurável cobrindo todo o ciclo: pré-cadastro → aguardando recebimento → recebido → triagem → diagnóstico → aguardando/enviado orçamento → aguardando aprovação → aprovado/reprovado → aguardando peça → em reparo → aguardando teste/testando → pronto → aguardando retirada → entregue → pós-atendimento → garantia (+ cancelado / sem reparo / abandonado conforme política).

Cada transição pode disparar: tarefa, notificação (e-mail/WhatsApp), atualização de cliente e financeiro, reserva/baixa de estoque, geração de documento, log, webhook ou ação de IA.

**Intake da OS**: checklist profissional de estado externo, fotos obrigatórias/configuráveis (frente, traseira, laterais, tela, componentes, acessórios), termo de recebimento com fotos e aceite digital.

**Portal do cliente** (mobile-first, acesso via link mágico seguro): acompanhar status e orçamento, aprovar/reprovar, anexar documentos e fotos, ver prazo estimado e pagamentos, baixar documentos, consultar histórico e garantia, abrir novo chamado, avaliar atendimento.

### 8.7 Diagnóstico Técnico

Ambiente dedicado registrando sintoma relatado, hipótese, testes realizados, resultado, evidências (fotos/vídeos/logs), peças testadas, medições, diagnóstico final e nível de confiança. Checklists por categoria (não liga, superaquecimento, lentidão, tela, armazenamento, memória, SO, rede, malware, upgrade, recuperação de dados, manutenção preventiva). A IA pode sugerir hipóteses, mas deve separar claramente fato observado, resultado de teste, inferência e sugestão.

### 8.8 Orçamentos

Itens de mão de obra, peças, serviços terceirizados, deslocamento, diagnóstico, frete, desconto e impostos/taxas. Propostas alternativas (Econômica / Recomendada / Premium), aprovação item a item quando permitido, e ao aprovar: registro de prova de aceite, evento gerado, conversão em plano de execução, reserva de estoque e cobrança quando aplicável. A IA pode traduzir diagnóstico técnico em explicação clara ao cliente — **nunca mascarando incerteza técnica**.

### 8.9 Comunicação com Cliente

Central de comunicação multicanal (WhatsApp Business/API, e-mail, SMS, notificações web, portal) com templates para cada etapa do ciclo (recebimento, diagnóstico, orçamento, aprovação pendente, peça aguardada, reparo iniciado, pronto para retirada, pagamento pendente, garantia, pós-venda, pesquisa de satisfação, reativação). Comunicação acionada por eventos, com prevenção contra spam/duplicidade e registro completo na timeline.

### 8.10 Documentos / GED

Document Management System integrado, com upload/drag-and-drop, preview, versionamento, tags, pastas virtuais, controle de acesso, validade/expiração, assinatura eletrônica via provedor, hash do arquivo, OCR, busca full-text e RAG. Banco guarda apenas metadata + referência segura ao objeto (nunca arquivo em coluna de banco). Estrutura lógica sugerida:

```
/Clientes/{cliente}
/Equipamentos/{ativo}
/OS/{ano}/{os}
/Projetos/{projeto}
/Contratos/{contrato}
/Financeiro/{ano}
/Empresa/{categoria}
```

### 8.11 Assinatura e Aceite

Camada de integração com provedores de assinatura eletrônica (ex: Clicksign, D4Sign ou equivalente), suportando múltiplos signatários e evidências de aceite (IP, timestamp, hash). Não presumir que uma assinatura desenhada na tela, isoladamente, satisfaz toda necessidade jurídica — permitir provedores adequados ao contexto regulatório.

### 8.12 Inventário

Produto com SKU, código de barras/EAN, marca, categoria/subcategoria, fornecedor, custo, preço (normal/promocional/atacado), margem, estoque mín/máx, localização, lote, número de série e garantia. Movimentações completas (entrada, saída, venda, uso em OS, devolução, transferência, ajuste, perda, avaria, reserva). Alertas de estoque baixo/zerado, excesso, produto parado, margem baixa e preço abaixo do custo.

### 8.13 Compras e Fornecedores

Cadastro de fornecedores, cotação, pedido de compra, recebimento, conferência, vínculo com OS, custo real, prazo e desempenho do fornecedor. IA pode sugerir compras com base em consumo, OS abertas, lead time, estoque mínimo e previsão.

### 8.14 PDV / Vendas de Produtos (Varejo Multi-Segmento)

PDV integrado ao estoque, suportando hardware, periféricos, acessórios, suprimentos, itens de escritório e outros segmentos permitidos pela estratégia comercial — **produto como entidade genérica com taxonomia configurável**, sem categorias rígidas. Venda rápida, leitor de código de barras, desconto, parcelamento, PIX/cartão/boleto, retirada/entrega, emissão fiscal via integração.

### 8.15 E-commerce / Marketplaces

Arquitetura preparada para integração futura com Mercado Livre, Shopee, Amazon, loja própria e Nuvemshop/Shopify, com camada de integração comum para catálogo, estoque, preço, pedido, envio e sincronização de status — **nunca acoplando o domínio de vendas diretamente à API de um marketplace**.

### 8.16 Impressão 3D

Catálogo de modelos com pré-visualização 3D (Three.js), fila de impressão com controle de filamentos/tempo/custo, orçamentação automática baseada em volume/material/tempo de máquina, e venda de peças prontas integrada ao módulo de varejo.

### 8.17 Financeiro

Contas a pagar/receber, caixa, banco, cartões, PIX, parcelamentos, recorrências, inadimplência, despesas, receitas, centros de custo. Fluxo de caixa (com previsão via IA), DRE gerencial simplificada, margem por OS/produto/serviço, contas vencidas, conciliação bancária (Open Finance quando disponível), anexos de comprovantes. Adaptador de pagamentos desacoplado (priorizar provedores brasileiros como Asaas ou equivalente), orientado por API + webhook. Cobrança automatizada de inadimplentes via WhatsApp/e-mail.

### 8.18 Fiscal (Brasil)

Camada fiscal desacoplada, integrando com provedores especializados para NF-e, NFC-e e NFS-e via SEFAZ. **Não** codificar regras tributárias rígidas no core — modelar natureza da operação, regime tributário, CFOP, NCM, CST/CSOSN, ISS, retenções, alíquotas, município/estado como parametrizações configuráveis e atualizáveis. Agente fiscal de IA para diagnosticar rejeições de NF-e e sugerir correções.

### 8.19 Serviços Profissionais e Projetos

Módulo de projetos/consultoria cobrindo desenvolvimento de software, automação, IA, análise de dados, implantação, infraestrutura, suporte, modelagem 3D e treinamento. Cada projeto com cliente, contrato, escopo, orçamento, cronograma (Kanban + sprints e cascata), tarefas, apontamento de horas com timer, custos, marcos, entregáveis, documentos e faturamento. Contratos de retainer (horas mensais) com controle de saldo. Margem por projeto em tempo real.

### 8.20 Contratos e Recorrência

Contrato de manutenção, suporte mensal, consultoria recorrente, SLA, horas contratadas, franquia de atendimento, renovação, reajuste, cobrança automática e cancelamento. Alertas de vencimento, renovação, horas restantes, SLA em risco e inadimplência.

### 8.21 Garantia / RMA

Registro de período, cobertura, exclusões, fornecedor responsável, peça/serviço e número de série. Fluxo: cliente reclama → abertura de caso → validação da garantia → triagem → diagnóstico → decisão → reparo/troca/reembolso/crédito conforme política → conclusão → histórico. Indicadores de reincidência e falha por peça/fornecedor/técnica.

### 8.22 Pós-Atendimento / Customer Success

Automações de mensagem pós-entrega, pesquisa de satisfação (NPS), lembrete de garantia, manutenção preventiva, upgrade sugerido, acessórios compatíveis, renovação de contrato, reativação de clientes inativos e campanhas segmentadas. IA identifica oportunidades de pós-venda com base no histórico. Programa de fidelidade com pontos e benefícios.

### 8.23 Marketing e CRM Comercial

Funil, oportunidades, campanhas, segmentos, tags, origem do lead, taxa de conversão, CAC/LTV quando houver dados suficientes, ticket médio, recompra e churn. Automação orientada a evento — exemplo: *cliente fez formatação há 10 meses → IA identifica oportunidade de manutenção → cria follow-up → prepara mensagem → operador aprova → envia.*

---

## 9. INTELIGÊNCIA ARTIFICIAL E AUTOMAÇÃO AGÊNTICA

**Princípio:** IA local como padrão, IA remota como exceção. Tarefas críticas devem poder funcionar 100% offline.

### 9.1 Copiloto Operacional (assistente global)

Assistente acessível de qualquer tela do ERP (via command palette ⌘K), respondendo com dados reais e autorizados. Exemplos: "Mostre todas as OS atrasadas", "Quais clientes aguardam orçamento?", "Qual serviço teve maior margem este mês?", "Resuma o histórico deste cliente", "Prepare uma mensagem para este cliente", "Crie uma proposta com três opções". Quando não houver evidência suficiente: **"Não encontrei informação suficiente no sistema"** — nunca inventar dados.

### 9.2 Agentes especializados

| Agente | Responsabilidade | Modelo sugerido |
|---|---|---|
| **Triagem/Intake** | Classificar chamados, extrair entidades (cliente, equipamento, problema) | Modelo local rápido |
| **Diagnostic Copilot** | Sugerir hipóteses/checklists usando base interna, manuais e histórico | Modelo local intermediário |
| **Orçamento/Sales** | Sugerir preços com base em histórico/complexidade, identificar oportunidades, criar propostas | Modelo local ou remoto |
| **Fiscal** | Diagnosticar rejeições de NF-e e sugerir correções | Modelo local especializado |
| **Atendimento/Customer Communication** | Responder dúvidas de clientes 24/7, converter dado técnico em linguagem clara | Modelo local |
| **Procurement** | Sugerir compras com base em consumo, lead time e estoque | Modelo local |
| **Finance** | Resumir caixa, contas e riscos — nunca executa ação financeira crítica sem aprovação | Modelo local ou remoto |
| **Follow-up** | Buscar clientes/casos sem próxima ação definida | Modelo local |
| **Knowledge/RAG** | Pesquisar documentos, manuais, contratos e histórico via base vetorial | Modelo local |
| **Executive Analyst** | Gerar o resumo/briefing diário do negócio | Modelo local ou remoto |
| **Código** | Auxiliar em desenvolvimento interno e automações | Claude Code / Codex (remoto) |

### 9.3 Funcionalidades de IA no produto

Consulta em linguagem natural sobre qualquer dado do negócio; previsão de demanda de peças/produtos; detecção de anomalias em custos, prazos e comportamento de clientes; geração automática de laudos técnicos a partir de checklists e fotos; transcrição e resumo de reuniões (Whisper local + LLM); tradução automática de documentação técnica; **geração e otimização de copy de marketing** para a landing page e campanhas (Seção 6.2).

### 9.4 AI Tooling

Toda ferramenta exposta à IA deve ter: nome, descrição, input/output schema, permissões necessárias, nível de risco, idempotência, auditoria e tratamento de erros. Exemplos de tools: `get_customer`, `get_customer_history`, `get_asset`, `search_repair_orders`, `check_stock`, `create_quote_draft`, `create_task`, `prepare_customer_message`, `send_customer_message`, `create_payment_link`, `get_payment_status`, `create_purchase_order_draft`, `search_documents`, `search_knowledge_base`, `get_financial_summary`, `get_calendar_availability`, `create_calendar_event`.

### 9.5 RAG / Base de Conhecimento

Fontes: manuais técnicos, PDFs, procedimentos internos, políticas, contratos, FAQ, histórico de casos aprovados, documentos de fornecedores. Pipeline: upload → verificação de segurança → extração/OCR → limpeza → chunking → embeddings → indexação com metadata → busca híbrida → reranking → geração com citação da fonte interna.

### 9.6 Automações com gatilhos (exemplos)

- OS finalizada → WhatsApp com pesquisa de satisfação;
- Estoque de peça abaixo do mínimo → pedido de compra automático;
- Contrato a 30 dias do vencimento → notificar proprietário;
- NF-e rejeitada → acionar Agente Fiscal para diagnóstico;
- Lead sem resposta em X horas → escalar para o proprietário.

---

## 10. SEGURANÇA, LGPD E PRIVACIDADE

### 10.1 Segurança

RBAC com princípio do menor privilégio; MFA preparado; rate limiting; defesas contra CSRF/XSS/SQLi; validação sempre server-side; proteção contra upload malicioso (com antivírus quando necessário); criptografia em trânsito e de dados sensíveis em repouso; secrets fora do código; logs de auditoria; backups com restauração testada; retenção configurável; soft delete como padrão, hard delete apenas em fluxos controlados; segregação de dados por organização/tenant (row-level security). Nunca registrar senhas de equipamentos em texto puro se houver alternativa segura; nunca logar segredos.

### 10.2 LGPD / Privacidade

Fundamentos de finalidade, consentimento quando aplicável, base legal configurável, minimização de dados, retenção, anonimização quando possível, exportação de dados, atendimento a solicitações do titular, registro de processamento e política de acesso. LGPD deve influenciar arquitetura, dados, acesso e retenção — não ser tratada como um simples banner de cookies.

---

## 11. INTEGRAÇÕES E APIS

O sistema deve expor uma **API RESTful documentada (OpenAPI/Swagger)** e webhooks para integrações externas, com arquitetura de adapters (nenhuma integração acoplada diretamente ao core).

| Integração | Tipo | Prioridade |
|---|---|---|
| WhatsApp Business API | Notificações e chatbot | Crítica |
| SEFAZ (NF-e, NFS-e, NFC-e) via provedor | Fiscal | Crítica |
| Gateway de pagamento (ex: Asaas, PIX, cartão, boleto) | Recebimentos | Crítica |
| Ollama / LM Studio | IA local | Crítica |
| Storage S3-compatible | Documentos | Crítica |
| Google Calendar | Agendamentos | Alta |
| Open Finance / bancos | Conciliação bancária | Alta |
| Marketplaces (Mercado Livre, Shopee, Amazon) | Vendas e estoque | Alta |
| E-mail transacional (SendGrid, SES ou equivalente) | Notificações | Alta |
| Assinatura eletrônica (Clicksign, D4Sign) | Contratos | Média |
| n8n | Orquestração externa opcional | Média |
| APIs LLM comerciais (fallback) | IA remota | Média |

Requisitos de API: versionamento, paginação, filtering/sorting, idempotency keys, webhooks de saída para entidades importantes, API keys para integrações externas, logs completos.

---

## 12. MODELO DE DADOS E BANCO DE DADOS

### Entidades principais (PostgreSQL)

`organizacoes` (tenant), `usuarios`, `clientes` (PF/PJ), `equipamentos`, `ordens_servico`, `orcamentos`, `produtos`, `pedidos_venda`, `projetos`, `contratos`, `documentos`, `transacoes_financeiras`, `notas_fiscais`, `interacoes` (WhatsApp/e-mail/telefone/chat), `leads`, `agentes_ia` (logs, prompts, respostas, feedback), `eventos_auditoria`.

### Boas práticas

Migrations versionadas (ex: Prisma Migrate ou Alembic, conforme stack escolhida); índices otimizados para consultas frequentes; soft delete para auditoria; **row-level security por organização** desde o primeiro schema (multi-tenant real, não simulado por filtro de aplicação).

---

## 13. AUTOMAÇÃO: EVENTOS, WORKFLOW ENGINE E ALERTAS

### 13.1 Domínio orientado a eventos

Eventos internos observáveis e testáveis, por exemplo: `customer.created`, `lead.created`, `lead.converted`, `asset.received`, `repair.status_changed`, `quote.approved`, `quote.rejected`, `part.required`, `repair.delivered`, `payment.confirmed`, `payment.failed`, `warranty.opened`, `contract.expiring`, `task.overdue`.

### 13.2 Workflow Engine

Motor configurável no formato `TRIGGER → CONDITIONS → ACTIONS → RETRIES → AUDIT`.

- **Triggers**: criação/atualização, mudança de status, data, tempo decorrido, webhook, pagamento, estoque, formulário, mensagem recebida, decisão de IA.
- **Actions**: criar tarefa, enviar mensagem, gerar documento, criar cobrança, criar evento, alterar status, adicionar tag, reservar estoque, criar alerta, chamar webhook, executar agente.

Garantir mecanismo de idempotência para evitar automações duplicadas.

### 13.3 Alertas Inteligentes

Central de alertas priorizados por **impacto**, não apenas por data: OS prestes a vencer, orçamento parado, cliente esperando resposta, pagamento atrasado, estoque crítico, peça/fornecedor atrasado, margem negativa, cliente recorrente sem contato, garantia/contrato perto do vencimento.

---

## 14. RELATÓRIOS, BI E BUSCA GLOBAL

### 14.1 Relatórios

- **Operacionais**: OS por status, tempo médio, atrasos, produtividade, reincidência, garantia, peças usadas.
- **Comerciais**: faturamento, ticket médio, conversão, origem de lead, clientes novos, recompra, produtos/serviços.
- **Financeiros**: receita, despesas, margem, fluxo de caixa, contas a receber, inadimplência, lucratividade.
- **Estoque**: giro, estoque parado, margem, perdas, ruptura, compras.
- **Executivos**: visão 7/30/90 dias, tendências, alertas, anomalias.

### 14.2 Busca Global

Busca rápida por cliente, CPF/CNPJ, telefone, e-mail, OS, número de série, SKU, produto, documento, contrato, projeto ou tag — incluindo busca em linguagem natural (ex: "notebooks recebidos este mês que ainda aguardam peça").

---

## 15. UX/UI OPERACIONAL (SOLO OPERATOR, ATALHOS, BRIEFING)

> Complementa a Seção 5 com os princípios específicos da experiência **dentro** do ERP.

### 15.1 Princípios de UX operacional

Clareza, velocidade, baixa fricção, densidade informacional controlada, atalhos de teclado, command palette (⌘K), busca global, ações rápidas, responsividade, acessibilidade, empty states úteis, feedback visual, prevenção de erro, histórico claro. A tela de OS deve permitir trabalhar por horas sem sensação de burocracia.

Atalhos essenciais: nova OS, novo cliente, nova venda, novo orçamento, registrar pagamento, abrir busca, abrir assistente IA.

### 15.2 Modo Solo Operator

Como o sistema começa operado por uma única pessoa, criar um modo que reduza cliques, consolide tarefas, mostre apenas o necessário, sugira a próxima ação, permita aprovar lotes de ações de baixo risco e gere resumo diário.

**"Minha fila de hoje"**:
```
URGENTE            → tarefas críticas
PRÓXIMOS           → atendimentos
AGUARDANDO TERCEIROS → peças/clientes/fornecedores
OPORTUNIDADES      → vendas/pós-venda
FINANCEIRO         → cobranças
ROTINAS            → tarefas administrativas
```

### 15.3 Daily AI Briefing

Briefing diário automático, por exemplo: *"Bom dia. Hoje você tem X atendimentos. Existem Y OS em risco. Z clientes aguardam retorno. Há R$ N em cobranças vencidas. Duas peças críticas precisam ser compradas. Três oportunidades comerciais merecem atenção."* Cada informação deve levar ao registro correspondente com um clique.

### 15.4 Documentos gerados

Templates profissionais (aplicando o design system — Seção 5.4) para OS, orçamento, recibo, termo de entrada/entrega, laudo técnico, garantia, contrato, proposta comercial, relatório de atendimento e comprovante de pagamento, com suporte a template por empresa/marca/unidade.

### 15.5 Configurações

Área administrativa cobrindo: dados da empresa, identidade visual (logo, cor — respeitando os tokens da Seção 5), usuários, cargos, permissões, status, categorias, serviços, produtos, preços, descontos, garantias, SLAs, impostos, integrações, provedores de IA e modelos, automações, templates, notificações, retenção, backups e parâmetros de segurança.

---

## 16. OBSERVABILIDADE, TESTES, MIGRAÇÕES E MULTI-TENANCY

### 16.1 Observabilidade

Logs estruturados, métricas, traces quando justificável, health checks, monitoramento de jobs e integrações, alertas de falha, dashboard técnico. Métricas específicas de IA: custo estimado, latência, tokens, taxa de erro, modelo, provider, tool calls, taxa de aprovação humana e resultados rejeitados.

### 16.2 Testes

Obrigatório: unit tests, integration tests, API tests, workflow tests, permission tests, AI tool tests, E2E, testes de idempotência, testes de backup/restore e testes de segurança fundamentais. Toda regra financeira, de estoque ou transição crítica deve ter teste. Criar dados seed para ambiente de demonstração (incluindo dados de exemplo para a landing page/plano de preços).

### 16.3 Migrações e Dados

Banco sempre via migrations versionadas — nunca alteração manual de estrutura em produção. Criar seed, fixtures, importador/exportador CSV, backups e procedimento de restore documentado. Permitir importação futura de clientes, produtos, estoque e histórico de sistemas legados.

### 16.4 Multi-Tenancy

Projetar desde o início para organização/tenant, mesmo que a primeira instalação use uma única empresa. Todas as entidades de negócio devem respeitar isolamento por organização (row-level security).

---

## 17. ROADMAP DE IMPLEMENTAÇÃO

Não construir tudo de uma vez. Sempre entregar uma fatia vertical funcionando antes de avançar.

| Fase | Entregável | Observação |
|---|---|---|
| **Fase 0 — Foundation** | Arquitetura, CI/CD, auth completo (login/cadastro/onboarding — Seção 7), RBAC, organizações/multi-tenancy, auditoria, PostgreSQL, storage, **design system publicado** (Seção 5), API base, Docker, observabilidade básica | Sem isso, nada mais começa |
| **Fase 1 — Landing Page** | Site de conversão completo (Seção 6) publicado sobre o design system, formulário de lead conectado ao CRM | Pode rodar em paralelo à Fase 0 do backend |
| **Fase 2 — Core ERP** | Clientes, equipamentos, OS, intake, diagnóstico, orçamento, documentos, portal do cliente, notificações | Módulo de OS funcionando é o primeiro marco real de valor |
| **Fase 3 — Inventory + Sales** | Produtos, estoque, compras, fornecedores, vendas, PDV | |
| **Fase 4 — Finance** | Contas, pagamentos, cobranças, fluxo de caixa, integração de pagamento | |
| **Fase 5 — Fiscal + Integrations** | NF-e/NFC-e/NFS-e via provedor, WhatsApp, Google Calendar, marketplaces | |
| **Fase 6 — Professional Services + Impressão 3D** | Projetos, tarefas, contratos, SLA, timesheet, recorrência, módulo de impressão 3D | |
| **Fase 7 — AI Platform** | AI Gateway, modelos locais, tool calling, RAG, agentes, aprovações, daily briefing | |
| **Fase 8 — Intelligence** | BI avançado, previsão, recomendações, detecção de anomalias, scoring de cliente | |

---

## 18. CRITÉRIOS DE ACEITAÇÃO

Antes de considerar qualquer módulo (ou tela do site/auth) concluído, comprovar:

1. Fluxo funcional completo (incluindo, quando aplicável, o fluxo visual do site/login sem estados quebrados);
2. Validação server-side;
3. Permissões e RBAC aplicados;
4. Auditoria registrada;
5. Testes cobrindo o caminho crítico;
6. Tratamento de erro com componentes do design system;
7. Loading states e empty states;
8. Responsivo (mobile-first);
9. Acessibilidade básica (contraste, teclado, alt text);
10. Aderência ao design system (tokens, componentes, tipografia — Seção 5) sem estilos "soltos";
11. Logs;
12. Documentação atualizada;
13. Migrations e seed quando aplicável;
14. Integração com eventos quando relevante.

---

## 19. COMO O AGENTE DEVE TRABALHAR

Não gerar milhares de linhas de código de uma vez sem validar a arquitetura. Sequência obrigatória:

1. Analisar requisitos e identificar ambiguidades;
2. Criar ADRs quando decisões importantes forem tomadas;
3. Criar/atualizar o modelo de domínio;
4. Criar/atualizar schema de banco;
5. Definir contratos de API;
6. Consultar/criar o design system (Seção 5) antes de qualquer tela nova;
7. Implementar uma fatia vertical pequena (feature completa ponta a ponta, não telas soltas);
8. Testar;
9. Validar contra os Critérios de Aceitação (Seção 18);
10. Integrar;
11. Documentar;
12. Avançar para o próximo incremento.

### Formato de saída esperado em cada etapa

**Contexto** (o que será implementado) · **Decisões** (principais decisões arquiteturais e por quê) · **Alterações** (arquivos/módulos criados ou modificados) · **Banco** (migrations) · **API** (endpoints e schemas) · **UI** (telas/componentes, com referência aos tokens do design system usados) · **Automação** (eventos/jobs/workflows) · **IA** (modelos, prompts, tools, permissões, fallback) · **Testes** (executados e resultados) · **Riscos** (problemas conhecidos) · **Próxima etapa** (incremento recomendado).

---

## 20. REGRAS ESPECIAIS DE IA

Nunca inventar preço, estoque, diagnóstico, prazo, dado financeiro **ou copy de marketing com números/depoimentos falsos**. Nunca afirmar que uma ação foi executada sem confirmação real da ferramenta. Separar claramente observação, dado do banco, inferência e recomendação. Quando uma ferramenta falhar, informar o erro de forma controlada. Quando faltar contexto, fazer a menor quantidade necessária de perguntas e ainda apresentar uma solução provisória segura.

---

## 21. RESULTADO FINAL DESEJADO

O resultado deve ser um produto que:

- **No site**, converte um visitante desconhecido em lead ou assinante em poucos minutos, com uma primeira impressão de qualidade e confiança.
- **No cadastro/login**, faz o usuário entrar no produto sem fricção, sentindo que está usando algo premium desde o primeiro clique.
- **No ERP**, faz o operador pensar menos em administração e mais em entregar serviço — o sistema sabe quem é o cliente, qual equipamento é dele, o que aconteceu, quando, quem fez, qual diagnóstico, quais peças, quanto custou, quanto foi cobrado, se foi pago, qual garantia existe, quais documentos foram produzidos, o que o cliente precisa agora e qual é a próxima ação.

A experiência ideal: *"Entrei no site, entendi o valor em segundos, me cadastrei sem esforço, e ao abrir o sistema ele já me mostrou o que importa, preparou o trabalho repetitivo, organizou a operação e deixou para mim somente as decisões que realmente exigem julgamento humano."*

---

## 22. PRIMEIRA MISSÃO DO AGENTE

Antes de escrever código de produto:

1. Transformar este documento em um **Product Requirements Document (PRD)**;
2. Produzir o **Guia de Estilo / Design System** (`/docs/design-system.md` — Seção 5.5);
3. Produzir arquitetura lógica (diagrama C4);
4. Produzir mapa de módulos e mapa de entidades/relacionamentos (ERD);
5. Produzir matriz de permissões (RBAC);
6. Produzir mapa de integrações;
7. Produzir matriz de agentes de IA e ferramentas;
8. Produzir matriz de automações;
9. Produzir wireframes de baixa fidelidade da landing page, do fluxo de auth/onboarding e do dashboard principal, já aplicando os tokens do design system;
10. Produzir roadmap MVP → V1 → V2 (baseado na Seção 17);
11. Identificar inconsistências e decisões ainda abertas, propondo soluções sem bloquear o projeto;
12. Somente depois, começar a implementação pela Fase 0.

**Prioridade máxima:** qualidade arquitetural, consistência visual de ponta a ponta (site → login → app), segurança, consistência dos dados e velocidade operacional. Não transformar o sistema em um amontoado de funcionalidades — tudo deve ter justificativa operacional, uma entidade de domínio e um fluxo claro.

---

**FIM DO PROMPT MESTRE UNIFICADO — AL BUSINESS OS**
