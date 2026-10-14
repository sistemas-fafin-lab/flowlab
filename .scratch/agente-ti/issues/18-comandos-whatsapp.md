# 18 — Comandos pelo WhatsApp e grupo da equipe

**What to build:** pelo WhatsApp, a EVA faz o que já faz na tela, com confirmação. Pedido do usuário em 14/Out: "quero seguir com todos os comandos".
- **Qualquer membro:** atualiza os próprios cards, o fluxo da 15, e faz perguntas sobre as demandas, com as mesmas regras do chat (16).
- **Gestor** (`canApproveAgenteTI`) também pode:
  - pedir cobranças ("cobra o IT-045", "cobra a Ana");
  - ver as sugestões pendentes numa lista numerada;
  - aprovar ou rejeitar por número ("aprovar 1 e 3", "rejeitar 2 motivo");
  - mandar avisos no grupo da equipe.
- **Nada sai sem o SIM:** a EVA mostra o que vai fazer e espera "SIM" por 30 min. A permissão é conferida de novo na hora do SIM.
- **Grupo da equipe:**
  - escolhido em Configurações, a partir da lista que a VPS lê do WAHA;
  - recebe o fechamento do dia (dias úteis, 18h), o resumo de cada reunião analisada e os avisos;
  - fechamento e resumo têm liga/desliga, que nasce desligado;
  - tudo respeita o horário de cobrança.

Plano: §2 (D29), §6.2/§6.3 e §11.4.

**Blocked by:** 13, 14, 15. A conferência em produção depende da migration aplicada e do pacote novo na VPS.

**Status:** done no código (14/Out/2026); falta aplicar a migration, atualizar a VPS e conferir com o celular

- [x] Migration `20261014160000_eva_comandos_whatsapp.sql`:
  - `ti_agente_comandos` com RLS (só gestor lê; só o servidor grava);
  - colunas do grupo em `ti_agente_config` (`whatsapp_grupo_id`, que só aceita `…@g.us`);
  - `chat_id_destino` e o tipo `grupo` em `ti_agente_mensagens`;
  - `ti_agente_aprovar_sugestao_como` e `ti_agente_rejeitar_sugestao_como`, só para a service role, com as RPCs da tela delegando para elas.
- [x] Roteador `api/_lib/ti-agente/comandos.ts`:
  - SIM/NÃO do pedido aguardando, sem IA;
  - lista numerada lida sem IA;
  - agradecimento sem resposta;
  - uma chamada de IA com a intenção;
  - permissão de gestor na preparação e no SIM.
- [x] Grupo (`api/_lib/ti-agente/grupo.ts`): fila do grupo, fechamento do dia (cron `agente-fechamento-cron`, `0 21 * * 1-5`), resumo da reunião depois da análise, aviso e teste.
- [x] VPS: lista de grupos a cada 30 min (`GET /api/eva/groups`), envio ao grupo sem `check-exists`, horário também para o grupo.
- [x] Configurações: escolher o grupo, "Atualizar lista", "Enviar teste ao grupo", os dois liga/desliga e a ajuda dos comandos.
- [x] Fila do Início: mensagem do grupo aparece como "Grupo da equipe"; a falha do grupo leva a Configurações.
- [x] Aplicar a migration no projeto do app (14/Out; conferido pelo REST: tabela e colunas existem, anon barrado na versão "como").
- [x] Atualizar o pacote da VPS (14/Out, sem sudo; a lista de grupos foi lida e voltou vazia: o número da EVA ainda não estava em grupo).
- [x] Aba Membros mostra quem é gestor: selo "Gestor" e o nome do cargo.
- [ ] Aplicar `20261014170000_eva_gestor_mesma_regra.sql` (a regra de gestor no banco igual à das policies).
- [ ] Pôr o número da EVA no grupo da equipe, escolher o grupo em Configurações e enviar o teste.
- [ ] Cadastrar o WhatsApp de cada gestor na aba Membros, para ele poder mandar comandos.
- [ ] Conferir com o celular: uma pergunta, um "cobra o IT-…" com SIM, "sugestões pendentes" → "aprovar 1" → SIM, e um aviso no grupo.

## Comments

**14/Out/2026 — implementado no código.**

- **Ordem de cada mensagem** (`processarRecebida`):
  1. limite diário (20 por membro, 40 por gestor);
  2. só texto;
  3. o SIM ou NÃO do pedido aguardando;
  4. "aprovar/rejeitar N";
  5. agradecimento;
  6. a IA.

  Qualquer outra mensagem com um pedido aguardando cancela o pedido: um SIM depois não confirma o que ficou para trás.
- **Uma chamada de IA só** (`SchemaMensagem`). A IA devolve a intenção mais os campos de cada uma: os itens da 15, a resposta da pergunta, códigos ou pessoa a cobrar, números, motivo e texto do aviso.
  - O contexto é o do chat (membros, cards abertos, projetos, última reunião), mais os cards que a pessoa pode atualizar e a última cobrança e a última resposta da EVA.
  - Sem `canManageIT`, só os próprios cards (RN17). A fila do WhatsApp não entra (D24).
- **Cobrar** usa as mesmas regras do botão: `checarCobranca` na prévia e `cobrarCard` no SIM.
  - Por pessoa, entram os cards atrasados dela, até 5.
  - O que não dá para cobrar aparece com o motivo (não atrasado, janela de 4 h, sem adesão).
- **Aprovar/rejeitar** vale para a última lista que a EVA mandou ao gestor (2 h). Rejeitar sem motivo faz a EVA perguntar o motivo.
  - No SIM, chama `ti_agente_aprovar_sugestao_como` em nome do gestor, a mesma lógica da tela.
  - A lista guarda os ids; uma sugestão que outra pessoa já decidiu nesse meio-tempo aparece como "já está aprovada".
- **Idempotência:** o pedido vira `executado` antes de rodar (`update … where status = 'aguardando'`), então um SIM repetido responde "Esse pedido já foi feito".
- **Grupo:** `chat_id_destino` é o único destino fora da lista de membros, e o script recusa o que não for `…@g.us`.
  - Fechamento e resumo têm `chave_dia`: `fechamento:<dia>` e `reuniao:<id>`.
  - Reunião realizada há mais de 3 dias não vai para o grupo, porque a primeira sincronização traz o histórico.
- **Decisões tomadas na implementação:**
  - "Concluídas hoje" no fechamento é coluna Concluído com `updated_at` de hoje. Não há coluna de conclusão; é a mesma aproximação de `concluidoNaSemana`.
  - O gestor pode atualizar pelo WhatsApp qualquer card aberto, não só os seus; a mudança continua indo para a fila de aprovação.
  - "ok" com pedido aguardando é SIM; sem pedido, é agradecimento e não tem resposta.
- **Testes:**
  - 21 no roteador: leitura sem IA, textos, permissões, cobrar com SIM, lista → aprovar → SIM, rejeitar com e sem motivo, expirado, cancelado, deixou de ser gestor, aviso no grupo, fora do horário;
  - 8 no grupo, 3 novos na fila da VPS e 1 no cliente do WAHA (formatos de grupo);
  - na migration (PGlite), mais 16 cenários (com reaplicar a migration nova), e os anteriores continuam passando:
    - a versão "como" recusa um não gestor e um aprovador nulo;
    - `authenticated` não executa a versão "como", e a `service_role` executa;
    - as RPCs da tela delegam para ela;
    - a mensagem de grupo entra sem membro;
    - a config recusa um contato no lugar do grupo.

**14/Out/2026 — regra de gestor no banco (`20261014170000_eva_gestor_mesma_regra.sql`).** As funções "como" conferiam o aprovador com `user_has_permission`. Essa função tem um fallback de role legado que dá ao `operator` quase todas as chaves, inclusive `canApproveAgenteTI`; as policies, a tela e o servidor não dão.
- Não havia brecha: o servidor confere `tem(usuario, 'canApproveAgenteTI')` antes de chamar.
- Mesmo assim, o banco agora usa `ti_agente_eh_gestor(uuid)`, a regra de `current_user_has_permission` para um usuário dado: admin, ou cargo com a chave, e nunca removido ou desativado.
- O corpo das duas funções é o mesmo da migration anterior; só a linha da checagem mudou.
- Mais 8 cenários no PGlite: operator recusado, admin aceito, gestor desativado recusado, o corpo ainda aprova, e o cliente não chama a função.

**Quem é gestor na aba Membros:** selo "Gestor" e "Cargo: …" em cada membro, pela mesma regra (`ehGestorEva` em `domain/pessoas.ts`). Gestor sem WhatsApp recebe a dica de cadastrar o número. No banco do app, em 14/Out, os dois membros cadastrados são admins, portanto gestores; só um tinha WhatsApp.

**Nome da migration:** nasceu como `20261014120000_…`, mas o `main` ganhou no mesmo dia a `20261014120000_fat_corrigir_lancamentos.sql`. O Supabase usa o timestamp como versão, então as duas colidiriam. Por isso ficou `20261014160000_eva_comandos_whatsapp.sql`.

**Ordem de implantação:** primeiro a migration, depois o deploy da Vercel e o pacote novo da VPS.
- O pacote novo lê `chat_id_destino` e `waha_grupos_em`. Antes da migration, ele falharia a cada minuto.
- A tela de Configurações também lê as colunas novas.

**14/Out/2026 — "a EVA está demorando muito para responder" (primeiro teste real).** Medido no banco, na primeira mensagem real:
- a mensagem chegou às 17:00:06 e a resposta ficou pronta às 17:00:13 (7 s);
- a resposta só saiu às 17:01:01: **48 s esperando a VPS**, que olhava a fila uma vez por minuto.

Também apareceu um erro escondido: o **Claude recusava o schema** dos comandos com 400 ("For 'integer' type, properties maximum, minimum are not supported"). O `z.number().int()` do campo `numeros` vira `minimum`/`maximum` no JSON Schema. O Gemini assumia em 2,7 s, então a resposta saía, mas sempre pela reserva.

Correções:
- `paraJsonSchema` tira do schema enviado os limites que o Claude não aceita (`minimum`, `maximum`, `exclusive*`, `multipleOf`, `minLength`, `maxLength`); o zod continua conferindo a resposta. `numeros` ficou sem `.int()`, com a conferência em `prepararDecisao`.
  - Conferido com uma chamada real ao Claude: `ok` em 4,8 s, intenção "aprovar" com os números 1 e 3.
- A VPS, em cada execução do timer, relê a fila a cada 5 s por até 50 s (`send-outbox.ts`). A resposta sai em segundos, sem mudar o timer nem o `install.sh`, e por isso sem sudo. `--uma-vez` faz uma passada só.

Tempo esperado agora: uns 7 a 10 s para a resposta ficar pronta, mais até 5 s até a VPS enviar. A exceção são os 10 s do fim de cada minuto, entre uma execução e a próxima.
