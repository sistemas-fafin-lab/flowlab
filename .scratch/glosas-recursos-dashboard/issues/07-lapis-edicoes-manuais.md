# 07: Lápis: edições manuais de lote e de requisição

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** no card "Detalhes do recurso", o lápis permite corrigir, no lote, a data de envio, a data real de retorno e a data real de pagamento, e, em cada requisição, o valor recursado e o valor recebido de glosa. Os valores editados ficam guardados só no FlowLab e valem acima do apLIS.

**Blocked by:** 02, 04, 06

**Status:** done

- [x] As edições são guardadas no Supabase com usuário e data, com RLS: só quem pode gerenciar o faturamento grava.
- [x] O campo editado mostra a marca "editado manualmente".
- [x] Cada edição vira evento no histórico, com usuário, valor anterior e valor novo.
- [x] A sincronização não sobrescreve um campo editado e não gera evento de sincronização para ele.
- [x] A data de envio editada recalcula retorno, pagamento e selo; a data real de retorno encerra o selo de atraso.
- [x] Na lista, a data real aparece diferenciada da prevista.
- [x] Valores editados entram na classificação e nos cards.
- [x] Quem não pode gerenciar não vê o lápis.
- [x] O teste do handler de sincronização confirma que um campo editado não é sobrescrito.

## Notas da implementação

- **Onde mora a edição:** colunas da própria foto (migration `20261023180000`): no lote, `data_envio_editada`, `data_retorno_real`, `data_pagamento_real`; na requisição, `valor_recursado_editado`, `valor_recebido_glosa_editado`. Cada uma com `<coluna>_por` (usuário) e `<coluna>_em`. null = vale o apLIS. A sincronização não manda essas colunas no upsert, então não as sobrescreve. RLS: as políticas de UPDATE das fotos já exigiam `canManageBilling`; o histórico ganhou o tipo `edicao_manual`.
- **Gravação:** `POST /api/faturamento/glosas-recursos-editar` com `{ idLoteRecurso | idRequisicao, campo, valor }` (`canManageBilling`, cliente do usuário). `valor: null` remove a edição. A rota calcula o evento (`recursoGlosa.eventoEdicaoManual`, com o valor que valia antes e o que passa a valer) e a RPC `glosa_recurso_gravar_edicao` grava edição e evento numa transação só, com o usuário de `auth.uid()` (sem usuário, recusa). Salvar o mesmo valor não grava nada; salvar o valor igual ao do apLIS sem edição prévia fixa esse valor (a sincronização deixa de mudá-lo).
- **Sincronização:** `eventosDoLote(..., { envioEditado })` e `eventosDaRequisicao(..., { recebidoGlosaEditado })` suprimem o evento do campo editado. O valor recursado não tinha evento de sincronização. Lote com envio editado conta como enviado para a marca de "valor inicial estimado".
- **Leitura:** a view `glosa_recurso_lotes_lista` foi recriada com `data_envio` (editada ou do apLIS), `valor_recorrido` com o recursado editado, e `status_label` "Enviado" para lote "Criado" no apLIS com envio editado. Lotes, resumo e detalhe usam `edicoesDaFoto` na classificação; o detalhe devolve `editados` e o nome de quem editou em cada evento.
- **Tela:** lápis no card (envio, retorno real e pagamento real no bloco do lote; recursado e recebido de glosa na requisição), com a marca "editado manualmente" e "Remover edição". Na lista, as colunas Retorno e Pagamento mostram a data real (rótulo "real") ou a prevista (em itálico, rótulo "prevista"). Cada edição gravada incrementa a `versao` da página, e lista, cards e card de detalhe são relidos.
- Migration **não testada em banco** nem aplicada no Supabase. Sem ela aplicada, a sincronização e as leituras falham (as colunas novas são lidas).
- Revisão: o handler de edição e o card não têm teste próprio (os pontos de teste combinados no spec são o módulo de regras e o handler de sincronização). Ficaram de fora o cadastro da rota em `api/server.ts` (como as outras rotas `glosas-recursos-*`) e a edição da glosa fixada (o spec cita o lápis para ela, mas este ticket lista só os cinco campos).
