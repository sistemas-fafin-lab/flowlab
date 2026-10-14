# Plano — EVA, o agente de TI (Início + reuniões → Kanban + cobrança por WhatsApp)

> **Status:** 🚧 **Código completo, em conferência** (branch `feat/agente-ti`).
> - **Fases 0 a 2 (13/Out/2026):** Início com dados reais, reuniões do Granola, sugestões com aprovação, chat e comentários. As migrations foram aplicadas no projeto do app, e a primeira análise real rodou pela tela.
> - **Fases 3 e 4 (14/Out/2026):** fila do WhatsApp com o script da VPS, cobrança diária e sob demanda, e respostas pelo webhook.
> - **Falta, fora do código:** variáveis na Vercel, a sessão do WAHA e o timer da VPS (issues 04 e 13), e as conferências no navegador.
>
> Protótipo da interface em `docs/flowlab_agent/` (§12).
> **Área:** Tecnologia. Dois subitens novos no menu "Tecnologia": **Início** com a pílula EVA (`/it/inicio`) e **EVA** (`/it/eva`, administração).
> **Criado em:** 13/Out/2026, a partir da reunião "Conceito do Agente no FlowLab".
> **Decisões:** **todas fechadas com o usuário em 13/Out.** D7 a D16 e D18 a D27 como recomendado, com três ajustes:
> - D2 revista para Sonnet 5.5;
> - D20/D21: a EVA **executa ações, sempre com aprovação prévia**;
> - D24: a fila do WhatsApp é **só para gestores**.
>
> **Desenvolvimento autorizado em 13/Out.**
> **Issues:** `.scratch/agente-ti/spec.md` e `.scratch/agente-ti/issues/01` a `17`.

---

## 0. Objetivo

Dar à TI a **EVA**, um agente de IA que:
- acompanha o Kanban e os projetos em andamento;
- é alimentado pelas reuniões da equipe;
- cobra as tarefas de cada pessoa pelo WhatsApp.

Junto com ela, uma **página inicial** que mostra tudo num lugar só.

Entregáveis, na ordem em que geram valor:
1. **Início da EVA**: homepage da TI (`/it/inicio`), no visual do protótipo (§12). Mostra o resumo do Kanban, as atrasadas, a fila do WhatsApp, os projetos em andamento (com prazo e situação deduzidos), as tasks do dia, comentários da EVA em cada bloco e um chat com ela. Tudo nas visões "Equipe" e "Minha visão".
2. **Reuniões → sugestões**: o resumo de cada reunião (vindo do Granola ou colado à mão) é lido pelo Claude Sonnet 5.5 (com o Gemini de reserva), que propõe cards novos, mudanças e comentários. **Nada entra no Kanban sem aprovação** de quem tem a chave nova `canApproveAgenteTI`.
3. **Cobrança por WhatsApp**: todo dia útil de manhã, cada pessoa recebe no WhatsApp as suas pendências (atrasadas, vencendo, paradas).
4. **Conversa pelo WhatsApp**: a pessoa responde ("IT-045 concluída", "vou atrasar para sexta") e o agente registra no card e cria a sugestão de mudança.

---

## 1. Glossário

| Termo | O que é |
|---|---|
| **Demanda** ou **card** | Uma linha de `it_requests`. Os cards do Board e os chamados de TI são a mesma tabela. |
| **Card aberto** | Card que ainda não terminou (RN01). |
| **Projeto em andamento** | Projeto de `it_projects` com sprint ativa ou com pelo menos um card aberto. Não existe coluna de status: a situação é **deduzida** (D4, RN05). |
| **Reunião** | O resumo de uma reunião guardado pelo agente (`ti_agente_reunioes`). Vem do Granola ou é colado à mão. |
| **Sugestão** | Uma proposta do agente: criar um card, mudar um card ou comentar num card. Fica **pendente** até alguém aprovar ou rejeitar. |
| **Aprovador** | Quem tem `canApproveAgenteTI`. Aprova e rejeita sugestões e configura o agente. |
| **Membro** | Pessoa que o agente conhece: o usuário do FlowLab, os nomes pelos quais aparece nas reuniões ("@Gabriel Carneiro") e, se quiser receber cobrança, o WhatsApp. |
| **Pendência** | Um card aberto de um membro que entra na cobrança: atrasado, vencendo ou parado (RN02 a RN04). |
| **Saída** (*outbox*) | Fila de mensagens de WhatsApp a enviar, gravada no banco. Um script na VPS esvazia a fila (D9). |
| **Reserva** | O Gemini, chamado só quando o Claude falha ou está indisponível (D17). |

---

## 2. Decisões

| # | Decisão | Resolução | Bloqueia |
|---|---|---|---|
| **D1** | Fonte das reuniões | ✅ **Fechado (13/Out): API pública do Granola, plano Business.** A chave já está no `.env` (`GRANOLA_API_KEY`). O resumo colado à mão continua existindo como reserva e para reuniões fora do Granola. Detalhes do teste na §3. | Fase 2 |
| **D2** | Modelo de IA | ✅ **Fechado (13/Out): Claude Sonnet 5.5 (`claude-sonnet-5-5`), e só ele**, para economizar tokens. Nenhum outro modelo Claude entra, nem como reserva. SDK oficial `@anthropic-ai/sdk`, saída estruturada validada com zod. A chave (`CLAUDE_API_KEY`) é **da organização**, então toda chamada leva o cabeçalho `anthropic-workspace-id` (`CLAUDE_WORKSPACE_ID`, §3). | Fase 2 |
| **D3** | WhatsApp | ✅ **Fechado (13/Out): WAHA, número do agente +55 61 9992-4986.** Uma sessão própria do WAHA (criada como **`eva`** em 14/Out), separada da `quotations_001` das cotações. Ver D9 para o caminho das mensagens. | Fase 3 |
| **D4** | Status e prazo dos projetos | ✅ **Fechado (13/Out): deduzidos dos prazos dos cards e da sprint.** Nenhuma coluna nova em `it_projects`. Regra na RN05. | Fase 1 |
| **D5** | Homepage | ✅ **Fechado (13/Out): página nova**, no estilo da homepage principal do FlowLab (`Home.tsx`), com visual moderno e prioridade máxima na interface. **O visual sai de um protótipo do usuário no Claude Design**, recebido em 13/Out em `docs/flowlab_agent/`. A §12 diz de onde sai cada dado e o que muda em relação aos mocks. | Issue 03 |
| **D6** | Sugestões do agente | ✅ **Fechado (13/Out): sempre passam por aprovação**, com uma chave nova: `canApproveAgenteTI`. | Fase 2 |
| **D7** | Quem vê o painel e o agente | ✅ **Fechado (13/Out), como recomendado:** `canManageIT`, a mesma chave do Board e dos Projetos. Na página do agente, as abas Membros e Configurações exigem `canApproveAgenteTI`. | Fase 0 |
| **D8** | Entrada do menu Tecnologia | ✅ **Fechado (13/Out), como recomendado:** o item pai "Tecnologia" passa a abrir o Início da EVA para quem tem `canManageIT`. Hoje ele abre o Hub de Aplicações (analytics), que continua no menu. | Fase 0 |
| **D9** | Caminho das mensagens de WhatsApp | ✅ **Fechado (13/Out), como recomendado: fila no banco + script na VPS.** O WAHA está preso em `127.0.0.1:3000` na VPS (`docker-compose.yaml`), e a Vercel não alcança esse endereço. Expor a API do WAHA na internet daria a quem tivesse a chave controle total do número (enviar, ler conversas). Em vez disso, a Vercel grava as mensagens em `ti_agente_mensagens` e um timer da VPS envia pelo `localhost`, no mesmo padrão de `tools/quotation-approval-digest/`. As mensagens recebidas chegam pelo webhook do WAHA, que sai da VPS para a Vercel. **ngrok (13/Out):** o usuário acessa o WAHA por um endpoint ngrok rodando na VPS. O agente **não usa** esse endpoint: o script fala com o WAHA pelo `localhost` da mesma máquina. Mas o túnel deixa a API do WAHA acessível pela internet, então o endpoint precisa de proteção (§11.1). | Fase 3 |
| **D10** | Telefones de quem recebe | ✅ **Fechado (13/Out), como recomendado: tabela própria `ti_agente_membros`**, preenchida por um aprovador, com adesão explícita (`recebe_cobranca`). `user_profiles.telefone` não existe em nenhum ambiente (`20260721120000_user_soft_delete.sql:25`), e mexer na tabela central de usuários fica fora do escopo. | Fase 2 |
| **D11** | Texto da cobrança | ✅ **Fechado (13/Out), como recomendado: modelo fixo, sem IA, na v1.** É previsível, não custa nada e não inventa. O Claude entra onde ele é necessário: ler reuniões e entender respostas em texto livre. | Fase 3 |
| **D12** | Respostas pelo WhatsApp | ✅ **Fechado (13/Out), como recomendado: viram comentário no card + sugestão na fila.** Nada muda direto no Kanban por mensagem, nem a resposta do próprio responsável. Vale reavaliar depois de algumas semanas de uso. | Fase 4 |
| **D13** | Ritmo da cobrança | ✅ **Fechado (13/Out), como recomendado:** uma mensagem por pessoa por dia útil, por volta das 08h (horário de Brasília), só se houver pendência. Nunca uma mensagem por card. | Fase 3 |
| **D14** | Reunião editada depois da análise | ✅ **Fechado (13/Out), como recomendado:** cada reunião é analisada **uma vez**. Se a nota mudar no Granola depois, a tela mostra "atualizada desde a análise" e um botão **Reanalisar**, que troca só as sugestões ainda pendentes. | Fase 2 |
| **D15** | Quem recebe a chave nova | ✅ **Fechado (13/Out), como recomendado.** Como em Gastos de TI: **nenhuma migration grava em `custom_roles`**. O usuário marca a chave nos cargos depois da implantação. Até lá, só admin aprova. | — |
| **D16** | Escopo de "todas as demandas" | ✅ **Fechado (13/Out), como recomendado:** cards e chamados de TI (`it_requests`), projetos e sprints de TI. O Board multidepartamento (`board_tickets`) fica fora da v1. | — |
| **D17** | Reserva quando o Claude falha | ✅ **Fechado (13/Out): Gemini.**<br>• Quando o Claude falha ou está indisponível (erro, tempo esgotado, recusa, resposta fora do schema), a mesma tarefa vai para o Gemini, com as mesmas instruções e o mesmo schema.<br>• Usa a chave `GEMINI_API_KEY`, já usada pelo Apoio Alvaro, com o modelo **`gemini-3.8-flash`**, escolhido pelo usuário (§9.1).<br>• Toda troca fica registrada e aparece na tela. | Fase 2 |
| **D18** | Nome, rotas e pasta | ✅ **Fechado (13/Out), vem do protótipo:** o agente se chama **EVA**.<br>• O Início fica em `/it/inicio`, no menu "Início" com a pílula EVA, como primeiro subitem.<br>• A administração (Sugestões, Reuniões, Membros, Configurações) fica em `/it/eva`, no menu "EVA".<br>• O front fica em `src/modules/eva/`, a pasta do handoff.<br>• Banco (`ti_agente_*`), API (`api/ti/[action].ts`, ações `agente-*`) e chave (`canApproveAgenteTI`) mantêm os nomes. | Fase 0 |
| **D19** | Recorte do Início | ✅ **Fechado (13/Out), vem do protótipo:** as visões **Equipe / Minha visão** substituem os filtros de projeto, responsável e tipo que o plano tinha. | Fase 1 |
| **D20** | Chat com a EVA | ✅ **Fechado (13/Out):** entra na v1. Ela responde e **pode propor ações** (criar, mudar ou comentar cards), que só são executadas **depois de aprovadas** por um gestor (D28, RN17). O custo foi aceito pelo usuário.<br>• Usa Sonnet 5.5 com `effort: 'low'` pelo `gerarEstruturado`, com cache no contexto.<br>• Limite de 30 perguntas por pessoa por dia.<br>• Custo de cerca de US$ 0,01 a 0,03 por pergunta (§12.3).<br>• As respostas fixas do protótipo saem. | Fase 2 |
| **D21** | Comentários da EVA nos blocos | ✅ **Fechado (13/Out):** na v1, saem de **regras fixas**, sem IA, calculadas na leitura (`domain/comentarios.ts`). A exceção é o de Projetos, que usa a última reunião analisada.<br>• A ação de um comentário pode navegar, abrir o chat ou **executar uma ação com aprovação prévia** (D28). Exemplo: "Redistribuir" vira a proposta "mover IT-045 e IT-052 da Ana para o Diego".<br>• Comentários de agenda ficam de fora (§12.2). | Fase 1 e 2 |
| **D22** | Botão Cobrar/Lembrar | ✅ **Fechado (13/Out):** entra na Fase 3, pela mesma fila (D9).<br>• **Lembrar** (o próprio card): quem tem `canManageIT`.<br>• **Cobrar** (card de outra pessoa, "em nome do gestor"): só `canApproveAgenteTI`.<br>• No máximo 1 por card a cada 4 h (RN16), com o texto do protótipo como modelo fixo.<br>• Sem WhatsApp cadastrado, o botão fica desabilitado, com dica. | Fase 3 |
| **D23** | Minhas tasks do dia | ✅ **Fechado (13/Out):** são os meus cards abertos que vencem hoje, mais os atrasados. Não há agenda nem horário na v1.<br>• Marcar **conclui o card** (`done` + `status = 'resolved'`, a mesma regra do Board), com opção de desfazer por alguns segundos.<br>• É ação da própria pessoa, não sugestão da EVA, então não passa por aprovação. | Fase 1 |
| **D24** | Quem vê a fila do WhatsApp | ✅ **Fechado (13/Out): só gestores** (`canApproveAgenteTI`).<br>• O bloco "Fila do WhatsApp" e o "último contato da EVA" nas atrasadas só aparecem para eles, que leem `ti_agente_mensagens` direto (a RLS já é deles).<br>• Para os demais, o bloco de atrasadas ocupa a linha inteira.<br>• O indicador "Cobranças hoje" continua para todos, por uma função que devolve **só a contagem** (`ti_agente_cobrancas_hoje()`, §6.3).<br>• Entregue/Lida vêm das confirmações do WAHA (`message.ack`) na Fase 4.<br>• Mensagens ao grupo da equipe ficam fora da v1. | Fase 3 |
| **D25** | Chips de situação no Início | ✅ **Fechado (13/Out):**<br>• **Granola:** horário da última sincronização.<br>• **Wa-ha:** situação da sessão, gravada a cada minuto pelo script da VPS em `ti_agente_config` (a Vercel não alcança o WAHA, D9).<br>• **Aprovadores:** chip extra "N sugestões aguardando", que o protótipo não tem e leva a `/it/eva`. | Fase 1 a 3 |
| **D26** | Ditado por voz | ✅ **Fechado (13/Out):** como no handoff. Web Speech API do navegador (Chrome/Edge, HTTPS), sem servidor e sem custo. No Chrome, o áudio é processado pelo serviço de voz do Google. | Fase 2 |
| **D27** | Projeto "em risco" | ✅ **Fechado (13/Out), vem do protótipo:** além das regras da RN05, o projeto fica em **Atenção** quando o progresso da sprint ativa está mais de 20 pontos abaixo do tempo já decorrido dela. Exemplo do protótipo: 35% feito com 60% da sprint passada. | Fase 1 |
| **D28** | Como a EVA executa ações | ✅ **Fechado (13/Out):** a EVA **executa ações, sempre com aprovação prévia**.<br>• Toda ação (comentário, chat, reunião, WhatsApp) vira uma **proposta concreta** em `ti_agente_sugestoes`, com o que muda em cada card.<br>• **Gestor** (`canApproveAgenteTI`): vê a proposta num diálogo de confirmação. Confirmar é aprovar, e a EVA executa na hora, na mesma transação, registrando quem aprovou.<br>• **Os demais:** a proposta vai para a fila e espera um gestor.<br>• Nada muda no Kanban sem um gestor ter aprovado antes. Isso reforça a D6, não a substitui. | Fase 1 a 4 |

---

## 3. O que os testes de viabilidade mostraram (13/Out/2026)

Foram feitas só leituras, sem gravar nada e sem enviar mensagens.

**Granola: funciona.**
- `GET https://public-api.granola.ai/v1/notes` com a chave do `.env`: HTTP 200, **uma nota visível**: uma reunião de planejamento de sprint da equipe, criada em 21/09 e editada em 05/10, cujo dono é a conta "Tecnologia e AI" da TI.
- A nota está na pasta **"Team meetings"** (`fol_WEROcYgPA0ti68`) do espaço **"TI Lab team"** (`spa_DcGoa4LgJ9TMR4`). A busca do agente filtra por essa pasta (`folder_id`), que fica configurável.
- `GET /v1/notes/{id}` devolve `summary_markdown` (14,5 mil caracteres, cerca de 4 a 5 mil tokens), `attendees`, `folder_membership`, `web_url` e `updated_at`. A transcrição só vem com `?include=transcript`, e o resumo basta.
- O resumo segue um **modelo fixo**:
  - Lado REVIEW: resumo executivo, indicadores, tarefas **por responsável** (com status, se foi planejada e observações), entregas, bloqueios.
  - Lado PLANNING: objetivo, capacidade, planejamento **por responsável**, épicos, riscos.
  - Fechamento: decisões registradas e **"Próximas ações"** no formato `**ação** — @Responsável — Prazo: …`.
  
  É quase um formulário. A extração fica bem mais confiável do que com texto livre.
- Limite da API: 25 requisições a cada 5 s e 300 por minuto. O agente usa poucas por dia.
- ✅ **Decidido (13/Out): fica a chave atual.** Hoje só existe essa nota mesmo. Se outras pessoas passarem a gravar reuniões em contas próprias, a chave pode não enxergá-las. Nesse caso, a saída é uma **chave de workspace** do plano Business (não expira, pertence ao workspace) com acesso ao espaço "TI Lab team".

**Claude: a chave é da organização, e cada chamada precisa dizer o workspace.**
- `GET https://api.anthropic.com/v1/models` respondeu HTTP 400: *"This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header"*.
- O usuário confirmou (13/Out) que a chave é **vinculada à organização**. Pela documentação oficial ("Workspaces › API keys and resource scoping"), uma chave pessoal ou de conta de serviço sem workspace fixo é **multi-workspace**: cada requisição roda no workspace indicado pelo cabeçalho `anthropic-workspace-id` (`wrkspc_…`). O dono da chave precisa ter acesso a esse workspace.
- Tentar listar os workspaces com essa chave (`GET /v1/organizations/workspaces`) deu **HTTP 403** ("Missing permissions"). O usuário é o **dono da organização**, então a causa provável é o escopo da chave, que não inclui administração. Para o agente isso não importa: ele só usa a API de mensagens. O ID do workspace foi copiado do Console (Settings › Workspaces).
- ✅ **Resolvido (13/Out):** o usuário colocou o ID em `CLAUDE_WORKSPACE_ID` no `.env`. O mesmo `GET /v1/models` com o cabeçalho respondeu **HTTP 200**, o `anthropic-workspace-id` da resposta é o enviado, e `claude-sonnet-5-5` (D2) aparece na lista. Se esse workspace não for o Default, vale configurar nele um limite de gasto mensal (o Default não aceita).
- **No código:** o cliente envia o cabeçalho em todas as chamadas, com `new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, defaultHeaders: { 'anthropic-workspace-id': process.env.CLAUDE_WORKSPACE_ID } })`. `defaultHeaders` é opção documentada do `ClientOptions` do SDK; o SDK não tem opção nem variável de ambiente própria para workspace.
- ✅ **Decidido (13/Out): a chave não muda**, inclusive em produção. Ela é do dono da organização, então o risco de ser arquivada por saída do dono não se aplica. Se um dia for trocada por uma chave presa a um workspace, o código continua funcionando sem `CLAUDE_WORKSPACE_ID`.

**Gemini (reserva, D17): funciona.**
- `GET /v1beta/models/gemini-3.8-flash` com a `GEMINI_API_KEY` do `.env`: HTTP 200, entrada de 1 M tokens, saída de 65 mil, suporta `generateContent`.
- O SDK instalado (`@google/genai` 1.52) aceita `responseMimeType: 'application/json'` com `responseJsonSchema`, então o Gemini recebe o mesmo JSON Schema do Claude.

**WAHA: não alcançável fora da VPS.**
- No `.env`, `VITE_WAHA_API_URL` aponta para `localhost`, e a sessão configurada é `quotations_001` (cotações).
- Daqui, a chamada não conectou (HTTP 000). Da Vercel também não conectaria. É isso que motiva a D9.
- As variáveis `VITE_WAHA_*` **não são usadas em nenhum arquivo de `src/`**. Como têm o prefixo `VITE_`, se algum dia forem lidas no front, a chave do WAHA vai parar no bundle público. Recomendação: removê-las do `.env` e usar nomes sem `VITE_` só na VPS (§16).
- **Número +55 61 9992-4986:** gravado como `556199924986`, sem o 9 extra. Muitos números brasileiros antigos têm o identificador do WhatsApp sem esse dígito. Para os destinatários, o script resolve o identificador certo com `GET /api/contacts/check-exists` do WAHA antes do primeiro envio e guarda o resultado.

**Vercel: cabe.**
- Hoje há 9 functions (o limite do Hobby é 12). O dispatcher novo `api/ti/[action].ts` é a 10ª.
- Crons: o Hobby permite até 100 por projeto, **cada um no máximo 1× por dia**, com disparo em algum momento dentro da hora marcada. As duas rotinas novas (sincronizar reuniões, montar a cobrança) são diárias, então cabem.

---

## 4. Requisitos

### 4.1 Funcionais: Início da EVA (Fase 1)

A interface é a do protótipo (§12). Os requisitos abaixo seguem os blocos dele.

| ID | Requisito |
|---|---|
| **RF01** | **Hero:** orb da EVA, "EVA · Agente de TI · {data}", saudação conforme a hora e a visão, e um briefing de 1 ou 2 frases montado por modelo fixo a partir dos números (atrasadas, mensagens na fila, última reunião importada). Tem também o campo "Pergunte à EVA", com sugestões e microfone (RF23). |
| **RF02** | **Controles:** alternância **Equipe / Minha visão** (D19), que troca todos os blocos. Chips de situação do Granola e do Wa-ha, mais o chip de sugestões pendentes para aprovadores (D25). Botão atualizar. |
| **RF03** | **Indicadores** (4 cards):<br>• **Equipe:** Em aberto (de Backlog a Revisão), Atrasadas (dica: N críticas), Concluídas na semana, Cobranças enviadas hoje.<br>• **Minha visão:** Em aberto (meus), Atrasadas (minhas), Hoje (x/y das tasks do dia), Projetos (meus, dica: N em risco). |
| **RF04** | **Resumo do Kanban:** barra proporcional e as 5 colunas com contagem e até 2 cards de destaque (critério na §12.1). Na Minha visão, só os meus. |
| **RF05** | **Atrasadas e cobranças:** prioridade, título, projeto, responsável, dias de atraso e último contato da EVA. Filtro Todas / Crítica e alta. O botão Cobrar/Lembrar (RF25) entra na Fase 3. |
| **RF06** | **Fila do WhatsApp:** mensagens recentes e pendentes, com horário, destinatário, texto e status (D24). Fica vazia, com explicação, até a Fase 3. |
| **RF07** | **Projetos em andamento:** nome, sprint ativa, feito/total, prazo deduzido e situação (RN05, D27). |
| **RF08** | **Minhas tasks do dia** (D23): checklist dos meus cards que vencem hoje e dos atrasados. Marcar conclui o card, com opção de desfazer. |
| **RF09** | **Comentários da EVA**, um por bloco (D21): texto, origem, ação principal e "Perguntar à EVA". Somem quando a regra não tem nada a dizer. |

### 4.2 Funcionais: reuniões, sugestões e chat (Fase 2)

| ID | Requisito |
|---|---|
| **RF10** | Cadastro de **membros**: usuário do FlowLab, apelidos (como aparece nas reuniões), WhatsApp e adesão à cobrança. Só aprovadores veem e editam. |
| **RF11** | **Colar reunião:** título, data e resumo (texto ou markdown). O agente analisa na hora e mostra as sugestões. Qualquer pessoa com `canManageIT` pode enviar. |
| **RF12** | **Sincronizar com o Granola:** uma vez por dia útil (cron) e pelo botão "Buscar reuniões agora". Busca as notas novas da pasta configurada, guarda e analisa. |
| **RF13** | Lista de **reuniões**: origem, data, status da análise (pendente, analisando, analisada, erro), número de sugestões e link para a nota no Granola. Mostra o selo "atualizada desde a análise" quando a nota mudou depois (D14). |
| **RF14** | **Fila de sugestões:** cada sugestão mostra o tipo, o card afetado (se houver), os campos propostos, o **trecho da reunião** que a justifica e a confiança. O aprovador pode **editar os campos e aprovar**, ou **rejeitar** com motivo. Aprovação em lote para as de confiança alta. |
| **RF15** | Aprovar uma sugestão aplica a mudança no Kanban na hora: cria o card, muda o card ou grava o comentário. Também avisa no sino os responsáveis do card. |
| **RF16** | Os aprovadores recebem notificação no sino quando há sugestões novas. |
| **RF17** | **Reanalisar** uma reunião (D14). |
| **RF23** | **Chat com a EVA** (D20, §12.3): drawer e barra flutuante do protótipo, respondendo pelo `agente-perguntar`. Pode propor ações, executadas só com aprovação prévia (D28). Limite diário por pessoa. |
| **RF24** | **Ditado por voz** (D26) no hero, no drawer e na barra flutuante, com as mensagens de erro do handoff. |

### 4.3 Funcionais: WhatsApp (Fases 3 e 4)

| ID | Requisito | Fase |
|---|---|---|
| **RF18** | **Cobrança diária:** em dia útil, uma mensagem por membro com adesão, listando as pendências (RN12). | 3 |
| **RF19** | Botão **"Enviar teste"** por membro, que confirma que o número recebe. | 3 |
| **RF20** | **Liga/desliga geral** do WhatsApp e da cobrança, na aba Configurações, sem precisar de deploy. | 3 |
| **RF21** | Histórico de mensagens por membro (enviadas, falhas, recebidas). | 3 |
| **RF22** | **Respostas:** a mensagem recebida de um membro vira comentário no card citado e, se pedir mudança (concluir, adiar, bloquear), uma sugestão na fila. O agente responde confirmando o que entendeu. | 4 |
| **RF25** | **Cobrar / Lembrar sob demanda** (D22): o botão no bloco de atrasadas põe uma mensagem na fila na hora. A tela mostra "Cobrada", e o card de Cobranças soma +1. | 3 |
| **RF26** | **Entregue / Lida** na fila do Início, a partir das confirmações do WAHA (`message.ack`, D24). | 4 |

### 4.4 Regras de negócio

| ID | Regra |
|---|---|
| **RN01** | **Card aberto:** `kanban_status <> 'done'`, `status` fora de (`resolved`, `cancelled`) e `kanban_hidden = false`. |
| **RN02** | **Atrasado:** card aberto com prazo antes de hoje.<br>• **"Hoje"** é o dia de **America/Sao_Paulo**.<br>• **O dia do prazo** é o que foi escolhido no Board. O `ITTaskDrawer`, único lugar que grava `due_date`, salva esse dia como meia-noite UTC (`new Date('2026-10-20').toISOString()`). Por isso o prazo é lido **sem converter fuso** (`diaDoPrazo`). Converter para Brasília jogaria todo prazo para o dia anterior, às 21h. Descoberto na implementação, em 13/Out.<br>• **Instantes reais** (`updated_at`, comentários) usam o fuso de Brasília. |
| **RN03** | **Vence em breve:** card aberto com vencimento entre hoje e hoje + N dias. N = 7 no Início. Na cobrança, conta o vencimento hoje ou no próximo dia útil. |
| **RN04** | **Parado:** card em `in_progress` ou `review` sem mudança há `dias_parado` dias corridos ou mais (padrão 5). A última mudança é a mais recente entre `updated_at` e o último comentário. |
| **RN05** | **Projeto (D4).** **Em andamento:** tem sprint `active` ou pelo menos um card aberto. **Prazo:** o maior entre o `end_date` da sprint ativa e o maior `due_date` dos cards abertos, ou vazio se não houver nenhum. **Situação:** *Atrasado* se algum card aberto está atrasado ou a sprint ativa já passou do fim. *Atenção* se algum card aberto vence em até 3 dias, ou se a sprint ativa termina em até 3 dias com cards abertos, ou se o progresso da sprint ativa está mais de 20 pontos abaixo do tempo já decorrido dela (D27). *No prazo* se tem prazo. *Sem prazo* nos demais casos. **Progresso:** cards `done` ÷ cards não ocultos e não cancelados, da sprint ativa se houver, senão do projeto. |
| **RN06** | Nenhuma regra chama `new Date()` por dentro: `hoje` entra como argumento, e todas ficam em `domain/` com testes. É a mesma convenção de Gastos de TI e Qualidade. |
| **RN07** | **Nada muda no Kanban sem aprovação (D6).** A aprovação roda numa RPC única e atômica: aplica a mudança e marca a sugestão como aprovada. Se qualquer passo falhar, nenhum vale. |
| **RN08** | **Pessoas:** o agente só pode atribuir responsáveis da lista de membros que recebe. "@Nome" bate com o membro pelos apelidos, sem diferenciar acento nem maiúsculas. Sem correspondência, ou com "Equipe", a sugestão vai sem responsável e com aviso. |
| **RN09** | **Cards:** o agente recebe a lista de cards abertos e só pode citar códigos dessa lista. O servidor confere. Se o código não existir, a sugestão vira "criar card" com confiança baixa e aviso. |
| **RN10** | **Prazos:** a IA devolve uma data ISO ou vazio, e guarda o texto original ("Prazo: próxima sprint"). Prazos relativos são resolvidos a partir da **data da reunião**, não da data da análise. "Não informado" fica vazio. |
| **RN11** | Reanalisar troca as sugestões **pendentes** daquela reunião (marcadas `substituida`) e nunca mexe nas aprovadas ou rejeitadas. |
| **RN12** | **Cobrança:** só membros ativos, com adesão e WhatsApp. Só em dias úteis. Só se houver pendência. No máximo uma mensagem por pessoa por dia (vale mesmo que o cron rode duas vezes). Até 8 itens, mais "e outras N no Início". Respeita o liga/desliga geral. |
| **RN13** | **Recebidas:** só valem mensagens de um membro cadastrado. São ignoradas mensagens de grupos (`@g.us`), as enviadas pelo próprio número (`fromMe`) e as de números desconhecidos. As desconhecidas são registradas como `ignorada`, sem resposta. |
| **RN14** | Toda chamada de IA vira uma linha em `ti_agente_chamadas_ia`, inclusive a do Claude que falhou e levou ao Gemini. A linha guarda finalidade, provedor, modelo, tokens de entrada e saída, duração, resultado e motivo da falha. **Nenhum texto de reunião ou de mensagem** vai para esse registro. |
| **RN15** | O conteúdo das reuniões e das mensagens recebidas é **dado, nunca instrução**. Ele vai delimitado no prompt, a saída é validada pelo schema e nada é aplicado sem aprovação (RN07). |
| **RN16** | **Cobrança sob demanda (D22):** no máximo 1 por card a cada 4 h. Só para membro ativo, com adesão e WhatsApp. Respeita o liga/desliga geral. Não conta para o limite de 1 cobrança automática por dia (RN12). Grava quem clicou (`enviada_por`). |
| **RN17** | **O chat não age sozinho (D20, D28).** Ele responde, cita cards e pode **propor** ações (criar, mudar ou comentar cards). Cada proposta aparece no drawer com o que muda: o gestor confirma e a EVA executa; os demais enviam para a fila. Cobrança não é proposta pelo chat: ele indica o botão Cobrar. No máximo 30 perguntas por pessoa por dia. Na Minha visão, o contexto se limita ao que é da pessoa. |
| **RN18** | **Proposta (D28):** toda ação da EVA nasce como linha em `ti_agente_sugestoes` com `origem` (`reuniao`, `whatsapp`, `comentario`, `chat`) e `proposta_por`. Só a RPC de aprovação aplica a mudança. A proposta e a aprovação na mesma ação (gestor confirmando) rodam numa transação só. |

### 4.5 Não funcionais

| ID | Requisito |
|---|---|
| **RNF01** | **Segurança:** chaves do Claude, do Granola e do WAHA só no servidor ou na VPS, nunca com prefixo `VITE_`. O WAHA continua fechado na VPS (D9). O webhook é validado (§11.3). Os crons exigem `CRON_SECRET`. RLS em todas as tabelas novas. |
| **RNF02** | **Functions:** um dispatcher só, `api/ti/[action].ts`, registrado nos três lugares de sempre (Vercel, `api/server.ts`, middleware do `vite.config.ts`). |
| **RNF03** | **Duração:** uma análise leva de 30 s a 2 min. Com a reserva, o pior caso fica em 4,5 min: Claude com 2 tentativas de 90 s, mais 90 s do Gemini (§9.1). A function tem `maxDuration` de 300 s. A sincronização só começa uma análise nova se ainda restarem 4,5 min; o resto fica `pendente` para a próxima execução ou para o botão. |
| **RNF04** | **Custo da IA:** cerca de US$ 0,06 a 0,11 por reunião com o Sonnet 5.5 (§9.5), ou seja, menos de US$ 0,50 por mês no ritmo semanal. Cada resposta de WhatsApp custa cerca de US$ 0,01. O Gemini só é cobrado quando assume. |
| **RNF05** | **Testabilidade:** regras em `domain/` puras e testadas. Os clientes de Granola, Claude e WAHA recebem `fetch`/cliente injetado e nunca lançam exceção, como em `api/_lib/requestsDigestWhatsApp.ts`. Toda rotina aceita `?dryRun=true`. |
| **RNF06** | **Desempenho:** o painel carrega em menos de 2 s. A consulta pega só cards abertos e os concluídos nos últimos 14 dias, paginando (o PostgREST corta em 1000 linhas). |
| **RNF07** | **Dados pessoais (LGPD):** resumos de reunião, telefones e mensagens só são visíveis para aprovadores, exceto a lista de reuniões, que é da equipe de TI. A retenção das mensagens (ex.: 180 dias) fica para depois da v1. Com a reserva, o resumo da reunião também pode ir para o Google (Gemini), como já acontece com os documentos do Apoio Alvaro. |
| **RNF08** | **Interface:** segue o protótipo do Claude Design (D5), com tema claro e escuro e uso no celular. Gráficos seguem a skill `dataviz`. |

---

## 5. Arquitetura

```
                    ┌──────────────────────────── Vercel ─────────────────────────────┐
 Granola API ◄──────┤ api/ti/[action].ts                                               │
 (notas da pasta)   │  ├─ agente-sync-cron     (cron diário)  ─┐                       │
                    │  ├─ agente-sincronizar   (botão)        ─┼─► analisa com IA ─────┼──► Claude Sonnet 5.5
 Usuário (colar) ──►│  ├─ agente-analisar      (colar resumo) ─┘     │                 │      └► Gemini 3.8 Flash (se o Claude falhar)
                    │  ├─ agente-cobranca-cron (cron diário) ──┐     ▼                 │
                    │  └─ waha-webhook         (recebidas) ◄─┐ │  ti_agente_sugestoes  │
                    └────────────────────────────────────────┼─┼───────────┬───────────┘
                                                             │ │           │ aprovar (RPC)
                                       ti_agente_mensagens ◄─┼─┘           ▼
                                       (fila de saída)       │        it_requests (Kanban)
                                              │              │
                    ┌───────────── VPS ───────┼──────────────┼──┐
                    │ tools/agente-ti-whatsapp│ (timer 1 min)│  │
                    │   lê a fila ────────────┘              │  │
                    │   envia ─► WAHA 127.0.0.1:3000 ────────┘  │  ◄─► WhatsApp (+55 61 9992-4986)
                    │            (sessão eva; webhook ──► Vercel)
                    └───────────────────────────────────────────┘
```

**Fluxo 1, reunião → sugestões:**
1. A reunião entra pelo cron, pelo botão ou colada à mão e vai para `ti_agente_reunioes`.
2. O servidor monta o contexto: membros, cards abertos, projetos e sprints.
3. O Claude Sonnet 5.5 devolve as sugestões no schema. Se ele falhar, o Gemini responde no mesmo schema (D17).
4. O servidor valida (RN08 a RN10) e grava em `ti_agente_sugestoes`.
5. Os aprovadores recebem aviso no sino.
6. Quem aprova chama a RPC, que aplica a mudança em `it_requests`.

**Fluxo 2, cobrança:**
1. O cron calcula as pendências com as **mesmas regras do Início** (RN01 a RN04, em `domain/`).
2. Monta uma mensagem por membro (modelo fixo, D11) e grava na fila.
3. O timer da VPS envia.

**Fluxo 3, resposta:**
1. O WAHA chama `waha-webhook`, que valida e grava a mensagem recebida.
2. O Claude interpreta a mensagem; se ele falhar, o Gemini.
3. O servidor grava o comentário no card e a sugestão na fila.
4. O servidor enfileira a confirmação, que o timer da VPS envia.

---

## 6. Modelo de dados

Prefixo **`ti_agente_`**, seguindo Gastos de TI. O prefixo `it_` pertence às tabelas antigas, que usam a RLS por `department = 'TI'`. Convenções de sempre:
- `uuid` com `gen_random_uuid()`;
- `created_at`/`updated_at` com trigger;
- `text` com CHECK nomeado em vez de enum;
- `COMMENT ON` em pt-BR;
- guarda `to_regprocedure('public.current_user_has_permission(text)')` no topo da migration.

### 6.1 Tabelas

**`ti_agente_config`** (uma linha só)

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | boolean PK DEFAULT true, CHECK (`id`) | garante uma linha só |
| `granola_folder_id` | text NULL | pasta que o agente lê (hoje `fol_WEROcYgPA0ti68`, "Team meetings") |
| `granola_ultima_sync_em` | timestamptz NULL | cursor da sincronização (`updated_after`): o maior `updated_at` de nota já visto, não a hora da execução |
| `granola_verificado_em` | timestamptz NULL | fim da última sincronização sem erro, com ou sem nota nova. Alimenta o chip "Granola" do Início (D25) |
| `granola_ultimo_erro` | text NULL | erro da última sincronização; NULL quando ela terminou bem. Acende o chip em vermelho |
| `whatsapp_ativo` | boolean DEFAULT false | liga/desliga geral do envio (RF20) |
| `cobranca_ativa` | boolean DEFAULT false | liga/desliga só da cobrança diária |
| `dias_parado` | smallint DEFAULT 5 CHECK 1–60 | RN04 |
| `waha_status` | text NULL | situação da sessão `eva` (`WORKING`, `SCAN_QR_CODE`, `FAILED`…), gravada pelo script da VPS (D25) |
| `waha_verificado_em` | timestamptz NULL | último aviso do script. Mais de 5 min sem aviso = chip "Wa-ha sem sinal" |
| `updated_by`, `updated_at` | | |

**`ti_agente_membros`**

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL UNIQUE → `user_profiles` | |
| `apelidos` | text[] DEFAULT '{}' | como aparece nas reuniões: "Gabriel Carneiro", "Gabriel" (RN08) |
| `whatsapp` | text NULL, CHECK só dígitos, 12–13 | ex.: `5561999924986` |
| `whatsapp_chat_id` | text NULL | resolvido pelo WAHA no primeiro envio (`…@c.us`) |
| `recebe_cobranca` | boolean DEFAULT false | adesão explícita (D10) |
| `ativo` | boolean DEFAULT true | |
| `created_at`, `updated_at`, `updated_by` | | |

**`ti_agente_reunioes`**

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `origem` | text CHECK (`granola`, `manual`) | |
| `granola_note_id` | text NULL UNIQUE | `not_…` |
| `titulo` | text NOT NULL | |
| `realizada_em` | timestamptz NULL | início do evento ou `created_at` da nota; base dos prazos relativos (RN10) |
| `resumo_markdown` | text NOT NULL | |
| `web_url` | text NULL | link para a nota no Granola |
| `fonte_atualizada_em` | timestamptz NULL | `updated_at` da nota, que alimenta o selo da D14 |
| `status` | text CHECK (`pendente`, `analisando`, `analisada`, `erro`) | |
| `erro` | text NULL | |
| `analisada_em` | timestamptz NULL | |
| `provedor` | text NULL CHECK (`claude`, `gemini`) | quem respondeu. `gemini` acende o selo "analisada pelo Gemini" na fila (D17); os tokens ficam em `ti_agente_chamadas_ia` |
| `motivo_reserva` | text NULL | por que o Claude não respondeu, quando houve troca |
| `observacoes` | text NULL | o que a reunião decidiu de mais importante para os projetos (campo `observacoes` da análise); alimenta o comentário do bloco Projetos |
| `created_by` | uuid NULL → `user_profiles` | vazio quando vem do cron |
| `created_at` | | |

**`ti_agente_sugestoes`**

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `reuniao_id` | uuid NULL → `ti_agente_reunioes` ON DELETE CASCADE | |
| `mensagem_id` | uuid NULL → `ti_agente_mensagens` | quando vem de uma resposta no WhatsApp (Fase 4) |
| `origem` | text CHECK (`reuniao`, `whatsapp`, `comentario`, `chat`) | de onde veio a proposta (RN18) |
| `proposta_por` | uuid NULL → `user_profiles` | quem clicou na ação do comentário ou do chat. Vazio quando veio de reunião ou WhatsApp |
| `tipo` | text CHECK (`criar_card`, `atualizar_card`, `comentar_card`) | |
| `card_id` | uuid NULL → `it_requests` ON DELETE SET NULL | obrigatório para atualizar e comentar |
| `proposta` | jsonb NOT NULL | campos propostos (§9.3) |
| `trecho` | text NOT NULL | trecho da reunião ou da mensagem que justifica |
| `confianca` | text CHECK (`alta`, `media`, `baixa`) | |
| `avisos` | text[] DEFAULT '{}' | ex.: "responsável '@Erika' não é membro" |
| `status` | text CHECK (`pendente`, `aprovada`, `rejeitada`, `substituida`) DEFAULT `pendente` | |
| `decidido_por`, `decidido_em`, `motivo_rejeicao` | | |
| `card_resultante_id` | uuid NULL → `it_requests` | o card criado ou mudado |
| `created_at` | | |

Índices: (`status`, `created_at`), `reuniao_id`, `card_id`.

**`ti_agente_mensagens`** (fila de saída e histórico)

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `membro_id` | uuid NULL → `ti_agente_membros` | vazio para número desconhecido (RN13) |
| `direcao` | text CHECK (`saida`, `entrada`) | |
| `tipo` | text CHECK (`cobranca`, `cobranca_manual`, `teste`, `confirmacao`, `recebida`) | `cobranca_manual` = botão Cobrar/Lembrar (D22) |
| `texto` | text NOT NULL | |
| `card_ids` | uuid[] DEFAULT '{}' | cards citados |
| `status` | text CHECK (`pendente`, `enviada`, `entregue`, `lida`, `falhou`, `recebida`, `ignorada`) | `entregue`/`lida` vêm do `message.ack` do WAHA (Fase 4, D24) |
| `enviada_por` | uuid NULL → `user_profiles` | quem clicou em Cobrar/Lembrar (RN16). Vazio nas automáticas |
| `tentativas` | smallint DEFAULT 0 | |
| `proxima_tentativa_em` | timestamptz NULL | atraso crescente: 1, 5 e 15 min |
| `chave_dia` | text NULL | `cobranca:<membro>:<YYYY-MM-DD>`, UNIQUE, garante 1 cobrança por dia (RN12) |
| `waha_message_id` | text NULL UNIQUE | evita gravar a mesma recebida duas vezes |
| `erro` | text NULL | |
| `created_at`, `enviada_em` | | |

**`ti_agente_chamadas_ia`** (registro de uso, RN14)

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `finalidade` | text CHECK (`analise_reuniao`, `resposta_whatsapp`, `chat`) | |
| `user_id` | uuid NULL → `user_profiles` | quem perguntou, no chat. Base do limite diário (RN17) |
| `reuniao_id` | uuid NULL → `ti_agente_reunioes` ON DELETE SET NULL | |
| `mensagem_id` | uuid NULL → `ti_agente_mensagens` ON DELETE SET NULL | |
| `provedor` | text CHECK (`claude`, `gemini`) | |
| `modelo` | text NOT NULL | `claude-sonnet-5-5` ou `gemini-3.8-flash` |
| `resultado` | text CHECK (`ok`, `erro`, `configuracao`, `recusa`, `cortada`, `schema_invalido`) | `configuracao` = 400/401/403, que precisa de gente para resolver |
| `erro` | text NULL | mensagem curta do provedor, sem conteúdo da reunião |
| `tokens_entrada`, `tokens_saida` | integer NULL | |
| `duracao_ms` | integer NOT NULL | |
| `created_at` | timestamptz | |

Índices: `created_at`, (`provedor`, `resultado`).

### 6.2 RLS

| Tabela | Ler | Gravar pelo cliente |
|---|---|---|
| `ti_agente_config` | `canManageIT` ou `canApproveAgenteTI` | update: `canApproveAgenteTI` |
| `ti_agente_membros` | `canApproveAgenteTI` (tem telefone) | `canApproveAgenteTI` |
| `ti_agente_reunioes` | `canManageIT` ou `canApproveAgenteTI` | nenhuma (só o servidor grava) |
| `ti_agente_sugestoes` | `canManageIT` ou `canApproveAgenteTI` | nenhuma (só pelas RPCs) |
| `ti_agente_mensagens` | `canApproveAgenteTI` | nenhuma (servidor e VPS, com service role) |
| `ti_agente_chamadas_ia` | `canManageIT` ou `canApproveAgenteTI` (só metadados) | nenhuma (só o servidor grava) |

### 6.3 RPCs

- **`ti_agente_aprovar_sugestao(p_id uuid, p_proposta jsonb DEFAULT NULL) RETURNS uuid`**
  - `SECURITY DEFINER`, `search_path` fixo. Confere `canApproveAgenteTI` e trava a sugestão (`FOR UPDATE`). Exige `status = 'pendente'`. Se `p_proposta` vier, ela substitui a proposta (o aprovador editou). Aplica conforme o tipo:
    - **`criar_card`:** insere em `it_requests` com `requested_by = auth.uid()`, `is_internal = true`, `tags` com `agente-ti`. Os padrões são `request_type = 'desenvolvimento'`, `priority = 'medium'` e `kanban_status = 'todo'`. Projeto e sprint vêm da proposta.
    - **`atualizar_card`:** muda só `kanban_status`, `due_date`, `assigned_to` e `priority`. Ao ir para `done`, também grava `status = 'resolved'`, a mesma regra de `ITKanbanBoard.tsx:774`.
    - **`comentar_card`:** insere em `it_task_comments` com `user_id = auth.uid()`.
  - Marca a sugestão como `aprovada`, com quem e quando, e guarda `card_resultante_id`. Insere em `user_notifications` um aviso para cada responsável do card (módulo `IT`). Devolve o id do card.
  - Como roda como `SECURITY DEFINER`, ela **ignora a RLS de `it_requests`**. A conferência de permissão no começo é obrigatória e tem teste.
- **`ti_agente_rejeitar_sugestao(p_id uuid, p_motivo text) RETURNS void`**: mesma conferência; exige motivo não vazio.
- **`ti_agente_propor_sugestao(p_tipo text, p_card_id uuid, p_proposta jsonb, p_trecho text, p_origem text, p_aprovar boolean DEFAULT false) RETURNS uuid`** (D28, RN18): é o caminho das ações vindas de comentários e do chat.
  - `SECURITY DEFINER`. Exige `canManageIT` ou `canApproveAgenteTI` para propor.
  - Insere a sugestão com `origem` e `proposta_por = auth.uid()`.
  - Com `p_aprovar = true`, exige `canApproveAgenteTI` e chama a aprovação **na mesma transação**: o gestor confirmou no diálogo, e a EVA executa na hora.
  - Devolve o id da sugestão.
- **`ti_agente_cobrancas_hoje() RETURNS integer`** (D24): `SECURITY DEFINER`, exige `canManageIT`. Conta as mensagens `cobranca` e `cobranca_manual` enviadas hoje (dia de Brasília), sem expor texto nem destinatário. Alimenta o indicador do Início para quem não é gestor.

---

## 7. Permissões, rotas e menu

**Chave nova** em `src/utils/permissions.ts`, grupo `'Tecnologia'`:
- `canApproveAgenteTI`: "Aprovar sugestões e configurar a EVA".
- Entra na lista de exclusão do `operator` legado, com caso novo em `permissions.test.ts`. Nenhuma migration grava em `custom_roles` (D15).

**Rotas** em `src/App.tsx`, no bloco de TI:

| Rota | Tela | Permissão |
|---|---|---|
| `/it/inicio` | Início da EVA (o protótipo, §12) | `canManageIT` (D7) |
| `/it/eva` | Administração da EVA, aba Sugestões | `anyOf: canManageIT, canApproveAgenteTI` |
| `/it/eva/reunioes` | Reuniões + colar reunião | idem |
| `/it/eva/membros` | Membros | `canApproveAgenteTI` |
| `/it/eva/configuracoes` | Liga/desliga, pasta do Granola, dias parado, situação das integrações | `canApproveAgenteTI` |

Quem tem só `canManageIT` vê as sugestões, mas os botões de aprovar e rejeitar só aparecem com `canApproveAgenteTI`.

**Menu** em `src/components/Layout.tsx`, como no README do handoff (`docs/flowlab_agent/design_handoff_eva_home/README.md`, passo 3):
- **Início:** primeiro subitem de "Tecnologia", com ícone `Sparkles` e a pílula **EVA**.
  - A pílula pede uma propriedade nova, `badge?: string`, em `NavigationItem`.
  - O `Link` do subitem passa de `block` para `flex items-center`.
- **EVA:** subitem novo para a administração (`/it/eva`), com `matchNested` (criado em Gastos de TI).
- **Item pai "Tecnologia":** ganha `canApproveAgenteTI` no `anyOf`. Pela D8, o `href` do pai vira `/it/inicio` para quem tem `canManageIT`.
- Rotas novas na lista que abre o grupo automaticamente.

---

## 8. Estrutura do código

O módulo do front parte do código do handoff (`docs/flowlab_agent/design_handoff_eva_home/src/modules/eva/`). Ele já segue o padrão do repositório: React 18, TS, Tailwind 3.4, lucide-react 0.263, framer-motion 12 e `useAuth` em `src/hooks/useAuth.ts`, tudo conferido em 13/Out. A pasta é copiada inteira, e o que é mock passa a usar dados reais (§12.2). O que o plano acrescenta aparece marcado com `+`.

```
src/modules/eva/
├── index.ts
├── types.ts                       # do handoff + Membro, Reuniao, Sugestao, Mensagem (+)
├── constants.ts                   # do handoff (cores do kanban, prioridades, status) + limites (+)
├── domain/                        # puro, `hoje` sempre como argumento (RN06); usado pelo front, pela api e pela VPS
│   ├── chatReplies.ts             # do handoff: helpers de data; as respostas fixas saem quando o chat real entra
│   ├── datas.ts (+ .test)         # (+) dia em America/Sao_Paulo, dias úteis, "próximo dia útil"
│   ├── demandas.ts (+ .test)      # (+) aberto, atrasado, vence em breve, parado, tasks do dia, resumo do kanban
│   ├── projetos.ts (+ .test)      # (+) em andamento, prazo, situação, progresso e ritmo (RN05)
│   ├── inicio.ts (+ .test)        # (+) snapshot do Início por visão: indicadores, briefing, destaques (§12.2)
│   ├── comentarios.ts (+ .test)   # (+) comentários da EVA por regra (D21)
│   ├── cobranca.ts (+ .test)      # (+) pendências por membro + textos das mensagens (D11, D22, RN12, RN16)
│   └── pessoas.ts (+ .test)       # (+) normaliza "@Nome" e casa com os apelidos (RN08)
├── services/evaService.ts         # do handoff: ponto único de integração; lê do Supabase (os mocks do handoff saíram)
├── hooks/
│   ├── useEvaHome.ts              # do handoff, ligado ao evaService real (paginação, guarda de resposta atrasada)
│   ├── useEvaChat.ts              # do handoff, chamando `agente-perguntar` (D20)
│   ├── useVoiceInput.ts           # do handoff, sem mudança (D26)
│   ├── useScrolledPast.ts         # do handoff
│   ├── useSugestoes.ts            # (+) fila + aprovar/rejeitar (RPC)
│   ├── useReunioes.ts             # (+)
│   ├── useMembrosAgente.ts        # (+)
│   └── useConfigAgente.ts         # (+)
└── components/
    ├── (os 19 arquivos do handoff) # EvaHomePage, EvaHero, EvaControls, EvaStatCards, KanbanSummaryCard,
    │                              # OverdueCard, WhatsAppQueueCard, ProjectsCard, MyTasksCard, EvaInsight,
    │                              # EvaChatDrawer, EvaFloatingChat, EvaOrb, EvaGlow, ui, eva.css…
    └── admin/                     # (+) EvaAdminShell (abas), SugestoesPage, SugestaoCard, EditarSugestaoModal,
                                   #     ReunioesPage, ColarReuniaoModal, MembrosPage, ConfiguracoesPage

api/ti/[action].ts                 # dispatcher (espelha api/notifications/[action].ts)
api/_lib/handlers/
├── ti-agente-sync-cron.ts         # GET, CRON_SECRET, ?dryRun
├── ti-agente-sincronizar.ts       # POST, sessão + canManageIT
├── ti-agente-analisar.ts          # POST, sessão + canManageIT (colar) ou canApproveAgenteTI (reanalisar)
├── ti-agente-cobranca-cron.ts     # GET, CRON_SECRET, ?dryRun
├── ti-agente-cobrar.ts            # POST, sessão; Cobrar/Lembrar sob demanda (D22)
├── ti-agente-perguntar.ts         # POST, sessão + canManageIT; chat com a EVA (D20)
└── ti-waha-webhook.ts             # POST, validação do webhook (§11.3)
api/_lib/ti-agente/
├── granola.ts (+ .test)           # listar notas da pasta, buscar nota; fetch injetado
├── ia/
│   ├── claude.ts                  # @anthropic-ai/sdk, Sonnet 5.5, cabeçalho do workspace, tempo e tentativas (§9.1)
│   ├── gemini.ts                  # @google/genai, Gemini 3.8 Flash, reserva (D17)
│   └── gerarEstruturado.ts (+ .test)  # tenta o Claude, cai no Gemini, valida no zod, grava em ti_agente_chamadas_ia
├── extracao.ts (+ .test)          # prompt, schema zod, montagem do contexto, validação pós-IA (RN08–RN10)
├── respostas.ts (+ .test)         # interpretação de mensagem recebida (Fase 4)
├── chat.ts (+ .test)              # contexto, limite diário e resposta do chat (D20, RN17)
└── analisarReuniao.ts             # orquestra: contexto → Claude → validação → gravação → aviso aos aprovadores

tools/agente-ti-whatsapp/
├── README.md
├── install.sh                     # timer systemd a cada minuto (molde: tools/hardware-monitor/install.sh)
└── send-outbox.ts                 # lê a fila, resolve chatId, envia pelo WAHA local, atualiza status
                                   # e grava a situação da sessão do WAHA (D25)
```

**Domínio compartilhado.** Nada em `api/` importa de `src/` hoje. O script da VPS importa de `src/modules/...`, como `tools/quotation-approval-digest/send-digest.ts`. Para a cobrança usar as mesmas regras do Início, os handlers de `api/` importam `src/modules/eva/domain/*`, que não pode usar `import.meta.env` nem nada do navegador. **Conferir no primeiro preview** que a function empacota esse import. Se não empacotar, o domínio vai para `api/_lib/ti-agente/domain/` e o front importa de lá (issue 06).

**Reaproveitamentos:**
- **Autenticação nos handlers:** `getSupabaseAdminClient()` / `getSupabaseUserClient(token)` (`api/_lib/supabase.ts`); conferência de sessão como em `api/_lib/rh/autorizacao.ts`; cron como em `umami-inatividade-cron.ts`.
- **Notificação no sino:** `user_notifications` (inserção pelo servidor, com service role).
- **Detalhe do card:** `ITTaskDrawer` existente.
- **Formatação:** `src/modules/faturamento/utils/formato.ts`.

**Dependências novas:**
- `@anthropic-ai/sdk`;
- `zod` 4, declarado explicitamente. Hoje só existe o 3.22, como dependência indireta, e ele não tem `z.toJSONSchema`, necessário para gerar o JSON Schema único da §9.1.

O `@google/genai` (1.52) já está no projeto.

---

## 9. O agente: extração com IA (Claude Sonnet 5.5, Gemini de reserva)

### 9.1 Chamada e reserva

**Uma porta de entrada só:** `gerarEstruturado({ finalidade, instrucoes, conteudo, schema, esforco })`.
- É usada pela análise de reunião (§9), pelo chat do Início (§12.3) e pela leitura das respostas do WhatsApp (§11.3).
- Tenta o Claude primeiro. Se ele falhar, chama o Gemini. Cada tentativa vira uma linha em `ti_agente_chamadas_ia` (RN14).
- Nenhum outro código chama os SDKs de IA direto.

**Schema único.**
- O schema da §9.3 é escrito em zod e convertido **uma vez** para JSON Schema (`z.toJSONSchema`, zod 4).
- Formato: todos os campos em `required`, os opcionais como `nullable`, e `additionalProperties: false`. É o que a saída estruturada do Claude exige, e o Gemini também aceita.
- O mesmo JSON Schema vai para os dois provedores. A resposta de qualquer um passa pelo mesmo `safeParse` do zod e depois pela validação da §9.4. Assim, nada depois da IA muda quando o provedor muda.

**Claude, o principal (D2):**
- **Cliente:** `new Anthropic({ apiKey: CLAUDE_API_KEY, defaultHeaders: { 'anthropic-workspace-id': CLAUDE_WORKSPACE_ID }, timeout: 90_000, maxRetries: 1 })`.
  - O cabeçalho só vai quando `CLAUDE_WORKSPACE_ID` existe (§3).
  - Tempo e novas tentativas ficam abaixo do padrão do SDK (10 min, 2 tentativas), para sobrar tempo para o Gemini dentro da function (RNF03).
- **Modelo:** fixo, `claude-sonnet-5-5`, numa constante. Não há variável para trocar de modelo, e nenhum outro modelo Claude entra.
- **Chamada:** `client.messages.create()` com `max_tokens: 16000`, sem streaming, e `output_config: { effort, format: { type: 'json_schema', schema } }`. A saída esperada fica entre 3 e 6 mil tokens.
- **Esforço explícito:** `medium` na análise de reunião e `low` nas respostas do WhatsApp.
  - No Sonnet 5.5 o padrão é `high`, e os níveis foram recalibrados em relação ao Sonnet 5.
  - Se as sugestões não convencerem, o primeiro ajuste é subir a análise para `high`, medindo os tokens no registro.
- **Raciocínio:** o parâmetro `thinking` fica de fora, e o modelo decide quanto pensar (adaptativo). `{ type: 'disabled' }` dá erro 400 nesse modelo.
- **Sem o fallback de recusa do servidor da Anthropic.** Ele trocaria para outro modelo Claude, o que vai contra a D2. Uma recusa cai no Gemini.
- **Erros:** classes tipadas do SDK (`RateLimitError`, `APIError`…), nunca comparação de texto.

**Quando o Gemini assume (D17):**
- erro da API depois da nova tentativa do SDK: 429, 5xx, 529 (sobrecarga), tempo esgotado, falha de conexão;
- erro de configuração (400, 401, 403) ou `CLAUDE_API_KEY` ausente. O Gemini assume do mesmo jeito, mas o resultado fica marcado como `configuracao`, porque precisa de gente para resolver, e não pode ficar escondido atrás da reserva;
- `stop_reason` igual a `refusal` ou `max_tokens` (resposta cortada);
- resposta que não passa no `safeParse`.

**Gemini, a reserva:**
- `@google/genai` (já instalado), no molde de `api/_lib/apoio/gemini.ts`:
  - `ai.models.generateContent({ model, contents, config: { systemInstruction, responseMimeType: 'application/json', responseJsonSchema } })`;
  - tempo limite de 90 s. Os 60 s iniciais se mostraram curtos no teste com a reunião real (13/Out): uma rodada levou 35 s, a outra estourou.
- **Modelo:** `gemini-3.8-flash`, escolhido pelo usuário e confirmado na chave em 13/Out (§3).
  - Fica em `AGENTE_TI_GEMINI_MODEL`, com esse valor como padrão, separado do `GEMINI_MODEL` do Apoio Alvaro, para uma mudança num não afetar o outro.
- **Instruções:** as mesmas do Claude (§9.2), em `systemInstruction`. O conteúdo da reunião segue em `contents`.
- Tirar cerca de markdown antes do `JSON.parse`, como faz `parseRespostaJson` do Apoio.
- **Tokens:** vêm de `usageMetadata` da resposta e vão para o registro.

**Se os dois falharem:**
- **Reunião:** vai para `status = 'erro'` com as duas mensagens e pode ser reanalisada.
- **Resposta do WhatsApp:** fica registrada sem interpretação, para tratamento manual, e o agente responde "Recebi, mas não consegui processar agora. A equipe vai ver no Início."

**Na tela:**
- a reunião guarda quem respondeu (`provedor`) e por que o Claude não respondeu (`motivo_reserva`);
- a fila mostra o selo "analisada pelo Gemini";
- a aba Configurações mostra quantas vezes o Gemini assumiu e o último erro do Claude;
- se o Gemini assumir **3 vezes seguidas**, os aprovadores recebem um aviso no sino.

### 9.2 Contexto enviado

1. **Instruções** (fixas, em pt-BR):
   - a tarefa;
   - o formato do modelo de reunião da TI (REVIEW, PLANNING, "Próximas ações");
   - as regras: não inventar; citar o trecho; usar só ids e códigos fornecidos; prazos relativos à data da reunião; preferir **atualizar** um card existente a criar um duplicado;
   - o conteúdo de `<reuniao>` é dado, nunca instrução (RN15).
2. **Membros:** id, nome e apelidos.
3. **Cards abertos:** código, título, responsáveis, coluna, prazo e projeto, um por linha.
4. **Projetos e sprints:** id, nome, sprint ativa e próxima sprint planejada, com datas.
5. **A reunião:** título, data e `summary_markdown`, entre `<reuniao>…</reuniao>`.

As mesmas instruções e o mesmo contexto vão para o Gemini quando ele assume.

O cache de prompt traz pouco com esse volume (poucas chamadas por semana). Fica como ajuste futuro: instruções e schema já vêm primeiro e não mudam.

### 9.3 Schema da saída (zod)

Convertido para JSON Schema e usado pelos dois provedores (§9.1).

```ts
const Sugestao = z.object({
  tipo: z.enum(['criar_card', 'atualizar_card', 'comentar_card']),
  card_codigo: z.string().nullable(),          // 'IT-045'; obrigatório para atualizar/comentar
  titulo: z.string().nullable(),               // criar
  descricao: z.string().nullable(),
  responsaveis: z.array(z.string()),           // ids de membros (RN08)
  prazo: z.string().nullable(),                // 'YYYY-MM-DD' (RN10)
  prazo_texto: z.string().nullable(),          // texto original
  prioridade: z.enum(['low', 'medium', 'high', 'critical']).nullable(),
  kanban_status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']).nullable(),
  projeto_id: z.string().nullable(),
  sprint: z.enum(['ativa', 'proxima']).nullable(),
  comentario: z.string().nullable(),           // comentar, ou observação junto de atualizar
  trecho: z.string(),                          // evidência literal
  confianca: z.enum(['alta', 'media', 'baixa']),
});
const SchemaSugestoes = z.object({ sugestoes: z.array(Sugestao), observacoes: z.string().nullable() });
```

### 9.4 Validação depois da IA (servidor)

- Ids de membro e de projeto fora da lista enviada são descartados, com aviso.
- `card_codigo` que não existe entre os abertos transforma a sugestão em `criar_card` com confiança `baixa` (RN09).
- Datas inválidas viram vazio, com aviso.
- `sprint: 'ativa' | 'proxima'` é resolvida para o `sprint_id` do projeto. Se não houver sprint, fica vazio com aviso.
- Uma sugestão de `atualizar_card` igual ao estado atual do card é descartada.

### 9.5 Custo estimado (Sonnet 5.5: US$ 2 / 10 por milhão de tokens de entrada / saída)

| Parte | Tokens | Custo |
|---|---|---|
| Entrada: instruções (~2 mil) + resumo (~5 mil) + membros, cards e projetos (~3 a 6 mil) | ~10 a 13 mil | ~US$ 0,02 a 0,03 |
| Saída, incluindo o raciocínio | ~4 a 8 mil | ~US$ 0,04 a 0,08 |
| **Por reunião** | | **~US$ 0,06 a 0,11** (medido em 13/Out com a reunião real de 21/09: 11 mil tokens de entrada e 2 mil de saída, cerca de US$ 0,04) |
| Resposta de WhatsApp (`effort: 'low'`, ~2 mil de entrada e ~500 de saída) | | ~US$ 0,01 |
| Pergunta no chat (`effort: 'low'`, ~8 a 12 mil de entrada com o contexto, ~300 a 600 de saída) | | ~US$ 0,03 sem cache; ~US$ 0,01 quando o contexto vem do cache |

**Chat:** com 5 pessoas fazendo 10 perguntas por dia útil, o gasto fica em cerca de US$ 10 a 30 por mês. É o maior custo de IA do plano. O limite de 30 perguntas por pessoa por dia (RN17) e o cache seguram o teto. O número real sai de `ti_agente_chamadas_ia` por `finalidade`.

- Com uma reunião por semana, o gasto fica **abaixo de US$ 0,50 por mês**. É cerca de metade do que custaria com o Opus.
- O Gemini só é cobrado quando assume, pela tabela do Google para o 3.8 Flash.
- A conferência real sai de `ti_agente_chamadas_ia` (RN14). O limite de gasto fica no workspace da Anthropic (§3).

---

## 10. Cobrança

**Quando:** cron `0 11 * * 1-5` (08h de Brasília, dias úteis). O Hobby dispara em algum momento entre 08h00 e 08h59. O `?dryRun=true` devolve as mensagens montadas sem gravar.

**Quem:** membros com `ativo`, `recebe_cobranca`, `whatsapp` e pelo menos uma pendência (RN12). O liga/desliga geral é conferido duas vezes: no cron, ao montar, e na VPS, ao enviar.

**O quê**, montado por `domain/cobranca.ts`:

```
Bom dia, Gabriel! Suas pendências de hoje (13/10):

⚠️ Atrasadas
• IT-045 Robô de pré-faturamento: venceu 10/10
⏰ Vencem hoje ou amanhã
• IT-052 Hub de Laudos: vence amanhã
💤 Paradas há 5 dias ou mais
• IT-038 Auditoria Área: sem atualização desde 06/10

Responda aqui para atualizar (ex.: "IT-045 concluída", "IT-052 vai para sexta").
Início: https://<app>/it/inicio
```

Seções vazias não aparecem. Acima de 8 itens, a mensagem termina com "e outras N no Início". Os cards ocultos do Kanban (`kanban_hidden`) ficam de fora.

**Sob demanda (D22, RN16):** o botão Cobrar/Lembrar do bloco de atrasadas chama `agente-cobrar`.
- O servidor confere a permissão: Lembrar = o próprio card com `canManageIT`; Cobrar = card de outra pessoa com `canApproveAgenteTI`.
- Também confere a janela de 4 h por card e se o responsável tem WhatsApp com adesão.
- Se estiver tudo certo, põe uma mensagem `cobranca_manual` na fila, que o script da VPS envia em até 1 minuto.
- Texto (modelo do protótipo): `{Nome}, a task "{título}" está atrasada há {N dias}. Consegue atualizar o status?`, mais o código do card.
- Card com mais de um responsável: vai uma mensagem para cada um.

---

## 11. WhatsApp (WAHA)

### 11.1 Sessão

- **Sessão nova `eva`** (criada em 14/Out, engine GOWS) no WAHA Plus da VPS, com o número **+55 61 9992-4986** (o número do próprio agente, que envia as mensagens). O usuário configura a sessão e conecta pelo QR code do painel do WAHA, acessando pelo **endpoint ngrok da VPS** (13/Out). A sessão `quotations_001` não é tocada.
- **O agente não usa o ngrok:** o script da fila (§11.2) roda na mesma VPS e fala com o WAHA em `http://127.0.0.1:3000`. Assim, uma troca de URL do ngrok não afeta nada.
- **Proteção do endpoint ngrok.** O túnel deixa a API do WAHA acessível pela internet, e quem a alcança controla o número (envia e lê conversas). Antes de conectar o número:
  - chave de API ligada no WAHA, exigida em toda chamada (`X-Api-Key`);
  - senha no painel e no Swagger do WAHA;
  - de preferência, uma camada de autenticação no próprio ngrok (Basic Auth ou OAuth na política de tráfego) ou restrição de IP.
- **Webhook da sessão:** `https://<app>/api/ti/waha-webhook?token=<WAHA_WEBHOOK_SECRET>`, eventos `message` e `message.ack`, sem HMAC (§11.3).

### 11.2 Envio (fila → VPS)

`tools/agente-ti-whatsapp/send-outbox.ts`, num timer systemd a cada minuto:
1. Lê `ti_agente_config.whatsapp_ativo`. Se estiver desligado, encerra.
2. Busca até 20 mensagens `saida` + `pendente` com `proxima_tentativa_em` vencida, das mais antigas para as mais novas.
3. Para cada uma: se o membro não tem `whatsapp_chat_id`, resolve com `GET /api/contacts/check-exists?phone=…&session=eva` e guarda. Se o número não existe no WhatsApp, a mensagem fica `falhou` com aviso na tela de membros.
4. `POST /api/sendText` `{ session, chatId, text }` com `X-Api-Key`, e **1 a 3 s de intervalo** entre envios, para não parecer disparo em massa.
5. Sucesso: `enviada`, com `waha_message_id` e `enviada_em`. Falha: `tentativas + 1` e nova tentativa depois de 1, 5 e 15 min. Na 4ª falha, `falhou`.
6. A cada execução, lê `GET /api/sessions/eva` e grava `waha_status` e `waha_verificado_em` em `ti_agente_config`. É o que alimenta o chip "Wa-ha" do Início (D25). Roda mesmo com o liga/desliga desligado. Se o WAHA nem responde, grava `INACESSIVEL` (chip "fora do ar").
7. *(Implementação, 14/Out)* Com a sessão fora de `WORKING`, o script não tenta enviar: as mensagens esperam a sessão voltar, sem gastar tentativas.

Roda a partir de um checkout do repositório com `npx tsx`, como `tools/quotation-approval-digest/`. A rotina fica em `api/_lib/ti-agente/outbox.ts` (testada); o executável só monta os clientes. As chaves ficam num arquivo de ambiente `600`, não nas units do systemd.

### 11.3 Recebidas (webhook)

`ti-waha-webhook.ts`:
1. **Valida a origem.** ✅ **Decidido na implementação (14/Out): token secreto na URL** (`/api/ti/waha-webhook?token=<WAHA_WEBHOOK_SECRET>`, por HTTPS), comparado em tempo constante, mais a conferência do remetente na lista de membros.
   - O HMAC SHA-512 do WAHA (`X-Webhook-Hmac`) precisaria do corpo cru, e a Vercel entrega o corpo já convertido em JSON. Recalcular sobre `JSON.stringify(req.body)` não reproduz os bytes originais.
   - Sem `WAHA_WEBHOOK_SECRET` configurado, a rota responde 503 e não grava nada.
2. Aplica a RN13: ignora grupos, `fromMe` e números desconhecidos. Grava a recebida com `waha_message_id` único, então uma entrega repetida pelo WAHA é ignorada.
3. Responde 200 rápido. A interpretação roda em seguida, com `waitUntil` se disponível. Ela usa o `gerarEstruturado` (§9.1): Claude Sonnet 5.5 com `effort: 'low'`, Gemini se ele falhar, e os cards abertos **daquele membro** como contexto (mais a última cobrança enviada a ele, para entender "concluída" sem código). Ela gera um comentário no card citado (autor: o próprio membro, com o prefixo "via WhatsApp") e, se houver pedido de mudança, uma sugestão na fila (D12).
   - **Concluir** vira a sugestão "coluna → Concluído". **Adiar** com data vira a sugestão "prazo → nova data". Adiar sem data clara só comenta e pede a data.
   - **Bloqueado** vira comentário e aviso no sino aos gestores, sem sugestão: o card não tem campo de bloqueio.
   - Até 5 cards por mensagem. Acima de 20 mensagens de um membro no mesmo dia, as próximas ficam registradas sem interpretação e sem resposta. Isso segura o custo e evita um laço com robô de resposta automática.
4. Enfileira a confirmação: "Anotei no IT-045: 'concluída'. A mudança de status vai para aprovação."
5. **Confirmações de entrega (RF26):** o webhook também assina o evento `message.ack`. Com ele, a mensagem de saída de mesmo `waha_message_id` passa a `entregue` ou `lida`, o que acende os selos da fila no Início. O status nunca volta para trás: `lida` não vira `entregue`.

---

## 12. Início da EVA: o protótipo (D5)

**Recebido em 13/Out**, em `docs/flowlab_agent/`:
- `design_handoff_eva_home/README.md`: integração, comportamento, animações, tokens e modo escuro. É a referência de interface.
- `design_handoff_eva_home/prototype/TI Inicio EVA (standalone).html`: referência visual validada com o usuário. Abre offline e não vai para produção.
- `design_handoff_eva_home/src/modules/eva/`: implementação React pronta para copiar, com dados de mock.
- `_ds/…`: design system do FlowLab (tokens, `colors_and_type.css`, regras de aderência). `assets/`: logos.

**O visual do protótipo manda.** Este capítulo diz de onde sai cada dado e o que muda em relação aos mocks.

### 12.1 Blocos e origem dos dados

| Bloco (componente) | O que mostra | De onde sai | Fase |
|---|---|---|---|
| **Hero** (`EvaHero`) | Orb, "EVA · Agente de TI · {data}", saudação ("Bom dia, equipe de TI" ou "Bom dia, {nome}"), briefing, campo "Pergunte à EVA" com sugestões e microfone | Briefing montado por modelo fixo a partir dos números da visão (`domain/inicio.ts`), sem IA | 1. O campo de pergunta funciona a partir da 2 |
| **Controles** (`EvaControls`) | Equipe / Minha visão (D19), chips Granola e Wa-ha, botão atualizar | `ti_agente_config`: última sincronização e situação da sessão do WAHA (D25) | 1. Os chips mostram "não configurado" até as Fases 2 e 3 |
| **Indicadores** (`EvaStatCards`) | **Equipe:** Em aberto · Atrasadas (dica: N críticas) · Concluídas na semana · Cobranças hoje.<br>**Minha visão:** Em aberto · Atrasadas · Hoje (x/y) · Projetos (dica: N em risco) | `it_requests` (RN01 a RN03). Cobranças = mensagens `cobranca` e `cobranca_manual` enviadas hoje | 1. Cobranças, a partir da 3 |
| **Kanban** (`KanbanSummaryCard`) | Barra proporcional + 5 colunas com contagem e até 2 cards de destaque | `it_requests` não ocultos, por `kanban_status`. Destaques: maior prioridade, depois prazo mais próximo, depois o mais recente. Em "Concluído", só os da semana | 1 |
| **Atrasadas e cobranças** (`OverdueCard`) | Prioridade, título, projeto, responsável, dias de atraso, último contato da EVA, botão Cobrar/Lembrar, filtro Todas / Crítica e alta | RN02. Último contato = última mensagem de saída que cita o card, e se houve resposta | 1 para a lista. Botão e último contato, a partir da 3 (D22) |
| **Fila do WhatsApp** (`WhatsAppQueueCard`) | Horário, destinatário, texto, status | **Só gestores** (D24), lendo `ti_agente_mensagens`. Status: `pendente` = Agendada, `enviada` = Enviada, `entregue`/`lida` = Entregue/Lida, `falhou` = Falhou | 3. Antes disso, estado vazio explicando o que vai aparecer. Entregue/Lida, a partir da 4 |
| **Projetos** (`ProjectsCard`) | Nome, sprint, feito/total, prazo, situação | `domain/projetos.ts` (RN05, com o ritmo da D27). `on_track`/`at_risk`/`late` = No prazo/Atenção/Atrasado. "Sem prazo" ganha selo neutro | 1 |
| **Minhas tasks do dia** (`MyTasksCard`) | Checklist com feito/não feito e selo de atrasada | Meus cards abertos que vencem hoje, mais os atrasados (D23). No lugar do horário, o código do card. Marcar conclui o card, com opção de desfazer | 1 |
| **Comentários da EVA** (`EvaInsight`, um por bloco) | Texto, origem, ação, "Perguntar à EVA" | Regras fixas em `domain/comentarios.ts` (D21). O de Projetos vem da última reunião analisada | 1 para as regras. Reunião e sugestões, a partir da 2 |
| **Chat** (`EvaChatDrawer`, `EvaFloatingChat`) | Perguntas e respostas, estado "pensando", brilho de borda | Ação `agente-perguntar` (D20, §12.3) | 2. Antes disso, o drawer abre com o aviso "o chat chega na próxima etapa" |
| **Voz** (`useVoiceInput`) | Ditado em pt-BR no hero, no drawer e na barra flutuante | Web Speech API do navegador (D26) | 2, junto com o chat |

### 12.2 O que muda em relação aos mocks

- **Só o `evaService` troca.** Ele é o ponto único de integração do handoff:
  - `getSnapshot(view)` monta o snapshot com Supabase e `domain/inicio.ts`;
  - `ask` chama `agente-perguntar`;
  - `sendCharge` chama `agente-cobrar`;
  - `acceptInsight` executa a ação do comentário: navegar, abrir o chat ou **propor uma ação** (D28). O gestor vê o diálogo com o que muda, confirma e a EVA executa; os demais enviam para a fila.
- **Saem os textos que prometem ação direta.** Os mocks dizem "Movi 2 revisões para o Diego", "Atualizei o prazo… e marquei o projeto como em risco", "Criei 3 cards no Backlog". Pela D6/D28, a EVA só executa depois de aprovada. Esses textos viram propostas ("Proponho mover 2 revisões da Ana para o Diego"). O texto de confirmação só diz "Movi" depois que a aprovação executou de fato.
- **A agenda fica de fora.** "Bloquear agenda", "Reservar horário" e as tasks com horário (09:30, 11:00…) pressupõem uma integração com agenda que não existe. Na v1, as tasks do dia são cards (D23), e os comentários de agenda não aparecem.
- **Saem os recursos que exigem agendar mensagens.** "Silenciar até 14:00" e "reagendei uma nova cobrança para 13:15" dependem disso, e a v1 não agenda mensagens.
- **Mensagens para o grupo ficam para depois.** "Fechamento do dia" e "Resumo do sprint review" para o "Grupo Equipe TI" estão no fora do escopo (§13).
- **As aprovações ficam à vista.** O protótipo não mostra as sugestões pendentes. Para os aprovadores, um chip "N sugestões aguardando", ao lado dos chips de integração, leva a `/it/eva` (D25).
- **Encaixe no repositório, conferido em 13/Out:**
  - `../../../hooks/useAuth` existe, e `userProfile.name` também;
  - lucide-react 0.263, framer-motion 12, Tailwind 3.4 e `animate-fade-in-up` (`src/index.css`) já estão no projeto.
- **Lint de aderência:** `_ds/…/_adherence.oxlintrc.json` avisa sobre cor hex solta. O repositório usa ESLint, não oxlint, e as cores fixas do handoff (`constants.ts`) ficam como estão na v1.

### 12.3 Chat com a EVA (D20)

- **Responde e propõe, nunca executa sozinha** (RN17, D28). Responde perguntas sobre o board, os projetos, as reuniões e a fila, citando os cards pelo código.
  - Quando pedem uma mudança de card ("move o IT-045 para revisão"), devolve uma **proposta** que aparece no drawer como cartão: "Aprovar e executar" para gestor, "Enviar para aprovação" para os demais. A execução passa por `ti_agente_propor_sugestao` (§6.3).
  - Cobrança não é proposta pelo chat: ela aponta o botão Cobrar.
- **Chamada:** `gerarEstruturado` (§9.1), com `finalidade: 'chat'`, `effort: 'low'` e schema `{ resposta, cards_citados, propostas }`. Cada proposta usa o mesmo formato das sugestões de reunião (§9.3).
- **Contexto:**
  - cards abertos, um por linha;
  - projetos e sprints;
  - o resumo da última reunião analisada;
  - as últimas mensagens da fila, só para gestor (D24).
  
  Na Minha visão, só o que é da pessoa. Pedido sobre card que não está no contexto não vira "card novo", como acontece na reunião: a proposta simplesmente não sai. O bloco de contexto vai com cache de prompt: perguntas seguidas na mesma sessão pagam cerca de 10% da entrada.
- **Histórico:** as últimas 6 mensagens da sessão. Nada vai para o banco além do registro de uso (RN14).
- **Limite:** 30 perguntas por pessoa por dia, contadas em `ti_agente_chamadas_ia`.
- **Custo:** cerca de US$ 0,01 a 0,03 por pergunta (§9.5).

---

## 13. Faseamento

```
00 shell ─── 01 início ─── 02 reuniões → sugestões → aprovação + chat ─── 03 cobrança ─── 04 conversa
```

### Fase 0: Shell
- Chave nova + teste; rotas e abas vazias; menu com "Início" (pílula EVA) e "EVA" (D7, D8, D18).
- **Pronto quando:** quem tem `canManageIT` vê os dois subitens e abre as telas vazias. Sem a chave, aparece "Acesso negado".

### Fase 1: Início da EVA
- O módulo do handoff entra em `src/modules/eva/`.
- `domain/datas`, `demandas`, `projetos`, `inicio` e `comentarios` (regras), com testes.
- O `evaService.getSnapshot` passa a ler do Supabase, nas duas visões.
- "Minhas tasks do dia" conclui o card de verdade (D23).
- O que depende de fases seguintes aparece desativado ou vazio, sempre com explicação: chat, botão Cobrar, fila do WhatsApp, chips.
- Não tem migration nem dependência externa. É a fatia que entrega valor primeiro.
- **Pronto quando:**
  - RF01 a RF09 funcionam nas visões Equipe e Minha visão, no tema claro e no escuro, e no celular;
  - as contagens batem com `SELECT`s feitos à mão;
  - a tela fica fiel ao protótipo standalone.

### Fase 2: Reuniões → sugestões → aprovação
- Pré-requisito humano: ID do workspace do Claude e as chaves do Claude e do Granola cadastrados na Vercel (§3, §16).
- Migrations (§6), dispatcher `api/ti`, clientes de Granola e Claude, extração, colar reunião, sincronização, fila de aprovação, RPCs, membros, avisos no sino.
- No Início:
  - chat com a EVA e ditado por voz (RF23, RF24);
  - comentário de Projetos a partir da última reunião;
  - chip de sugestões pendentes;
  - chip do Granola com a última sincronização.
- **Pronto quando:**
  - RF10 a RF17, RF23 e RF24 funcionam;
  - o chat responde sobre o board e a última reunião, propõe ações sem executá-las e para no limite diário;
  - a reunião real de 21/09 analisada em `dryRun` gera sugestões que um aprovador considera úteis;
  - aprovar cria ou muda o card certo, e rejeitar não mexe em nada;
  - quem não tem a chave não consegue aprovar, nem chamando a RPC direto;
  - com o Claude derrubado de propósito (chave inválida num preview), a análise sai pelo Gemini, com o selo e o motivo na tela.

### Fase 3: Cobrança por WhatsApp
- Configuração do WAHA na VPS (humana), script da fila (com o aviso de situação da sessão), cron da cobrança, liga/desliga, teste por membro, histórico.
- No Início:
  - botão Cobrar/Lembrar (RF25);
  - fila do WhatsApp;
  - indicador de Cobranças;
  - chip do Wa-ha.
- **Pronto quando:**
  - RF18 a RF21 e RF25 funcionam;
  - Cobrar duas vezes o mesmo card em menos de 4 h é recusado;
  - o "Enviar teste" chega no celular;
  - o `dryRun` da cobrança mostra as mesmas pendências que o Início;
  - com o liga/desliga desligado, nada sai.

### Fase 4: Conversa
- Webhook, interpretação com o Claude, comentário + sugestão, confirmação, e status Entregue/Lida pelo `message.ack`.
- **Pronto quando:**
  - RF22 e RF26 funcionam;
  - mensagens de grupo ou de números desconhecidos são ignoradas.

### Fora do escopo (depois)
- Board multidepartamento (`board_tickets`) no Início (D16).
- Mudança direta no Kanban por resposta no WhatsApp, sem aprovação (D12).
- Texto da cobrança escrito pela IA (D11).
- Escalonamento: avisar o líder quando um card fica atrasado mais de N dias.
- Mensagens para o grupo da equipe: fechamento do dia e resumo da reunião. Estão no protótipo, mas ficam fora da v1 (§12.2).
- Integração com a agenda: tasks com horário, "Bloquear agenda", "Reservar horário" (§12.2).
- Agendar e silenciar mensagens ("Silenciar até 14:00", "reagendar a cobrança para 13:15").
- Chat que executa ações (cobrar, mover cards) e comentários escritos pela IA (D20, D21).
- Histórico do chat salvo entre sessões.
- Webhook do Granola (a API não oferece hoje; a sincronização é por consulta).
- Retenção automática das mensagens (RNF07).

---

## 14. Verificação

1. **Testes de domínio** (`npm test`), no mínimo:
   - prazo gravado pelo Board para hoje (meia-noite UTC, que é 21h de ontem em Brasília) continua sendo de hoje, e o de ontem está atrasado há 1 dia;
   - card em `done` com `status` ainda `pending` (não é aberto);
   - card oculto;
   - card sem prazo;
   - sexta-feira com o "próximo dia útil" caindo na segunda;
   - parado contado pelo último comentário, e não só pelo `updated_at`;
   - projeto só com sprint ativa e sem cards;
   - projeto sem sprint e sem prazo;
   - projeto com sprint vencida;
   - progresso da sprint ativa contra o do projeto;
   - "@Gabriel Carneiro" contra o apelido "gabriel carneiro" (com e sem acento);
   - "Equipe" sem responsável;
   - cobrança com mais de 8 itens;
   - cobrança sem pendência (sem mensagem);
   - a mesma entrada com `hoje` diferente;
   - ritmo da sprint (D27): 35% feito com 60% decorrido vira Atenção; 45% com 60% fica No prazo;
   - destaques do Kanban: maior prioridade, depois prazo mais próximo, depois o mais recente; no máximo 2 por coluna;
   - tasks do dia: vence hoje entra; atrasado entra; vence amanhã não entra; concluído sai;
   - briefing nas visões Equipe e Minha visão, inclusive com zero atrasadas (sem "0 tasks atrasadas" esquisito);
   - comentários por regra: cada um some quando não há o que dizer, e nenhum texto promete mudança feita sozinha.
2. **Extração:** `extracao.test.ts` com um resumo **fictício** no modelo da TI (sem dados reais no repositório), cobrindo:
   - código inexistente vira "criar";
   - membro desconhecido vira aviso;
   - prazo relativo usa a data da reunião;
   - atualização igual ao estado atual é descartada.
   
   A reunião real só passa pelo `dryRun`, em produção.
3. **Clientes:** Granola, Claude, Gemini e WAHA com `fetch` ou cliente injetado: sucesso, 401, 429, tempo esgotado e resposta inválida, sem lançar exceção.
4. **Reserva:** `gerarEstruturado.test.ts`, com clientes falsos, cobrindo:
   - Claude ok: o Gemini não é chamado;
   - 529 e tempo esgotado: o Gemini assume;
   - 401: o Gemini assume e o resultado fica `configuracao`;
   - recusa, `max_tokens` e JSON fora do schema: o Gemini assume;
   - os dois falham: erro com as duas mensagens;
   - 3 reservas seguidas: aviso no sino;
   - em cada caso, as linhas certas em `ti_agente_chamadas_ia`, sem texto da reunião.
5. **Chat e cobrança sob demanda:**
   - o chat responde citando códigos existentes;
   - diante de "move o IT-045 para revisão", devolve uma proposta e não muda nada até a aprovação; diante de "cobra o Bruno", indica o botão;
   - proposta confirmada por gestor executa na hora, com `decidido_por`; proposta de quem não é gestor fica pendente;
   - a 31ª pergunta do dia é recusada com aviso;
   - na Minha visão, o contexto não traz cards de outras pessoas;
   - Lembrar funciona no próprio card com `canManageIT`;
   - Cobrar o card de outra pessoa sem `canApproveAgenteTI` volta 403;
   - o mesmo card não é cobrado de novo em menos de 4 h.
6. **RLS e RPCs**, com três usuários:
   - sem chave: não lê nada;
   - só `canManageIT`: lê a fila, não aprova, nem pela RPC direta; não lê `ti_agente_mensagens` (a fila do Início não aparece para ele), mas `ti_agente_cobrancas_hoje()` devolve a contagem;
   - `canApproveAgenteTI`: aprova, e o card aparece no Board.
7. **WhatsApp:**
   - mensagem de teste chega;
   - número inexistente marca `falhou`;
   - liga/desliga desligado não envia;
   - o mesmo dia não gera duas cobranças (`chave_dia`);
   - webhook com assinatura ou token errado volta 401;
   - entrega repetida do WAHA não duplica.
8. **Fidelidade ao protótipo:** o Início, aberto lado a lado com `TI Inicio EVA (standalone).html`, bate em espaçamento, cores, animações (com `prefers-reduced-motion` desligando tudo), tema escuro e larguras estreitas.
9. **`npx tsc --noEmit`, `npm run lint` e `vite build`** sem erros novos; o preview da Vercel sobe com 10 functions.

---

## 15. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| WhatsApp bane o número (o WAHA não é a API oficial) | Número dedicado; só a equipe interna e com adesão; 1 mensagem por pessoa por dia; intervalo entre envios; liga/desliga sem deploy; o sino do FlowLab continua avisando |
| IA propõe card duplicado ou errado | Aprovação obrigatória (D6); trecho da reunião em cada sugestão; lista de cards abertos no contexto com preferência por atualizar; validação pós-IA (§9.4) |
| Texto da reunião ou da mensagem tenta instruir a IA | Conteúdo delimitado e tratado como dado; saída presa ao schema; nada aplicado sem aprovação (RN15) |
| Chave do Granola não enxerga reuniões de outras contas | Hoje só há uma conta gravando (decidido manter a chave, §3). Se mudar, chave de workspace com acesso ao espaço "TI Lab team". Colar à mão continua disponível |
| Chave do Claude é da organização e exige o cabeçalho de workspace | `CLAUDE_WORKSPACE_ID` em toda chamada. A chave é do dono da organização e não muda (§3) |
| Endpoint ngrok expõe a API do WAHA na internet | O agente não depende dele (fala pelo `localhost`); chave de API do WAHA, senha no painel e autenticação no ngrok (§11.1) |
| RPC `SECURITY DEFINER` vira porta dos fundos no Kanban | Conferência de permissão na primeira linha; só os campos listados; testes com usuário sem a chave |
| Análise passa do tempo da function | `maxDuration` de 300 s; Claude com 90 s e 1 nova tentativa, Gemini com 90 s; a sincronização só começa uma análise se restarem 4,5 min; reanalisar manual em caso de erro |
| Claude indisponível, sobrecarregado ou recusando | Gemini 3.8 Flash assume com as mesmas instruções e o mesmo schema (D17); selo e motivo na tela |
| A reserva esconde um erro de configuração do Claude (chave errada, workspace errado) | Erros 400/401/403 registrados como `configuracao` e mostrados na aba Configurações; aviso no sino depois de 3 reservas seguidas |
| Sugestões piores quando o Gemini responde | Todas passam por aprovação (D6), com o selo "analisada pelo Gemini"; modelo configurável em `AGENTE_TI_GEMINI_MODEL` |
| Telefones e conversas expostos | RLS só para aprovadores; envio só pela VPS; WAHA fechado (D9) |
| Mesma regra dando números diferentes no Início e na cobrança | Um único `domain/` usado pelo front, pela api e pela VPS (§8) |
| Prazo lido no dia errado (o Board grava meia-noite UTC do dia escolhido) | `diaDoPrazo` lê o dia sem converter fuso; "hoje" e os instantes reais usam Brasília (RN02); testes dos dois casos |
| Os textos do protótipo prometem ações que a EVA não faz ("Movi", "Atualizei", "Criei", "Bloqueei a agenda") | Mocks fora da tela de produção; comentários por regra que só sugerem; teste que barra texto de ação feita sozinha (§12.2, §14) |
| O chat vira o maior custo de IA | Esforço baixo, contexto enxuto com cache, limite de 30 perguntas por pessoa por dia, gasto por `finalidade` na aba Configurações (§9.5) |
| O chat inventa um card ou um número | Contexto com os dados reais e códigos citados conferidos; a resposta só cita cards da lista enviada |
| O ditado por voz manda áudio para o serviço do navegador | É o comportamento padrão do Chrome e do Edge; o microfone só liga com clique e permissão; registrado na D26 |
| Botão Cobrar vira disparo em massa | Só aprovadores cobram outras pessoas; 1 cobrança por card a cada 4 h; liga/desliga geral (RN16) |

---

## 16. Variáveis de ambiente e configuração

| Onde | Variável | Situação |
|---|---|---|
| Vercel | `CLAUDE_API_KEY` | existe no `.env` (chave da organização); cadastrar na Vercel |
| Vercel | `CLAUDE_WORKSPACE_ID` | nova; `wrkspc_…` copiado do Console (Settings › Workspaces); vai no cabeçalho `anthropic-workspace-id` (§3) |
| Vercel | `GEMINI_API_KEY` | já existe (Apoio Alvaro); confirmar que está na Vercel em Production e Preview |
| Vercel | `AGENTE_TI_GEMINI_MODEL` | opcional; padrão `gemini-3.8-flash` |
| Vercel | `GRANOLA_API_KEY` | existe no `.env`; cadastrar na Vercel (a chave atual, decidido em 13/Out) |
| Vercel | `CRON_SECRET` | já existe |
| Vercel | `WAHA_WEBHOOK_SECRET` | nova; o **token** do webhook (decidido na issue 15, §11.3). Um valor aleatório longo, que vai também na URL configurada no WAHA (`?token=…`) |
| Vercel | `WAHA_SESSION` | opcional; padrão `eva`. O webhook ignora eventos de outra sessão |
| Vercel | `APP_URL` | já existe; base do link "Início" na cobrança (`api/_lib/appUrl.ts`) |
| VPS | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | do projeto **do app** (o do `VITE_SUPABASE_URL`), não o de teste. Ficam em `/etc/flowlab/eva-whatsapp.env` (600), gravado pelo `install.sh` |
| VPS | `WAHA_URL=http://127.0.0.1:3000`, `WAHA_API_KEY`, `WAHA_SESSION=eva` | novas, **sem prefixo `VITE_`**. O script recusa uma `WAHA_URL` do ngrok |
| `.env` local | `VITE_WAHA_*` | não usadas por nenhum código; **remover** (§3) |
| Banco | `ti_agente_config.granola_folder_id` | `fol_WEROcYgPA0ti68` ("Team meetings") |
| `vercel.json` | crons `/api/ti/agente-sync-cron` (`0 12 * * 1-5`) e `/api/ti/agente-cobranca-cron` (`0 11 * * 1-5`); `functions` com `maxDuration` para `api/ti/[action].ts` | novo |

---

## 17. Pontos de edição fora do módulo

| Arquivo | Mudança |
|---|---|
| `src/utils/permissions.ts` + `.test.ts` | `canApproveAgenteTI`, exclusão do `operator`, teste |
| `src/App.tsx` | 5 rotas |
| `src/components/Layout.tsx` | 2 subitens ("Início" com `Sparkles` e pílula EVA; "EVA"), `badge?: string` em `NavigationItem` + pílula no `Link` do subitem, `anyOf` e `href` do pai (D8), auto-expansão |
| `src/modules/index.ts` | opcional: `export * from './eva'` (README do handoff) |
| `api/ti/[action].ts` (novo), `api/server.ts`, `vite.config.ts` | dispatcher registrado nos 3 lugares |
| `vercel.json` | 2 crons + `maxDuration` |
| `package.json` | `@anthropic-ai/sdk`, `zod` 4 (`@google/genai` já existe) |
| `supabase/migrations/` | duas migrations na Fase 2: tabelas e RLS (issue 05); RPCs de aprovação (issue 11). Nenhuma grava em `custom_roles` |
| `tools/agente-ti-whatsapp/` (novo) | script da fila + instalação do timer |
| `docs/CLAUDE.md` | registrar o módulo `agente-ti/` |
