# 08 — Guia Estratégico de Fornecedores (MEI, Assistência Técnica, Revenda & 3D)

> **Objetivo:** Centralizar a análise prática de fornecedores B2B no Brasil para operação com **CNPJ MEI**, equilibrando compra em distribuidoras oficiais (com NF-e e RMA direto) e oportunidades pontuais em marketplaces PF via comparador interno do **AL Business OS** (`/app/inventory → Cotação B2B vs. Marketplace PF`).

---

## 1. Pré-requisitos Cadastrais e Fiscais (Antes de Enviar Pedidos)

Grande parte das distribuidoras de tecnologia valida automaticamente o CNPJ na Receita Federal e na SEFAZ estadual antes de liberar login e tabela de revenda:

1. **CNAE Compatível:** Para comprar componentes/equipamentos para revenda, o MEI precisa conter CNAE de comércio (ex.: `4751-2/01` — *Comércio varejista especializado de equipamentos e suprimentos de informática*), além do CNAE de serviço (`9511-8/00` — *Reparação e manutenção de computadores e de equipamentos periféricos*).
2. **Inscrição Estadual (IE) Ativa:** No estado do RJ (e maioria dos estados), MEI que possui apenas CNAE de serviços costuma ser isento de IE — o que **bloqueia faturamento B2B com ICMS-ST** na maioria das distribuidoras. Confirme se sua IE está ativa na SEFAZ antes de aplicar nos distribuidores *Tier 1*.
3. **Dossiê Padrão para Cadastro (Tenha em PDF/Pasta):**
   - Cartão CNPJ e Certificado da Condição de Microempreendedor Individual (CCMEI).
   - Consulta Sintegra / CCC mostrando Inscrição Estadual ativa.
   - Comprovante de endereço comercial, documento do titular, e-mail profissional (`contato@seudominio`) e telefone/WhatsApp comercial.

---

## 2. Mapa de Fornecedores por Perfil e Compatibilidade com MEI

### Grupo A — Distribuidores Gerais de Hardware (Mais Amigáveis ao MEI)

| Fornecedor | Aceitação MEI | Pontos Fortes | Observações Práticas |
|---|---|---|---|
| **Agis Distribuição** | **Alta** (aceita MEI com CNAE compatível; análise rápida) | Catálogo amplo (+80 marcas: ASUS, Acer, Lenovo, HP, Kingston, Logitech); CDs em Campinas/SP e Serra/ES. | Excelente candidato a distribuidor principal para equipamentos de marca, SSDs e periféricos. |
| **Mazer Distribuidora** | **Alta** (possui opção explícita `MEI` no cadastro; exige IE ativa) | Notebooks, PCs, componentes, linha gamer, energia e conectividade (atua desde 1997). | Ótima para comparar preços de componentes e ofertas pontuais de hardware. |
| **Fujioka Distribuidor** | **Muito Alta** (política aberta para MEI tanto para revenda quanto consumo) | Notebooks, monitores, smartphones, periféricos e itens de giro rápido. | Baixa barreira de entrada; útil para validar primeiros pedidos B2B rapidamente. |
| **Hayamax** | **Alta** | Acessórios, cabos, periféricos, áudio, energia (Fortrek e outras) e opção de *cross-docking*. | Ideal para ampliar mix de balcão sem imobilizar capital em estoque pesado. |
| **Aldo** | **Alta** | Forte em infraestrutura/energia e portfólio selecionado de TI para integradores MEI. | Útil quando houver projetos de energia/nobreak ou equipamentos corporativos específicos. |

---

### Grupo B — Especialistas em Peças de Manutenção (Notebooks & Bancada)

Fornecedores de peças específicas de reparo costumam atender muito bem assistências técnicas MEI, sendo indispensáveis no dia a dia da bancada:

| Fornecedor | Especialidade | Por que cadastrar |
|---|---|---|
| **bringIT (`b2b.bringit.com.br`)** | Telas LED/IPS, baterias, fontes, teclados, coolers e SSDs | Portal B2B dedicado para técnicos e lojistas; entrega ágil e catálogo segmentado por modelo de notebook. |
| **BB Baterias (`bbbaterias.com.br`)** | Baterias, carregadores, teclados e telas | Canal de revenda com descontos progressivos para assistências técnicas e suporte de compatibilidade. |
| **ELGScreen / NotebookParts / Ibyte Atacado** | Telas, dobradiças, carcaças e peças avulsas | Redundância fundamental quando uma tela ou teclado específico estiver em falta na bringIT/BB. |

---

### Grupo C — Estúdio de Impressão 3D (`mod-3d-print`)

Para garantir margem recorrente em peças técnicas, suportes, cases e prototipagem sob demanda:

| Fornecedor | Foco | Observações |
|---|---|---|
| **3DLab** | Filamentos PLA, PETG, ABS e resinas técnicas | Bom padrão dimensional, tabela comercial e consistência de cores para lote repetitivo. |
| **Voolt3D** | Filamentos de linha técnica e engenharia | Forte presença nacional com canal direto/revenda para estúdios 3D. |
| **GTMax3D / Slim3D** | Filamentos, bicos, mesas PEI e peças de reposição de impressoras | Úteis tanto para insumo quanto para manutenção de impressoras 3D de clientes (`checklist impressora-3d`). |

---

### Grupo D — Distribuidores Corporativos / Restrições Iniciais para MEI

Mantenha no radar, mas **não dependa apenas deles na fase inicial**:
- **All Nations:** Excelente presença no RJ e ótima logística regional, porém o atacado tradicional costuma exigir IE rigorosa, histórico ou perfil tributário além do MEI inicial (consulte modalidades de *faturamento direto*).
- **Oderço:** Muito forte em montagem gamer, fontes, placas-mãe e marcas próprias (PCYes, Vinik), mas o cadastro direto frequentemente restringe MEI/Simples pequeno por regras de ICMS-ST interestadual.
- **Pauta Distribuição / Tiburon / Star Mídia Tech / Golden / Fujioka:** Bons candidatos para ampliar cotação comparativa assim que a IE estiver ativa e validada.
- **Ingram Micro & TD SYNNEX:** *Tier-1* corporativo (servidores, licenciamento, projetos enterprise). Fazem mais sentido ao migrar para ME ou fechar contratos B2B maiores.

---

## 3. Regra de Ouro: B2B vs. Marketplace PF & Precificação Segura

1. **Nunca compre no impulso sem calcular o Custo Posto (*Landed Cost*):**
   $$\text{Custo Posto Unitário} = \text{Preço Unitário} + \frac{\text{Frete} + \text{Impostos/ST}}{\text{Quantidade}}$$
   Muitas vezes uma promoção no **Mercado Livre Full / Amazon / KaBuM! (compra PF)** sai mais barata para 1–2 unidades que um distribuidor B2B com frete e ST. Use sempre a aba **Cotação B2B vs. Marketplace PF** em `/app/inventory` para decidir com dados.
2. **Quando priorizar Distribuidor B2B mesmo empatado:**
   - Precisa de **NF-e de entrada** para revender com nota fiscal emitida para cliente PJ.
   - Compra recorrente de **alto valor** (SSDs, memórias, fontes, notebooks) exigindo procedência e garantia/RMA rastreável.
3. **Estratégia "Paciente VIP da Loja":**
   - Equipamentos e PCs montados/vendidos pela sua loja devem ser marcados no cadastro de ativos como **Adquirido na Loja (VIP -20% na manutenção)** (`acquiredFromStore: true`), aumentando conversão de hardware e fidelizando manutenções preventivas recorrentes.
4. **Fórmula de Preço de Venda com Margem Protegida:**
   $$\text{Preço de Venda} = \frac{\text{Custo Real Total (Peça + Frete + Taxas)}}{1 - \text{Margem Desejada}}$$

---

## 4. Roteiro Pronto de Primeiro Contato Comercial (WhatsApp / E-mail)

> *"Olá, equipe comercial! Sou [Seu Nome], responsável pela [Nome da Empresa] (CNPJ MEI [XX.XXX.XXX/0001-XX], IE [Número], atuação em assistência técnica de informática, manutenção e revenda de hardware/TI no interior do RJ). Gostaria de concluir nosso cadastro de revenda para iniciar cotações recorrentes. Poderiam confirmar:*
> *1. Documentos necessários para liberação de acesso B2B para MEI com IE?*
> *2. Existe pedido mínimo inicial ou faixa para frete grátis para nossa região?*
> *3. Como funciona o prazo de análise, formas de pagamento (PIX/boleto) e política de RMA/garantia?*
> *Obrigado!"*
