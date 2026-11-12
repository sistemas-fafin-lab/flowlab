# 04: Funil de glosa por competência com vínculo ao lote

**What to build:** na aba Comparativos, o funil Faturado → Recebido → Glosa total (= recuperada + acatada + em disputa) → Saldo pendente, por competência (mês de emissão), para os 3 meses, com glosa, acatada e saldo atribuídos ao lote e as glosas sem lote como "Fora de lote". Recuperada aparece como detalhe do Recebido, sem somar duas vezes; o "recebido no mês" (caixa) aparece ao lado. Entrega o **mapeamento proposto de status do apLIS → Glosa recuperada** para a usuária revisar. Ver `../spec.md`.

**Blocked by:** 03

**Status:** done (aguardando a usuária confirmar o mapeamento de Recuperada e o significado de "Fora de lote")

- [x] Funil fecha: Faturado = Recebido + Acatada + Em disputa + Saldo; Recuperada não é somada duas vezes.
- [x] Acatada usa os status 18 e 8; Recuperada usa uma constante de mapeamento revisável, documentada no corpo desta issue ao concluir.
- [x] Glosas sem lote entram como "Fora de lote" e o total bate com a tela Glosas e Recursos.
- [x] Título emitido em outro mês não entra no mês.
- [x] Testes de função pura (competência, fechamento do funil, fora de lote, virada de ano) e da rota; `npm test` e typecheck passam.

## Entregue

Rota `GET /api/faturamento/comparativos-funil-glosa?mes=YYYY-MM`; cálculo puro em `src/modules/faturamento/utils/funilGlosa.ts`; bloco na aba Comparativos (`FunilGlosaComparativo.tsx`).

Fontes: faturado e recebido vêm dos títulos (`notas`, operadoras consideradas na meta, emissão no mês). Acatada, em disputa e recuperada vêm da **foto de recursos** (`glosa_recurso_requisicoes`); a tabela `glosas` não é usada (virou histórico em `20261026120000`). O saldo do mês é `faturado − recebido − (acatada + em disputa − fora de lote)`: a glosa "Fora de lote" entra nos totais (para bater com Glosas e Recursos), mas não abate o saldo, porque o faturado dela não está no mês. O funil fecha como `Faturado = Recebido + Acatada + Em disputa − Fora de lote + Saldo`, e a tela mostra a linha "fora de lote" para conferir.

Correções da revisão de 12/11/2026: a glosa fora de lote deixou de abater o saldo (que podia ficar negativo); a leitura por competência passou a filtrar as operadoras da meta (`id_fonte_pagadora`); o lote com título emitido fora dos 3 meses deixou de cair em "Fora de lote"; e a emissão mais antiga do lote passou a considerar títulos de qualquer data.

### Mapeamento proposto de status do apLIS → Glosa recuperada (para a usuária revisar)

Constante revisável: `STATUS_APLIS_RECUPERADA` em `api/_lib/faturamento/glosaRecuperada.ts`.

| Status do apLIS (`CodEventoFatur`) | Classe no funil |
|---|---|
| 34 Glosa recebida, 17 Recurso pago | **Recuperada** (deferido total), valor = ΔRec (recebido atual − recebido na fixação) |
| 7 / 16 (1º e 2º recurso), 33 Em tratativas | **Recuperada** só do que já voltou (ΔRec > 0, em lote de recurso enviado); sem retorno, 7/16 é **Em disputa** |
| 6 Glosado sem recurso | **Em disputa** (valor = glosa fixada) |
| 18 Recebido a menor – acatado, 8 Glosa definitiva – acatada diretoria | **Acatada** (líquido − recebido) |
| 15 Recurso não acatado | fora do funil (indeferida) |

### Decisões a confirmar

- **"Fora de lote"**: a foto sempre tem lote de faturamento, então "sem lote" foi lido como *lote do apLIS que não tem título (não cancelado) no Supabase, em data nenhuma* (o mês vem da competência do lote) e como título sem lote. Se a intenção era "fora de lote de **recurso**" (a sub-aba de mesmo nome da tela Glosas e Recursos), é outra regra.
- Lote ligado a dois títulos: a glosa conta uma vez, no mês da emissão mais antiga (de qualquer data, mesmo fora dos 3 meses); o (total − recebido) dos títulos é dividido igualmente entre os lotes deles. Se o título mais antigo está fora dos 3 meses, a glosa não aparece e o saldo do título mais novo não a abate.
- Abertos da revisão, para a usuária decidir: recuperação parcial (7/16 com ΔRec < recursado) põe só o ΔRec em Recuperada e o resto cai no saldo, não em Em disputa; status 33 sem retorno não entra em Em disputa; e nada garante Recuperada ≤ Recebido (a foto do apLIS anda na frente das baixas do Supabase).
- Acatada/disputa/recuperada só aparecem para meses cujos lotes têm título ou competência dentro dos 3 meses.
