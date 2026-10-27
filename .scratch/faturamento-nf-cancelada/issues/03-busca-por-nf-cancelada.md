# 03: Busca de títulos pelo número de uma NF cancelada

**What to build:** na lista de títulos, buscar pelo número de uma NF cancelada encontra o título que a substituiu, e a linha mostra que aquele número é uma NF cancelada e qual é a NF atual. As NFs canceladas sem título (importadas da planilha) também aparecem na busca por número, como resultado próprio, com operadora, valor, data de emissão e motivo. Regras em `.scratch/faturamento-nf-cancelada/spec.md`.

**Blocked by:** 01 (Registrar a NF anterior como cancelada ao trocar o número).

**Status:** ready-for-agent

- [x] A busca da lista de títulos casa com o número atual e também com o número de uma NF cancelada, e devolve qual NF casou. (`utils/nfCanceladaBusca.ts`; os títulos achados entram no `or()` como `id_nota.in.(...)`.)
- [x] A linha encontrada por uma NF cancelada indica que o número buscado foi cancelado e mostra o número atual. (Sem selo quando o número atual também casa com o termo.)
- [x] As NFs canceladas sem título entram como resultado próprio da busca, com operadora, valor, data de emissão e motivo. (Bloco acima da tabela, só na página 1; respeita só o filtro de Operadora.)
- [x] A leitura exige `canViewBilling` ou `canManageBilling`. (RLS de `fat_nfs_canceladas`.)
- [x] A busca pelo número atual continua igual. (Falha na leitura das NFs canceladas não derruba a lista.)
- [ ] Conferência manual no app:
  - buscar o número antigo do título do ticket 01;
  - buscar uma NF sem título inserida à mão no dev.
