Status: done
Type: bug

# `nivelConfiancaVinculo` (heurística de confiança do vínculo de IHQ) nunca é chamada no backend

## Onde

`api/_lib/qualidade/ihqRegras.ts` define `nivelConfiancaVinculo(candidatas)` — a regra R1
("mais de 1 candidata, 0 com peça" = `baixa`; 1 candidata = `alta`; etc.) que decide se um
vínculo de IHQ pode ser aceito automaticamente ou precisa de curadoria manual. Achado pelo
`/code-review` da issue 01 (rodado em `283e2f3^`, depois reverificado no HEAD atual): a função
só é referenciada pelo próprio arquivo, pelo teste (`ihqRegras.test.ts`) e por comentários —
nenhum handler a chama.

Consequência: `qa_ihq_solicitacoes.vinculo_confianca`/`vinculo_proveniencia` só são gravados em
UM lugar hoje — `qualidade-confirmar-vinculo-ihq.ts`, e só quando um humano confirma
manualmente (`vinculo_confianca: 'alta'` fixo). `qualidade-sync-ihq.ts` nunca grava essas
colunas. Ou seja, toda solicitação recém-sincronizada fica com `vinculo_confianca` no default
do banco (nunca populado pela heurística), e:

- O filtro `vinculoAConfirmar` de `src/modules/qualidade/ihq.ts` (`vinculo_confianca in
  ('baixa','nenhuma') AND vinculo_proveniencia = 'heuristica'`) nunca bate para nada recém
  sincronizado — a worklist de "vínculos para confirmar" fica sempre vazia mesmo quando há
  ambiguidade real.
- `VinculoDrawer.tsx` usa `data.vinculoConfianca` (valor armazenado, não as `candidatas`
  recalculadas ao vivo por `buscar-detalhe-ihq`) para decidir se mostra a lista de candidatas
  (`precisaConfirmar`) — como esse campo nunca é populado pela heurística, o drawer nunca entra
  no modo "escolher candidata" fora do caso confirmado manualmente.

## O que fazer

Decidir ONDE rodar a heurística antes de implementar — duas opções, com trade-offs diferentes:

1. **No sync** (`sync-ihq`): mais fiel ao design original (comentário em
   `confirmar-vinculo-ihq.ts` já assume que existe um estado "pré-confirmação" heurístico antes
   do usuário abrir o item). Custo: 1 consulta `buscarCandidatasVinculoIhqLis` por solicitação
   sincronizada (N+1) — precisa medir se o volume de IHQ por período torna isso aceitável, ou
   se compensa paralelizar/batch.
2. **Sob demanda, em `buscar-detalhe-ihq`** (lazy): calcular `nivelConfiancaVinculo` a partir
   das `candidatas` já recalculadas ao vivo nesse handler, e persistir de volta (auto-cura a
   cada visualização), só quando `vinculo_proveniencia` ainda não for `'manual'`. Mais barato
   (nenhum N+1 novo — já busca candidatas), mas: (a) esse handler só exige `canViewQualidade`,
   então um usuário só-leitura dispararia uma escrita como efeito colateral de abrir a tela —
   checar se a RLS de `UPDATE` em `qa_ihq_solicitacoes` aceita isso ou se precisa de
   service_role; (b) decidir se o trigger de auditoria deve ou não registrar essa escrita
   automática (ele já existe e dispara em mudança de `vinculo_proveniencia`).

Confiança `alta`/`media` (candidata única, ou única com peça) parecem, pela regra R1 e pelo
gate `precisaConfirmar` do frontend, destinadas a auto-resolver `cod_requisicao_original` sem
intervenção humana — só `baixa`/`nenhuma` ficam para curadoria manual. Confirmar essa leitura
antes de implementar (não document.ado explicitamente em nenhum lugar do código portado).

## Critérios de aceite

- `npx vitest run src/modules/qualidade/domain/ihqRegras.test.ts` continua verde (não muda a
  regra pura, só quem a chama).
- Uma solicitação de IHQ recém-sincronizada com candidata ambígua (2+ candidatas, 0 com peça)
  aparece no filtro `vinculoAConfirmar` sem precisar de nenhuma ação manual prévia.
- Uma solicitação com candidata única é auto-vinculada (ou documentar explicitamente por que
  não deveria ser, se a leitura acima estiver errada).

## Comments

Implementado **no sync** (opção 1), decisão do usuário.

`qualidade-sync-ihq.ts` agora, depois do upsert de espelho de sempre:

1. Busca de volta `id, cod_requisicao_ihq, vinculo_proveniencia` das linhas upsertadas
   (`.select()` encadeado no upsert).
2. Para cada solicitação cujo `vinculo_proveniencia` NÃO seja `'manual'` (linha nova ou
   ainda-heurística) e que tenha `codPaciente` resolvido no LIS, chama
   `buscarCandidatasVinculoIhqLis` e `nivelConfiancaVinculo` (R1), e grava
   `vinculo_confianca`/`vinculo_proveniencia: 'heuristica'`/`cod_requisicao_original`.
3. Confirmou-se a leitura da issue: confiança `alta` (candidata única) e `media` (única com
   peça, entre 2+) resolvem `cod_requisicao_original` sozinhas; `baixa`/`nenhuma` gravam só
   confiança/proveniência, sem `cod_requisicao_original` — ficam para o filtro
   `vinculoAConfirmar` do frontend, como já eram consumidas.
4. Nunca sobrescreve uma linha já `vinculo_proveniencia: 'manual'` (confirmação humana
   sempre vence a heurística, mesmo em re-sync).
5. Loop **sequencial**, não `Promise.all` — `comConexao` abre 1 conexão MySQL dedicada por
   chamada (não é pool); rodar N em paralelo abriria N conexões simultâneas no banco
   compartilhado do LIS. Erro numa solicitação individual (LIS ou gravação) só loga e
   segue para a próxima — não aborta o sync inteiro, que já tinha persistido o espelho com
   sucesso. Fica documentado no cabeçalho do arquivo como ponto a medir se o volume de IHQ
   por período crescer muito.

Escrita usa `getSupabaseAdminClient()` (service_role, mesmo client do upsert de espelho) —
sem `auth.uid()`, então o trigger de auditoria (`qa_ihq_solicitacoes_auditoria_trigger`,
migration 20260820140000) não grava em `app_auditoria` para essa atualização automática,
igual ao restante do sync; só a confirmação manual (`confirmar-vinculo-ihq.ts`, client da
sessão do usuário) fica auditada — comportamento já existente, não alterado aqui.

Verificado: `npx tsc --noEmit -p api/tsconfig.json` sem erros;
`npx vitest run src/modules/qualidade/domain/ihqRegras.test.ts` 8/8 (regra pura inalterada).
