# 04: Importar as 11 NFs da aba "NF CANCELADAS FORA APLIS"

**What to build:** as 11 linhas da aba "NF CANCELADAS FORA APLIS" da planilha "CONTROLE DE EMISSÃO DE NOTAS" entram uma vez no histórico de NFs canceladas, com origem `planilha`. Cada linha é ligada ao título que a substituiu só quando há um único candidato claro. As demais entram sem título, ligadas só à operadora. Um relatório diz o que foi vinculado e o que não foi, e por quê. Regras e dados conferidos em `.scratch/faturamento-nf-cancelada/spec.md` (Further Notes).

**Blocked by:** 01 (Registrar a NF anterior como cancelada ao trocar o número), porque precisa da tabela.

**Status:** ready-for-agent

- [ ] Antes de escrever a função de vínculo, conferir o que dá para reaproveitar do script do acerto de 20/10 (`fat_acerto_titulos_planilha_pelo_aplis`).
- [ ] O script em `supabase/scripts/` gera uma migration de dados única, no padrão desse acerto: transação única e conferência no fim.
- [ ] O nome do convênio na planilha (ex.: "SIS", "STF MED", "BRADESCO") é resolvido para a operadora do flowlab no script. As linhas ambíguas vão para o relatório.
- [ ] Uma função pura decide o título candidato de cada linha. O candidato precisa:
  - ser da mesma operadora;
  - ter sido emitido depois da NF cancelada, em até 30 dias;
  - ter lote em comum ou o mesmo valor.
  - Sem candidato único, a linha entra sem título.
- [ ] Teste vitest da função: candidato único, nenhum candidato, mais de um candidato.
- [ ] O motivo é copiado da planilha como está. Valor e data de emissão vêm da planilha.
- [ ] O relatório em `.scratch/faturamento-nf-cancelada/` lista as linhas vinculadas, as não vinculadas e o motivo de cada uma.
- [ ] A conferência no fim da migration verifica que as 11 linhas entraram e que nenhum número se repete por operadora.
