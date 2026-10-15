# Faturamento: aplicar as glosas do apLIS nos títulos

Status: ready-for-agent

Continuação de `.scratch/faturamento-baixas-automaticas-aplis` — revê a decisão
2 daquela spec ("Glosa continua manual").

## Problem Statement

O "Aplicar baixas do apLIS" lança o dinheiro recebido, mas a glosa continua
sendo digitada à mão a partir do demonstrativo do convênio. O apLIS já tem essa
glosa: quando o operador importa o demonstrativo XML lá, o apLIS grava, por
procedimento, o valor recebido e o motivo/código da glosa. O operador digita a
mesma coisa duas vezes, e enquanto não digita o título fica com saldo aberto.

Levantamento de 14/10/2026: 60 títulos com o recebido batendo com o apLIS e
saldo em aberto (R$ 66.275), 55 deles com glosa com motivo no apLIS e só 4 com
alguma glosa lançada no sistema. Esses títulos nem aparecem na prévia de hoje,
que só olha a divergência do recebido.

## Solution

O modal vira **"Aplicar baixas e glosas do apLIS"**. A prévia passa a mostrar,
por título, além das baixas, as glosas a lançar — calculadas do apLIS, uma por
lote + código + status, com o status que o apLIS indica (aberta, em recurso ou
definitiva). Entram também os títulos cuja baixa já bate e só falta a glosa. O
operador marca baixas e glosas separadamente por título e confirma; o sistema
lança as baixas e, se todas entraram, as glosas do título numa RPC nova.

## Decisões (14/10/2026)

1. **Junto das baixas**, no mesmo modal, com prévia e confirmação. Sem cron.
2. **Objetivo: fechar o saldo.** Não é preciso o detalhe por procedimento.
3. **Fonte:** o procedimento do apLIS (`ValorLiquido − ValorRecebido`, motivo
   em `IdMotivoGlosa`), conferido com o demonstrativo importado só como
   informação.
4. **Status** pela situação da requisição no apLIS (`CodEventoFatur`),
   conferida com o recurso:
   - `em_recurso`: procedimento num lote de recurso (`fatloterecursoprocedimento`)
     ou requisição em 7 / 16 (recurso de glosa 1º / 2º);
   - `definitiva`: requisição em 18 (recebido a menor — acatado), 27 (glosa
     total), 23 (glosa mantida), 8 (glosa definitiva) ou 15 (recurso não
     acatado), e o procedimento continua recebido a menor;
   - `aberta`: o resto (inclusive 6, "glosado ainda sem recurso").
   Levantamento de 2026: a situação é marcada à mão e nem sempre está em dia
   (das 214 requisições em 7, só 45 têm lote de recurso), por isso o recurso
   real conta e o valor recebido é sempre conferido.
5. **Uma glosa por lote + código + status**, com o valor somado. Sempre avulsa
   (sem `recebimento_id`), com ou sem baixa nova.
6. **Títulos na prévia:** também os que têm a baixa batendo e glosa a lançar.
7. **Sem duplicar:** a sugestão é a diferença, por título + lote + código, entre
   a glosa do apLIS e as glosas já lançadas com origem no apLIS (fora as
   `revertida`).
8. **Motivo e código:** do catálogo `fatmotivoglosa` (código TISS +
   descrição); com o catálogo vazio e um código em `DesMotivoGlosa` (ex.
   "3292"), esse código, com o motivo "Código 3292 (do apLIS)".
9. **Glosa total sem data** (recebido 0, sem `DtaRecebido`, com motivo) entra.
10. **Demonstrativo:** selo informativo "confere" / "difere do demonstrativo"
    por glosa sugerida; não bloqueia nem desmarca.
11. **Glosa não lançada (pulada), com o motivo na prévia** — a baixa do título
    segue quando couber:
    - diferença sem motivo no apLIS;
    - título com glosa lançada à mão (sem origem apLIS);
    - glosa que não cabe no saldo depois das baixas da prévia (tolerância
      R$ 1,00);
    - ~~título sem número da nota;~~ (revisto em 15/10/2026: entra como
      qualquer outro — título sem número é exceção, mas aceito; a trava saiu
      também do `fat_registrar_baixa`);
    - títulos `sistema-maior` e `lote-ausente`.
12. **Execução:** em sequência, título a título; as glosas do título só entram
    se todas as baixas dele entraram.
13. **Marcação:** dois checkboxes por título (baixas e glosas); o rodapé soma
    os dois separados.
14. **Gravação:** RPC nova, numa transação por título, com `origem = 'aplis'`.

## User Stories

1. Como operador do faturamento, quero lançar as glosas do apLIS junto com as baixas, para não digitar de novo o que já está no demonstrativo importado lá.
2. Como operador, quero ver na prévia, por título, as glosas a lançar com lote, código, motivo, status e valor, para conferir antes de confirmar.
3. Como operador, quero ver na prévia os títulos cuja baixa já está lançada e só falta a glosa, para fechar o saldo deles também.
4. Como operador, quero marcar e desmarcar as baixas e as glosas de cada título separadamente, para lançar o dinheiro hoje e conferir a glosa depois (ou o contrário).
5. Como operador, quero marcar e desmarcar todas as baixas ou todas as glosas de uma vez, para não clicar título a título.
6. Como operador, quero ver no rodapé o total a lançar em baixas e o total a lançar em glosas, separados, para saber o efeito antes de confirmar.
7. Como operador, quero que cada glosa venha com o status que o apLIS indica (aberta, em recurso ou definitiva), para não ter de reclassificar uma por uma.
8. Como operador, quero que a glosa já decidida no apLIS entre como definitiva, para o título liquidar sem retrabalho.
9. Como operador, quero que a glosa em recurso entre como "em recurso", para o título não aparecer como liquidado enquanto o recurso não foi julgado.
10. Como operador, quero que a glosa ainda sem recurso entre como aberta, para acompanhá-la em Glosas & Recursos.
11. Como operador, quero uma glosa por lote e motivo (e status), com o número de procedimentos, para o título mostrar por que e onde foi glosado sem virar centenas de linhas.
12. Como operador, quero ver se a glosa sugerida confere com o demonstrativo importado, para ter mais confiança ao confirmar.
13. Como operador, quero que uma glosa diferente do demonstrativo ainda venha marcada, porque o demonstrativo chega atrasado e às vezes falta.
14. Como operador, quero que a glosa com código digitado em texto livre no apLIS seja aproveitada com esse código, para não perder glosa real por falha de cadastro.
15. Como operador, quero que a glosa total sem data de recebimento entre, quando tem motivo, para fechar os títulos com procedimento glosado por inteiro.
16. Como operador, quero que a diferença sem motivo no apLIS fique de fora e apareça como pulada, para não glosar o que pode ser só pagamento atrasado.
17. Como operador, quero que o título com glosa lançada à mão tenha a glosa pulada com aviso, para eu conferir em vez de o sistema adivinhar.
18. Como operador, quero que a glosa que passaria do saldo do título seja pulada com aviso, para a inconsistência do apLIS não virar saldo negativo.
19. ~~Como operador, quero que título sem número da nota tenha a glosa pulada, pela mesma regra da baixa.~~ (revisto em 15/10/2026: entra como qualquer outro.)
20. Como operador, quero que títulos com recebido a mais no sistema ou com lote ausente no apLIS não recebam glosa, para não mascarar um lançamento errado.
21. Como operador, quero que reabrir a prévia depois de lançar não sugira de novo a mesma glosa, para não glosar em dobro.
22. Como operador, quero que, se o apLIS aumentar a glosa de um lote depois que lancei, a prévia sugira só a diferença.
23. Como operador, quero que as glosas de um título só entrem se todas as baixas dele entraram, para a conta do saldo valer.
24. Como operador, quero ver o resultado por título (baixas lançadas, glosas lançadas, "baixa falhou, glosas não lançadas", erro com a mensagem), para saber o que acertar.
25. Como operador, quero que um erro num título não pare os outros.
26. Como operador, quero que as glosas de um título entrem todas ou nenhuma, para não ficar com o título pela metade.
27. Como operador, quero que, ao fechar o modal depois de lançar, a lista de títulos e a conferência (selos) sejam relidas.
28. Como gestor do faturamento, quero saber quem confirmou cada glosa lançada do apLIS, para auditoria.
29. Como gestor, quero distinguir as glosas que vieram do apLIS das digitadas à mão, para entender a origem do glosado.
30. Como usuário sem permissão de editar o faturamento, não quero ver o botão nem conseguir lançar glosas pela RPC.
31. Como operador, quero o aviso "dados do apLIS até ontem", para entender por que a glosa de um demonstrativo importado hoje não aparece.
32. Como operador, quero que a falha na leitura do apLIS apareça como erro, e não como "nada a lançar".
33. Como operador, quero que o botão diga "Aplicar baixas e glosas do apLIS", para saber que a glosa também entra.

## Implementation Decisions

- **Leitura do apLIS (MySQL de faturamento):** nova consulta de procedimentos
  dos lotes, em blocos de 1.000 lotes como as demais: por procedimento, o
  lote, a requisição, `ValorLiquido`, `ValorRecebido`, `IdMotivoGlosa` →
  código e descrição do catálogo, `DesMotivoGlosa`, `CodEventoFatur` da
  requisição e se está em `fatloterecursoprocedimento`. Glosa do demonstrativo
  por (requisição, código do procedimento), usando o demonstrativo mais recente
  (há reimportações duplicadas). Pode reaproveitar o que já resolve código de
  glosa nas telas de glosa legado.
- **Utilitário puro `glosasSugeridas`** (ao lado do das baixas). Entrada por
  título: os procedimentos dos lotes, as glosas já lançadas no sistema (com
  origem, lote, código e status), o saldo depois das baixas sugeridas, o tipo
  da conferência e se tem número. Saída: lista de glosas `{ idLote (aplis_id),
  codigo, motivo, status, valor, procedimentos, demonstrativo: 'confere' |
  'difere' | null }` e, quando não há glosa, `puladoGlosa` com o motivo
  (`sem-motivo`, `glosa-manual`, `passa-do-saldo`, `tipo`; o `sem-nota` saiu em 15/10/2026). Regra:
  diferença por procedimento ≥ R$ 0,01 com motivo; agrupa por lote + código +
  status; desconta, por lote + código, as glosas de origem apLIS não revertidas;
  descarta grupos < R$ 0,01.
- **Rota da prévia** (`titulos-baixas-aplis-previa`, `canManageBilling`): passa
  a incluir os títulos sem divergência de recebido mas com glosa a lançar; cada
  título ganha `glosas` e `puladoGlosa`. `pulado` (da baixa) continua. Falha da
  réplica → 502.
- **Schema:** coluna `glosas.origem` (texto, nulo = digitada; `'aplis'`).
  Glosas do apLIS gravam `lote_id` (uuid do lote no sistema) e `codigo_glosa`.
- **RPC `fat_lancar_glosas_aplis(p)`** (SECURITY DEFINER, exige
  `canManageBilling`): `p = { notaId, glosas: [{ loteId, codigo, motivo,
  status, valor }] }`. Numa transação: título não cancelado e com número; cada
  lote vinculado ao título; motivo obrigatório; status em
  aberta/em_recurso/definitiva; soma das glosas do título ≤ valor total; grava
  `origem = 'aplis'`, `recebimento_id` nulo, `responsavel`/autor = quem
  chamou; recalcula o título pelo gatilho existente. Erro em qualquer glosa
  desfaz as do título.
- **Frontend:** o modal "Aplicar baixas do apLIS" vira "Aplicar baixas e
  glosas do apLIS" (botão também). Por título: checkbox de baixas e de glosas
  (cada um só quando há o que lançar), glosas listadas com lote, código,
  motivo, status, valor e selo do demonstrativo; pulados de baixa e de glosa à
  parte. Seleção inicial: todas as baixas e glosas aplicáveis, menos as baixas
  de títulos com lote em outro título (regra atual). Execução em sequência:
  baixas do título (como hoje), depois as glosas numa chamada da RPC, só se
  todas as baixas marcadas entraram.
- Permissão: a mesma do modal de hoje (`canManageBilling`).

## Testing Decisions

- Bons testes olham só o comportamento externo: dado o apLIS e o sistema, que
  glosas são sugeridas (ou por que não); dada a prévia e a seleção, o total e o
  resumo. Nada de detalhes internos de agrupamento.
- **Utilitário `glosasSugeridas`** (vitest, seam principal; prior art: o teste
  da regra das baixas sugeridas): agrupamento por lote + código + status;
  status por situação (6 → aberta, 7/16 → em recurso, 18/27/23/8/15 →
  definitiva, procedimento em lote de recurso → em recurso mesmo em 6,
  situação definitiva mas procedimento já pago → sem glosa); código em texto
  livre; glosa total sem data; diferença sem motivo pulada; glosa manual
  pulada; passa do saldo (com e sem tolerância); desconto de glosa apLIS já
  lançada e revertida que não desconta; sem nota e tipos fora; demonstrativo
  confere / difere / ausente.
- **Handler da prévia** (vitest; prior art: o teste atual do handler): título
  só com glosa entra; `sistema-maior`/`lote-ausente` e sem nota com
  `puladoGlosa`; 401/403; 502 na réplica.
- **Utilitário do frontend** (vitest; prior art: o teste atual de aplicar
  baixas): seleção inicial com dois checkboxes; total separado de baixas e
  glosas; resumo com "baixa falhou, glosas não lançadas".
- **RPC:** sem teste automatizado de SQL no repositório. A issue traz um
  roteiro manual em SQL: lote de outro título recusado, soma acima do valor
  total recusada, status inválido recusado, transação desfeita no erro,
  `origem` gravada, usuário sem permissão recusado.

## Out of Scope

- Atualizar o status de glosas já lançadas quando o apLIS mudar (6 → 18,
  recurso pago → revertida).
- Glosa por procedimento ou por requisição.
- Reconstruir a data original de uma baixa que o pagamento do recurso
  sobrescreveu no apLIS (limitação conhecida, abaixo).
- Lançar sozinho (cron) e escrever qualquer coisa no apLIS.

## Further Notes

- **Limitação conhecida (afeta também as baixas):** quando o recurso é pago, o
  apLIS sobrescreve `ValorRecebido` e `DtaRecebido` do procedimento (730 de
  1.230 procedimentos em recurso em 2026). A data do pagamento original se
  perde; a prévia das baixas pode atribuir parte do principal à data do
  recurso. O total segue certo.
- No apLIS a glosa não é digitada: vem da importação do demonstrativo, que
  preenche recebido, motivo e data por procedimento. A tela de Baixa só muda a
  situação da requisição.
- 2.717 procedimentos de 2026 têm motivo mas foram pagos por inteiro: a regra
  só olha diferença > 0, não o motivo sozinho.
- Glosa só `definitiva` liquida o título (`fat_recalcular_nota`); `aberta` e
  `em_recurso` zeram o saldo mas deixam "parcialmente recebida".
