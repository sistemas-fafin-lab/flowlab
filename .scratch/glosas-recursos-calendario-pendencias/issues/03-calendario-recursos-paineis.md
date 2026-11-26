# 03: Calendário de recursos: Hoje, Amanhã e Atrasados

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** a aba "Calendário de recursos" em Glosas e Recursos, com os painéis Hoje, Amanhã e Atrasados e a lista "Sem prazo cadastrado". Cada item é um lote de faturamento de um convênio com requisições em status 6, com motivo de glosa e fora de lote de recurso enviado, agrupado pela data do prazo para recorrer. Prazo no sábado ou no domingo aparece na sexta anterior com o selo "vence sáb" ou "vence dom".

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [x] Função pura de itens do calendário: agrupamento lote × prazo, data de exibição (fim de semana → sexta anterior), selos Hoje / Amanhã / Atrasado / Futuro e lista sem prazo. Testes do spec, incluindo prazo no sábado, no domingo e virada de mês.
- [x] Endpoint do calendário por mês e fonte pagadora, a partir da foto e das regras de prazo; uma regra alterada reflete na próxima leitura.
- [x] Cada item mostra convênio, nº do lote, protocolo, quantidade de requisições, valor não recorrido, principais motivos e o selo de fim de semana quando houver.
- [x] Clicar no item abre as requisições dele, com o detalhe que já existe em "Recursos fora de lote".
- [x] A lista "Sem prazo cadastrado" tem link para a tela de regras.
- [ ] O filtro de convênio do cabeçalho vale; temas claro e escuro; sem rolagem horizontal em 390 px.

## Comments

**Implementação (26/11/2026)**

- Função pura `calendarioDeRecursos` em `api/_lib/faturamento/recursoGlosa.ts`; endpoint `GET /api/faturamento/glosas-recursos-calendario?mes=YYYY-MM&fontePagadoraId=`; aba em `src/modules/faturamento/components/CalendarioRecursos.tsx`. A resposta já traz os `itens` do mês para a grade da issue 04.
- **Protocolo do lote de faturamento:** a foto não o tinha. A migration `20261126160000_glosa_recurso_calendario.sql` cria `protocolo_lote_faturamento` (vem de `fatlote.Protocolo` na sincronização) e põe `id_lote_faturamento` e o protocolo na view `glosa_recurso_requisicoes_lista`. O protocolo fica vazio até o mês ser sincronizado de novo. Não há backfill.
- **Decisão: sem data de recebimento.** Além de "sem regra" e "regra sem prazo", a requisição sem data de recebimento também vai para "Sem prazo cadastrado", com o selo "Sem data de recebimento", para nada sumir sem aviso.
- **Decisão: Hoje no fim de semana.** O selo Hoje vale quando a data de exibição é ≤ hoje e o prazo real ainda não passou. Assim, quem abre a tela num sábado vê em Hoje o prazo do próprio sábado, que foi exibido na sexta. Pela letra do spec ("data de exibição = hoje"), esse item seria "futuro".
- **Diferença com "Recursos fora de lote":** o calendário mantém a requisição que está num lote de recurso **não enviado**, como manda o spec. A sub-aba "Recursos fora de lote" só lista as requisições sem nenhum lote, então essa requisição aparece no calendário e não aparece lá.
- **Falta conferir (ready-for-human):** aplicar a migration e olhar 390 px e temas claro e escuro não foram conferidos no app, porque o endpoint depende da migration aplicada. O layout é de uma coluna em tela estreita, com `min-w-0`, `break-words` e classes `dark:`.

