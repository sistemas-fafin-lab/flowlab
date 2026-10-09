# Plano — Módulo Gastos de TI (base de despesas + dashboard FinOps)

> **Status:** 🚀 **Pronto para subir** (roteiro na §14). **Pronto no código, em conferência.** Fases 0 a 3 concluídas em 01/Out/2026 (issues 01 a 13), Fase 4 em 05/Out/2026 (issues 14 a 16). Migrations das Fases 1 e 2 aplicadas; a da Fase 4 (`20261009170000_gastos_ti_orcamentos.sql`) ainda não. Os widgets do dashboard foram conferidos com dados fictícios num harness, nos temas claro e escuro; falta conferir com dados reais no navegador.
> **Área:** Tecnologia — novo subitem do menu "Tecnologia", ao lado de Hub de Aplicações, Board e Mind Map.
> **Criado em:** 30/Set/2026. **Revisado em:** 30/Set/2026, com as decisões D2, D3, D5, D6, D13 e D14 fechadas com o usuário.
> **Issues:** `.scratch/gastos-ti/spec.md` e `.scratch/gastos-ti/issues/01` a `16`.

---

## 0. Objetivo

Dar à TI um lugar único para **registrar tudo o que ela gasta** e **enxergar esse gasto como FinOps**: quanto a TI custa por mês hoje, para onde vai o dinheiro, o que vence e renova, e onde o realizado fugiu do previsto.

Entregáveis:
1. **Base de despesas**: cadastro de despesas com recorrência, valor, fornecedor, forma de pagamento e quem autorizou, mais o registro do que foi efetivamente pago mês a mês.
2. **Dashboard FinOps**: KPIs, evolução mensal, quebras por categoria, fornecedor e setor, projeção, renovações e alertas, com a mesma identidade visual dos dashboards de TI atuais (`ITHubDashboard`).

---

## 1. Glossário do módulo

Três conceitos que o módulo inteiro usa e que não podem se confundir:

| Termo | O que é | Exemplo |
|---|---|---|
| **Despesa** | O compromisso cadastrado: o que se paga, a quem, quanto, com que recorrência e quem autorizou. | "Microsoft 365 Business Standard, 40 licenças, mensal, R$ 2.480" |
| **Ocorrência** | Cada cobrança **prevista** de uma despesa numa competência. É **calculada** a partir da recorrência, e só é gravada quando alguém mexe nela. | "M365, competência out/2026, vence 10/10, R$ 2.480" |
| **Lançamento** | O registro gravado de uma ocorrência que alguém tocou: teve a previsão **ajustada**, foi **paga** ou foi **dispensada**. | "M365 out/2026 paga em 09/10, R$ 2.536,40, NF 1234" |
| **Ajuste** | Mudança de uma ocorrência **só naquele mês** (valor, vencimento, forma de pagamento), sem mexer na despesa. | "AWS de out/2026 vai vir R$ 3.900, não os R$ 3.200 estimados" |
| **Reajuste** | Mudança de valor de uma despesa **daquele mês em diante**, sem reescrever o passado. | "M365 passa a R$ 2.600 a partir de jan/2027" |
| **Competência** | O mês a que a cobrança se refere, gravado como o primeiro dia do mês (`2026-10-01`) e exibido como "out/2026". | — |

---

## 2. Decisões a confirmar

| # | Decisão | Recomendação / resolução | Bloqueia |
|---|---|---|---|
| **D1** | Nome e rota do módulo | **"Gastos de TI"** em **`/it/gastos`**. "Controle de Custos" já existe (`/cost-control`, custo de exames, `App.tsx:245-252`), e o menu agrupa itens pelo nome, então um nome repetido quebra o agrupamento. | — |
| **D2** | Permissões | ✅ **Resolvido (30/Set): duas chaves novas.** `canViewGastosTI` (só leitura: dashboard e listas) e `canManageGastosTI` (cadastrar, ajustar, dar baixa, orçamento, categorias). `canManageIT` não é reaproveitada: ela libera o Board e o Hub para o time técnico, que não precisa ver contratos e valores. | Fase 0 |
| **D3** | Quem autorizou | ✅ **Resolvido (30/Set): campo de texto livre** com o nome de quem autorizou, obrigatório. A data da autorização fica como campo opcional. Para o mesmo nome não aparecer escrito de várias formas ("João", "Joao S.") e dividir o filtro, o campo sugere os nomes já digitados antes. A sugestão não obriga nada: continua sendo texto livre. | Fase 1 |
| **D4** | Fornecedor | **Reusar `suppliers`** (FK opcional + nome copiado no cadastro). `suppliers` tem DELETE físico (`useInventory.ts:1184`), por isso o nome copiado é obrigatório. Cadastro rápido (nome + CNPJ) direto do formulário. | — |
| **D5** | Categorias | ✅ **Resolvido (30/Set): categorias expansíveis.** Qualquer usuário com `canManageGastosTI` cria categorias novas a qualquer momento, inclusive sem sair do formulário da despesa. São 8 iniciais, **uma delas só para Inteligência Artificial** (§4.1). Cor nos gráficos: a paleta validada tem 8 cores, e cada categoria recebe uma pela **ordem** definida na tela de categorias, nunca pelo ranking de valor. Da 9ª em diante, a categoria aparece com nome próprio nos gráficos de barras e na tabela, e somada em "Outros" (cinza) só no gráfico empilhado. Para dar cor própria a uma categoria nova, basta subi-la na ordem. | Fase 1 |
| **D6** | Como a recorrência vira cobrança | ✅ **Resolvido (30/Set): previsão calculada, com total margem para edição ao longo do mês.** As ocorrências saem de uma função pura a partir da despesa e dos reajustes, sem cron e sem gerar linhas futuras. Qualquer ocorrência pode ser ajustada (valor, vencimento, forma de pagamento), paga, dispensada ou ter a baixa editada ou desfeita, em qualquer mês. A linha só é gravada no primeiro toque (RN15). Nada fica travado: tudo vai para a auditoria. | Fase 1 |
| **D7** | Formas de pagamento | Lista própria da TI: **PIX, Boleto, Cartão corporativo, Débito automático, Transferência, Outro**. A lista de `payment_requests` (PIX/Dinheiro/Boleto/Caju/Solides, `paymentUtils.ts:235-241`) não serve: Caju e Solides são benefícios e não há cartão. Campo livre opcional para identificar o meio (ex.: "cartão final 1234"). | — |
| **D8** | Moeda | **Tudo em R$.** Serviços cobrados em dólar (cloud, SaaS) guardam o valor **pago em R$**; moeda e valor originais ficam como informação, sem conversão automática. | — |
| **D9** | Setor beneficiado | **Um setor por despesa** na v1, usando a lista `DEPARTMENTS` (`permissions.ts:122-138`). Rateio percentual entre setores (ex.: M365 dividido por licenças) fica para depois. | — |
| **D10** | Orçamento | **Anual por categoria**, distribuído igualmente pelos 12 meses. Entra na Fase 4. | Fase 4 |
| **D11** | Aprovação | **v1 registra quem autorizou, sem fluxo de aprovação.** Um fluxo com alçadas por valor pode reaproveitar `approval_level_config`/`user_approval_limits` depois. | — |
| **D12** | Relação com Solicitações de Pagamento | **v1 independente.** Parte do gasto de TI pode já passar por `payment_requests` (departamento "TI"). Vincular um lançamento a uma solicitação de pagamento, para não digitar duas vezes, fica para depois. | — |
| **D13** | Carga inicial | ✅ **Resolvido (30/Set): não existe planilha hoje.** O modelo de importação é desenhado neste plano (§7.1), e a carga inicial parte dele ou do cadastro manual. | Fase 2 |
| **D14** | Quem recebe as chaves | ✅ **Resolvido (30/Set): nenhum cargo recebe as chaves na implantação.** As migrations **não** gravam nada em `custom_roles`. Depois de implementado, o usuário atribui `canViewGastosTI`/`canManageGastosTI` manualmente em Usuários › Cargos. Até lá, **só admin enxerga o módulo** (no banco, `current_user_has_permission()` só olha `custom_roles.permissions` ou `role = 'admin'`). | — |

> Todas as decisões que afetavam schema, escopo ou implantação estão fechadas. As que seguem só com recomendação (D1, D4, D7–D12) têm padrão seguro e podem ser revistas durante a implementação.

---

## 3. Requisitos

### 3.1 Funcionais — Base de despesas (Fase 1)

| ID | Requisito |
|---|---|
| **RF01** | Cadastrar despesa com: descrição, categoria, fornecedor, valor, tipo de valor (fixo ou variável), recorrência, competência inicial, competência final (opcional), dia de vencimento, forma de pagamento, **nome de quem autorizou** (texto livre, obrigatório) e data da autorização (opcional), setor beneficiado, natureza (OPEX/CAPEX), quantidade e unidade (ex.: 40 licenças), responsável técnico, número do contrato, renovação automática, antecedência do aviso de renovação e observações. |
| **RF02** | Editar despesa. Mudança no valor base é tratada como **correção** (vale desde o início) e fica na auditoria. |
| **RF03** | **Reajustar** o valor a partir de uma competência, com motivo (reajuste contratual, renegociação, mudança de quantidade), preservando o histórico. |
| **RF04** | **Encerrar** despesa informando a última competência. Excluir só é permitido enquanto a despesa não tem lançamentos. |
| **RF05** | Listar despesas com busca (descrição, fornecedor, contrato), filtros (categoria, fornecedor, setor, situação, recorrência, forma de pagamento, autorizado por, com os nomes já digitados como opções) e ordenação. Cada linha mostra o valor vigente, o **equivalente mensal** e a próxima ocorrência. |
| **RF06** | Detalhe da despesa em painel lateral: dados, próximas 12 ocorrências, histórico de valores, lançamentos, anexos e auditoria. |
| **RF07** | Categorias expansíveis: criar categorias novas a qualquer momento (na tela de categorias ou direto no formulário da despesa, com "+ Nova categoria"), renomear, descrever o que entra nela, reordenar (a ordem define a cor, D5) e desativar. Categoria com despesas não é excluída, só desativada. |
| **RF08** | Escolher fornecedor do cadastro existente ou cadastrar um rapidamente (nome + CNPJ). |
| **RF09** | Anexar contrato, proposta ou e-mail de autorização à despesa. |

### 3.2 Funcionais — Realizado mês a mês (Fase 2)

| ID | Requisito |
|---|---|
| **RF10** | Tela **Mês a mês**: para uma competência, listar todas as ocorrências previstas com situação (a vencer, vencida, paga, dispensada), selo "ajustada" quando a previsão foi mexida, e totais de previsto, pago e em aberto. |
| **RF11** | **Ajustar a previsão** de uma ocorrência a qualquer momento do mês, antes ou depois do vencimento: valor, vencimento, forma de pagamento e observação. Ao salvar, o usuário escolhe **"só este mês"** (ajuste, grava na ocorrência) ou **"deste mês em diante"** (vira um reajuste da despesa, RF03). Vale para fixas e variáveis. É assim que se atualiza a estimativa de cloud, telefonia ou uso de IA ao longo do mês. |
| **RF12** | **Dar baixa** numa ocorrência: valor pago, data, forma de pagamento, nota fiscal e comprovante. Baixa em lote para despesas fixas (valor pago = previsto). |
| **RF13** | **Dispensar** uma ocorrência que não foi cobrada (carência, suspensão), com motivo. **Editar uma baixa já feita** (valor, data, comprovante) e **desfazer** baixa, dispensa ou ajuste, voltando à previsão calculada. |
| **RF14** | **Gasto avulso no mês**: registrar direto no Mês a mês uma cobrança que não estava prevista (ex.: cobrança extra de um fornecedor). Cria uma despesa única naquela competência, com os mesmos campos obrigatórios (categoria, fornecedor, autorizado por). |
| **RF15** | Importar despesas de planilha Excel com o modelo próprio do módulo (§7.1): modelo para download, pré-visualização com erros e avisos por linha, criação opcional das categorias que ainda não existem, e relatório das linhas que ficaram de fora. |
| **RF16** | Exportar a lista de despesas e o mês a mês para Excel. |

### 3.3 Funcionais — Dashboard FinOps (Fases 3 e 4)

| ID | Requisito | Fase |
|---|---|---|
| **RF17** | Uma única barra de filtros acima de tudo: período, categoria, fornecedor, setor, natureza, forma de pagamento. Todos os gráficos respondem ao mesmo recorte. | 3 |
| **RF18** | KPIs: realizado no período (com variação sobre o período anterior), previsto no período (já com os ajustes do mês), custo recorrente mensal, custo anualizado, a pagar em 30 dias, vencidas sem baixa. | 3 |
| **RF19** | Gráficos: evolução mensal por categoria com 3 meses de projeção, gasto por categoria, top fornecedores com concentração, gasto por setor, recorrente × pontual e OPEX × CAPEX. | 3 |
| **RF20** | Card de **alertas** ordenado por severidade (§8.4). | 3 |
| **RF21** | **Calendário de renovações**: contratos que terminam ou renovam nos próximos 90 dias. | 3 |
| **RF22** | Tabela de detalhamento com todas as ocorrências do recorte, ordenável e exportável. | 3 |
| **RF23** | Cadastro de **orçamento** anual por categoria e visão **orçado × realizado**. | 4 |
| **RF24** | Alternar entre **visão caixa** (quando foi pago) e **visão competência** (anual diluído em 12 meses). | 4 |
| **RF25** | Detalhamento avançado: mapa de calor categoria × mês, maiores desvios previsto × realizado, custo unitário (por licença/usuário) e economias obtidas em renegociações. | 4 |
| **RF26** | **Drill-down**: clicar numa barra (categoria, fornecedor, setor) aplica o filtro no painel inteiro e abre o resumo daquele item. | 4 |

### 3.4 Regras de negócio

| ID | Regra |
|---|---|
| **RN01** | Uma despesa com recorrência de N meses tem ocorrências na competência inicial e a cada N meses, até a competência final (se houver). Meses do ciclo: única 0, mensal 1, bimestral 2, trimestral 3, semestral 6, anual 12. |
| **RN02** | Parcelamento é recorrência mensal com competência final (compra em 10× = mensal, 10 competências). |
| **RN03** | Vencimento = dia de vencimento dentro da competência, limitado ao último dia do mês (dia 31 em fevereiro vira 28/29). |
| **RN04** | Valor previsto de uma ocorrência, nesta ordem de prioridade: (1) o **ajuste** gravado naquela ocorrência, se houver; (2) o **reajuste** mais recente com vigência até aquela competência; (3) o valor base. Vencimento e forma de pagamento seguem a mesma lógica: ajuste da ocorrência primeiro, cadastro da despesa depois. |
| **RN05** | Equivalente mensal = valor vigente ÷ meses do ciclo. Despesa única não entra no custo recorrente. |
| **RN06** | **Custo recorrente mensal** = soma dos equivalentes mensais das despesas recorrentes ativas na competência atual. Para despesas variáveis, usa a média dos 3 últimos lançamentos pagos (sem histórico, usa o valor estimado). **Custo anualizado** = custo recorrente × 12 + despesas únicas previstas no ano. |
| **RN07** | Cada ocorrência tem no máximo um lançamento. Situação: **paga** ou **dispensada** (lançamento com esse status), **vencida** (não paga nem dispensada, com vencimento antes de hoje, já considerando um vencimento ajustado), **a vencer** (o resto). "Ajustada" é um selo à parte, não uma situação: uma ocorrência pode estar ajustada e vencida ao mesmo tempo. |
| **RN08** | A despesa não tem campo de status: a situação vem das datas. **Futura** (início depois do mês atual), **ativa**, **encerrada** (competência final antes do mês atual). Suspender = dispensar as ocorrências do período. |
| **RN09** | "Autorizado por" é texto livre obrigatório (espaços extras removidos ao salvar). A data da autorização é opcional e, se preenchida, não pode ser futura. |
| **RN10** | Valores em R$, `DECIMAL(15,2)`, maiores que zero. |
| **RN11** | **Desvio**: pago acima do previsto em mais que a tolerância (padrão 10%) gera alerta. A comparação usa o previsto **original** (da recorrência e dos reajustes), não o ajustado no mês. Se usasse o ajustado, bastaria ajustar a previsão para o desvio sumir, e o dashboard perderia justamente o sinal de que o custo fugiu do contratado. |
| **RN12** | **Aviso de renovação**: competência final dentro da antecedência da despesa (padrão 30 dias). |
| **RN13** | Orçamento anual por categoria, dividido igualmente pelos 12 meses. |
| **RN14** | Nenhuma regra chama `new Date()`/`NOW()` internamente: a data de referência (`hoje`) entra como argumento, para as regras serem determinísticas e testáveis. É o mesmo princípio de `riscosAlertas.ts` (qualidade, issue 04). |
| **RN15** | Uma ocorrência só vira linha em `ti_lancamentos` no **primeiro toque** (ajuste, baixa ou dispensa). Até lá ela é só previsão calculada. Desfazer um ajuste que não tem baixa apaga a linha, e a ocorrência volta a seguir a despesa. |
| **RN16** | **Nada fica travado.** Qualquer ocorrência de qualquer mês, passado ou futuro, pode ser ajustada, paga, dispensada, ter a baixa editada ou desfeita. Não há fechamento de mês na v1. Toda mudança vai para a auditoria (RNF02). |
| **RN17** | Mudar recorrência, início ou fim de uma despesa **nunca apaga lançamentos**. Um lançamento que caia numa competência que deixou de ter ocorrência aparece no Mês a mês com o selo "fora da recorrência", e o usuário decide se mantém ou exclui. |

### 3.5 Não funcionais

| ID | Requisito |
|---|---|
| **RNF01** | **Segurança:** RLS em todas as tabelas via `current_user_has_permission()`. Anexos em bucket **privado** com URL assinada. Chaves novas fora do fallback do `operator` legado. |
| **RNF02** | **Auditoria:** toda inclusão, alteração ou exclusão em despesas, reajustes, lançamentos e orçamento registra quem, quando, antes e depois. |
| **RNF03** | **Desempenho:** dashboard em menos de 2 s com até ~500 despesas × 24 meses. Consultas filtradas por data no servidor. Ao trocar filtro, o gráfico anterior fica esmaecido em vez de piscar o skeleton. |
| **RNF04** | **Testabilidade:** todo cálculo (recorrência, situação, KPIs, alertas, importação) em funções puras em `domain/`, cobertas por vitest. |
| **RNF05** | **Visualização acessível:** paleta validada em claro e escuro, legenda sempre presente com 2+ séries, tabela equivalente para cada gráfico, cor nunca como única pista. |
| **RNF06** | **Identidade visual** igual à do `ITHubDashboard` (§8.1). |
| **RNF07** | **Formatos brasileiros:** valores em R$, datas dd/mm/aaaa, competências como "out/2026". Competência trafega como texto `YYYY-MM-01`, nunca como `Date` com fuso. |
| **RNF08** | **Sem função serverless nova.** O plano Hobby da Vercel permite 12 e já há 9 em `api/`. O módulo lê e grava direto no Supabase, protegido por RLS. |
| **RNF09** | Responsivo (mobile-first), tema claro e escuro. |

---

## 4. Modelo de dados

Prefixo **`ti_`** (livre no banco; `it_` já pertence às tabelas de chamados e projetos, que usam a RLS antiga por `department = 'TI'`). Convenções dos módulos recentes: `uuid` com `gen_random_uuid()`, `created_at`/`updated_at` com trigger por tabela, `text` + CHECK nomeado em vez de enum, dinheiro em `DECIMAL(15,2)`, `COMMENT ON` em pt-BR, guarda `to_regprocedure('public.current_user_has_permission(text)')` no topo da migration.

### 4.1 Tabelas

**`ti_categorias`**

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `nome` | text NOT NULL, UNIQUE sem diferenciar maiúsculas (`lower(nome)`) | evita "IA" e "ia" como duas categorias |
| `descricao` | text NULL | o que entra na categoria; aparece como dica no formulário |
| `natureza_padrao` | text CHECK (`opex`, `capex`) | sugere a natureza no cadastro da despesa |
| `ordem` | int NOT NULL | define a cor: as 8 primeiras têm cor própria (D5) |
| `ativo` | boolean DEFAULT true | sem DELETE: desativar. Categoria desativada some do formulário, mas continua nos gráficos e no histórico |
| `created_by`, `created_at`, `updated_at` | | |

A tabela é **expansível**: as 8 linhas abaixo são só a carga inicial, e quem tem `canManageGastosTI` cria outras quando quiser (RF07).

| Ordem | Categoria inicial | O que entra (texto de `descricao`) | Natureza padrão |
|---|---|---|---|
| 1 | **Inteligência Artificial** | Assinaturas e APIs de IA: ChatGPT, Claude, Copilot, Gemini, consumo por token, plataformas de IA. Ferramenta de IA vai aqui mesmo sendo assinatura SaaS. | OPEX |
| 2 | SaaS e Assinaturas | Software por assinatura que não é IA: M365, Google Workspace, ERP, antivírus. | OPEX |
| 3 | Cloud e Hospedagem | AWS, Azure, GCP, VPS, domínios, hospedagem, e-mail transacional. | OPEX |
| 4 | Licenças de Software | Licença perpétua ou de longo prazo comprada de uma vez. | CAPEX |
| 5 | Hardware e Equipamentos | Computadores, servidores, periféricos, rede, peças. | CAPEX |
| 6 | Telecom e Conectividade | Links de internet, telefonia, chips, VPN. | OPEX |
| 7 | Serviços e Suporte | Consultoria, desenvolvimento terceirizado, manutenção, suporte técnico. | OPEX |
| 8 | Diversos | O que não se encaixa nas demais. | OPEX |

Consultoria, manutenção e suporte ficam juntos em "Serviços e Suporte", o que abre espaço para IA dentro das 8 cores. A categoria genérica se chama **"Diversos"**, e não "Outros", para não se confundir com o agrupamento "Outros" do gráfico empilhado (D5).

**`ti_despesas`**

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `descricao` | text NOT NULL | |
| `categoria_id` | uuid NOT NULL → `ti_categorias` | |
| `fornecedor_id` | uuid NULL → `suppliers` ON DELETE SET NULL | D4 |
| `fornecedor_nome` | text NOT NULL | cópia do nome (sobrevive à exclusão do fornecedor) |
| `natureza` | text CHECK (`opex`, `capex`) | |
| `tipo_valor` | text CHECK (`fixo`, `variavel`) DEFAULT `fixo` | variável = valor é estimativa, atualizada no mês por ajuste (RF11) |
| `valor_base` | DECIMAL(15,2) CHECK > 0 | valor por ocorrência desde o início (RN04) |
| `recorrencia` | text CHECK (`unica`, `mensal`, `bimestral`, `trimestral`, `semestral`, `anual`) | |
| `competencia_inicio` | date NOT NULL, CHECK dia = 1 | |
| `competencia_fim` | date NULL, CHECK dia = 1 e ≥ início | encerramento/fim de contrato (RN08) |
| `dia_vencimento` | smallint CHECK 1–31 | |
| `forma_pagamento` | text CHECK (lista D7) | |
| `meio_pagamento_detalhe` | text NULL | ex.: "cartão final 1234" |
| `moeda_original`, `valor_original` | text / DECIMAL NULL | só informativo (D8) |
| `quantidade` | integer NULL CHECK > 0 | base do custo unitário |
| `unidade` | text NULL | licença, usuário, GB, link… |
| `setor` | text NULL | valor de `DEPARTMENTS` (D9) |
| `responsavel_id` | uuid NULL → `user_profiles` | dono técnico |
| `autorizado_por` | text NOT NULL, CHECK `length(trim(autorizado_por)) > 0` | nome digitado, texto livre (D3) |
| `autorizado_em` | date NULL | opcional (RN09) |
| `numero_contrato` | text NULL | |
| `renovacao_automatica` | boolean DEFAULT false | |
| `aviso_renovacao_dias` | smallint DEFAULT 30 | RN12 |
| `observacoes` | text NULL | |
| `anexos` | jsonb DEFAULT `'[]'` | `[{path, name}]` no bucket privado |
| `created_by` | uuid NOT NULL DEFAULT `auth.uid()` → `user_profiles` | |
| `created_at`, `updated_at`, `updated_by` | | trigger preenche `updated_by` (padrão `metas_faturamento`) |

Índices: `categoria_id`, `fornecedor_id`, `setor`, `competencia_fim`.

**`ti_despesa_reajustes`**

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `despesa_id` | uuid NOT NULL → `ti_despesas` ON DELETE CASCADE | |
| `vigente_desde` | date NOT NULL, CHECK dia = 1 | competência a partir da qual vale |
| `valor` | DECIMAL(15,2) CHECK > 0 | |
| `motivo` | text CHECK (`reajuste_contratual`, `renegociacao`, `mudanca_quantidade`, `outro`) | `renegociacao` com valor menor alimenta "economias" (RF25) |
| `quantidade` | integer NULL | nova quantidade, se mudou |
| `observacao` | text NULL | |
| `created_by`, `created_at` | | |

UNIQUE (`despesa_id`, `vigente_desde`). **Por que tabela separada em vez de só editar o valor:** editar o valor reescreveria a projeção e o "previsto" dos meses já fechados. Com reajustes datados, o previsto de set/2026 continua sendo o de set/2026 mesmo depois de um reajuste em jan/2027.

**`ti_lancamentos`** (Fase 2)

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `despesa_id` | uuid NOT NULL → `ti_despesas` ON DELETE RESTRICT | impede excluir despesa com histórico (RF04) |
| `competencia` | date NOT NULL, CHECK dia = 1 | |
| `status` | text CHECK (`previsto`, `pago`, `dispensado`) | `previsto` = ocorrência ajustada, ainda não paga (RF11) |
| `valor_previsto` | DECIMAL(15,2) NOT NULL | previsão **ajustada** do mês. No primeiro toque recebe a previsão calculada, e o usuário edita |
| `vencimento` | date NOT NULL | idem: nasce com o vencimento calculado (RN03) e pode ser ajustado |
| `forma_pagamento` | text | nasce com a da despesa e pode ser ajustada |
| `valor_pago` | DECIMAL(15,2) NULL | obrigatório se `pago` (CHECK) |
| `pago_em` | date NULL | obrigatório se `pago` (CHECK) |
| `nota_fiscal` | text NULL | |
| `motivo_dispensa` | text NULL | obrigatório se `dispensado` (CHECK) |
| `observacao` | text NULL | |
| `anexos` | jsonb DEFAULT `'[]'` | comprovante, NF |
| `created_by`, `created_at`, `updated_at`, `updated_by` | | |

UNIQUE (`despesa_id`, `competencia`) garante a RN07. Índices: `competencia`, `pago_em`, `vencimento`.

**O previsto original não é gravado.** Ele sempre pode ser recalculado a partir da despesa e dos reajustes (RN04, itens 2 e 3). É contra ele que o desvio é medido (RN11). Gravar uma cópia criaria duas fontes para o mesmo número.

**`ti_orcamentos`** (Fase 4)

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `ano` | smallint NOT NULL | |
| `categoria_id` | uuid NOT NULL → `ti_categorias` | |
| `valor_anual` | DECIMAL(15,2) CHECK ≥ 0 | RN13 |
| `observacao` | text NULL | |
| `created_by`, `created_at`, `updated_at` | | |

UNIQUE (`ano`, `categoria_id`).

**`ti_auditoria`**: tabela genérica em jsonb (`tabela`, `registro_id`, `acao`, `antes`, `depois`, `autor`, `criado_em`) preenchida por trigger `SECURITY DEFINER` nas quatro tabelas acima. É o padrão de `qa_auditoria` (`20260831170000_qualidade_riscos_schema.sql:78-116`). Só SELECT e INSERT via trigger; sem UPDATE ou DELETE.

### 4.2 RLS e storage

| Tabela | SELECT | INSERT / UPDATE | DELETE |
|---|---|---|---|
| `ti_categorias` | view ou manage | manage | nenhuma (desativar) |
| `ti_despesas` | view ou manage | manage | manage (o `RESTRICT` de `ti_lancamentos` barra quem tem histórico) |
| `ti_despesa_reajustes` | view ou manage | manage | manage |
| `ti_lancamentos` | view ou manage | manage | manage (desfazer ajuste, baixa ou dispensa; fica na auditoria) |
| `ti_orcamentos` | view ou manage | manage | manage |
| `ti_auditoria` | view ou manage | só trigger | nenhuma |

"view" = `current_user_has_permission('canViewGastosTI')`; "manage" = `current_user_has_permission('canManageGastosTI')`. Policies com os nomes `<tabela>_select`, `_insert`, `_update`, `_delete`.

**Storage:** bucket privado `ti-gastos-anexos`, policies pelas mesmas chaves, download por URL assinada, seguindo `src/modules/rh/holeritesStorage.ts` e `20260916120000_rh_holerites.sql` §3. PDF, PNG e JPEG até 10 MB.

---

## 5. Permissões, rotas e menu

**Chaves** em `src/utils/permissions.ts`, grupo `'Tecnologia'` (o editor de cargos agrupa sozinho, `UserManagement.tsx:1463-1468`):
- `canViewGastosTI`: "Visualizar Gastos de TI"
- `canManageGastosTI`: "Gerenciar Gastos de TI"

As duas entram na lista de exclusão do `operator` legado (`permissions.ts:95`), para não mostrar botões que a RLS vai negar. Adicionar caso em `src/utils/permissions.test.ts`.

**Nenhum cargo recebe as chaves por migration (D14).** Depois da implantação, o usuário as atribui manualmente em Usuários › Cargos. Até lá, só admin vê o módulo.

**Rotas** em `src/App.tsx`, no bloco de TI (`:489-537`):

| Rota | Tela | Permissão |
|---|---|---|
| `/it/gastos` | Dashboard FinOps | `canViewGastosTI` ou `canManageGastosTI` (`anyOf`) |
| `/it/gastos/despesas` | Lista e cadastro de despesas | idem (botões de escrita só com `canManageGastosTI`) |
| `/it/gastos/mes-a-mes` | Realizado por competência | idem |
| `/it/gastos/orcamento` | Orçamento anual (Fase 4) | idem |

As quatro telas compartilham um cabeçalho com abas (Dashboard · Despesas · Mês a mês · Orçamento), para o menu ganhar **um único** subitem.

**Menu** em `src/components/Layout.tsx`:
- Subitem **"Gastos de TI"** → `/it/gastos` dentro de "Tecnologia" (`:710-721`), com `anyOf` das duas chaves.
- ⚠️ Hoje o item pai "Tecnologia" exige `canManageIT` e aponta para `/it/dashboard`. Quem só tem as chaves de gastos (ex.: Financeiro, Diretoria) **não veria o menu** e, se visse, cairia em "Acesso negado" ao clicar no pai. O pai passa a `anyOf: ['canManageIT', 'canViewGastosTI', 'canManageGastosTI']` e o `href` do pai passa a depender da permissão (sem `canManageIT`, aponta para `/it/gastos`). É o mesmo cuidado documentado no item RH (`Layout.tsx:680-686`).
- Adicionar as rotas novas na lista que abre o grupo automaticamente (`Layout.tsx:473`).
- Nenhuma migration de `module_categories`: o item "Tecnologia" já está na categoria `tecnologia`.

---

## 6. Estrutura do código

Segue a anatomia de `rh/` (hooks com `useState`/`useEffect`, guarda contra resposta atrasada com `requestIdRef`, mutações devolvendo `string | null`) e de `qualidade/` (`domain/` puro e testado).

```
src/modules/gastos-ti/
├── index.ts                      # exporta as páginas
├── types.ts                      # Despesa, Reajuste, Ocorrencia, Lancamento, Categoria, Orcamento
├── constants.ts                  # RECORRENCIAS, FORMAS_PAGAMENTO, MOTIVOS_REAJUSTE + labels
├── domain/                       # tudo puro, `hoje` sempre como argumento (RN14)
│   ├── competencia.ts (+ .test)  # somar meses, vencimento no mês, formatar "out/2026"
│   ├── recorrencia.ts (+ .test)  # ocorrências no intervalo, valor vigente, equivalente mensal
│   ├── situacao.ts (+ .test)     # aplica ajustes e cruza ocorrências × lançamentos → paga/dispensada/vencida/a vencer + selos
│   ├── finops.ts (+ .test)       # KPIs e agregações do dashboard
│   ├── alertas.ts (+ .test)      # regras da §8.4
│   ├── exportacao.ts (+ .test)   # linhas para XLSX
│   └── importacao.ts (+ .test)   # planilha → despesas validadas + erros por linha
├── hooks/
│   ├── useCategoriasTI.ts
│   ├── useDespesasTI.ts          # despesas + reajustes
│   ├── useLancamentosTI.ts       # por intervalo de competência
│   ├── useOrcamentoTI.ts
│   └── useFinopsDashboard.ts     # busca o recorte e devolve os agregados de domain/finops
├── storage.ts                    # upload e URL assinada do bucket privado
└── components/
    ├── GastosTIShell.tsx         # cabeçalho + abas
    ├── despesas/                 # DespesasPage, DespesaFormModal, DespesaDrawer, ReajusteModal
    ├── categorias/               # CategoriasModal (criar, ordenar, desativar) + NovaCategoriaInline (usado no formulário)
    ├── mes-a-mes/                # MesAMesPage, AjusteOcorrenciaModal, BaixaModal, BaixaLoteModal, GastoAvulsoModal, ImportarDespesasModal
    ├── dashboard/                # FinopsDashboard + um componente por gráfico/card
    └── ui/                       # Kpi, Widget, VazioGrafico, eixoMoeda
```

Reaproveitamentos:
- **Formatação:** `src/modules/faturamento/utils/formato.ts` (`formatCurrency`, `formatData` com a correção de fuso `T00:00:00`, `formatCompetencia`, `hojeIso`).
- **Cards do dashboard:** `Kpi`, `Widget`, `VazioGrafico` e `eixoMoeda` copiados de `ContasReceberDashboard.tsx:162-254` para `ui/` do módulo. Não existe um KpiCard global, e promover um fica fora deste escopo.
- **Seletor de período por mês:** `src/modules/qualidade/components/ui/SeletorPeriodoPorMes.tsx`.
- **Excel:** `xlsx` (já é dependência), com o padrão de `src/components/CostControl/domain/exportacao.ts` e `PayorImportModal.tsx:88-135` (modelo para download + importação).
- **Sugestões de "autorizado por":** nomes distintos já gravados em `ti_despesas.autorizado_por`, oferecidos num `<datalist>` no campo de texto (D3). Não precisa de tabela nem de RPC.

**Por que agregar no navegador:** o volume de gasto de TI é pequeno (centenas de despesas, poucos milhares de lançamentos por ano). As regras ficam em TypeScript puro e testável, sem migration a cada KPI novo, como decidido na Fase 8 de Análises Clínicas (D5). Se o volume crescer, sobe para uma RPC `ti_dashboard_finops(p_desde, p_ate)` no molde de `fat_dashboard_receber` (`20260807130000_contas_receber_rpcs.sql:300-439`).

---

## 7. Telas da base

**Despesas** (`/it/gastos/despesas`)
- Linha de filtros + busca com debounce de 350 ms (padrão de `TitulosList.tsx`).
- Tabela: descrição · categoria · fornecedor · recorrência · valor vigente · equivalente mensal · próxima ocorrência · situação · autorizado por.
- Rodapé com totais: custo recorrente mensal do recorte e quantidade de despesas.
- Botões "Nova despesa", "Importar" e "Exportar".
- Clique na linha abre o **painel lateral** (RF06), com as ações Editar, Reajustar, Encerrar e Anexos.

**Formulário da despesa** em quatro blocos:
1. **O quê:** descrição, categoria (com "+ Nova categoria" ali mesmo, e a descrição da categoria como dica para quem está em dúvida), natureza, quantidade e unidade.
2. **Quem:** fornecedor (busca + cadastro rápido), setor e responsável técnico.
3. **Quanto e quando:** valor, fixo ou variável, recorrência, início, fim, vencimento, forma e meio de pagamento, contrato, renovação automática e aviso.
4. **Autorização:** "Autorizado por" (texto livre com sugestões dos nomes já usados), data (opcional) e anexo da evidência.

Uma prévia ao vivo mostra as próximas 6 ocorrências e o equivalente mensal, para quem cadastra ver na hora se a recorrência ficou certa.

**Mês a mês** (`/it/gastos/mes-a-mes`)
- Seletor de competência (‹ out/2026 ›). Qualquer mês pode ser aberto e editado, inclusive os passados (RN16).
- Quatro números no topo: previsto (com ajustes), pago, em aberto e vencido.
- Lista agrupada por situação, com vencidas no topo. Cada linha mostra o previsto e, quando foi ajustado, o original riscado ao lado (ex.: ~~R$ 3.200~~ R$ 3.900).
- Ações por linha: **ajustar**, dar baixa, dispensar, editar baixa, desfazer. Seleção múltipla para baixa em lote.
- **Ajustar** abre um modal com valor, vencimento, forma de pagamento e observação, e pergunta: "Aplicar **só em out/2026** ou **de out/2026 em diante**?" A segunda opção cria um reajuste na despesa (RF03).
- Botão **"+ Gasto avulso"** para uma cobrança fora da previsão (RF14).
- Selos: "estimado" (variável ainda sem baixa), "ajustada" (previsão mexida no mês), "fora da recorrência" (RN17).

### 7.1 Modelo de importação (RF15)

Não existe planilha hoje (D13), então o modelo é desenhado aqui. Segue o importador de fontes pagadoras (`src/components/CostControl/PayorImportModal.tsx` + `domain/importacaoFontesPagadoras.ts`):
- O modelo é gerado no próprio navegador com `xlsx`.
- Os cabeçalhos são comparados sem acento e sem diferenciar maiúsculas.
- A validação roda linha a linha numa função pura testada (`domain/importacao.ts`).
- Aceita `.xlsx`, `.xls` e `.csv`.

Importar exige `canManageGastosTI`.

**Arquivo:** `modelo_importacao_gastos_ti.xlsx`, gerado na hora do download (as listas refletem as categorias ativas naquele momento), com três abas:

| Aba | Conteúdo |
|---|---|
| **Despesas** | Só a linha de cabeçalho. É a única aba lida na importação. |
| **Instruções** | Uma linha por coluna: o que é, se é obrigatória, formato aceito e exemplo. Embaixo, 3 despesas de exemplo completas: Microsoft 365 mensal, AWS variável e notebook parcelado em 10×. |
| **Listas** | Valores aceitos: categorias ativas, recorrências, formas de pagamento, tipo de valor, natureza e setores. |

Os exemplos ficam na aba Instruções, não na aba Despesas, para não serem importados por engano. O modelo de fontes pagadoras traz a linha de exemplo na própria aba de dados, e aqui isso é evitado de propósito.

**Colunas da aba Despesas:**

| Coluna | Obrigatória | Formato aceito | Se vier vazia |
|---|---|---|---|
| Descrição | sim | texto | erro |
| Categoria | sim | nome de uma categoria, sem diferenciar maiúsculas e acentos | erro |
| Fornecedor | sim | texto | erro |
| CNPJ do fornecedor | | 14 dígitos, com ou sem pontuação | casa só pelo nome |
| Valor | sim | `2480`, `2480,00`, `2.480,00` ou número do Excel | erro |
| Tipo de valor | | Fixo / Variável | Fixo |
| Recorrência | sim | Única, Mensal, Bimestral, Trimestral, Semestral, Anual | erro |
| Início | sim | competência: `10/2026`, `out/2026` ou uma data (vale o mês dela) | erro |
| Fim | | mesmo formato do Início; ignorado quando a recorrência é Única | sem fim |
| Dia de vencimento | sim | 1 a 31 | erro |
| Forma de pagamento | sim | PIX, Boleto, Cartão corporativo, Débito automático, Transferência, Outro | erro |
| Detalhe do pagamento | | texto (ex.: "cartão final 1234") | — |
| Autorizado por | sim | texto | erro |
| Data da autorização | | data | — |
| Setor | | um valor da lista de setores | — |
| Natureza | | OPEX / CAPEX | natureza padrão da categoria |
| Quantidade | | inteiro maior que zero | — |
| Unidade | | texto (licença, usuário, GB…) | — |
| Nº do contrato | | texto | — |
| Renovação automática | | Sim / Não | Não |
| Aviso de renovação (dias) | | inteiro | 30 |
| Moeda original | | USD, EUR… | — |
| Valor original | | número | — |
| Observações | | texto | — |

O responsável técnico fica fora do modelo: é um usuário do sistema, e escolher pelo nome digitado geraria ambiguidade. Ele é preenchido depois, no formulário.

**Pré-visualização (nada é gravado antes da confirmação):**
- Cada linha aparece como **ok**, **aviso** ou **erro**, com o número da linha na planilha e o motivo. Exemplo: "Linha 7: recorrência 'Mensalmente' não reconhecida. Use Mensal".
- **Erro, a linha não entra:**
  - coluna obrigatória vazia;
  - valor não numérico ou menor ou igual a zero;
  - recorrência, forma de pagamento, tipo de valor ou natureza fora da lista;
  - competência ilegível ou fim antes do início;
  - dia de vencimento fora de 1–31;
  - data de autorização futura.
- **Categoria que ainda não existe:** a pré-visualização lista os nomes desconhecidos com a opção **"Criar estas categorias"**, desmarcada por padrão.
  - Marcada, as categorias são criadas no fim da ordem e as linhas passam.
  - Desmarcada, as linhas ficam com erro.
  - É o que mantém as categorias expansíveis (D5) sem criar "Saas" e "SaaS" por um erro de digitação.
- **Aviso, a linha entra, mas o usuário vê antes:**
  - Fornecedor sem cadastro em `suppliers`: grava só o nome, como no cadastro manual.
  - Linha repetida dentro da própria planilha.
  - Despesa que parece já existir no sistema (mesma descrição, fornecedor e início). Esta vem **desmarcada** por padrão.
- **Casamento de fornecedor:** primeiro pelo CNPJ, depois pelo nome, sem diferenciar maiúsculas e acentos.

**Gravação:**
- Entram só as linhas marcadas e sem erro, numa única chamada de inserção: ou entram todas, ou nenhuma. Não existe importação pela metade.
- O importador **só cria despesas**. Ele não atualiza despesas existentes nem importa pagamentos de meses passados. Se o histórico interessar, entra pelo Mês a mês.
- Cada despesa importada passa pela auditoria como qualquer outra (RNF02), registrando quem importou.
- Ao final, **"Baixar relatório"** gera um `.xlsx` com as linhas que ficaram de fora e o motivo de cada uma, para corrigir e reimportar.

**Exportação (RF16):** a lista de despesas é exportada com as mesmas colunas do modelo, então o arquivo exportado pode servir de base para uma nova carga. Na reimportação, o aviso de despesa que já existe impede duplicar.

---

## 8. Dashboard FinOps (`/it/gastos`)

### 8.1 Identidade visual

Segue o `ITHubDashboard.tsx`, o dashboard de TI mais atual:
- **Cards de vidro:** `bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-3xl`.
- **Cabeçalho:** ícone com brilho violeta (acento da TI, `from-violet-500 to-purple-600` + blur atrás) e título em gradiente (`from-slate-800 to-slate-600 bg-clip-text text-transparent`).
- **Presets de período:** controle segmentado `bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-1`.
- **Entrada:** `animate-fade-in-up` escalonado. Skeleton só na primeira carga.
- **Gráficos:** `recharts` (já é dependência), com as cores do gráfico trocadas pelo tema via `useTheme()`, como `ITHubDashboard.tsx:179-210`.

### 8.2 Layout

```
┌─ [ícone] FinOps · Gastos de TI ───────────────── [Caixa|Competência] [Exportar] ┐
│ Período [Mês][Trimestre][Ano][12 meses][Personalizado]  Categoria ▾  Fornecedor ▾│
│ Setor ▾  Natureza ▾  Pagamento ▾                                                 │
├────────────┬────────────┬────────────┬────────────┬────────────┬────────────────┤
│ Realizado  │ Previsto   │ Recorrente │ Anualizado │ Orçamento  │ A pagar 30 d   │
│ R$ 48,2 mil│ R$ 51,0 mil│ R$ 16,1 mil│ R$ 204 mil │ ▓▓▓▓▓░ 71% │ R$ 9,8 mil     │
│ ▲ 6% vs ant│ 94% pago   │ /mês       │ /ano       │ (Fase 4)   │ ⚠ 3 vencidas   │
├────────────┴────────────┴────────────┴────────────┴────────────┴────────────────┤
│ Evolução mensal: colunas empilhadas por categoria, 12 meses + 3 projetados        │
├──────────────────────────────────────────┬──────────────────────────────────────┤
│ Gasto por categoria (barras horizontais) │ Top fornecedores + concentração      │
├──────────────────────────────────────────┼──────────────────────────────────────┤
│ Gasto por setor (barras horizontais)     │ Recorrente × pontual · OPEX × CAPEX  │
├──────────────────────────────────────────┼──────────────────────────────────────┤
│ Alertas FinOps                           │ Renovações nos próximos 90 dias      │
├──────────────────────────────────────────┴──────────────────────────────────────┤
│ Fase 4: Orçado × realizado · Mapa de calor categoria × mês · Maiores desvios     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Detalhamento: todas as ocorrências do recorte (ordenável, exportável)            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Cada bloco: métrica, forma e por quê

| Bloco | O que mostra | Forma | Por que essa forma | Fase |
|---|---|---|---|---|
| **Realizado** | Soma de `valor_pago` no período; variação sobre o período anterior de mesmo tamanho; tendência de 12 meses | Número + variação + minigráfico de linha | Um número de destaque não precisa de gráfico | 3 |
| **Previsto** | Soma das ocorrências do período com os ajustes aplicados (RN04); % já pago | Número + subtítulo | idem | 3 |
| **Custo recorrente** | RN06: quanto a TI custa por mês hoje | Número | É a métrica central de FinOps | 3 |
| **Anualizado** | RN06 | Número | — | 3 |
| **Orçamento consumido** | Realizado no ano ÷ orçamento do ano | Medidor (trilho + preenchimento) com rótulo de % | Uma razão contra um limite é um medidor, não uma pizza de 2 fatias | 4 (antes disso: estado vazio "orçamento não cadastrado", nunca um 0 enganoso) |
| **A pagar em 30 dias** | Ocorrências a vencer nos próximos 30 dias; vencidas sem baixa na linha de baixo | Número + selo de alerta com ícone | — | 3 |
| **Evolução mensal** | Pago por mês empilhado por categoria; os 3 meses seguintes mostram o previsto, esmaecidos e marcados "projeção". As 8 primeiras categorias na ordem têm cor própria; da 9ª em diante, somadas em "Outros" (cinza) | Colunas empilhadas, um único eixo em R$ | Tendência + composição. Na Fase 4 entra a linha do orçamento mensal **no mesmo eixo** (mesma unidade), nunca um segundo eixo | 3 |
| **Por categoria** | Total do período de **todas** as categorias, cada uma com nome próprio (inclusive as criadas depois), com % | Barras horizontais ordenadas, cada uma na cor da própria categoria (a mesma da evolução); da 9ª em diante, cinza | A cor segue a categoria em todos os gráficos, e o nome no rótulo identifica as que ficam em cinza, então o gráfico aceita quantas categorias existirem. Barra lê melhor que rosca para valores próximos | 3 |
| **Top fornecedores** | Top 10 + "Outros", com % do total e % acumulado nos rótulos; frase-resumo "3 fornecedores = X% do gasto" | Barras horizontais ordenadas, uma cor | Mostra a concentração sem o gráfico de Pareto de dois eixos | 3 |
| **Por setor** | Total por setor beneficiado (showback) | Barras horizontais | — | 3 |
| **Recorrente × pontual / OPEX × CAPEX** | Duas proporções | Barra 100% empilhada, uma por proporção, com rótulos | Duas fatias = barra rotulada, não pizza | 3 |
| **Alertas** | §8.4, ordenados por severidade | Lista com ícone + rótulo + cor de status | Status nunca só por cor | 3 |
| **Renovações** | Despesas com fim ou renovação em até 90 dias: dias restantes, valor anualizado, selo "renova sozinha" ou "exige decisão" | Lista ordenada por data | — | 3 |
| **Detalhamento** | Todas as ocorrências do recorte: competência, despesa, fornecedor, categoria, previsto, pago, situação | Tabela ordenável + exportar | É também a tabela equivalente dos gráficos | 3 |
| **Orçado × realizado** | Por categoria no ano | Uma barra com marcador de meta por categoria; cor de status só quando passa de 90%/100% | Delta contra meta | 4 |
| **Mapa de calor** | Categoria × mês, intensidade = valor pago | Grade em um único tom (claro → escuro) | Magnitude numa grade | 4 |
| **Maiores desvios** | Top 10 despesas com pago ≠ previsto **original** (em R$ e %, RN11). O tooltip mostra também o previsto ajustado, para ver se o desvio foi antecipado no mês | Barras divergentes: acima em tom quente, abaixo em tom frio, zero neutro | Polaridade em torno de zero | 4 |
| **Custo unitário** | Despesas com quantidade: valor por licença/usuário por mês e variação no ano | Tabela | — | 4 |
| **Economias** | Soma anualizada dos reajustes `renegociacao` com valor menor | Número | — | 4 |
| **Caixa × competência** | Caixa: valor no mês do pagamento. Competência: despesa anual diluída em 12 meses (bimestral em 2 etc.) | Alternador no cabeçalho | Uma anual paga em janeiro distorce a série no caixa | 4 |
| **Drill-down** | Clicar numa barra aplica o filtro no painel inteiro e abre um painel lateral com o resumo do item (despesas, total em 12 meses, evolução) | — | — | 4 |

### 8.4 Alertas (calculados na leitura, sem notificação por e-mail na v1)

| Alerta | Regra | Severidade |
|---|---|---|
| Ocorrência vencida sem baixa | RN07 | alta |
| Pago acima do previsto | RN11 (tolerância padrão 10%) | média |
| Renovação próxima sem renovação automática | RN12 e `renovacao_automatica = false` | alta |
| Renovação automática próxima | RN12 e `renovacao_automatica = true` (hora de renegociar ou cancelar) | média |
| Categoria com orçamento acima de 90% (Fase 4) | RN13 | média; acima de 100%, alta |
| Lançamento fora da recorrência | RN17 | baixa |

### 8.5 Regras de gráfico (da skill `dataviz`, obrigatórias)

- Carregar a skill `dataviz` **antes** de escrever o primeiro gráfico e **rodar o validador de paleta** (claro e escuro) nas cores das categorias.
- **A cor segue a categoria, não a posição no ranking.** Filtrar não repinta as categorias que sobram. A cor vem de `ti_categorias.ordem`.
- **No máximo 8 cores categóricas** (as 8 da paleta validada). Da 9ª categoria em diante, "Outros" em cinza neutro nos gráficos que usam cor por categoria. Nunca gerar uma 9ª cor. Gráficos de uma série (barras por categoria) usam uma cor só e mostram todas.
- **Nunca dois eixos Y.** Valores em R$ com eixo em milhares (`eixoMoeda`).
- Legenda sempre presente com 2+ séries. Rótulos diretos só nos pontos que importam, nunca em todos. Tooltip ao passar o mouse em todo gráfico.
- **Todo gráfico tem uma tabela equivalente** (botão "ver tabela") e um estado vazio explícito (`VazioGrafico`).
- Cores de status (bom, atenção, crítico) reservadas para alertas e orçamento, nunca usadas como cor de série.

---

## 9. Mapa técnico: de onde sai cada número

| Métrica | Fonte | Cálculo (`domain/`) |
|---|---|---|
| Previsto original, ocorrências, projeção | `ti_despesas` + `ti_despesa_reajustes` | `recorrencia.ocorrenciasNoIntervalo(despesa, reajustes, desde, ate)` |
| Previsto (com ajustes) | previsto original + `ti_lancamentos` | `situacao.aplicarAjustes(ocorrencias, lancamentos)`: o lançamento, quando existe, sobrepõe valor, vencimento e forma de pagamento (RN04) |
| Realizado | `ti_lancamentos` (`status = 'pago'`) | soma de `valor_pago` por `pago_em` (caixa) ou por competência diluída (competência) |
| Situação da ocorrência | ocorrências ajustadas × `ti_lancamentos` | `situacao.classificar(ocorrencias, lancamentos, hoje)`, incluindo os selos "ajustada" e "fora da recorrência" |
| Desvio | pago × previsto **original** | `finops.desvios(...)` (RN11) |
| Custo recorrente / anualizado | despesas ativas + últimos lançamentos das variáveis | `finops.custoRecorrenteMensal(..., hoje)` |
| Quebras por categoria, fornecedor, setor | lançamentos + despesa | `finops.agruparPor(chave)` |
| Orçado × realizado | `ti_orcamentos` + lançamentos | `finops.orcadoRealizado(ano, ...)` |
| Alertas | tudo acima | `alertas.calcular(..., hoje)` |

**Consultas do dashboard:** despesas e reajustes (tabela inteira, volume pequeno) + lançamentos da janela filtrados no servidor (`.gte`/`.lte` em competência). A janela vai do período anterior (para a variação) até 12 meses para trás (minigráficos) e 3 para frente (projeção).

---

## 10. Faseamento

Fatias verticais: cada fase termina com algo usável em produção.

```
00 shell ─── 01 base de despesas ─── 02 mês a mês ─── 03 dashboard v1 ─── 04 detalhamento avançado
```

Depois de cada implantação, o usuário decide manualmente quais cargos recebem as chaves (D14). Até lá, admin valida sozinho.

### Fase 0: Shell e permissões ✅ (01/Out/2026)
- Chaves em `permissions.ts` + teste; exclusão do `operator` legado.
- Rotas `/it/gastos*` com as abas vazias; subitem no menu; ajuste do item pai "Tecnologia" (§5); lista de auto-expansão.
- **Pronto quando:** usuário com `canViewGastosTI` e sem `canManageIT` vê só "Gastos de TI" dentro de "Tecnologia"; sem nenhuma chave, recebe "Acesso negado".

### Fase 1: Base de despesas ✅ no código (01/Out/2026)

Migrations a aplicar, nesta ordem (cada uma recusa rodar sem a anterior):
1. `20261009120000_gastos_ti_categorias.sql`
2. `20261009130000_gastos_ti_despesas.sql`
3. `20261009140000_gastos_ti_reajustes.sql`
4. `20261009150000_gastos_ti_anexos.sql`

- Migration: `ti_categorias` (+ as 8 iniciais, com IA), `ti_despesas`, `ti_despesa_reajustes`, `ti_auditoria` + triggers, RLS, bucket `ti-gastos-anexos`.
- `domain/competencia.ts`, `domain/recorrencia.ts` + testes.
- Tela Despesas, formulário com prévia de ocorrências, painel lateral, reajuste, encerrar, excluir (sem lançamentos), anexos.
- Categorias: tela de gestão (criar, ordenar, desativar) + criação direto no formulário.
- **Pronto quando:** RF01–RF09 funcionam; os testes cobrem os casos de borda da §11.

### Fase 2: Mês a mês (realizado) ✅ no código (01/Out/2026)

Migration a aplicar: `20261009160000_gastos_ti_lancamentos.sql` (depende das quatro da Fase 1).

- Migration: `ti_lancamentos` + trigger de auditoria + RLS.
- `domain/situacao.ts`, `domain/importacao.ts`, `domain/exportacao.ts` + testes.
- Tela Mês a mês: ajustar ("só este mês" ou "deste mês em diante"), baixa individual e em lote, dispensar, editar baixa, desfazer, gasto avulso, importar e exportar Excel.
- O importador (RF15, §7.1) depende só das tabelas da Fase 1. Se a carga inicial for grande, pode ser antecipado para logo depois da Fase 1, sem esperar o Mês a mês.
- **Pronto quando:** RF10–RF16 funcionam; ajustar, pagar, editar e desfazer funcionam em qualquer mês, passado ou futuro (RN16); o modelo baixado, preenchido com as 3 despesas de exemplo e reimportado entra sem erro; uma planilha com linhas ruins aponta cada uma com número e motivo, e não grava nada até a confirmação.

### Fase 3: Dashboard FinOps v1 ✅ no código (01/Out/2026)

Sem migration. Decisões tomadas na implementação (detalhes nas issues 11 a 13):
- Base dos números: competência, a mesma do Mês a mês.
- Evolução: 12 meses até o fim do período, mais 3 de projeção.
- Alertas: últimos 12 meses, independentes do período.
- Ranking por categoria: na cor da própria categoria.

- `domain/finops.ts`, `domain/alertas.ts` + testes; `useFinopsDashboard`.
- Filtros, 5 KPIs (orçamento como estado vazio), evolução mensal com projeção, categoria, fornecedores, setor, proporções, alertas, renovações, detalhamento + exportar.
- **Pronto quando:** RF17–RF22 funcionam; cada KPI bate com uma soma conferida à mão no banco; paleta validada.

### Fase 4: Detalhamento avançado
- Migration: `ti_orcamentos` + RLS + auditoria; aba Orçamento.
- KPI de orçamento, linha de orçamento na evolução, orçado × realizado, mapa de calor, maiores desvios, custo unitário, economias, caixa × competência, drill-down.
- **Pronto quando:** RF23–RF26 funcionam.

Pronta no código em 05/Out/2026 (detalhes nas issues 14 a 16). Decisões tomadas na implementação:
- **Três visões:** cobrança (padrão, igual ao Mês a mês), caixa (mês do pagamento) e diluída (a "competência" do RF24: N fatias pelos meses do ciclo). As visões remapeiam as ocorrências e reaproveitam o `finops.ts`. Detalhamento e exportação listam sempre cobranças inteiras.
- **Orçamento:** só o filtro de categoria se aplica. Com outro filtro, o KPI avisa e a linha do orçamento some do gráfico.
- **Desvios:** contra o previsto original (RN11), com o ajustado no detalhe.
- **Economias:** reajustes "renegociação" que baixaram o valor, anualizados pelo ciclo.
- **Carga dos lançamentos:** passou a paginar (o PostgREST corta em 1000 linhas). Inclui 11 meses antes e 3 depois do recorte, para trocar de visão sem buscar de novo.

### Fora do escopo (depois)
- Rateio de uma despesa entre setores por percentual (D9).
- Fluxo de aprovação com alçadas por valor (D11).
- Vínculo com Solicitações de Pagamento para não digitar duas vezes (D12).
- E-mail de aviso de renovação e de vencidas. Precisaria de um cron no `vercel.json`, que já tem 2.
- Conversão de moeda com cotação do dia (D8).
- Custo de TI por colaborador ativo (depende da RLS de `colaboradores`, do módulo RH).
- Integração com as APIs de faturamento dos provedores de cloud e licenças ociosas por uso real.
- Painel arrastável e redimensionável (`react-grid-layout`, como no `ContasReceberDashboard`).

---

## 11. Verificação

1. **Testes de domínio** (`npm test`) cobrindo, no mínimo:
   - Dia 31 em fevereiro e em meses de 30 dias.
   - Anual iniciando no meio do ano.
   - Trimestral alinhada à competência inicial.
   - Reajuste no meio do intervalo.
   - Reajuste futuro que ainda não vale.
   - Despesa encerrada.
   - Despesa futura.
   - Despesa única.
   - Parcelamento de 10×.
   - Variável sem histórico.
   - Virada de ano.
   - Mesma entrada com `hoje` diferente muda só a situação, não a projeção.
   - Ajuste só neste mês: muda o previsto daquela competência e não muda as outras.
   - Ajuste de vencimento para depois de hoje tira a ocorrência de "vencida".
   - Desfazer ajuste sem baixa: a ocorrência volta à previsão calculada.
   - Reajuste da despesa depois de um ajuste no mês: o ajuste continua valendo naquela competência (RN04).
   - Mudar a recorrência com lançamentos existentes: nenhum some, e os que sobram ficam marcados "fora da recorrência" (RN17).
   - Desvio calculado contra o previsto original, mesmo com ajuste (RN11).
   - Categoria da 9ª posição em diante cai em "Outros" no empilhado e mantém o nome nas barras.
   - Importação:
     - valor nos formatos `2480`, `2480,00`, `2.480,00` e número do Excel;
     - competência como `10/2026`, `out/2026`, data e data serial do Excel;
     - cabeçalho com e sem acento;
     - categoria desconhecida com e sem "Criar estas categorias";
     - fornecedor casado por CNPJ e por nome;
     - linha repetida na planilha e despesa que já existe;
     - recorrência Única com Fim preenchido;
     - linha só com erros não bloqueia as demais.
2. **`npx tsc --noEmit` e `npm run lint`** sem erros novos nos arquivos do módulo; `vite build` ok.
3. **RLS de ponta a ponta**, com três usuários de teste:
   - Sem chave: não lê nada, nem pela API do Supabase.
   - Só `canViewGastosTI`: lê tudo, grava nada (403).
   - `canManageGastosTI`: lê e grava.
   - Anexo privado não abre sem URL assinada.
4. **Auditoria:** editar, reajustar, ajustar no mês, dar baixa, editar baixa e desfazer geram linhas em `ti_auditoria` com antes e depois.
5. **Dashboard contra o banco:** para uma competência conhecida, realizado, previsto e o total de cada categoria batem com `SELECT sum(...)` feito à mão.
6. **Filtros:** trocar período ou categoria recalcula tudo, nenhum gráfico quebra com recorte vazio, e as cores das categorias não mudam ao filtrar.
7. **Tema:** gráficos legíveis em claro e escuro; paleta aprovada no validador da skill `dataviz` nos dois modos.
8. **Menu:** usuário só com as chaves de gastos vê e navega sem cair em "Acesso negado".

---

## 12. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Sem planilha atual, a carga inicial parte do zero e o módulo nasce vazio | Modelo de importação próprio com exemplos e listas de valores aceitos (§7.1); pode ser antecipado para logo depois da Fase 1 |
| Ninguém além de admin consegue usar o módulo depois da implantação | Esperado (D14): as chaves são atribuídas manualmente em Usuários › Cargos quando o usuário decidir |
| Despesas variáveis sem baixa distorcem previsto × realizado | Alerta de vencida sem baixa; custo recorrente das variáveis pela média dos lançamentos (RN06) |
| Editar valor reescreve meses passados | Reajuste datado em tabela própria (§4.1); valor previsto copiado no lançamento |
| Datas deslocadas por fuso horário | Competência como texto `YYYY-MM-01`, nunca `Date` com hora (RNF07) |
| Valores de contratos visíveis a quem não deve ver | Chaves próprias, fora de `canManageIT` e do fallback do `operator` (D2) |
| Exclusão de fornecedor apaga a referência | FK `ON DELETE SET NULL` + nome copiado (D4) |
| Categorias criadas sem limite tornam os gráficos ilegíveis | Teto de 8 cores pela ordem; o excedente vira "Outros" só no empilhado e mantém o nome nas barras e na tabela (D5) |
| Categorias duplicadas ou com sobreposição ("IA" × "Inteligência Artificial", IA × SaaS) | Nome único sem diferenciar maiúsculas; descrição da categoria como dica no formulário; regra explícita de que ferramenta de IA vai para IA (§4.1) |
| O mesmo autorizador escrito de formas diferentes divide o filtro | Sugestões dos nomes já digitados no campo; espaços extras removidos ao salvar (D3, RN09) |
| Ajustar a previsão no mês esconde que o custo fugiu do contratado | Desvio medido contra o previsto original (RN11); a tela mostra o original riscado ao lado do ajustado |
| Menu de Tecnologia escondido de quem só vê gastos | `anyOf` e `href` dependente de permissão no item pai (§5) |
| Mesmo gasto digitado aqui e em Solicitações de Pagamento | Aceito na v1; vínculo planejado (D12) |

---

## 13. Pontos de edição fora do módulo

| Arquivo | Mudança |
|---|---|
| `src/utils/permissions.ts` (`:4-76`, `:95`) | 2 chaves + exclusão do `operator` |
| `src/utils/permissions.test.ts` | casos das chaves novas |
| `src/App.tsx` (`:489-537`) | 4 rotas sob `ProtectedRoute anyOf` |
| `src/components/Layout.tsx` (`:473`, `:710-721`) | subitem, item pai com `anyOf`/`href`, auto-expansão |
| `supabase/migrations/` | uma migration por fase (Fases 1, 2 e 4), sem gravar nada em `custom_roles` (D14) |
| `docs/CLAUDE.md` (lista de módulos) | registrar o módulo `gastos-ti/` |
| `src/components/Select.tsx`, `src/components/DatePicker.tsx` | prop opcional `tone="vidro"` (polimento do dashboard). O default mantém as classes de antes; nenhuma outra tela muda |

---

## 14. Subida para produção

A ordem é banco → cargos → app. O app não quebra sem o banco: sem a migration de orçamento, o KPI de orçamento só mostra "Orçamento indisponível".

**1. Banco (Supabase).**
- **Nova, ainda não aplicada:** `20261009170000_gastos_ti_orcamentos.sql`.
- **As cinco das Fases 1 e 2 já estão em produção.** Elas foram renumeradas de `20261001…/20261002…` para `20261009120000`–`20261009160000`, porque três versões colidiam com migrations de outros módulos que entraram no `main` (`it_requests_novo_colaborador`, `custo_fontes_pagadoras_linha_por_exame`, `holerites_pendentes`).
  - Se foram aplicadas pelo SQL Editor, não há nada a fazer.
  - Com `supabase db push`, o CLI vai listá-las como pendentes (o nome mudou). Todas são idempotentes, então rodar de novo não muda nada.
- **Conferência:**
  - `select to_regclass('public.ti_orcamentos');` não pode voltar nulo.
  - `select count(*) from public.ti_categorias;` precisa dar 8 ou mais.
- **Só se o CLI foi usado antes:** confira se as versões antigas ficaram registradas com os nossos nomes, o que teria feito o CLI pular as migrations dos outros módulos com a mesma versão.
  ```sql
  select version, name from supabase_migrations.schema_migrations
  where version in ('20261001120000', '20261001150000', '20261002120000');
  ```

**2. Cargos (D14).** Em Usuários (`/users`), marque "Visualizar Gastos de TI" e/ou "Gerenciar Gastos de TI" (grupo Tecnologia) nos cargos que vão usar o módulo.
- Quem tem cargo customizado, inclusive o de Administrador, só enxerga o menu depois disso. O frontend lê as permissões do cargo, e o RLS também.
- Só um perfil `role = 'admin'` sem cargo vê o módulo direto.

**3. App (Vercel).**
1. Push da branch `feat/gastos-ti`. Se a integração Git da Vercel gerar o preview, confira o módulo com os dados reais antes de publicar.
2. Leve a branch ao `main`. Ela já está rebaseada sobre o `origin/main`, então o avanço é direto (fast-forward). A Vercel publica.
3. Não há variável de ambiente nova.

**4. Conferência pós-deploy (cerca de 5 minutos).**
- Menu Tecnologia → Gastos de TI.
- Cadastrar uma despesa de teste e conferir a prévia das ocorrências.
- No Mês a mês, dar baixa com anexo.
- No Orçamento, salvar um valor.
- No Dashboard, usar filtros, visões, drill-down e exportar.
- Um perfil só com "Visualizar" não pode ver botões de escrita.
- Apagar a despesa de teste. Com lançamento, o sistema pede para encerrar em vez de excluir: desfaça a baixa antes.

**5. Volta atrás.** Faça o redeploy do deploy anterior na Vercel. As tabelas `ti_*` e o bucket `ti-gastos-anexos` são isolados do resto do sistema e podem ficar.
