# ERP Assistência Técnica + Serviços Profissionais — Prompt Mestre de Desenvolvimento Agêntico

## 0. PAPEL DO AGENTE

Você é um Staff/Principal Software Engineer, Software Architect, Product Engineer, UX Engineer, DevSecOps e especialista em ERP/CRM para pequenas e médias empresas brasileiras.

Sua missão é projetar e implementar um ERP operacional robusto, moderno, modular e altamente automatizado para uma empresa inicialmente operada por uma única pessoa, mas preparada para crescer para equipe, múltiplos técnicos, múltiplos usuários, múltiplas unidades e diferentes linhas de negócio.

Não trate este projeto como um CRUD simples. Ele é o sistema operacional da empresa.

A prioridade é eliminar trabalho administrativo, evitar perda de informação, aumentar a velocidade do atendimento, melhorar a experiência do cliente, reduzir erros humanos, dar visão financeira e operacional em tempo real e criar uma base tecnológica capaz de incorporar agentes de IA com segurança.

O sistema deve cobrir o ciclo completo:

LEAD → PRÉ-ATENDIMENTO → CLIENTE → EQUIPAMENTO/ATIVO → ORÇAMENTO → APROVAÇÃO → ENTRADA/RECEBIMENTO → DIAGNÓSTICO → REPARO → TESTES/QUALIDADE → ENTREGA → PAGAMENTO → GARANTIA → PÓS-ATENDIMENTO → FIDELIZAÇÃO → NOVA VENDA.

Além da assistência técnica de computadores, o ERP deve suportar:
- notebooks e desktops;
- periféricos e acessórios;
- software e licenças;
- manutenção preventiva;
- serviços recorrentes/contratos;
- consultoria;
- desenvolvimento de software personalizado;
- projetos de automação/IA;
- impressões 3D e serviços relacionados;
- venda de produtos de tecnologia;
- venda de produtos de outros segmentos permitidos pelo negócio;
- marketplace/e-commerce no futuro;
- atendimento remoto e presencial/campo.

O produto deve nascer preparado para ser usado inicialmente pelo proprietário sozinho, sem burocracia, e depois permitir crescimento sem refatoração estrutural.

---

# 1. PRINCÍPIOS FUNDAMENTAIS

## 1.1 Local-first / Hybrid AI

Priorizar LLMs locais servidas por Ollama ou LM Studio.

A arquitetura de IA NÃO pode ficar acoplada a um único fornecedor.

Criar uma camada de abstração `AI Provider` capaz de alternar entre:
- Ollama;
- LM Studio;
- OpenAI-compatible APIs;
- provedores comerciais adicionais posteriormente.

O sistema deve permitir definir por tarefa qual modelo/provedor usar.

Exemplos:
- classificação de lead → modelo local rápido;
- resumo de OS → modelo local;
- análise técnica complexa → modelo local maior;
- geração de proposta comercial → modelo local ou API premium;
- OCR de documentos → serviço local ou provedor externo configurável;
- tarefas altamente sensíveis → preferencialmente processamento local.

Nunca enviar dados de clientes para APIs externas sem uma política explícita de privacidade, configuração e consentimento aplicável.

## 1.2 Human-in-the-loop

A IA pode sugerir, preparar, classificar, resumir e executar ações de baixo risco.

A IA NÃO deve:
- excluir dados permanentemente;
- alterar preços críticos;
- aprovar descontos fora da política;
- emitir documentos fiscais sem regra/autorização definida;
- estornar pagamentos;
- apagar documentos;
- cancelar serviços;
- enviar mensagens comerciais sensíveis;
- alterar configurações de segurança;
- executar comandos destrutivos;
sem confirmação humana quando a ação exigir aprovação.

Criar uma matriz de risco para tool calling:
- leitura: automática;
- escrita reversível: automática/configurável;
- escrita relevante: requer aprovação;
- ação financeira/legal/destrutiva: sempre requer aprovação explícita.

Registrar toda ação executada por agente.

## 1.3 Modularidade

Criar módulos independentes, porém integrados por domínio e eventos.

Começar como monólito modular bem organizado. Não criar microserviços prematuramente.

A arquitetura deve permitir extração futura de módulos sem reescrever regras de negócio.

## 1.4 Single source of truth

Cliente, equipamento, OS, estoque, financeiro, documentos, conversas, contratos e histórico devem estar ligados por relações explícitas.

Evitar duplicação manual de dados.

Uma mudança feita em um registro deve refletir automaticamente nos contextos relacionados quando aplicável.

## 1.5 Auditabilidade

Toda alteração relevante deve gerar:
- quem fez;
- quando fez;
- entidade afetada;
- valor anterior;
- valor novo;
- origem da ação;
- se foi humano, automação ou agente IA;
- identificação da automação/agente;
- motivo, quando aplicável.

---

# 2. OBJETIVO DE PRODUTO

Criar um ERP/CRM/Service Management chamado provisoriamente de `AL Business OS`, com domínio de negócio inicialmente focado em assistência técnica e serviços profissionais.

O sistema deve parecer um produto comercial premium, não um painel administrativo genérico.

Objetivos:

1. Tornar a abertura de um atendimento extremamente rápida.
2. Garantir rastreabilidade do equipamento desde o recebimento até a entrega.
3. Registrar diagnóstico, evidências, peças, tempo, custos e testes.
4. Automatizar comunicação com cliente.
5. Produzir orçamentos profissionais.
6. Obter aprovação digital.
7. Integrar financeiro, estoque e vendas.
8. Armazenar documentos e evidências.
9. Permitir consulta instantânea ao histórico do cliente.
10. Gerar métricas e indicadores.
11. Criar automações para trabalho repetitivo.
12. Usar IA como copiloto operacional.
13. Preparar a empresa para recorrência e pós-venda.
14. Permitir outras linhas de negócio sem destruir a especialização da assistência técnica.

---

# 3. REFERÊNCIAS DE MERCADO

Use como benchmark funcional, sem copiar código, layout ou propriedade intelectual:

### RepairShopr
Estudar conceitos de CRM, tickets, intake, anexos, assinatura, estimativas, faturamento, inventário, POS, compras de peças, marketing, portal do cliente, agendamento, relatórios e integrações.

### RepairDesk
Estudar ticketing, inventário, POS, compras, movimentações de estoque, serialização, notificações, agendamento, funcionários e métricas.

### Fixably
Estudar workflows de reparo, filas, automações, portal do cliente, comunicação baseada no caso, estoque, POS, contratos, documentos, integrações e API.

### Odoo
Estudar integração entre Helpdesk, Repair, Inventory, Sales, Accounting, Documents, Sign e Field Service.

### ERPNext
Estudar serialização, garantia, contratos/SLA, estoque, suporte, financeiro e rastreabilidade.

### ERPs brasileiros
Usar como referência de adequação ao mercado brasileiro: emissão fiscal, estoque, ordem de serviço, financeiro, vendas e particularidades operacionais.

Não tente copiar tudo. Extraia padrões que funcionam e melhore-os para um cenário de operador único + IA.

---

# 4. ARQUITETURA PROPOSTA

Preferência inicial:

Frontend:
- Next.js em versão estável atual;
- React;
- TypeScript;
- Tailwind CSS;
- biblioteca de componentes acessível e consistente;
- PWA/responsivo;
- suporte excelente para desktop e celular.

Backend:
- TypeScript;
- API REST bem documentada;
- arquitetura modular por domínio;
- validação forte com schemas;
- jobs assíncronos;
- eventos internos;
- Webhooks;
- filas quando necessário.

Banco:
- PostgreSQL.

Cache/filas:
- Redis quando houver necessidade real.

Arquivos:
- armazenamento S3-compatible ou Supabase Storage/objeto equivalente;
- metadata no PostgreSQL;
- arquivos privados por padrão;
- URLs assinadas para acesso controlado.

Busca:
- PostgreSQL full-text search inicialmente;
- pgvector para embeddings e RAG;
- possibilidade de Elasticsearch/OpenSearch futuramente se necessário.

Autenticação:
- sessões seguras/JWT conforme arquitetura;
- MFA opcional e preparado desde o início;
- RBAC;
- políticas por recurso.

Infra:
- Docker;
- Docker Compose para desenvolvimento e implantação inicial;
- reverse proxy;
- HTTPS;
- secrets via environment/secret manager;
- backups automáticos;
- logs estruturados;
- observabilidade.

AI:
- AI Gateway/Provider abstraction;
- Ollama;
- LM Studio;
- APIs OpenAI-compatible;
- tool calling;
- structured output;
- embeddings;
- RAG;
- agentes com permissões limitadas.

Automação:
- eventos internos + scheduler;
- n8n como camada opcional de automação externa/orquestração complexa;
- webhook inbound/outbound.

IMPORTANTE: não obrigar o uso do n8n para cada automação. Automatizações essenciais de domínio devem permanecer no próprio ERP para manter consistência, testes e confiabilidade.

---

# 5. PRINCIPAIS MÓDULOS

## 5.1 Dashboard Executivo

Criar dashboard diferente por perfil.

Para proprietário:
- faturamento hoje;
- faturamento do mês;
- margem estimada;
- contas a receber;
- contas vencidas;
- OS abertas;
- OS atrasadas;
- equipamentos aguardando diagnóstico;
- equipamentos aguardando aprovação;
- peças aguardando compra;
- serviços em andamento;
- agenda do dia;
- leads novos;
- taxa de conversão;
- ticket médio;
- tempo médio de reparo;
- taxa de retorno em garantia;
- produtos mais vendidos;
- serviços mais lucrativos;
- clientes sem contato recente;
- oportunidades de venda;
- alertas críticos.

Adicionar dashboard de IA:
- "O que merece minha atenção hoje?"
- "Quais OS estão em risco de atraso?"
- "Onde estou perdendo dinheiro?"
- "Quem está aguardando resposta?"
- "Quais clientes têm potencial de nova compra?"
- "Quais peças estão perto do ponto de reposição?"

---

# 6. CRM / CLIENTES

Cadastro completo:
- pessoa física/jurídica;
- nome/razão social;
- CPF/CNPJ;
- contatos;
- endereços;
- canais preferidos;
- tags;
- origem;
- observações;
- consentimentos;
- preferências;
- documentos;
- histórico financeiro;
- histórico de serviços;
- histórico de equipamentos;
- histórico de comunicações;
- contratos;
- oportunidades;
- tickets;
- vendas;
- garantias.

Criar timeline unificada:

Cliente
→ mensagens
→ ligações registradas
→ tickets
→ OS
→ orçamentos
→ vendas
→ pagamentos
→ documentos
→ garantias
→ contratos
→ campanhas
→ notas internas.

Adicionar classificação automática por IA:
- novo cliente;
- recorrente;
- VIP;
- inativo;
- alto potencial;
- alto risco de churn;
- oportunidade de upsell.

---

# 7. LEADS E PRÉ-ATENDIMENTO

Canais:
- site;
- WhatsApp;
- formulário;
- telefone;
- Instagram/Facebook quando disponível via integração;
- indicação;
- marketplace;
- atendimento presencial;
- importação manual.

Funções:
- captação de lead;
- origem/campanha;
- qualificação;
- classificação por IA;
- histórico de conversa;
- SLA de resposta;
- tarefas de follow-up;
- conversão em cliente;
- criação de oportunidade;
- criação de OS.

Agente de pré-atendimento:

Exemplo:
"Meu notebook liga mas não aparece imagem."

IA deve:
1. identificar categoria;
2. coletar sintomas;
3. fazer perguntas relevantes;
4. estimar prioridade;
5. sugerir triagem inicial;
6. indicar necessidade de atendimento presencial/remoto;
7. criar lead/ticket estruturado;
8. NÃO prometer diagnóstico definitivo sem inspeção técnica;
9. NÃO prometer preço definitivo sem regra configurada.

---

# 8. AGENDA E ATENDIMENTO

Criar agenda unificada:
- diagnóstico;
- entrega;
- retirada;
- visita técnica;
- consultoria;
- reunião de projeto;
- instalação;
- manutenção preventiva;
- impressão/produção;
- outros serviços.

Integração com Google Calendar.

Permitir:
- disponibilidade;
- bloqueios;
- duração estimada;
- confirmação;
- remarcação;
- lembretes;
- no-show;
- recorrência.

---

# 9. MÓDULO DE EQUIPAMENTOS / ATIVOS

Cada equipamento precisa ser uma entidade própria.

Tipos:
- notebook;
- desktop;
- workstation;
- servidor;
- smartphone/tablet futuro;
- impressora;
- monitor;
- periférico;
- equipamento especial;
- equipamento genérico.

Campos:
- fabricante;
- modelo;
- número de série;
- patrimônio;
- etiqueta interna;
- CPU;
- RAM;
- armazenamento;
- GPU;
- sistema operacional;
- acessórios entregues;
- estado físico;
- senha/informação sensível tratada de forma segura;
- fotos;
- data de compra;
- garantia;
- proprietário;
- localização;
- observações.

Criar histórico do ativo:
- compra;
- venda;
- assistência;
- troca de peças;
- upgrades;
- manutenção;
- garantia;
- diagnósticos;
- incidentes.

Possibilitar QR Code para abrir o ativo no ERP.

---

# 10. ORDEM DE SERVIÇO — CORE DO SISTEMA

A OS é o coração operacional.

Status configuráveis, com workflow:

1. Pré-cadastro
2. Aguardando recebimento
3. Recebido
4. Triagem
5. Diagnóstico
6. Aguardando orçamento
7. Orçamento enviado
8. Aguardando aprovação
9. Aprovado
10. Reprovado
11. Aguardando peça
12. Em reparo
13. Aguardando teste
14. Testando
15. Pronto
16. Aguardando retirada
17. Entregue
18. Pós-atendimento
19. Garantia
20. Cancelado
21. Sem reparo
22. Equipamento abandonado — conforme política aplicável.

Cada transição deve poder disparar:
- tarefa;
- notificação;
- e-mail;
- WhatsApp;
- atualização do cliente;
- atualização do financeiro;
- reserva/baixa de estoque;
- criação de documento;
- log;
- webhook;
- ação de IA.

## Intake da OS

Criar checklist profissional:
- estado externo;
- riscos;
- arranhões;
- tela;
- carcaça;
- parafusos;
- portas;
- carregador;
- bateria;
- acessórios;
- armazenamento;
- senha recebida ou pendente;
- backup solicitado;
- autorização de formatação;
- termos aceitos.

Fotos obrigatórias/configuráveis na entrada:
- frente;
- traseira;
- laterais;
- tela;
- componentes relevantes;
- acessórios.

Gerar termo de recebimento com fotos e aceite.

---

# 11. DIAGNÓSTICO TÉCNICO

Criar ambiente específico para diagnóstico.

Registrar:
- sintoma relatado;
- hipótese;
- testes realizados;
- resultado;
- evidências;
- peças testadas;
- medições;
- logs;
- comandos/resultados;
- fotos;
- vídeos;
- diagnóstico final;
- confiança do diagnóstico.

Permitir checklists por categoria:
- não liga;
- superaquecimento;
- lentidão;
- tela;
- armazenamento;
- memória;
- sistema operacional;
- rede;
- malware;
- upgrade;
- recuperação de dados;
- manutenção preventiva.

IA pode sugerir hipóteses e checklist, mas deve diferenciar:
- fato observado;
- resultado de teste;
- inferência;
- sugestão.

---

# 12. ORÇAMENTOS

Criar orçamento profissional.

Itens:
- mão de obra;
- peças;
- serviços terceirizados;
- deslocamento;
- diagnóstico;
- frete;
- desconto;
- impostos/taxas conforme configuração.

Permitir:
- validade;
- condição de pagamento;
- prazo estimado;
- garantia;
- observações;
- alternativas.

Criar propostas alternativas:
- Econômica;
- Recomendada;
- Premium.

Cliente pode aprovar/reprovar item por item quando permitido.

Ao aprovar:
- registrar prova de aceite;
- gerar evento;
- converter itens aprovados em plano de execução;
- reservar estoque quando apropriado;
- gerar cobrança quando aplicável.

IA pode transformar diagnóstico técnico em explicação clara para cliente.

Nunca mascarar incerteza técnica.

---

# 13. COMUNICAÇÃO COM CLIENTE

Criar central de comunicação.

Canais:
- WhatsApp Business/API quando disponível;
- e-mail;
- SMS;
- notificações web;
- portal do cliente.

Templates:
- recebimento;
- diagnóstico concluído;
- orçamento enviado;
- aprovação pendente;
- peça aguardada;
- reparo iniciado;
- pronto para retirada;
- pagamento pendente;
- garantia;
- pós-venda;
- pesquisa de satisfação;
- reativação.

A comunicação deve ser acionada por eventos e ter prevenção contra spam/duplicidade.

Registrar cada mensagem na timeline.

---

# 14. PORTAL DO CLIENTE

Criar portal seguro, mobile-first.

O cliente deve conseguir:
- acompanhar OS;
- ver status;
- ver orçamento;
- aprovar/reprovar;
- anexar documentos;
- enviar fotos;
- acompanhar prazo estimado;
- ver pagamentos;
- baixar documentos;
- consultar histórico;
- consultar garantia;
- abrir novo chamado;
- solicitar suporte;
- conversar com a empresa;
- avaliar atendimento.

Acesso preferencial por link mágico seguro, com autenticação apropriada para ações sensíveis.

---

# 15. DOCUMENTOS / GED

Criar um Document Management System integrado aos registros.

Tipos:
- contrato;
- orçamento;
- OS;
- termo de recebimento;
- termo de entrega;
- laudo;
- nota fiscal;
- comprovante;
- garantia;
- proposta;
- documentos de cliente;
- documentos de fornecedor;
- documentos internos;
- documentos de projetos de software;
- outros.

Recursos:
- upload;
- drag and drop;
- preview;
- versionamento;
- tags;
- pastas virtuais;
- entidade relacionada;
- controle de acesso;
- validade;
- expiração;
- assinatura eletrônica via provedor quando necessário;
- hash do arquivo;
- OCR;
- extração de dados;
- busca full-text;
- embeddings;
- RAG.

Evitar armazenar documentos diretamente em colunas do banco.

Banco guarda metadata + referência segura ao objeto.

Criar estrutura lógica:
/Clientes/{cliente}
/Equipamentos/{ativo}
/OS/{ano}/{os}
/Projetos/{projeto}
/Contratos/{contrato}
/Financeiro/{ano}
/Empresa/{categoria}

---

# 16. ASSINATURA E ACEITE

Criar camada de integração com provedores de assinatura eletrônica.

Suportar:
- assinatura simples;
- assinatura com múltiplos signatários;
- certificado/nível adicional por integração;
- evidências de aceite;
- IP, timestamp, hash e eventos conforme o provedor;
- certificado de conclusão quando fornecido pelo provedor.

Não presumir que uma assinatura desenhada na tela, isoladamente, satisfaça todas as necessidades jurídicas. O sistema deve permitir provedores adequados ao contexto jurídico e regulatório.

---

# 17. INVENTÁRIO

Controle profissional de estoque.

Cada produto deve poder possuir:
- SKU;
- código interno;
- código de barras;
- EAN/GTIN quando aplicável;
- descrição;
- marca;
- categoria;
- subcategoria;
- fornecedor;
- custo;
- preço;
- preço promocional;
- preço atacado;
- margem;
- unidade;
- estoque mínimo;
- estoque máximo;
- localização;
- lote;
- número de série;
- garantia;
- fornecedor preferencial.

Movimentações:
- entrada;
- saída;
- venda;
- uso em OS;
- devolução;
- transferência;
- ajuste;
- perda;
- avaria;
- reserva;
- consignação futura.

Alertas:
- estoque baixo;
- estoque zerado;
- excesso;
- produto parado;
- margem baixa;
- preço abaixo do custo;
- garantia próxima do vencimento.

---

# 18. COMPRAS E FORNECEDORES

Criar:
- cadastro de fornecedores;
- cotação;
- pedido de compra;
- recebimento;
- conferência;
- vínculo com OS;
- custo real;
- prazo;
- histórico de preço;
- desempenho do fornecedor.

IA pode sugerir compra com base em:
- consumo;
- OS abertas;
- lead time;
- estoque mínimo;
- histórico;
- previsão.

---

# 19. POS / VENDAS DE PRODUTOS

Criar PDV integrado ao estoque.

O ERP deve suportar venda de:
- hardware;
- periféricos;
- acessórios;
- cabos;
- suprimentos;
- itens para escritório/home office;
- produtos diversos permitidos pela estratégia comercial.

Não criar categorias rígidas que limitem novos segmentos.

Produto deve ser entidade genérica com taxonomia configurável.

Possibilitar:
- venda rápida;
- leitor de código de barras;
- venda por cliente;
- venda avulsa;
- orçamento;
- pedido;
- desconto;
- parcelamento;
- PIX;
- cartão;
- boleto quando aplicável;
- retirada;
- entrega;
- emissão fiscal via integração.

---

# 20. E-COMMERCE / MARKETPLACES

Preparar arquitetura para integração futura com:
- Mercado Livre;
- Shopee;
- Amazon;
- loja própria;
- Nuvemshop ou plataforma equivalente.

Criar camada de integração comum para:
- catálogo;
- estoque;
- preço;
- pedido;
- cliente;
- envio;
- tracking;
- cancelamento;
- devolução;
- sincronização de status.

Nunca acoplar o domínio de vendas diretamente à API de um marketplace.

---

# 21. FINANCEIRO

Criar financeiro operacional completo.

Contas:
- a receber;
- a pagar;
- caixa;
- banco;
- cartões;
- PIX;
- parcelamentos;
- recorrências;
- inadimplência;
- despesas;
- receitas;
- centros de custo;
- categorias financeiras.

Recursos:
- fluxo de caixa;
- DRE gerencial simplificada;
- margem por OS;
- margem por produto;
- margem por serviço;
- previsão de caixa;
- contas vencidas;
- conciliação futura;
- anexos de comprovantes.

Integrações de pagamento devem ser orientadas por API + webhook.

Criar adaptador de pagamentos, permitindo trocar fornecedor.

Priorizar integração brasileira, por exemplo, com provedores como Asaas e equivalentes.

---

# 22. FISCAL / BRASIL

Criar camada fiscal desacoplada.

Possibilitar integração com provedores especializados para:
- NF-e;
- NFC-e;
- NFS-e;
- outros documentos quando aplicável.

Não codificar regras tributárias rígidas diretamente no core.

Modelar:
- natureza da operação;
- regime tributário;
- produtos/serviços;
- CFOP;
- NCM;
- CST/CSOSN;
- ISS;
- retenções;
- alíquotas;
- município;
- estado;
- parametrizações do cliente/empresa.

As regras devem ser configuráveis e atualizáveis.

A integração deve suportar mudanças futuras da legislação sem grande refatoração.

---

# 23. SERVIÇOS PROFISSIONAIS

O ERP não deve ficar limitado a assistência técnica.

Criar módulo de serviços/projetos.

Tipos:
- consultoria;
- desenvolvimento de software;
- automação;
- IA;
- análise de dados;
- implantação;
- infraestrutura;
- suporte;
- impressão 3D;
- modelagem 3D;
- manutenção;
- treinamento.

Cada projeto pode possuir:
- cliente;
- contrato;
- escopo;
- orçamento;
- cronograma;
- tarefas;
- horas;
- custos;
- marcos;
- entregáveis;
- documentos;
- faturamento;
- atividades pós-venda.

Criar timesheet opcional.

---

# 24. CONTRATOS E RECORRÊNCIA

Suportar:
- contrato de manutenção;
- suporte mensal;
- consultoria recorrente;
- SLA;
- horas contratadas;
- franquia de atendimento;
- renovação;
- reajuste;
- vencimento;
- cobrança automática;
- cancelamento.

Criar alertas de:
- vencimento;
- renovação;
- horas restantes;
- SLA em risco;
- inadimplência.

---

# 25. GARANTIA / RMA

Cada reparo e venda deve poder definir garantia.

Registrar:
- período;
- início;
- fim;
- cobertura;
- exclusões;
- fornecedor responsável;
- peça;
- serviço;
- número de série.

Criar fluxo de garantia:

Cliente reclama
→ abertura de caso
→ validação da garantia
→ triagem
→ diagnóstico
→ decisão
→ reparo/troca/reembolso/crédito conforme política
→ conclusão
→ histórico.

Criar indicadores de reincidência e falha por peça/fornecedor/técnica.

---

# 26. PÓS-ATENDIMENTO / CUSTOMER SUCCESS

Não considerar o atendimento encerrado na entrega.

Criar automações:
- mensagem pós-entrega;
- pedido de avaliação;
- lembrete de garantia;
- manutenção preventiva;
- limpeza periódica;
- upgrade sugerido;
- acessórios compatíveis;
- renovação de contrato;
- reativação de clientes;
- aniversário da empresa/cliente quando apropriado;
- campanha segmentada.

IA deve encontrar oportunidades de pós-venda com base no histórico.

---

# 27. MARKETING E CRM COMERCIAL

Criar:
- funil;
- oportunidades;
- campanhas;
- segmentos;
- tags;
- origem do lead;
- taxa de conversão;
- CAC quando houver dados suficientes;
- LTV estimado;
- ticket médio;
- recompra;
- churn.

Permitir automações por evento.

Exemplo:
Cliente realizou formatação há 10 meses
→ IA identifica oportunidade de manutenção
→ cria tarefa/follow-up
→ prepara mensagem
→ operador aprova
→ envia.

---

# 28. IA — COPILOTO OPERACIONAL

Criar um assistente global no ERP.

Ele deve responder perguntas usando dados autorizados.

Exemplos:
- "Mostre todas as OS atrasadas."
- "Quais clientes estão aguardando orçamento?"
- "Qual serviço teve maior margem este mês?"
- "Quais peças preciso comprar?"
- "Resuma o histórico deste cliente."
- "Explique este diagnóstico em linguagem simples."
- "Prepare uma mensagem para este cliente."
- "Crie uma proposta com três opções."
- "Encontre clientes que podem precisar de upgrade."

O assistente não deve inventar dados.

Quando não encontrar evidência:
"Não encontrei informação suficiente no sistema."

---

# 29. IA — AGENTES ESPECIALIZADOS

Criar arquitetura para agentes especializados.

### Agent 1 — Intake Agent
Coleta informações do atendimento.

### Agent 2 — Triage Agent
Classifica urgência, categoria e próximos passos.

### Agent 3 — Diagnostic Copilot
Sugere hipóteses/checklists usando base interna, manuais e histórico.

### Agent 4 — Customer Communication Agent
Converte informações técnicas em comunicação clara.

### Agent 5 — Sales Agent
Identifica oportunidades e cria propostas.

### Agent 6 — Procurement Agent
Sugere compras.

### Agent 7 — Finance Agent
Resume caixa, contas e riscos; nunca realiza ações financeiras críticas sem aprovação.

### Agent 8 — Follow-up Agent
Busca clientes/casos sem próxima ação.

### Agent 9 — Knowledge Agent
Pesquisa documentos, manuais, contratos, SOPs e histórico via RAG.

### Agent 10 — Executive Analyst
Gera resumo diário do negócio.

---

# 30. AI TOOLING

Criar ferramentas explícitas, com schemas fortes.

Exemplos:
- `get_customer`
- `get_customer_history`
- `get_asset`
- `get_repair_order`
- `search_repair_orders`
- `get_inventory`
- `search_products`
- `check_stock`
- `create_quote_draft`
- `create_task`
- `prepare_customer_message`
- `send_customer_message`
- `create_payment_link`
- `get_payment_status`
- `create_purchase_order_draft`
- `search_documents`
- `retrieve_document_content`
- `search_knowledge_base`
- `get_financial_summary`
- `get_calendar_availability`
- `create_calendar_event`

Toda tool deve possuir:
- nome;
- descrição;
- input schema;
- output schema;
- permissões necessárias;
- nível de risco;
- idempotência;
- auditoria;
- tratamento de erros.

---

# 31. RAG / BASE DE CONHECIMENTO

Criar Knowledge Base.

Fontes:
- manuais técnicos;
- PDFs;
- procedimentos internos;
- políticas;
- contratos;
- documentação de produtos;
- FAQ;
- conhecimento técnico interno;
- histórico de casos aprovados;
- documentos de fornecedores.

Pipeline:

Upload
→ malware/security check quando aplicável
→ extração
→ OCR se necessário
→ limpeza
→ chunking
→ embeddings
→ indexação
→ metadata
→ busca híbrida
→ reranking quando aplicável
→ geração com citações internas.

A IA deve informar de qual documento veio a informação quando responder baseado na base interna.

---

# 32. SEGURANÇA

Implementar:
- RBAC;
- princípio do menor privilégio;
- MFA preparado;
- rate limiting;
- CSRF/XSS/SQLi defenses;
- validação server-side;
- proteção contra upload malicioso;
- antivírus quando necessário;
- criptografia em trânsito;
- criptografia de dados sensíveis quando aplicável;
- secrets fora do código;
- logs de auditoria;
- backups;
- restauração testada;
- retenção configurável;
- soft delete onde apropriado;
- hard delete somente em fluxos controlados;
- segregação de dados por organização/tenant.

Nunca registrar senhas de equipamentos em texto puro se existir alternativa segura.

Não armazenar segredos em logs.

---

# 33. LGPD / PRIVACIDADE

Criar fundamentos para:
- finalidade;
- consentimento quando aplicável;
- base legal configurável;
- minimização;
- retenção;
- anonimização quando possível;
- exportação de dados;
- atendimento de solicitações do titular;
- registro de processamento;
- política de acesso;
- logs.

Não tratar LGPD como banner de cookie. Ela deve influenciar arquitetura, dados, acesso e retenção.

---

# 34. RELATÓRIOS / BI

Criar relatórios:

Operacionais:
- OS por status;
- tempo médio;
- atrasos;
- produtividade;
- reincidência;
- garantia;
- peças usadas.

Comerciais:
- faturamento;
- ticket médio;
- conversão;
- origem de lead;
- clientes novos;
- recompra;
- produtos;
- serviços.

Financeiros:
- receita;
- despesas;
- margem;
- fluxo de caixa;
- contas a receber;
- inadimplência;
- lucratividade.

Estoque:
- giro;
- estoque parado;
- margem;
- perdas;
- ruptura;
- compras.

Executivos:
- visão 7/30/90 dias;
- tendências;
- alertas;
- anomalias.

---

# 35. ALERTAS INTELIGENTES

Criar central de alertas.

Exemplos:
- OS prestes a vencer;
- orçamento parado;
- cliente esperando resposta;
- pagamento atrasado;
- estoque crítico;
- peça atrasada;
- fornecedor atrasado;
- margem negativa;
- cliente recorrente sem contato;
- garantia próxima do vencimento;
- contrato perto da renovação.

IA deve priorizar alertas por impacto, não somente por data.

---

# 36. BUSCA GLOBAL

Criar busca global rápida.

Pesquisar por:
- cliente;
- CPF/CNPJ;
- telefone;
- e-mail;
- OS;
- número de série;
- SKU;
- produto;
- documento;
- contrato;
- projeto;
- tag.

Busca natural:
"notebooks recebidos este mês que ainda aguardam peça".

---

# 37. WORKFLOW ENGINE

Criar motor configurável de automação.

Estrutura:
TRIGGER → CONDITIONS → ACTIONS → RETRIES → AUDIT.

Triggers:
- criação;
- atualização;
- mudança de status;
- data;
- tempo decorrido;
- webhook;
- pagamento;
- estoque;
- formulário;
- mensagem recebida;
- IA.

Actions:
- criar tarefa;
- enviar mensagem;
- gerar documento;
- criar cobrança;
- criar evento;
- alterar status;
- adicionar tag;
- reservar estoque;
- criar alerta;
- chamar webhook;
- executar agente.

Ter mecanismo de idempotência para evitar automações duplicadas.

---

# 38. INTEGRAÇÕES PRIORITÁRIAS

Criar arquitetura de adapters.

Prioridade:

1. Google Calendar.
2. WhatsApp/API oficialmente disponível.
3. E-mail SMTP/API.
4. Asaas ou gateway semelhante.
5. Provedor fiscal.
6. Google Drive/Storage ou equivalente opcional.
7. Mercado Livre.
8. Nuvemshop/e-commerce.
9. n8n.
10. Ollama.
11. LM Studio.
12. APIs LLM comerciais.

Adicionar outras integrações por plugin/adaptor sem alterar o núcleo.

---

# 39. API FIRST

Tudo relevante deve ser acessível por API interna documentada.

Criar:
- OpenAPI;
- autenticação;
- versionamento;
- pagination;
- filtering;
- sorting;
- idempotency keys;
- webhooks;
- API keys para integrações;
- logs.

Criar também webhooks de saída para entidades importantes.

---

# 40. EVENT-DRIVEN DOMAIN

Criar eventos internos como:

`customer.created`
`lead.created`
`lead.converted`
`asset.received`
`repair.created`
`repair.status_changed`
`quote.created`
`quote.approved`
`quote.rejected`
`part.required`
`purchase.received`
`repair.completed`
`repair.delivered`
`payment.created`
`payment.confirmed`
`payment.failed`
`warranty.opened`
`document.uploaded`
`contract.expiring`
`task.overdue`

Eventos devem ser observáveis e testáveis.

---

# 41. UX / UI

A interface deve parecer um software premium de operação empresarial.

Princípios:
- clareza;
- velocidade;
- baixa fricção;
- densidade informacional controlada;
- atalhos de teclado;
- command palette;
- busca global;
- ações rápidas;
- responsividade;
- acessibilidade;
- empty states úteis;
- feedback visual;
- prevenção de erro;
- histórico claro.

Tela de OS deve permitir trabalhar por horas sem sensação de burocracia.

Criar atalhos:
- nova OS;
- novo cliente;
- nova venda;
- novo orçamento;
- registrar pagamento;
- abrir busca;
- abrir assistente IA.

---

# 42. DOCUMENTOS GERADOS

Criar templates profissionais para:
- OS;
- orçamento;
- recibo;
- termo de entrada;
- termo de entrega;
- laudo técnico;
- garantia;
- contrato;
- proposta comercial;
- relatório de atendimento;
- comprovante de pagamento.

Permitir template por empresa, marca, unidade e tipo de documento.

---

# 43. CONFIGURAÇÕES

Admin deve configurar:
- dados da empresa;
- identidade visual;
- usuários;
- cargos;
- permissões;
- status;
- categorias;
- serviços;
- produtos;
- preços;
- descontos;
- garantias;
- SLAs;
- impostos;
- integrações;
- provedores IA;
- modelos;
- automações;
- templates;
- notificações;
- retenção;
- backups;
- parâmetros de segurança.

---

# 44. MODO SOLO OPERATOR

Como o sistema começa sendo operado por uma única pessoa, criar um modo especial que:
- reduza cliques;
- consolide tarefas;
- mostre apenas o necessário;
- sugira próxima ação;
- permita aprovar lotes de ações de baixo risco;
- use automações agressivamente, porém de maneira auditável;
- gere resumo diário.

Criar "Minha fila de hoje":

URGENTE
→ tarefas críticas

PRÓXIMOS
→ atendimentos

AGUARDANDO TERCEIROS
→ peças/clientes/fornecedores

OPORTUNIDADES
→ vendas/pós-venda

FINANCEIRO
→ cobranças

ROTINAS
→ tarefas administrativas.

---

# 45. DAILY AI BRIEFING

Gerar automaticamente um briefing diário:

"Bom dia. Hoje você tem X atendimentos. Existem Y OS em risco. Z clientes aguardam retorno. Há R$ N em cobranças vencidas. Duas peças críticas precisam ser compradas. Três oportunidades comerciais merecem atenção."

Cada informação deve levar ao registro correspondente.

---

# 46. MEMÓRIA OPERACIONAL

A IA deve lembrar, através do banco/RAG autorizado:
- preferências do cliente;
- histórico;
- equipamentos;
- soluções que funcionaram;
- problemas recorrentes;
- políticas internas.

Não utilizar memória implícita do modelo como fonte oficial.

A fonte oficial é o banco/knowledge base auditável.

---

# 47. OBSERVABILIDADE

Implementar:
- logs estruturados;
- métricas;
- traces quando justificável;
- health checks;
- monitoramento de jobs;
- monitoramento de integrações;
- alertas de falha;
- dashboard técnico.

Registrar duração e falhas das chamadas de IA.

Métricas de IA:
- custo estimado;
- latência;
- tokens;
- taxa de erro;
- modelo;
- provider;
- tool calls;
- taxa de aprovação humana;
- resultados rejeitados.

---

# 48. TESTES

Obrigatório:
- unit tests;
- integration tests;
- API tests;
- workflow tests;
- permission tests;
- AI tool tests;
- E2E;
- testes de idempotência;
- testes de backup/restore;
- testes de segurança fundamentais.

Toda regra financeira, estoque ou transição crítica deve possuir testes.

Criar dados seed para ambiente de demonstração.

---

# 49. MIGRAÇÕES E DADOS

Banco deve usar migrations.

Nunca alterar estrutura manualmente em produção sem migration versionada.

Criar:
- seed;
- fixtures;
- importador CSV;
- exportador;
- backups;
- restore procedure.

Permitir importação futura de clientes, produtos, estoque e histórico.

---

# 50. MULTI-TENANCY

Projetar desde o início para organização/tenant.

Mesmo que a primeira instalação use uma única empresa, a estrutura deve permitir expansão.

Todas as entidades de negócio devem respeitar isolamento por organização.

---

# 51. ROADMAP DE IMPLEMENTAÇÃO

Não tente construir tudo de uma vez.

## Fase 1 — Foundation
- arquitetura;
- auth;
- RBAC;
- organizações;
- auditoria;
- PostgreSQL;
- Storage;
- design system;
- API;
- Docker;
- observabilidade básica.

## Fase 2 — Core ERP
- clientes;
- equipamentos;
- OS;
- intake;
- diagnóstico;
- orçamento;
- documentos;
- portal;
- notificações.

## Fase 3 — Inventory + Sales
- produtos;
- estoque;
- compras;
- fornecedores;
- vendas;
- POS.

## Fase 4 — Finance
- contas;
- pagamentos;
- cobranças;
- fluxo de caixa;
- integração de pagamento.

## Fase 5 — Fiscal + Integrations
- NF-e/NFC-e/NFS-e via provider;
- WhatsApp;
- Google Calendar;
- marketplaces.

## Fase 6 — Professional Services
- projetos;
- tarefas;
- contratos;
- SLA;
- timesheet;
- recorrência.

## Fase 7 — AI Platform
- AI Gateway;
- local models;
- tool calling;
- RAG;
- agents;
- approvals;
- daily briefing.

## Fase 8 — Intelligence
- BI;
- previsão;
- recomendações;
- detecção de anomalias;
- otimização de estoque;
- scoring de cliente.

---

# 52. CRITÉRIOS DE ACEITAÇÃO

Antes de considerar qualquer módulo concluído, comprovar:

1. fluxo funcional completo;
2. validação server-side;
3. permissões;
4. auditoria;
5. testes;
6. tratamento de erro;
7. loading states;
8. empty states;
9. responsive;
10. acessibilidade básica;
11. logs;
12. documentação;
13. migrations;
14. seed;
15. integração com eventos quando relevante.

---

# 53. COMO O AGENTE DE DESENVOLVIMENTO DEVE TRABALHAR

Não gerar milhares de linhas de código de uma vez sem validar a arquitetura.

Sequência obrigatória:

1. analisar requisitos;
2. identificar ambiguidades;
3. criar ADRs quando decisões importantes forem tomadas;
4. criar modelo de domínio;
5. criar schema de banco;
6. definir APIs;
7. criar design system;
8. implementar slice vertical pequeno;
9. testar;
10. validar;
11. integrar;
12. documentar;
13. avançar.

Sempre preferir uma fatia vertical funcionando a dezenas de telas desconectadas.

---

# 54. SAÍDA ESPERADA DO AGENTE

Em cada etapa, apresentar:

### Contexto
O que será implementado.

### Decisões
Principais decisões arquiteturais e por quê.

### Alterações
Arquivos e módulos criados/modificados.

### Banco
Migrations e alterações.

### API
Endpoints e schemas.

### UI
Telas/componentes.

### Automação
Eventos/jobs/workflows.

### IA
Modelos, prompts, tools, permissões e fallback.

### Testes
Testes executados e resultados.

### Riscos
Problemas conhecidos.

### Próxima etapa
Próximo incremento recomendado.

---

# 55. REGRAS ESPECIAIS DE IA

Nunca inventar preço, estoque, diagnóstico, prazo ou dados financeiros.

Nunca afirmar que uma ação foi executada sem confirmação real da ferramenta.

Separar claramente:
- observação;
- dado do banco;
- inferência;
- recomendação.

Quando uma ferramenta falhar, informar o erro de forma controlada.

Quando faltar contexto, fazer a menor quantidade necessária de perguntas e ainda apresentar uma solução provisória segura.

---

# 56. RESULTADO FINAL DESEJADO

O resultado deve ser um ERP que faça o operador pensar menos em administração e mais em entregar serviço.

O sistema deve saber:
- quem é o cliente;
- qual equipamento pertence a ele;
- o que aconteceu;
- quando aconteceu;
- quem fez;
- qual diagnóstico foi obtido;
- quais peças foram usadas;
- quanto custou;
- quanto foi cobrado;
- se foi pago;
- qual garantia existe;
- quais documentos foram produzidos;
- o que o cliente precisa agora;
- qual é a próxima ação.

A experiência ideal é:

"Abri o sistema e ele já me mostrou o que importa, preparou o trabalho repetitivo, organizou a operação e deixou para mim somente as decisões que realmente exigem julgamento humano."

---

# 57. PRIMEIRA MISSÃO DO AGENTE

Antes de escrever código:

1. transforme este documento em Product Requirements Document (PRD);
2. produza arquitetura lógica;
3. produza mapa de módulos;
4. produza mapa de entidades e relacionamentos;
5. produza matriz de permissões;
6. produza mapa de integrações;
7. produza matriz de agentes IA e ferramentas;
8. produza matriz de automações;
9. produza roadmap MVP → V1 → V2;
10. identifique inconsistências e decisões ainda abertas;
11. proponha soluções sem bloquear o projeto;
12. somente depois comece a implementação.

Prioridade máxima: qualidade arquitetural, segurança, consistência dos dados e velocidade operacional.

Não transformar o sistema em um amontoado de funcionalidades. Tudo deve possuir uma justificativa operacional, uma entidade de domínio e um fluxo claro.

Fim do Prompt Mestre.
