# Levantamento de requisitos — Convenia (para clone no flowlab)

> Análise funcional da plataforma Convenia (app.convenia.com.br), feita via navegação
> autenticada em conta de teste (Lab Laboratório), em 2026-08-19 e 2026-08-20. Objetivo:
> mapear módulos, telas e funcionalidades para orientar a construção de um módulo de RH
> equivalente dentro do flowlab.
>
> Complementado em 2026-08-20 com material de uma entrevista do Mario com o RH de uma
> empresa cliente (`import_files/mario - sistema RH/`). Esse material trouxe regras de
> negócio, enums oficiais e endpoints de API que a navegação por trial vazio não
> revelava — ver `regras-de-negocio-clt.md` (compliance CLT/eSocial, fórmulas de 9box e
> eNPS) e `api-convenia.md` (catálogo de API pública + dicionário de enums com IDs) neste
> mesmo diretório. O dicionário de enums foi mesclado nas seções de campo abaixo onde
> aplicável.

## Login (`login.convenia.com.br`)

Subdomínio dedicado só para autenticação (separado de `app.` e `admin.`).

- Formulário simples: e-mail, senha.
- "Esqueceu sua senha?" (`/esqueci-a-senha`) — fluxo de 1 passo só: campo e-mail +
  botão "Recuperar senha" ("Digite seu e-mail e enviaremos um e-mail para você
  informando como recuperá-la"), link "Lembrou a senha? Entrar" para voltar. Sem
  captcha ou pergunta de segurança visível.
- Botão "Entrar" e botão alternativo "Continuar com Google" (SSO/OAuth Google).
- Copy de apoio nos dois estados do formulário (login normal vs. "esqueci a senha"):
  "Olá, amigo(a) / Informe seu e-mail e senha para entrar na plataforma" e
  "Tranquilo, vamos te ajudar. Informe os dados necessários para recuperar a sua senha."
- Sem MFA/2FA na conta testada — login redireciona direto para `app.convenia.com.br/tarefas`.
- Rodapé com links institucionais: Home, Suporte (central de ajuda), Privacidade, Termos.

## Pós-login: Tarefas / Onboarding (`/tarefas`)

Landing page inicial após autenticação — checklist de onboarding do produto. Confirmado
(2026-08-20) que **"Painel" no sidebar aponta para essa mesma tela**: navegar direto para
`/painel/` redireciona para `/tarefas`. Ou seja, não existe uma dashboard separada por
trás do primeiro item do sidebar — pelo menos não nesta conta/trial; "Painel" e "Tarefas"
são a mesma rota.

- Saudação personalizada ("Olá, {Nome do usuário logado}") + card "Boas-vindas à Convenia"
  com barra de progresso percentual (ex.: 42%).
- Lista de ~9 itens de checklist, cada um com título, descrição e status
  (**CONCLUÍDO** / **PENDENTE**, alguns sem status aparente): realizar alteração salarial,
  criar cargos/departamentos/centros de custo, criar campo personalizado, iniciar nova
  admissão, solicitar/aprovar férias, exportar relatório, acompanhar desenvolvimento
  (1:1 e risco de turnover), visão do colaborador (mural), fechamento de folha/holerites.
  Cada item parece linkar para a tela correspondente do produto (deep link guiado).
  Padrão a considerar no clone: checklist de ativação/onboarding pós-cadastro, com
  progresso agregado, guiando o admin pelas funcionalidades-chave.
- Cards laterais de conversão/suporte: "Fale com um especialista" (botão "Falar com
  Vendas") e "Vai uma ajudinha aí?" (botão "Central de Ajuda"), + link direto de WhatsApp
  de suporte.
- Header global (presente em todas as telas autenticadas, não só aqui): banner fixo de
  trial ("Restam N dias no período de testes...` + botão "Falar com especialista"),
  ícone de chat, ícone de notificações (sino), seletor de empresa ("Lab Laboratório" com
  seta), botão de menu/hambúrguer, breadcrumb "Tarefas" com link de volta.
- Widget de chat (iframe) embutido no canto da página — provável ferramenta de suporte
  tipo Intercom/Zendesk widget.

---

## Navegação principal (sidebar)

- Painel (`/painel/`)
- Colaboradores (`/colaboradores/`)
- Gestão (`/gestao`)
- Desenvolvimento (`/desenvolvimento`)
- Engajamento (`/engajamento`)
- Insights (`/insights`)
- Convenia Sync (`/sync`)
- Recrutamento e seleção (`/recrutamento/`)
- Ajuda (link externo para central de ajuda)

Conta está em período de teste (trial, 7 dias restantes na captura).

---

## Módulo: Colaboradores (`/colaboradores/`)

Sub-abas do módulo (nível 1): **Colaboradores (N)** · **Admissão (N)** · **Desligamento (N)** — cada uma com contador.

### Lista de colaboradores
- Busca por nome/pessoa gestora/matrícula.
- Botão "filtrar" (com badge de qtd. de filtros ativos).
- Botão "Iniciar nova admissão" (CTA principal).
- Botão de engrenagem (config da tabela/colunas, provavelmente).
- Tabela: Avatar, Nome + Cargo, Departamento, Pessoa gestora, Matrícula, menu de ações (⋮) por linha.
- Linha da tabela é clicável → abre o perfil do colaborador.
- Colaborador pode ter badges extras (ex.: "cipa" — indica participação na CIPA).

### Perfil do colaborador — `/colaboradores/{id}/detalhes/...`
Header fixo do perfil:
- Avatar (upload de foto), menu de ações (⋮), nome, cargo, botão de navegação (voltar/próximo colaborador?).
- Cartão de resumo: Departamento, Time, Data de admissão, Matrícula, Pessoa gestora, Centro de custo, CPF, e-mail (corporativo/gerado).
- Widget de salário oculto por padrão (ícone de olho para revelar) — dado sensível protegido por toggle.
- Busca interna ("Pesquise no perfil do colaborador").

Abas do perfil (nível 2): **Pessoal** · **Profissional** · **Adicionais** · **Anotações** · **Documentos** · **Históricos**

#### Aba "Pessoal" (sub-abas internas: Informações pessoais · Endereços e contatos · Dependentes)
- **Informações pessoais**: nome completo, nacionalidade(s), UF natal, cidade natal, cor/raça, gênero, gênero no documento, nome social, estado civil, data de nascimento, nome da mãe, nome do pai. Editável via ícone de lápis (edição inline/modal por seção).
- **Dados bancários** (cartão à parte, lista, "Adicionar" novo): banco, tipo de conta, agência, conta, chave PIX. Editar/excluir por item — suporta múltiplas contas.
- **Formação acadêmica** (lista, "Adicionar"): nível (ex. Mestrado completo), instituição de ensino, curso, ano de conclusão. Editar/excluir por item — suporta múltiplos registros.
- **Pessoa com Deficiência**: possui deficiência (sim/não), tipo, observações.

- **Endereços e contatos**: Endereço (CEP com autopreenchimento provável, endereço, número, complemento, bairro, UF, cidade); Contatos (celular, telefone residencial, e-mail pessoal); Contatos de emergência (lista, "Adicionar").
- **Dependentes**: lista de dependentes (avatar com iniciais), cada um com nome, data de nascimento, gênero no documento, escolaridade, CPF, contato, e-mail, incapacidade física/mental (sim/não), observações, nome completo da mãe, flags de IRRF / Salário Família. "Adicionar dependente".
  Modal "Adicionar dependente" confirmado por screenshot (`04d_modal_adicionar_dependente.png`,
  pasta da entrevista), campos na ordem real: Nome completo\*, Relação\*, Data de
  nascimento\*, Gênero no documento, Escolaridade, CPF de dependente\*, Contato, E-mail,
  "Dependente possui incapacidade física ou mental para trabalho?", Observações, Nome
  completo da mãe\*, + checkboxes "Incluir para fins de imposto de renda" (texto real da
  UI — a flag "IRRF" acima é paráfrase) e "Salário família".

#### Aba "Profissional" (sub-abas: Informações de Trabalho · Benefícios · Férias · Folha de Pagamento · Faltas e Afastamentos)

> Correção (screenshots `05c_colaborador_ferias.png` e `08b_colaborador_documentos_profissionais.png`,
> pasta da entrevista): a sub-aba real se chama **"Férias"**, não "Recesso" — corrigido
> abaixo (o termo "recesso" não aparece na UI atual).
- **Informações de Trabalho** — muito extenso, dividido em:
  - *Informações de Trabalho*: data admissão, pessoa gestora, e-mail profissional, tipo de admissão, hora contratual, forma de pagamento, matrícula, sindicato, estabilidade, cargo de confiança, primeiro emprego, data do exame admissional, tipo de salário, seguro desemprego, aposentado, inscrição em órgão de classe, conselho profissional, CIPA (sim/não), possui registro de ponto, número do crachá.
  - *Vínculo e Salário*: vínculo (CLT/Sócio/etc.), categoria de trabalhadores (lista tipo eSocial), cargo, departamento, time, centro de custo, salário, válido a partir de, motivo (ex.: Admissão, Ajuste de pró-labore), descrição.
  - *Contabilidade* (campos voltados a eSocial/legislação BR): tipo de regime previdenciário, natureza da atividade, indicativo de admissão, cota de PcD, agente nocivo, optante FGTS, possui imóvel próprio / adquirido via FGTS.
  - *Período de Experiência*: período, data admissão, término.
  - *Jornada de trabalho*: descrição textual da jornada, tipo de jornada, regime, horários (fixo/livre), hora noturna, horário de trabalho por dia da semana, DSR, horas mensais, motivo, observação.
  - *Contribuição Sindical*: lista, "Adicionar".
- **Benefícios**: lista de benefícios atribuídos ao colaborador (vazio no exemplo); "Adicionar benefício".
- **Férias**: toggle "permitir direito a recesso"; resumo com saldo (dias), data de vencimento, próximo vencimento.
- **Folha de Pagamento**: toggle "incluir no fechamento da folha"; código do colaborador no sistema de folha (próprio + dependentes); lista de "Eventos" recorrentes de folha (proventos/descontos), "Adicionar".
- **Faltas e Afastamentos**: suporta anexo por registro (confirmado por screenshot
  `05e_colaborador_faltas_afastamentos.png` — exemplo populado: "Afastamento Por
  Doença" com Período, Total de dias e badge "1 ANEXO"). Botão é só "Adicionar" (não
  "Adicionar falta ou afastamento" como parafraseado antes).

#### Aba "Adicionais"
- Campos personalizados por empresa (custom fields). Estado vazio incentiva criar campo personalizado — Convenia anuncia "mais de 60 campos padrão" + custom fields ilimitados.

#### Aba "Anotações"
- Lista de anotações internas (livres) sobre o colaborador, com "Adicionar anotação". Estado vazio no exemplo.

#### Aba "Documentos" (sub-abas: Documentos Pessoais · Documentos Profissionais · Exame Periódico)
- **Documentos Pessoais**: CPF (número + anexos), Carteira de Trabalho (número, série, data emissão, UF emissor, PIS, anexos), RG (número, data emissão, órgão emissor, UF emissor, anexos), Reservista (número, RA, categoria, anexos), CNH (número, emissão, validade, categoria, anexos), Título de Eleitor (número, zona, seção, anexos). Botão "Baixar todos" (zip).
- **Documentos Profissionais**: sub-categorias com contadores — Recibos, Termos e Contratos, **Férias** (confirmado por screenshot, não "Recessos"), Documentos Adicionais (cada item é um anexo controlado, ex. holerite mensal com flag "documento assinado").
- **Exame Periódico**: confirmado por screenshot (`08c_colaborador_exame_periodico.png`) —
  tabela com colunas Motivo (Admissional/Periódico), Data, Status (Concluído/Pendente),
  busca ("Procure pelo exame, data ou status"), botão "Adicionar".

#### Aba "Históricos" (sub-abas: Histórico de atualizações · Histórico de vínculo e salário)
- **Histórico de atualizações**: trilha de auditoria completa e granular — cada alteração de campo é logada com timestamp, tipo (Inclusão/Atualização), seção afetada (ex. "Informações Pessoais", "Dependentes - Nome"), autor (nome do usuário ou "Sistema RH" para import/seed), valor anterior → novo valor. Cobre TODOS os campos do perfil (pessoais, bancários, dependentes, endereço, deficiência, formação, jornada, admissão, salário, documentos, recibos). Requisito forte de auditoria.
- **Histórico de vínculo e salário**: presumivelmente uma visão filtrada apenas das mudanças contratuais/salariais (linha do tempo de reajustes, promoções, mudança de cargo/departamento/centro de custo).

### Fluxo de Admissão (`/colaboradores/admissao`)
Board Kanban com 4 etapas fixas, cada uma com contador:
1. **Aguardando preenchimento** — processo enviado por e-mail para o candidato preencher os próprios dados (self-service onboarding).
2. **Conferência** — RH revisa o que o candidato preencheu.
3. **Preenchimento manual** — RH preenche diretamente (alternativa ao self-service).
4. **Concluído** — admissão finalizada, colaborador criado.

Card do candidato: avatar/iniciais, nome, cargo. Clique abre modal com status ("O colaborador está preenchendo a admissão!"), e-mail para onde foi enviado o link, ações: **Ok entendi** · **Preencher manualmente** · **Enviar lembrete**.

**Formulário de admissão** (wizard multi-etapas, com barra de progresso % e "checklist 0/5"), etapas (sidebar):
1. Dados da Vaga
2. Foto de Perfil
3. Dados Pessoais
4. Formação Acadêmica
5. Endereços e Contatos
6. Dependentes
7. Dados Bancários
8. Documentos
9. Benefícios
10. Contabilidade

Campos vistos em **Dados da Vaga**: e-mail pessoal*, e-mail profissional, departamento*, time, cargo*, vínculo* (CLT/Bolsa/etc.), salário*, centro de custo*, categoria de trabalhadores, data de admissão*, período de experiência (ex. "2 x 45 dias"), jornada de trabalho (texto composto a partir de um cadastro de jornadas), horas mensais, primeiro emprego (sim/não), termos e contratos a anexar/selecionar (ex. "Contrato de trabalho" — indica repositório de templates de contrato), pessoa gestora, matrícula, data do exame admissional, forma de pagamento (Salário/Bolsa/Pró-labore/Pagamento por serviço prestado/Distribuição de resultados), hora contratual (regras de tempo parcial: não parcial/25h/30h/26h semanais — reflete legislação CLT de contrato parcial), tipo de salário, tipo de admissão, sindicato, tem seguro desemprego (sim/não), colaborador bate ponto (sim/não), campos personalizados, número do crachá.
Campo com `*` = obrigatório. Botão final "Finalizar" (por etapa, ou salva progresso parcial).

> **Decisão (Mario, 2026-08-20)**: o alvo real são 12 etapas (as 10 abaixo + "Outras
> informações" — campos personalizados — entre Dados Bancários e Documentos, + um passo
> final "Checklist" de integração com crachá/notebook/acessos, ver
> `regras-de-negocio-clt.md`). Para o clone, **implementar primeiro estas 10
> confirmadas por navegação**; os 2 passos restantes ficam para uma iteração seguinte.

### Fluxo de Desligamento (`/colaboradores/desligamento`)
Kanban com 4 etapas: **Dados iniciais** → **Aguardando contabilidade** → **Retorno da contabilidade** → **Concluídos**. Reforça o padrão de "processo em etapas com board" usado também na admissão — sugere que ambos fluxos (admissão/desligamento) compartilham um motor de workflow genérico de etapas configuráveis, com troca de informação RH ↔ contabilidade (cálculo de rescisão).

**Modal "Novo Desligamento"** — confirmado por screenshot (`12_modal_iniciar_desligamento.png`,
pasta da entrevista), preenche uma lacuna que não havia sido documentada. Campos:
- `Colaborador*` (select).
- `Tipo de Desligamento*` (dropdown — mapeia ao enum de 10 tipos em `api-convenia.md`,
  ex. "Demissão sem justa causa", "Pedido de demissão", "Acordo mútuo" etc.).
- `Categoria de Desligamento` (radio: **Voluntário / Involuntário / Outros** — eixo
  separado do "Tipo de Desligamento", não documentado antes; provavelmente alimenta os
  gráficos de Turnover Involuntário/Voluntário/Outros já vistos em Insights).
- `Aviso Prévio*` (dropdown — mapeia ao enum Trabalhado/Indenizado/Dispensado).
- `Data do Início do Aviso Prévio*`.
- `Data Final do Desligamento*`.
- `Desvincular Benefícios*` (Sim/Não).
- `Quando Remover o Acesso do Colaborador à Plataforma` (data).
- `Motivo do Desligamento` (texto livre).
- `Observações`.

---

## Módulo: Desenvolvimento (`/desenvolvimento`)

Sub-nav: **Metas** · **Avaliação de Desempenho** · **Reuniões 1:1** · **PDI**

### Metas (`/desenvolvimento/metas/`)
- Estilo OKR: métricas por **Empresa · Departamentos · Times** (nº de metas, progresso, %).
- Seções "Metas em destaque" e "Metas em risco" (alertas de acompanhamento).

### Avaliação de Desempenho (`/desenvolvimento/avaliacao-de-performance/`)
- Sub-abas: Visão Geral · Ciclos de Avaliação (indica suporte a múltiplos ciclos configuráveis, ex. semestral/anual).
  Material da entrevista com o RH (`regras-de-negocio-clt.md`) detalha um fluxo de 8
  estágios por ciclo (Rascunho → Programada → Indicação → Aprovação → Em Andamento →
  Calibração → Concluída) com calibração por distribuição forçada — **confirmado pelo
  Mario (2026-08-20) e visualmente pelo screenshot
  `22b_desenvolvimento_ciclos_avaliacao.png`** (barra de sub-abas real com esses 7
  estágios + "Todas"). Requisito válido para o clone.
- Tabela: Colaborador, Pessoa gestora, Departamento, Pontuação, Performance (status: "Não avaliado", etc.).

### Reuniões 1:1 (`/desenvolvimento/performance/`)
- Tabela por colaborador: pessoa gestora, data da última 1:1, data da próxima 1:1, **Risco de Turnover** (calculado/atribuído pela liderança — feature de people analytics).

### PDI — Plano de Desenvolvimento Individual (`/desenvolvimento/pdi/`)
- "Templates PDI" configuráveis pela empresa.
- Tabela por colaborador: pessoa gestora, PDI atual, PDIs concluídos, progresso total (%).

---

## Módulo: Engajamento (`/engajamento`)

Sub-nav: **Pesquisa** · **Mural**

### Pesquisa (`/engajamento/pesquisa/rapida/...`)
- Tipos de pesquisa (abas): **eNPS** · **lNPS** (NPS de liderança?) · **Sentimentos** · **Clima** · **Personalizadas** (rótulo "BETA" nos 4 primeiros tipos).
- Cada tipo: estado vazio + botão "Ativar pesquisa" — depois de ativada mostra respostas/participantes em tempo real (não visto em detalhe, conta vazia).

### Mural (`/painel/comunicacao/mural/lista` — nota: esta tela roda em subdomínio legado `admin.convenia.com.br`, não em `app.convenia.com.br`; indício de que parte do produto ainda usa uma stack de front-end mais antiga)
- Quadro de recados/comunicados internos para os colaboradores.
- Categorias de recado: Todos · Importante · Benefícios · Políticas · Movimentações · Confraternização.
- "Adicionar recado" — pode ser segmentado por departamento ou por colaborador específico, suporta anexos.
- É o que os colaboradores veem na "visão do colaborador" (portal do funcionário).

---

## Módulo: Insights (`/insights`)

Sub-nav: **Relatórios** · **Indicadores** · **Organograma**

### Relatórios (`/insights/relatorios/pre-definidos`)
Sub-abas: **Relatórios predefinidos** · **Relatórios personalizados** (report builder próprio). Filtro por categoria.

Catálogo de relatórios predefinidos (nomes + descrição), agrupados por categoria — confirma a promessa de "mais de 50 relatórios" do onboarding:

- **Estratégicos**: Custo Provisionado (estimativa de custo de desligamento), Idade por cargo, Idade por departamento, Turnover Anual (novo), Turnover Mensal (novo), Aniversários (com filtro de mês).
- **Info. Pessoais**: Dados bancários, Dados de emergência, Dependentes, PCD, Administradores (usuários com acesso admin e seus grupos de permissão).
- **Info. Profissionais**: Admissões (status do processo), Anotações, ASO (exame periódico), Atualização de cargo e salário (histórico salarial), Campos personalizados (catálogo dos criados), Cargos e CBOs, Desligamentos, Faltas e afastamentos, Jornada de Trabalho, Períodos de experiência, Pessoas gestoras, Tempo de casa, Vínculos, Visualização de recibos de pagamento (data/hora da 1ª visualização pelo colaborador — rastreamento de leitura).
- **Férias**: A vencer (3 meses), A vencer (6 meses), Histórico de Férias, Passivo de Férias (provisão financeira, considera 1/3 constitucional), Programação, Saldo de Férias (períodos aquisitivo/concessivo).
- **Benefícios**: Colaboradores vinculados (por operadora), Conciliação (custos por colaborador), Crédito do benefício (cálculo p/ fechamento de folha), Dependentes vinculados, Histórico do benefício do colaborador.
- **Reembolsos**: Histórico de Reembolsos, Reembolsos a pagar (somado por categoria), Reembolsos de colaboradores (por status/moeda).
- **Desenvolvimento**: 1:1 por pessoa gestora, Evolução nas avaliações de desempenho, Metas, PDI por colaborador, PDI por pessoa gestora.
- **Outros**: Acesso Convenia (envio de e-mail de 1º login / controle de acessos), Alterações cadastrais (exportação do audit log completo), **Fale com o RH** (categorias e tempo médio de 1ª resposta/conclusão — indica um módulo de HR helpdesk/ticketing ainda não localizado na navegação principal, a investigar).

Cada relatório provavelmente é exportável (CSV/XLSX) e aceita filtros (ex.: período, mês, departamento).

### Indicadores (`/insights/indicadores/todos`)
Dashboard de gráficos (people analytics), filtráveis por categoria: **Todos · Riscos · Salário · Movimentações · Diversidade**. Cada gráfico tem botão "Filtrar" próprio e, ao final da página, uma pesquisa de satisfação inline (rating 1–5) sobre a própria funcionalidade — padrão interessante de captar feedback contextual.

Gráficos observados (todos com série temporal mensal Set→Ago quando aplicável):
- **Colaboradores PCD** (%) — com linha de "quantidade mínima ... de acordo com a lei" (compliance com cota legal de PcD).
- **Jovem Aprendiz** (%) — idem, com mínimo legal de 5%.
- **Diferença salarial entre cargos** (dispersão).
- **Headcount** (evolução mensal).
- **Promoções** (% mensal) e **Promoções por departamento**.
- **Colaboradores por departamento** (%) e **Custo por departamento** (R$).
- **Admissões** (%) e **Desligamentos** (%) mensais.
- **Tempo de casa** (distribuição em faixas: 1-6m, 6m-1a, 1-2a, 2-3a, 3-4a, 4-5a, +5a).
- **Turnover mensal** e **Turnover anual**, ambos quebrados em Involuntário / Voluntário / Outros.
- **Distribuição por gênero** (identidade de gênero; o dicionário oficial de enums em
  `api-convenia.md` lista 11 opções com ID — Homem, Mulher, Homem Trans, Mulher Trans,
  Não-binário, Gênero Fluido, Transexual, Transgênero, Queer, Outros, Prefiro não
  responder — divergindo da contagem de 12 registrada aqui originalmente; usar os 11 com
  ID como fonte de verdade) e **Média salarial por gênero** (auditoria de equidade salarial).
- **Distribuição por etnia** (Amarela/Branca/Indígena/Parda/Preta/Não informado) e **Média salarial por etnia**.
- **Residência dos colaboradores** e **Naturalidade dos colaboradores** (ambos por UF).
- **Distribuição por faixa etária** (15-19, 20-29, ..., 50+).

Esse módulo é fortemente orientado a **compliance trabalhista brasileiro + DEI (diversidade/equidade)** — vale reproduzir como conjunto de dashboards no clone.

### Organograma (`/insights/organograma/`)
- Árvore visual da empresa a partir do campo "Pessoa gestora" de cada colaborador (raiz = quem não tem gestor, ex. CEO). Mostra contagem de subordinados diretos/indiretos por nó. Aba "Demais colaboradores" (quem não está no organograma, ex. sem gestor atribuído).

> Padrão notado em várias telas de Insights: pesquisa de satisfação inline ("Como foi a experiência ao utilizar esta funcionalidade?", escala 1–5) — vale considerar como padrão de feedback contínuo de produto.

---

## Módulo: Convenia Sync (`/sync`)

Painel de **integração com sistema contábil externo** via token de API. Sub-nav: Visão Geral · Alterações Cadastrais · Admissões · Desligamentos · Férias · Folhas de Pagamento.
- Exige configurar (nas configurações de contabilidade) um **token de acesso** para o escritório de contabilidade consumir/processar os eventos de RH (troca de dados bidirecional RH ⇄ contabilidade).
- Conceito a replicar: uma fila/log de eventos de domínio (admissão, desligamento, férias, alteração cadastral, folha) expostos via API para consumo externo.

---

## Módulo: Recrutamento e Seleção (`/recrutamento/`)

Add-on pago, **confirmado bloqueado** por paywall nesta conta trial — sub-abas **Vagas** e
**Banco de Talentos** (ATS com repositório de candidatos) ambas mostram o mesmo estado de
bloqueio: "A funcionalidade Recrutamento e Seleção não está ativa para sua empresa" +
"Solicite a contratação para começar a utilizar esta funcionalidade da Convenia e otimizar
o seu RH!" + botão "Contratar Plano". Não foi possível inspecionar telas internas.

---

## Menu do usuário (avatar, canto superior direito)

Presente em toda a stack nova (`app.convenia.com.br`), não só na legada: **Veja como
colaborador** (impersonar visão do funcionário, ver seção "Portal do colaborador" abaixo) ·
**Configurações** · **Ajustes de notificações** · **Financeiro** · **Ajuda** · **Sair**.
Quando acessado a partir do portal do colaborador (via impersonation), o mesmo menu vira
**Ver como administrador** · Ajuda · Sair (assimétrico — colaborador não vê Configurações
nem Financeiro).

Também existe um seletor de empresa (ícone ao lado, rótulo "Lab Laboratório") com busca "Nome da empresa" — suporte a **multi-empresa por conta** (ex.: contador/holding gerenciando várias razões sociais a partir do mesmo login), com link `trocar-empresa/{id}`.

### Financeiro (`/financeiro/...`)
Sub-abas: **Gestão Financeira** (lista de **Faturas** da assinatura Convenia — vazio no
trial: "Não há faturas cadastradas") e **Planos** (upgrade/gestão do plano contratado).
Módulo de billing da própria plataforma (cobrança da Convenia à empresa cliente), não deve
ser confundido com o módulo interno de Folha/Reembolsos.

### Login/Logout
- **Sair**: encerra a sessão e redireciona para `login.convenia.com.br` — não pede
  confirmação.
- Sessão sem expiração/MFA perceptível durante a exploração: `login.convenia.com.br`
  redireciona automaticamente para `/tarefas` quando já autenticado (cookie de sessão
  válido), sem pedir e-mail/senha de novo.

---

## Configurações (`/configuracoes/...`)

Hub central de administração, 10 seções na sub-nav: **Informações Básicas** · **Organização** · **Processos Operacionais** · **Desenvolvimento** · **Integrações e API** · **Contabilidade** · **Acessos e Permissões** · **Relações Trabalhistas** · **Campos do Sistema** · **Assinaturas**.

### Informações Básicas
- **Logo** e **Símbolo** da empresa (upload, usado no menu lateral expandido/recolhido) — white-label parcial da UI.
- **Personalização**: cor principal (hex, ex. `#3c6ee9`) — tema de cor customizável por empresa.
- **Dados de Cobrança**: nome fantasia, razão social, CNPJ, telefone, e-mail, endereço.

### Organização — sub-abas: Cargos · Departamentos (+ Times) · Centros de Custo
- **Cargos**: lista com status Ativo/Inativo; cada cargo pode ter **senioridades** cadastradas (trilha de carreira/nível dentro do cargo, ex. Júnior/Pleno/Sênior) — "Adicionar cargo" / "Adicionar senioridade".
- **Departamentos**: lista com contador de "pessoas atreladas"; sub-aba **Times** (Times pertencem a um Departamento — hierarquia Departamento → Time, meio-termo entre departamento e pessoa gestora).
- **Centros de Custo**: lista simples, código + nome (ex. "003-Tecnologia") — usado em folha/relatórios financeiros.

### Processos Operacionais — sub-abas: Admissão · Desligamento · Férias · Feriados · Jornada de Trabalho · E-mail · Checklist Admissão
- **E-mail**: templates de e-mail transacional por evento (ex. "e-mail de boas vindas") **parametrizados por tipo de vínculo** (CLT, PJ, Sócio, etc. — 13+ tipos); regra "admissão sem vínculo usa e-mail padrão".
- **Jornada de Trabalho**: sub-abas **Horários** (blocos de horário reutilizáveis, ex. "08:00 às 18:00 - 12:00/13:00") e **Jornadas** (composição de jornada a partir dos horários — o texto longo visto no perfil do colaborador é gerado a partir daqui).
- **Feriados**: calendário de feriados por mês/ano, "Adicionar feriado" (nacional/estadual/municipal, provavelmente).
- **Férias**: confirmado por screenshot (`33c_config_ferias.png`) — tabela "Política de
  Férias" com uma linha por tipo de vínculo (dos 15 catalogados) e contador de
  colaboradores atrelados a cada política (ex.: CLT: 5 pessoas, Sócio: 1, Estágio: 1, PJ:
  1). Ou seja, a regra de férias é configurável **por vínculo**, não é uma política única
  da empresa.
- **Checklist Admissão**: confirmado que "Checklist" é um conceito real e configurável do
  produto — a sub-aba **Desligamento** (`33b_config_desligamento.png`) tem sua própria
  seção separada "Checklist de Desligamento", também parametrizada por tipo de vínculo
  (tabela "Nome do Checklist" / "Tipo de Vínculo", ex. "Checklist (Desligamento)" / "CLT,
  Sócio +12"). Reforça (sem confirmar 100%) a plausibilidade do 12º passo "Checklist" no
  wizard de admissão citado em `regras-de-negocio-clt.md`.

### Acessos e Permissões — sub-abas: Acessos · Permissões
- **Acessos**: gestão de usuários com acesso administrativo à plataforma.
- **Permissões** → **Grupos de Permissões** (RBAC customizável: grupos como "Administrador", "Owner", cada um com contagem de pessoas atreladas; "Adicionar novo grupo de permissões") e **Gerenciar usuários**.
- Dentro de Permissões existe um segundo nível de configuração **por papel/contexto**, com toggles granulares Sim/Não:
  - **Pessoa Gestora**: o que o gestor vê no painel do colaborador liderado — Salário, Dados dos colaboradores (todos os campos nativos; campos personalizados são parametrizados à parte em "Campos do Sistema"), Organograma, Relatórios, Indicadores, Reunião 1:1 (+ exibir histórico), Metas; escopo de férias que pode **visualizar** vs. **aprovar** (só diretos vs. diretos+indiretos, configurados separadamente); se pode solicitar férias em nome de liderados (auto-aprova a etapa do gestor); se participa do fluxo de aprovação de reembolsos; se pode gerar PDI automaticamente a partir de evolução/mudança de cargo.
  - **Colaboradores** (self-service): se pode editar as próprias informações pessoais, ver organograma, participar de 1:1 (e com quem — apenas gestores / todos / ninguém), ver metas, ver PDI.
  - **Fale com o RH**: roteamento de categorias de atendimento para responsáveis específicos — categorias: Atestado, Atualização cadastral, Benefícios, Day Off, Demonstrativo de pagamento, Desligamento, Faltas, Férias/recesso/feriados, Holerite, Home Office, Movimentação (mérito), Movimentação (promoção), Nota fiscal, Ponto eletrônico, Reembolso, Requisição de vaga, Outros. **Confirma um módulo de HR helpdesk interno com tickets categorizados e roteados por responsável.**
  - **Canal de Denúncias**: whistleblower channel — configuração de quem recebe denúncias.
  - **Reuniões 1:1**: permissões específicas do fluxo de 1:1 (não detalhado em profundidade).

### Campos do Sistema (`/configuracoes/campos-do-sistema`)
Builder de **campos personalizados**, espelhando a estrutura de abas do perfil do colaborador: **Pessoal** (Informações pessoais · Endereços e contatos · Dependentes) · **Profissional** · **Adicionais** · **Documentos**. Cada subseção lista os campos nativos (não editáveis) + botão "Adicionar campo personalizado", com coluna "Vínculos" (provavelmente controla quais papéis/portais enxergam o campo).

Confirmado por screenshot (`39_config_campos_sistema.png`): cada campo nativo também tem
um **checkbox de ativo/inativo** (verde = ativo), separado da coluna "Vínculos" — ou
seja, a empresa pode desligar campos nativos que não usa, não só configurar quem os vê.
No exemplo, vêm marcados por padrão: UF natal, Cidade natal, Estado civil, Data de
nascimento; vêm desmarcados: Nome social, Nacionalidades, Cor/Raça, Gênero.

Achado relevante: dentro de "Informações pessoais" existe uma subseção nativa **"Estrangeiro"** (não visível no perfil de exemplo, deve aparecer condicionalmente) com campos de imigração: reside no Brasil?, tipo de visto, data de chegada, data de naturalização, tempo de residência, condição de ingresso, país de origem, casado(a)/tem filho(a) brasileiro(a), e endereço completo no exterior. Vale considerar suporte a colaboradores estrangeiros no clone.

### Desenvolvimento (`/configuracoes/desenvolvimento/competencias`)
- **Competências**: catálogo global de competências usadas na criação de perguntas de
  avaliação de desempenho, agrupadas em cards (ex.: "Competências técnicas", "Competências
  comportamentais", "Conhecimento de negócio", "Resultados"), cada card com badge de tag —
  **POTENCIAL** ou **DESEMPENHO**. Essas tags alimentam diretamente os eixos de uma
  **Matriz 9Box**: competências tag "potencial" → eixo Y, tag "desempenho" → eixo X.
  Confirma que o módulo de Avaliação de Desempenho é construído sobre um modelo de
  competências configurável + matriz 9box (talento x desempenho), não só nota simples.

### Integrações e API (`/configuracoes/integracoes/...`)
Sub-abas: **Integrações** · **API**.
- **Integrações**: catálogo de apps parceiros com página própria por app — vistos: Zapier,
  Pontomais (ponto eletrônico), Clicksign (assinatura eletrônica), Tiquetaque, Flashapp,
  Ifood (provavelmente benefício de VR/VA). A aba do **Zapier** gera um token de API
  próprio e lista "Popular workflows" prontos (templates de Zap) — ex.: nova linha no
  Google Sheets quando há nova admissão, mensagem no Slack em novas admissões/férias
  aprovadas/mural, card no Trello em férias aprovadas e alterações salariais. Confirma que
  os eventos de domínio expostos incluem: admissão, férias aprovadas, alteração salarial,
  mensagens de mural.
- **API**: sub-abas **Tokens** (gestão de API keys — "Adicionar novo Token") e
  **Webhooks**. Confirma REST API própria com autenticação por token + assinatura de
  webhooks para eventos, independente da integração via Zapier. Catálogo real de
  endpoints (`public-api.convenia.com.br/api/v3/...`) e dos 13 eventos de webhook
  nomeados, levantado via entrevista com o RH, está em `api-convenia.md`.

### Contabilidade (`/configuracoes/contabilidade`)
Sub-abas: **Contadores** · **Convenia sync** · **Configurações da folha**.
- **Contadores**: lista de contatos externos de contabilidade vinculados à empresa (nome,
  telefone, e-mail, "Responsável por"), com botão de **compartilhar** (provavelmente envia
  convite/acesso), editar, excluir, "Adicionar contador".
- **Convenia sync**: geração de **token de acesso** + campo "Instruções de acesso"
  (texto copiável) — é a configuração que alimenta o módulo `/sync` (Convenia Sync) já
  documentado acima; o contador usa esse token para consumir os eventos de RH via API.
- **Configurações da folha**: sub-abas **Configurações gerais** (nome do sistema de folha
  usado pela empresa + "Código do sistema de folha"), **Eventos da folha**, **Eventos de
  benefícios**, **Vínculos** — catálogos de mapeamento entre os conceitos internos da
  Convenia (eventos de proventos/descontos, tipos de vínculo) e os códigos equivalentes no
  sistema de folha externo da empresa. Essencial para o de/para na hora de exportar/fechar
  folha.

### Relações Trabalhistas (`/configuracoes/relacoes-trabalhistas/...`)
Sub-abas: **Sindicato** · **Termos e Contratos**.
- **Sindicato**: lista de sindicatos cadastrados (nome, site, telefone, "Convenções
  coletivas"), "Adicionar Sindicato" — é a fonte do campo "sindicato" usado no cadastro
  Profissional > Vínculo e Salário do colaborador.
- **Termos e Contratos**: repositório de **templates de contrato** (ex.: "Contrato de
  trabalho"), editável/excluível, "Adicionar contrato" — é a fonte da lista de "termos e
  contratos a anexar" vista no wizard de admissão (Dados da Vaga).

### Assinaturas (dentro de Configurações)
Ao clicar em "Assinaturas" no menu de Configurações da stack nova, a navegação **redireciona
para o stack legado** (`admin.convenia.com.br/painel/configuracao/assinaturas`) — evidência
adicional de que parte da área de configuração ainda não foi migrada para o front-end novo.
A tela mostra: "Para habilitar a funcionalidade de assinatura de documentos, é necessário
configurar a integração com a **ClickSign**." — ou seja, a assinatura eletrônica não é
construída internamente, é uma integração obrigatória com o parceiro ClickSign (já listado
também em Integrações). A mesma página legada exibe um menu de abas mais antigo e diferente
do atual: Informações básicas · Cargos, departamentos e centro de custo · Permissões · API ·
Integrações · Termos e contratos · Férias · Admissão/Desligamento · Assinaturas — sugerindo
que essa é uma versão anterior (pré-refatoração) da mesma hub de Configurações.

---

## Módulo: Gestão (`/gestao`)

Sub-nav: **Férias** · **Benefícios** · **Reembolsos** · **Folha de Pagamento** · **Recibos de Pagamento** · **Assinaturas**

### Férias (`/gestao/ferias/`)
- Sub-abas: Visão Geral · Histórico.
- Filtros por status: Todos · A vencer · Pendentes · Aprovadas · Em férias · Canceladas (cada um com contador).
- Botão "Iniciar novas férias" (RH pode lançar diretamente, sem esperar solicitação do colaborador). Confirmado por screenshot
  (`15_modal_iniciar_novas_ferias.png`, pasta da entrevista): abre um modal com 2
  modos — **Férias individuais** ("Selecione uma pessoa colaboradora para fazer uma
  solicitação de férias") e **Férias coletivas** ("Configure as férias coletivas da sua
  empresa com todos os dados necessários"). O modo coletivo é o que alimenta o endpoint
  `GET /companies/collective-vacations` documentado em `api-convenia.md`.
- Toggle de visualização lista/calendário ao lado da busca.
- Tabela: Colaborador, Período solicitado, Total de dias, Data limite para aprovação, Status.
- Reflete o "saldo de recesso" visto no perfil do colaborador (aba Profissional > Recesso).

### Benefícios (`/gestao/beneficios`)
- Catálogo de planos de benefício da empresa (ex.: Plano de Saúde — Sulamérica).
- Cada plano: nome, operadora, categoria (Plano de Saúde, VR/VA, etc.), nº de colaboradores vinculados, vencimento do contrato, status (Ativo/Inativo).
- Sub-abas: Visão Geral · Histórico. "Adicionar benefício".
- Vínculo N:N — plano de benefício ⇄ colaboradores (visto também no perfil individual).
- **Formulário "Novo benefício"** (confirmado por screenshot `16b_modal_adicionar_beneficio.png`
  da pasta da entrevista — campos reais, não documentados antes): Nome do benefício\*,
  Operador\* (Flash App / Ifood / Outros), CNPJ do operador, Categoria\*, **Eventos a
  descontar** (múltipla escolha: Afastamentos, Faltas, Férias, Licenças), Cálculo do
  saldo\*, Como é calculado o custo do colaborador\* (coparticipação), **este benefício
  entrará na folha de pagamento?** (Sim/Não)\*, **Data de corte\*** (confirma como campo
  de UI real a regra de "data de corte/cutoff" descrita em `regras-de-negocio-clt.md`),
  Vencimento do contrato, Data prevista do crédito para a pessoa colaboradora.

### Reembolsos (`/gestao/reembolsos`)
- Dashboard: total "Em análise do RH" (mês) e total "Aprovados" (mês), em R$.
- Fluxo: colaborador solicita reembolso de despesa → RH aprova/recusa.
- Filtros de status: Todos · Em análise · Aprovado · Recusado.

### Folha de Pagamento (`/gestao/folha`)
- Tela de venda/upsell de serviço de BPO de folha (não é self-service dentro do produto principal — Convenia atua como intermediária/parceira para fechamento de folha, com consultoria trabalhista e envio automatizado de holerites). **Fora do escopo de clone direto** — mas confirma que "fechamento de folha" e "distribuição de holerites em massa" são conceitos centrais do produto (aparecem também na aba Profissional > Folha de Pagamento do colaborador, com "eventos recorrentes").

### Recibos de Pagamento (`/gestao/recibos-de-pagamentos/`)
Central de **upload/distribuição em massa de documentos de folha por tipo**, agrupados em 3 categorias:
- **Salários e Benefícios**: Holerite, Adiantamento, Informe de Rendimentos, 13º Salário (+ 1ª e 2ª parcela separadas), Recibo de Férias, Folha Complementar, Pró-labore, Recibos (genérico), Vale Alimentação/Refeição, Vale Transporte.
- **Controle de Horas**: Espelho de Ponto.
- **Outros Pagamentos**: Comissão, PLR, Bônus, Outros, Demonstrativo de pagamento, Pagamento de nota fiscal.
- Cada tipo provavelmente abre um fluxo de upload em lote (PDF único fatiado por CPF/matrícula, ou múltiplos arquivos) + notificação ao colaborador + registro no histórico do perfil (já visto: "Inclusão • Recibos de pagamento", com anexo "Holerite.pdf" e flag "documento assinado").

### Assinaturas (`/gestao/assinaturas`)
- Add-on pago de **assinatura eletrônica** (recibos de férias, holerites etc.), confirmado
  como tela de venda (vídeo demo embutido + botão "Contratar Plano", não funcional no
  trial). Bullets de venda: "Assine documentos de férias e recibos sem sair da
  plataforma", "Armazenamento automático", "Validade jurídica com selo **ICP-Brasil**".
  Tecnicamente é a mesma integração **ClickSign** configurada em Configurações >
  Relações Trabalhistas/Assinaturas (stack legado) — não é assinatura própria da Convenia.

---

## Portal do Colaborador (`colaborador.convenia.com.br`)

Subdomínio próprio (terceira stack de front-end, distinta de `app.` e `admin.`) —
acessado via "Veja como colaborador" no menu do admin, ou diretamente pelo colaborador
autenticado com seu próprio login. É a "visão do colaborador" citada no checklist de
onboarding. Sidebar dedicada, bem menor que a do admin:

- **Painel** (`/painel`) — o Mural (feed de comunicados), já documentado na seção
  Engajamento > Mural, mas confirmado aqui como a home real do colaborador (não fica em
  `admin.convenia.com.br` como a exploração anterior supôs — o Mural do colaborador vive
  neste subdomínio `colaborador.`). Filtros de categoria: Todos · Importante · Benefícios
  · Políticas · Movimentações · Confraternização. Cada card de comunicado tem
  curtida (contador tipo like). Cards automáticos gerados pelo sistema: aniversário do
  colaborador, aniversário de casa (tempo de empresa).
- **Minhas Informações** (`/minhas-informacoes`) — provável espelho self-service do
  perfil do colaborador (não detalhado campo a campo nesta sessão).
- **Meus Recibos** (`/recibos-pagamento`) — acesso aos holerites/recibos distribuídos
  pelo RH (contraparte de `/gestao/recibos-de-pagamentos/`).
- **Minhas Férias** (`/minhas-ferias`) — solicitação/acompanhamento de férias
  (contraparte de `/gestao/ferias/`).
- **Meus benefícios** (`/meus-beneficios`) — consulta aos planos vinculados.
- **Meus Reembolsos** (`/meus-reembolsos`) — solicitação de reembolso de despesas
  (contraparte de `/gestao/reembolsos`).
- **Meu desenvolvimento** (`/meu-desenvolvimento`) — confirmado por screenshot
  (`49_colaborador_meu_desenvolvimento.png`): **só 2 sub-abas, "Minhas Reuniões 1:1" e
  "Minhas Avaliações"**. Corrige a especulação anterior ("provável acesso a metas, 1:1 e
  PDI") — na versão observada não há Metas nem PDI no portal do colaborador, mesmo esses
  módulos existindo no lado admin.
- **Ajuda** — link externo para central de ajuda com guia específico do colaborador.

Barra lateral direita do Painel: card de perfil (avatar, nome, cargo, pessoa gestora,
departamento), card "Informações da empresa" (nome da empresa + contadores "N
funcionários na empresa" / "N funcionários no departamento", com "Ver mais"), e widget
**Agenda** — calendário mensal navegável destacando datas de aniversário (natalício e de
casa) dos colaboradores.

Menu do avatar (assimétrico ao do admin): **Ver como administrador** (retorna à visão
admin) · **Ajuda** · **Sair**.

### Comunicações / Fale com o RH (`/comunicacoes/fale-com-rh`)
Ícone de balão de chat no header do portal do colaborador leva a um módulo de
**HR helpdesk com tickets**, confirmando a suspeita levantada a partir das permissões:
- Abas **Abertas** · **Concluídas** — lista de conversas/tickets.
- Estado vazio: "Não há conversas abertas / Quando novas conversas forem criadas por
  você ou pelo RH elas serão listadas aqui."
- **Nova conversa** (modal): campo **Assunto** (texto livre), campo **Categoria**
  (dropdown — mesmo catálogo de categorias já visto em Configurações > Permissões > Fale
  com o RH: Atestado, Atualização cadastral, Benefícios, Day Off, Demonstrativo de
  pagamento, Desligamento, Faltas, Férias/recesso/feriados, Holerite, Home Office,
  Movimentação (mérito/promoção), Nota fiscal, Ponto eletrônico, Reembolso, Requisição de
  vaga, Outros), e um toggle **"Deseja adicionar sua pessoa gestora na conversa?"**
  (Sim/Não) — permite incluir o gestor direto como participante/observador do
  ticket. Botão "Iniciar" cria a conversa (provavelmente abre uma thread de chat 1:1
  com o time de RH responsável pela categoria, conforme roteamento configurado nas
  Permissões).
- Confirma modelo: ticket = assunto + categoria + participantes (colaborador, RH
  responsável pela categoria, opcionalmente gestor) + status (aberta/concluída) + thread
  de mensagens.

---

