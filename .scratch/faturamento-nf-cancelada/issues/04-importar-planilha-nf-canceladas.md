# 04: Importar as 11 NFs da aba "NF CANCELADAS FORA APLIS"

**What to build:** as 11 linhas da aba "NF CANCELADAS FORA APLIS" da planilha "CONTROLE DE EMISSÃO DE NOTAS" entram uma vez no histórico de NFs canceladas, com origem `planilha`. Cada linha é ligada ao título que a substituiu só quando há um único candidato claro. As demais entram sem título, ligadas só à operadora. Um relatório diz o que foi vinculado e o que não foi, e por quê. Regras e dados conferidos em `.scratch/faturamento-nf-cancelada/spec.md` (Further Notes).

**Blocked by:** 01 (Registrar a NF anterior como cancelada ao trocar o número), porque precisa da tabela.

**Status:** done (28/Out/2026): migration regerada contra o Supabase de produção (a primeira tinha os ids de operadora de outro projeto) e aplicada lá; as 11 NFs entraram, todas só com a operadora

- [x] Antes de escrever a função de vínculo, conferir o que dá para reaproveitar do script do acerto de 20/10 (`fat_acerto_titulos_planilha_pelo_aplis`). (O acerto não tem casamento de título; reaproveitados `centavos` e o padrão `todas`/`sqlTexto`/transação + conferência.)
- [x] O script em `supabase/scripts/` gera uma migration de dados única, no padrão desse acerto: transação única e conferência no fim. (`importar-nfs-canceladas-planilha.ts` → `20261027180000_fat_nfs_canceladas_planilha.sql`.)
- [x] O nome do convênio na planilha (ex.: "SIS", "STF MED", "BRADESCO") é resolvido para a operadora do flowlab no script. As linhas ambíguas vão para o relatório. (`resolverOperadora`: convênio da NF no apLIS, depois CNPJ do tomador, depois o nome. As 11 resolveram; a 7504 vai pelo apLIS contra o nome e está destacada no relatório.)
- [x] Uma função pura decide o título candidato de cada linha. O candidato precisa: (`tituloSubstituto` em `api/_lib/faturamento/nfCanceladaPlanilha.ts`; "depois" inclui o mesmo dia; lotes da NF lidos de `fatrps.DadosAdicionais`. Nos dados reais nenhuma das 11 ligou: os títulos com lote em comum são de outra operadora ou emitidos antes da NF — listados no relatório.)
  - ser da mesma operadora;
  - ter sido emitido depois da NF cancelada, em até 30 dias;
  - ter lote em comum ou o mesmo valor.
  - Sem candidato único, a linha entra sem título.
- [x] Teste vitest da função: candidato único, nenhum candidato, mais de um candidato.
- [x] O motivo é copiado da planilha como está. Valor e data de emissão vêm da planilha. (Data do cancelamento, que a planilha não tem: emissão do título substituto, senão a da NF — decisão de 27/10.)
- [x] O relatório em `.scratch/faturamento-nf-cancelada/` lista as linhas vinculadas, as não vinculadas e o motivo de cada uma. (`relatorio-importacao-planilha.md`; também lista as 29 linhas da aba fora desta importação — decisão de 27/10: só as 11.)
- [x] A conferência no fim da migration verifica que as 11 linhas entraram e que nenhum número se repete por operadora. (O script só gera a migration se as 11 resolverem para uma operadora.)
