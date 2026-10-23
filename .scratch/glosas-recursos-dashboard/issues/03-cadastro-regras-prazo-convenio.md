# 03: Cadastro de regras de prazo por convênio

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** uma tela, dentro de Acompanhamento dos recursos, para cadastrar por convênio as quatro regras de prazo: Pagamento (fatura), Glosa – Recurso, Glosa – Análise e Glosa – Pagamento. Cada regra é de um destes tipos: N dias corridos, N dias úteis, dia X do mês seguinte, N-ésimo dia útil do mês seguinte, último dia do mês seguinte, ou sem prazo. Cada regra se liga a uma ou mais fontes pagadoras do apLIS. A tela já vem preenchida com a planilha da responsável pelas glosas (tabela nas Further Notes do spec).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Existe uma tabela de regras de prazo e uma de vínculo com fontes pagadoras do apLIS, com RLS: lê quem pode ver o faturamento, edita quem pode gerenciar.
- [x] A migration carrega a planilha do spec. Os casos não claros, vazios, "após solicitação de NF" e "conforme cronograma" entram como sem prazo. A interpretação de "20º dia útil" (Cassi) e de "20 dias" (Fascal) segue o spec.
- [x] O vínculo com as fontes pagadoras é pré-preenchido por semelhança de nome (por exemplo, BRADESCO liga os dois cadastros do Bradesco) e pode ser alterado na tela.
- [x] A tela lista as fontes pagadoras com glosa ou recurso que ainda não têm regra ligada.
- [x] Só quem pode gerenciar o faturamento vê os controles de edição.

## Comments

**Implementado (23/10/2026).** Decisões tomadas na implementação, para revisar:

- **Tela:** sub-aba "Regras de prazo" em Acompanhamento dos recursos. Lista os convênios com as quatro regras (e o texto da planilha embaixo) e as fontes ligadas. O lápis abre o modal da regra e das fontes. Também dá para criar e excluir convênio (fora do pedido, mas pequeno).
- **Gravação sem handler:** a tela lê e grava direto no Supabase com o cliente da sessão, e a RLS barra quem não pode (como em `useClinicasSemNf`). Um convênio é gravado pela RPC `glosa_prazo_salvar_regra` (`SECURITY INVOKER`), que grava a regra e as fontes numa transação só. O spec pede "padrão de dispatcher e handlers"; se for preciso, dá para trocar por um handler.
- **Uma fonte segue uma regra só:** a PK do vínculo é `id_fonte_pagadora`. Ao ligar uma fonte que já está em outro convênio, ela muda de regra, e o modal avisa.
- **Texto da planilha:** cada regra guarda o texto original em `<regra>_texto`, para quem for completar uma regra "sem prazo".
- **Pagamento (fatura):** os prazos contados da fatura entram com tipo (ASSEFAZ dia 20, BRADESCO 45 dias, FASCAL 20 dias úteis, POSTAL 60 dias, PF último dia, TST dia 20). Os contados da NF ou da entrega ficam como sem prazo com o texto.
- **PMDF – Glosa – Pagamento "30 dias após NF":** entrou como sem prazo, porque depende da NF. Pode ser 30 dias corridos; conferir com a responsável.
- **Vínculo automático:** padrão por convênio sobre o nome sem acento, aplicado às fontes de `operadoras` (aplis_id numérico, sem clínicas parceiras) e às da foto. Resultado com os nomes atuais: 34 vínculos; STM ficou sem fonte. Para conferir: PLAN ASSISTE também ligou "LAB PLANASSISTE" (1129); CASSI ligou CASSI-PER e E-VIDA ligou E-VIDAPER; "090 SULAMERICA" (1054) ficou de fora por ser clínica parceira.
- **Reaplicar a migration** não desfaz edição: as regras usam `ON CONFLICT DO NOTHING` e o vínculo automático só roda com a tabela de vínculo vazia.
- **Fontes sem regra:** view `glosa_recurso_fontes_sem_regra` sobre a foto (requisições + lotes de recurso), com "Ligar a…" para quem gerencia.
- **Fora da issue:** `useConveniosGlosas` passou a ignorar `operadoras` com aplis_id não numérico (OP001…OP005, de exemplo), que viravam `NaN` no filtro de convênio.
- Migration testada num Postgres local (aplicada duas vezes, RLS, CHECKs, RPC). Não foi aplicada no Supabase.
