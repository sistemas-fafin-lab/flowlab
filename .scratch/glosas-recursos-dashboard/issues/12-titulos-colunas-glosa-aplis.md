# 12: Títulos: colunas Glosado, Glosa recebida e Glosa acatada vindas do apLIS

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** em Contas a Receber → Títulos, a coluna "Glosado" passa a vir da foto (glosa fixada das requisições em status 6 dos lotes do título). Ao lado entram "Glosa recebida" (valor deferido dos recursos das requisições do título) e "Glosa acatada" (saldo negativo das requisições em status 18 e 8). Os cards de total do recorte somam as três. Nesta etapa, o saldo do título não muda.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] As três colunas são calculadas por lote de faturamento do título a partir da foto.
- [ ] Os totais do recorte (todas as páginas, não só a atual) incluem Glosado, Glosa recebida e Glosa acatada.
- [ ] O saldo do título continua com a regra atual. A mudança do saldo é feita no ticket 13.
- [ ] Testes do módulo de regras cobrem as somas por lote.
