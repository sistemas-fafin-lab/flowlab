# 05 — Migration: tabelas e RLS do agente

**What to build:** a migration com as seis tabelas do agente e as regras de acesso:
- `ti_agente_config` (uma linha só);
- `ti_agente_membros`;
- `ti_agente_reunioes` (com `provedor` e `motivo_reserva`, D17);
- `ti_agente_sugestoes`;
- `ti_agente_mensagens`;
- `ti_agente_chamadas_ia`, o registro de cada chamada ao Claude ou ao Gemini (RN14). Só metadados, nunca texto de reunião ou mensagem.

Ainda sem as RPCs de aprovação, que ficam na 11.

Pontos que exigem atenção:
- `ti_agente_membros` e `ti_agente_mensagens` têm telefones e conversas, e só os aprovadores leem.
- Nenhuma tabela aceita gravação de reuniões, sugestões ou mensagens pelo cliente. Isso fica com o servidor e a VPS, usando a service role.
- `chave_dia` UNIQUE em `ti_agente_mensagens` garante uma cobrança por pessoa por dia, mesmo se o cron rodar duas vezes.

Plano: §6.1, §6.2 e convenções da §6.

**Blocked by:** 01 (a chave `canApproveAgenteTI` precisa existir no front para os testes de ponta a ponta).

**Status:** done (13/Out/2026): aplicadas pelo usuário no projeto do app e conferidas (tabelas, colunas, embeds e funções)

- [ ] Migration `2026MMDDhhmmss_agente_ti_tabelas.sql`, idempotente, com a guarda de `current_user_has_permission` no topo.
- [ ] As seis tabelas, com CHECKs nomeados, índices, `COMMENT ON` em pt-BR e triggers de `updated_at`.
- [ ] `ti_agente_config` com a linha inicial (`granola_folder_id = 'fol_WEROcYgPA0ti68'`, tudo desligado, `dias_parado = 5`) e as colunas `waha_status` / `waha_verificado_em` (D25).
- [ ] `ti_agente_mensagens` com:
  - `tipo` incluindo `cobranca_manual`;
  - `status` incluindo `entregue` e `lida`;
  - coluna `enviada_por` (D22, D24).
- [ ] `ti_agente_chamadas_ia` com `finalidade` incluindo `chat` e coluna `user_id`, base do limite diário do chat (RN17).
- [ ] `ti_agente_sugestoes` com `origem` (`reuniao`, `whatsapp`, `comentario`, `chat`) e `proposta_por` (D28, RN18).
- [ ] RLS conforme a tabela da §6.2.
- [ ] Nenhum `INSERT` em `custom_roles` (D15).
- [ ] Conferência manual descrita na issue:
  - sem chave, não lê nada;
  - só `canManageIT` lê reuniões, sugestões e o registro de IA, mas não lê membros nem `ti_agente_mensagens` (a fila do WhatsApp é só para gestores, D24);
  - aprovador lê tudo.
- [ ] Atualizar a §6 do plano se algo mudar na implementação.

## Comments

**13/Out/2026 — implementado no código.**

- **`supabase/migrations/20261013150000_eva_tabelas.sql`:**
  - as seis tabelas, a linha inicial da config e a RLS da §6.2;
  - coluna extra `ti_agente_reunioes.observacoes`, que guarda o resumo da análise usado no comentário de Projetos.
- **`20261013151000_eva_rpcs.sql`:** aprovar, rejeitar, propor e `ti_agente_cobrancas_hoje()`, a contagem da issue 14 adiantada.
- **Nomes:** seguem a convenção nova de migrations, com o prefixo `eva_`. Falta a linha em `supabase/MIGRATIONS.md`, que ainda não está no `main`.
- **Decisão:** sem CHECK de `card_id` obrigatório. Ele faria a exclusão de um card no Board falhar quando houvesse sugestão pendente apontando para ele.

**Verificação:** as migrations rodaram num Postgres em WASM (PGlite), com stubs de `auth.uid()`, `current_user_has_permission`, `user_profiles`, `it_requests`, `it_task_comments` e `user_notifications`. Os 28 cenários passaram:
- reaplicar as duas migrations sem erro;
- não gestor barrado na RPC direta;
- card criado com prazo à meia-noite UTC (convenção do Board);
- `done` com `resolved`;
- comentário com o prefixo "EVA:";
- proposta pendente e proposta aprovada na mesma chamada;
- rejeição exige motivo;
- apagar um card com sugestão pendente;
- contagem de cobranças;
- RLS: só `canManageIT` não lê membros nem mensagens; gestor lê; sem chave não lê nada.

O script de teste ficou fora do repositório.

**Falta:** aplicar no Supabase (você).

**13/Out/2026 — duas colunas novas em `ti_agente_config` (issue 10).**
- `granola_verificado_em`: fim da última sincronização sem erro;
- `granola_ultimo_erro`: erro da última sincronização.

O chip "Granola" do Início não podia usar o cursor `granola_ultima_sync_em`, que é a data da nota mais recente e não a hora da execução. As colunas estão no `CREATE TABLE` e num `ADD COLUMN IF NOT EXISTS` logo depois, para o caso de a tabela já existir. Os 28 cenários do PGlite passaram de novo.

**13/Out/2026 — aplicadas.** O usuário rodou as duas migrations no projeto do app (`jqxe…`). A conferência foi feita só com a chave pública, sem ler nem gravar dados:
- as seis tabelas existem, com todas as colunas, inclusive as duas novas;
- os três embeds com o nome da FK funcionam;
- as quatro funções existem, e o anon é barrado em todas.

As Fases 3 e 4 (14/Out) não precisaram de migration nova: "Enviar teste" e "Cobrar" passam por rotas do servidor, já que a fila não tem policy de INSERT.

**14/Out/2026 — catálogo `supabase/MIGRATIONS.md`.** O arquivo ainda não está em nenhuma branch: é trabalho em andamento de outra sessão. Quando ele entrar no `main`, faltam:
- a linha `| [TI — EVA (agente de TI)](#ti--eva-agente-de-ti) | `eva_` | 8 |` na tabela de domínios, com o total subindo 8 (a terceira e a quarta vieram com a issue 18, a quinta com a 19, a sexta com a 20, a sétima com a 21, a oitava com a 22);
- a seção abaixo:

```markdown
## TI — EVA (agente de TI)

Tabelas `ti_agente_*` da EVA, a agente de TI ([plano](../docs/plans/agente-ti/PLANO_AGENTE_TI.md)).

| Migration | O que faz |
|---|---|
| [`20261013150000_eva_tabelas`](migrations/20261013150000_eva_tabelas.sql) | Seis tabelas `ti_agente_*` (config, membros, reuniões, mensagens, sugestões, chamadas de IA) com RLS |
| [`20261013151000_eva_rpcs`](migrations/20261013151000_eva_rpcs.sql) | RPCs de aprovar, rejeitar e propor sugestões, e a contagem de cobranças do dia |
| [`20261014160000_eva_comandos_whatsapp`](migrations/20261014160000_eva_comandos_whatsapp.sql) | Comandos pelo WhatsApp (`ti_agente_comandos`), grupo da equipe na config e na fila, e aprovar/rejeitar em nome do gestor (só service role) |
| [`20261014170000_eva_gestor_mesma_regra`](migrations/20261014170000_eva_gestor_mesma_regra.sql) | `ti_agente_eh_gestor`: a regra de gestor das policies (sem o fallback do operator legado) nas funções de aprovar/rejeitar em nome do gestor |
| [`20261014180000_eva_lembretes`](migrations/20261014180000_eva_lembretes.sql) | Lembretes pessoais pelo WhatsApp: tipo `lembrete` e status `cancelada` na fila de mensagens |
| [`20261015120000_eva_papeis`](migrations/20261015120000_eva_papeis.sql) | Três permissões separadas (configurar, gestor, aprovar): RLS e `ti_agente_tem_permissao` |
| [`20261015140000_eva_aviso_pessoal`](migrations/20261015140000_eva_aviso_pessoal.sql) | Aviso de gestor para uma pessoa: tipo `aviso` na fila e o comando `avisar_pessoa` |
| [`20261015160000_eva_papeis_por_pessoa`](migrations/20261015160000_eva_papeis_por_pessoa.sql) | Permissões da EVA por pessoa (`ti_agente_papeis`), no lugar do cargo: `ti_agente_pode` nas policies e RPCs, definir e voltar ao cargo |
```
