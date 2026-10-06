# Faturamento: criar títulos automaticamente a partir dos lotes do apLIS

Status: done

## Problem Statement

Hoje todo título do Contas a Receber é criado à mão: o operador abre "Novo
título", procura o lote do apLIS, marca, copia o número da NF-e e confirma —
um lote por vez. Mas o setor já fez esse trabalho dentro do apLIS: fechar o
lote (e, semanas depois, emitir o RPS) é exatamente o que define que existe uma
cobrança. O FlowLab repete à mão uma informação que já está no banco de backup
do apLIS, e o resultado depende de alguém lembrar de cadastrar cada lote e de
voltar depois para completar o número da nota quando o RPS sai.

## Solution

Um botão **"Atualizar do apLIS"** no cabeçalho da página Contas a Receber, ao
lado de "Sincronizar operadoras". Ao clicar, o operador vê uma **prévia** com:

1. os **lotes fechados no apLIS a partir de uma data de corte** (campo de data
   na própria prévia) que ainda não têm título — cada um vira **um título**
   (1 lote → 1 título, o mesmo padrão dos 1.509 títulos do backfill);
2. os **títulos já existentes sem número da nota** cujo lote ganhou NF-e no
   apLIS — o número é preenchido.

Tudo vem marcado; o operador desmarca as exceções e confirma. Cada título é
criado de forma independente: o que der certo fica, o que falhar aparece com o
motivo na própria linha. Os títulos saem idênticos aos da criação manual — o
botão só elimina a digitação. A criação manual continua existindo para
reapresentações e exceções.

## User Stories

1. As a operador de faturamento, I want a button that brings the apLIS lotes that still have no título, so that I don't have to register each one by hand.
2. As a operador de faturamento, I want the button next to "Sincronizar operadoras" on the Títulos tab, so that all apLIS synchronization actions are in one place.
3. As a operador de faturamento, I want to see a preview before anything is created, so that a wrong batch never lands in the Contas a Receber.
4. As a operador de faturamento, I want every valid lote to come pre-selected in the preview, so that the common case (create all) is one click.
5. As a operador de faturamento, I want to unselect individual lotes in the preview, so that I can leave exceptions to be handled manually.
6. As a operador de faturamento, I want a "fechados a partir de" date field in the preview, so that I control how far back the search goes.
7. As a operador de faturamento, I want that date to default to the first day of the previous month, so that the month that just closed is covered without me typing anything.
8. As a coordenador financeiro, I want the date field to refuse anything before 01/09/2026, so that nobody resurrects historical lotes that the backfill deliberately left out.
9. As a operador de faturamento, I want only lotes already closed in the apLIS (DtaFechamento filled, status not Cancelado nor Prejuízo) to appear, so that lotes still being assembled don't become títulos.
10. As a operador de faturamento, I want lotes of the Particular fonte pagadora to never appear, so that particulares keep their own pendências flow.
11. As a operador de faturamento, I want clínicas parceiras (e.g. Medigest) to appear in the preview, so that they are billed like any other convênio.
12. As a operador de faturamento, I want lotes that already belong to any título (manual, backfill or automatic) to be excluded, so that no lote is ever billed twice.
13. As a operador de faturamento, I want a reapresentado lote (already with a título) to stay out of the preview, so that reapresentação remains a deliberate manual action.
14. As a operador de faturamento, I want lotes with value R$ 0 to show up unselected and locked with the reason "sem valor a faturar", so that I understand why they won't become títulos instead of them silently disappearing.
15. As a operador de faturamento, I want lotes already Recebido or Recebido-parcial in the apLIS to carry a "já recebido no apLIS" badge, so that I remember to register the baixa afterwards.
16. As a operador de faturamento, I want each row of the preview to show operadora, lote, value, creation date and NF (when there is one), so that I can recognise the lote at a glance.
17. As a operador de faturamento, I want the automatic título to use the lote closing date (DtaFechamento, "faturado" in the apLIS) as emissão, so that it matches the "Data Faturamento" of the planilha and of manual títulos. (Changed 06/10: was the creation date, which put lotes closed in October into September.)
18. As a coordenador financeiro, I want the competência of the automatic título to be the month of the emissão, so that no automatic título is a hole in the monthly report.
19. As a operador de faturamento, I want the vencimento to follow the same rule as the manual flow (RPS vencimento when the lote already has an RPS, otherwise the operadora contractual rule), so that automatic and manual títulos behave the same in the aging.
20. As a operador de faturamento, I want the número da nota to be filled with the RPS NF-e when the lote already has one, so that I don't copy it by hand.
21. As a operador de faturamento, I want the responsável of the título to be whoever closed the lote in the apLIS, so that the Responsável column stays meaningful.
22. As a auditor, I want every automatic título to carry the observação "Criado pelo Atualizar a partir do apLIS em DD/MM", so that automatic títulos can be told apart from manual ones.
23. As a auditor, I want criado_por to be the user who clicked the button, so that there is a person accountable for each creation.
24. As a operador de faturamento, I want each título to be created independently, so that one failure doesn't block the rest of the month.
25. As a operador de faturamento, I want to see, per row, which títulos were created and which failed and why, so that I can fix the failures manually.
26. As a operador de faturamento, I want a summary after confirming (e.g. "28 títulos criados, 2 falharam, 5 NFs preenchidas"), so that I know the outcome without scrolling.
27. As a operador de faturamento, I want the Títulos list to refresh after confirming, so that the new títulos show up immediately.
28. As a operador de faturamento, I want the preview to also list títulos without número da nota whose lote now has an NF-e in the apLIS, so that I don't have to come back and type it weeks later.
29. As a operador de faturamento, I want the NF filling to apply to manual, backfill and automatic títulos alike, so that all títulos get completed the same way.
30. As a operador de faturamento, I want the NF filling to never overwrite a número already filled — even if someone typed it between opening the preview and confirming, so that a manual correction is never lost.
31. As a coordenador financeiro, I want the vencimento of an existing título to stay untouched when its RPS appears, so that an edited or contractual vencimento isn't replaced by the RPS one (which misses the real payment by 42 days, median).
32. As a operador de faturamento, I want a notice "dados do apLIS até ontem" next to the button, so that I don't think the button is broken when today's lote is missing.
33. As a administrador, I want the button and the route to require the same permission as creating a título manually (canManageBilling in the custom_role), so that no new permission has to be granted.
34. As a usuário sem canManageBilling, I want the button to be hidden, so that I'm not offered an action I can't perform.
35. As a operador de faturamento, I want a clear message when the apLIS replica is unreachable, so that I know to try again later instead of assuming there is nothing to create.
36. As a operador de faturamento, I want an empty-state message when there is nothing new, so that I know the check ran.
37. As a operador de faturamento, I want the manual "Novo título" to keep working unchanged, so that reapresentações and exceptions still have a path.
38. As a operador de faturamento, I want the preview to handle a whole month of lotes (~200) without pagination hiccups, so that one click covers the month.

## Implementation Decisions

**Unidade e elegibilidade**

- 1 lote do apLIS = 1 título. O RPS é só um dado do título (número da nota e,
  na criação, vencimento), não um agrupador. Motivo medido no apLIS: ~60% dos
  lotes nunca têm RPS (AMHP-DF praticamente nunca), e o RPS chega semanas
  depois do fechamento.
- Lote elegível: `DtaFechamento` não nula, `Status` (STLOT) fora de 5
  Cancelado e 8 Prejuízo, fonte pagadora com `Particular` ≠ 1, fechado a partir
  da data de corte, e sem nenhum vínculo em `nota_lote` com um título de
  qualquer status — **inclusive cancelado**. É mais restrito que
  `fat_criar_titulo` e a aba Faturas (que liberam lote de título cancelado) de
  propósito: refaturar lote cancelado é decisão manual.
- Lote desvinculado de um título (vínculo apagado, registro em
  `notas_lote_audit_logs`) volta a ser elegível, mas aparece **desmarcado**,
  com o título de origem, a data e o motivo.
- Título automático sem NF é aceito mesmo sabendo que, em operadora sem
  `nf_apos_pagamento`, a baixa fica bloqueada até o número ser preenchido
  (issue 34 do feedback). Lotes sem RPS no apLIS (quase toda a AMHP-DF)
  continuam precisando do número digitado à mão, como hoje. Essa regra reproduz 1.413 dos 1.415 lotes jan–ago que o setor pôs na
  planilha.
- Piso da data de corte: 01/09/2026 — validado no servidor, não só no campo.
  O corte compara com `DtaFechamento`, calculado em data local (mesma disciplina
  de `DATE_FORMAT` no SQL já usada no `bdLab`).

**Backend**

- Nova função de leitura no módulo `bdLab` de faturamento: lista os lotes
  fechados a partir de uma data, com os mesmos campos de `LoteFaturamento`
  (operadora, valor, datas, status, NF-e/RPS) mais o flag de fonte Particular.
  Recebe também a lista de ids de lotes para a consulta de NF-e dos títulos
  existentes (ou uma segunda função, a critério da implementação).
- Nova action no dispatcher de faturamento, `titulos-aplis-previa` (GET,
  exige `canManageBilling` — só existe para quem vai criar). Parâmetro `desde` (YYYY-MM-DD; 400 se inválido ou anterior ao
  piso). Resposta:

  ```ts
  {
    success: true,
    desde: string,                 // efetivo, já com o piso aplicado
    lotes: Array<{
      lote: LoteFaturamento,       // snapshot de exibição (+ dtaFechamento)
      bloqueio: 'sem-valor' | null,
      jaRecebidoAplis: boolean,    // STLOT 4 ou 7
      semNf: boolean,              // sem NFeNumero: baixa exigirá o número
      emissaoMesAnterior: boolean, // mês(DtaCriacao) ≠ mês(DtaFechamento)
      desvinculado: null | { idNota: string, em: string, motivo: string },
    }>,
    nfsAPreencher: Array<{
      idNota: string,
      idsLote: number[],
      operadora: string,
      situacao: 'preenchivel' | 'divergente',
      nfeNumeros: string[],        // 1 quando preenchível; as distintas quando divergente
    }>,
  }
  ```

  A dedupe consulta `nota_lote`/`lotes` no Supabase (mesmo padrão de
  `faturamento-lotes` com `somenteSemTitulo`). `nfsAPreencher` = títulos com
  `numero_nota` vazio, não cancelados, independentes da data de corte, em que
  **todos** os lotes têm `NFeNumero` no apLIS: preenchível quando é a mesma
  NF-e em todos; divergente (não selecionável) quando há mais de uma. Título
  com algum lote ainda sem NF-e não aparece.
- **Criação reaproveita `titulo-criar` sem mudança**: a tela chama a rota uma
  vez por lote marcado, com `idsLote: [id]`, `competencia` = mês da emissão
  padrão do lote e `observacoes` = "Criado pelo Atualizar a partir do apLIS em
  DD/MM". Emissão, vencimento, número da nota e responsável ficam por conta das
  regras que a rota já aplica. A recusa da RPC para lote já faturado protege
  contra corrida com uma criação manual simultânea.
- **Preenchimento de NF reaproveita `titulo-atualizar-numero-nota`**, com um
  novo parâmetro opcional `somenteSeVazio` (boolean). A RPC
  `fat_atualizar_numero_nota` ganha o modo correspondente: com ele ligado,
  título que já tem número não é alterado e a chamada responde com um resultado
  distinguível ("já preenchido") em vez de erro genérico. Sem o parâmetro, o
  comportamento atual da tela de edição não muda. Mudança de schema: só a
  assinatura/corpo da RPC — nova migration com `DROP FUNCTION` da assinatura
  antiga e recriação (evita overload ambíguo no PostgREST), refazendo os
  GRANTs; o modo "só se vazio" é um `UPDATE ... WHERE numero_nota IS NULL`
  atômico.

**Frontend**

- Botão "Atualizar do apLIS" no cabeçalho da página Contas a Receber, ao lado de
  "Sincronizar operadoras", visível só com `canManageBilling`, com o aviso
  "dados do apLIS até ontem".
- Modal de prévia no padrão visual do `NovoTituloModal`: campo "fechados a
  partir de" (default 1º dia do mês anterior, mínimo 01/09/2026), seção de
  lotes (todos marcados, bloqueados desmarcados e travados com o motivo, selo
  "já recebido no apLIS"), seção de NFs a preencher (marcadas), botão
  confirmar.
- Execução: até 4 chamadas em paralelo às rotas (medido ~6–8 s por lote; a
  primeira execução, ~180 lotes fechados desde 01/09, leva ~5 min); barra de
  progresso e aviso para não fechar o modal; cada linha mostra
  criando/criado/falhou + mensagem da rota; ao fim, resumo e recarga da lista
  de títulos. Fechar no meio não desfaz nada — reabrir mostra só o que falta.
- Lotes desvinculados vêm desmarcados (selecionáveis); os demais válidos vêm
  marcados. Selos por linha: "já recebido no apLIS", "sem NF — a baixa exige
  o número", "emissão em mês anterior", "desvinculado do título X em DD/MM:
  <motivo>".
- Funções puras num utilitário do módulo (ao lado de `emissaoTitulo`):
  competência a partir da emissão, texto da observação com a data local,
  default e piso da data de corte, consolidação de resultados por linha no
  resumo.

## Testing Decisions

- Bons testes aqui exercitam comportamento observável pela fronteira pública —
  resposta HTTP do handler, retorno das funções puras — e não a forma interna
  das consultas. Casos de teste espelham achados reais do banco quando
  possível (padrão do `bdLab.test.ts`, que cita lotes reais).
- **Handler `titulos-aplis-previa`** (seam principal): testado chamando o
  handler com `bdLab` e Supabase mockados, no padrão de
  `apoio-transferir.test.ts`. Casos: 401/403 sem permissão; 400 com `desde`
  inválido ou antes do piso; exclusão de lote que já tem título; lote R$ 0 vem
  com `bloqueio: 'sem-valor'`; STLOT 4/7 vem com `jaRecebidoAplis`; Particular
  não aparece; `nfsAPreencher` só inclui título sem número cujo lote tem NF-e;
  erro do apLIS vira mensagem clara (não 500 mudo).
- **Handler `titulo-atualizar-numero-nota` com `somenteSeVazio`**: mesmo
  padrão; garante que o parâmetro é repassado à RPC e que o resultado "já
  preenchido" chega à tela distinguível de erro.
- **Utilitário do frontend**: testes unitários no padrão de
  `emissaoTitulo.test.ts`/`periodo.test.ts` — competência, observação, default
  e piso da data (incluindo virada de ano), resumo de resultados.
- A consulta SQL nova é conferida ao vivo contra a réplica (skill
  `banco-lab-mysql`), como o resto do `bdLab`; a contagem para jan–ago deve
  reproduzir os ~1.413 lotes da planilha (sanity check, não teste
  automatizado).
- O componente do modal não ganha teste automatizado (o módulo não tem prática
  de teste de componente); validação manual no app.

## Out of Scope

- Agrupar vários lotes num título pelo RPS.
- Criar título para lotes sem fechamento, Particular, reapresentações ou
  lotes com título existente.
- Importar baixa/glosa do apLIS junto com o título (lote já recebido gera só o
  título; a baixa segue o fluxo atual).
- Atualizar vencimento de título existente quando o RPS aparece.
- Execução automática/agendada (cron) — é sempre um clique do operador.
- Corrigir número da nota já preenchido que diverge do apLIS.
- Mudar a criação manual.

## Further Notes

- A réplica do apLIS atrasa ~1 dia; lote fechado hoje só aparece amanhã.
- Números usados nas decisões (medidos em 30/09/2026 na réplica): 1.509
  títulos do backfill, todos 1 lote → 1 título; 887 deles sem RPS; RPS em 9% dos
  lotes de jan e 62% dos de jul; 1.413/1.415 lotes da planilha têm
  `DtaFechamento`; em 12% dos lotes a criação e o fechamento caem em meses
  diferentes (emissão segue a criação, por convenção); 1.503/1.509 títulos do
  backfill têm competência = mês da emissão; o apLIS não tem coluna de
  competência.
- Os títulos criados pela tela desde agosto não foram conferidos (sem leitura
  de produção nesta sessão); a dedupe por lote cobre esses casos.
