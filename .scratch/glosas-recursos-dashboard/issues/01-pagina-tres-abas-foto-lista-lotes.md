# 01: Nova página com 3 abas, foto do apLIS e lista de lotes de recurso

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** a página "Glosas e Recursos" passa a ter as abas Dashboard, Glosas recentes e Acompanhamento dos recursos, com um cabeçalho comum: período (mês do lote de faturamento original), convênio e "Atualizar". As abas "Nativas" e "Histórico (apLIS)" saem. Dashboard e Glosas recentes mostram "em breve". O "Atualizar" sincroniza o período e o convênio filtrados: lê do apLIS as requisições glosadas ou recursadas (status 6, 7, 15, 16, 17, 18, 8, 33, 34, ou presentes em algum lote de recurso) e os lotes de recurso dessas requisições, e grava a foto no Supabase, com a glosa fixada. A sub-aba "Lotes de recurso" (dentro de Acompanhamento) lista os lotes a partir da foto.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A página tem as 3 abas e o cabeçalho comum; as abas "Nativas" e "Histórico (apLIS)" saíram; o período padrão é o mês corrente.
- [x] Acompanhamento tem as sub-abas "Lotes de recurso" e "Recursos fora de lote" (esta última fica "em breve").
- [x] Existem tabelas no Supabase para a foto da requisição e a foto do lote de recurso, com RLS: lê quem pode ver o faturamento, grava quem pode gerenciar.
- [x] A glosa fixada segue o spec:
  - requisição nova antes do envio: líquido − recebido, guardando o recebido como base;
  - já em 6, 7 ou 16 na primeira sincronização: líquido − recebido, com "valor inicial estimado";
  - já em 34 ou 17: deferido total com o recursado do lote, ou em branco quando não há lote, com "valor inicial estimado";
  - depois de fixada, a glosa não muda em sincronizações seguintes.
- [x] A sincronização respeita o período e o convênio pedidos e devolve a data do dado do apLIS.
- [x] A lista de lotes mostra nº do lote de recurso, protocolo de faturamento, convênio, valor glosado, valor recorrido, data de envio e status, com busca (lote, guia, paciente, convênio, protocolo), filtro de status e paginação.
- [x] Testes do módulo de regras de recurso de glosa cobrem a fixação.
- [x] Testes do handler de sincronização, com apLIS e Supabase simulados, cobrem a gravação, o recorte por período e convênio e a recusa sem permissão.

## Comments

**Implementado (23/10/2026).** Decisões tomadas na implementação, para revisar:

- **Mês do lote de faturamento** = `fatlote.DtaCriacao` (o mesmo critério da aba Faturas).
- **Primeira sincronização** é decidida por requisição: não há sincronização anterior do mesmo mês que cubra todos os convênios ou o convênio dela (tabela `glosa_recurso_sincronizacoes`). Requisição que entra depois disso já num lote de recurso enviado também leva "valor inicial estimado" (história 55).
- **34/17 (deferido total):** glosa fixada = recursado do lote; recebido na fixação = recebido − recursado (para ΔRec = R na classificação). Vale mesmo fora da carga inicial.
- **Requisição em mais de um lote de recurso** (32 casos): fica o lote mais recente; o recursado é o desse lote. O lote anterior some da lista se todas as requisições dele foram para o novo.
- **Outros status em lote de recurso** (5 RECEBIDO ~1.500, 33, 15, 18, 8…): líquido − recebido, como 6/7/16. Para 5 e 33 o recebido pode já estar sobrescrito e a glosa sair perto de zero — o spec não define; vale decidir.
- **Permissão do "Atualizar":** quem vê o faturamento pode sincronizar; a gravação é com service_role (é espelho do apLIS). A RLS das tabelas segue ler = ver, gravar = gerenciar. Se só quem gerencia deve sincronizar, troca uma linha no handler.
- **Filtro de convênio** usa a fonte pagadora da requisição (como a sincronização), não a do lote.
- Requisição que sai do conjunto (status fora da lista e sem lote) não é relida: a foto dela fica com o último estado.
- As rotas `glosas-legado` e `recursos-legado` ficaram no backend, sem uso na tela.
