# Contas a Receber: glosas do apLIS substituem as digitadas, e glosa total sem retorno

Status: ready-for-human (migration gerada, aguardando aplicar em produção)

## Problema (relato de 22/10/2026)

Lote 5774 (FuSEx), título de R$ 750,16, aparecia com R$ 1.500,32 glosados. No
apLIS as 6 requisições do lote estão em glosa total (`CodEventoFatur` 27), mas:

- só 2 têm retorno (recebido 0 + motivo 1319/1831, R$ 44,06 cada); as outras 4
  estão com `ValorRecebido` nulo e sem motivo. O "Aplicar baixas e glosas do
  apLIS" ignorava recebido nulo, então só lançou R$ 88,12;
- o restante foi digitado à mão pelo "Lançar glosa" (R$ 750,16 e, ao que tudo
  indica, R$ 662,04), sem teto — glosado em dobro;
- título com glosa digitada era pulado pelo "Aplicar" ("título já tem glosa
  lançada"), então não havia como acertar pelo apLIS.

## Decisões (22/10/2026)

1. Glosa digitada à mão é **substituída** pelas do apLIS.
2. Glosa total sem motivo entra como **aberta** (por enquanto).

## Regra

- `diferencasDosLotes` (bdLab.ts): procedimento com `ValorRecebido` nulo entra
  quando a requisição está em 27; a diferença é o líquido inteiro. Medido em
  22/10: 66 procedimentos em 9 lotes, R$ 7.115,53.
- `glosasSugeridas` (glosasAplis.ts): diferença sem motivo em requisição 27 →
  motivo "Glosa total (apLIS)", sem código, status aberta (em recurso continua
  em recurso). Glosas digitadas (origem nula, não revertidas) vão em
  `substituir` quando:
  - o apLIS tem glosa com motivo para o título;
  - nenhuma diferença do título está sem motivo (senão `glosa-manual`: pode
    ser pagamento atrasado, e a digitada pode estar cobrindo isso);
  - a soma a lançar difere da soma das digitadas (se bate, fica como está);
  - o teto vale com o saldo somado das digitadas que saem.
- Prévia: `glosasSubstituidas` por título; o título entra mesmo com saldo
  fechado ou negativo quando há digitada a substituir.
- `fat_lancar_glosas_aplis` (migration `20261022130000_…_substituir.sql`):
  aceita `substituir: [id_glosa]`; exclui (auditoria 'exclusao', motivo
  "Substituída pela glosa do apLIS") e lança na mesma transação; `glosas` pode
  vir vazio quando só há digitadas a tirar.
- Modal: as digitadas aparecem riscadas sob "substitui as digitadas"; o
  rodapé soma quanto sai.

Glosa digitada junto de uma baixa (com `recebimento_id`) também é
substituída; a exclusão fica auditada como as outras.

## Fora do escopo

- Atualizar status ou reduzir glosa do apLIS já lançada quando o apLIS muda.

## Para o lote 5774

Depois de aplicar a migration e publicar o front: "Aplicar baixas e glosas do
apLIS" deve mostrar o título com +R$ 662,04 ("Glosa total (apLIS)", aberta) e
as duas digitadas (750,16 e 662,04) riscadas. Glosado final: R$ 750,16.
