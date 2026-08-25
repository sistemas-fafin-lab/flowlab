Status: resolved
Type: task

# Registro de Câncer: `Registrador` foi modelado como parâmetro fixo institucional; no design original é input por exportação

## Onde

`cancer.registrador` em `qa_parametros` (editável em
`CampoParametroFixo.tsx`/`CasoDrawer.tsx`, igual aos outros 15 campos
fixos) e `ExportacaoRhcCard.tsx`/`GerarExportacaoInput.registrador`
(exigido explicitamente como campo do formulário no momento de gerar a
exportação, `qualidade-gerar-exportacao-cancer.ts:118-124`).

## Causa raiz

O projeto irmão `Flowlab_Controle_Qualidade` modelou `Registrador` (coluna
29 do layout RHC) como algo estruturalmente diferente dos outros 15 campos
fixos — documentado explicitamente em
`openspec/changes/etapa-6-cancer/specs/cancer-exportacao/spec.md` (linhas
31-32): "`Registrador` é informado no momento da exportação, não fixo...
não lido de `app_parametros`". Motivo (design.md linha 45): é quem
preencheu aquela exportação específica, não uma constante da instituição —
pode mudar a cada lote/trimestre, diferente de CNES ou Cor.

Aqui no flowlab, `types.ts` (comentário citado no relatório de comparação)
reconhece a mudança de propósito: `registrador` foi colocado no mesmo balde
dos 15 campos fixos ("mesmo valor para todos os casos até alguém trocar,
como os demais campos fixos"). Na prática hoje isso não quebra nada — o
handler de exportação ainda exige `registrador` explícito no payload da
requisição, então o valor de `qa_parametros` nunca é a fonte de verdade no
CSV final — mas cria duas superfícies de edição pro mesmo conceito (o
drawer de qualquer caso, e o formulário de exportação), o que pode confundir
quem usa: editar pelo drawer parece que "fixa" o registrador de todas as
exportações futuras, mas não fixa nada, porque a exportação sempre pede de
novo.

## Correção proposta (pendente de decisão de produto)

Duas opções, não fiz a escolha por conta própria:

1. Adotar o modelo do colega: remover `registrador` de
   `CHAVES_PARAMETRO_FIXO_CANCER`/do drawer, deixando-o só como campo do
   formulário de exportação (`ExportacaoRhcCard.tsx`) — mais simples,
   elimina a superfície de edição redundante.
2. Manter como está, mas deixar explícito na UI (rótulo/tooltip) que o
   valor do drawer é só um **valor padrão sugerido** pro formulário de
   exportação, não o valor final gravado — se for isso que o usuário
   realmente quer (ex.: sempre a mesma pessoa registra, então vale ter um
   default pra não digitar toda vez).

## Comments

Não é bug (nada quebra hoje), é desvio de design que vale confirmar com o
usuário antes de mexer — daí `needs-triage` em vez de `ready-for-agent`.

## Answer

Usuário confirmou a opção 1: adotar o modelo do projeto irmão. Implementado:

- `registrador` removido de `CHAVES_PARAMETRO_FIXO_CANCER` e de
  `ParametrosFixosCancerDTO` (`types.ts`), de `ROTULOS_PARAMETRO_FIXO`/
  `ORDEM_PARAMETRO_FIXO`/`valorDoParametroFixo` (`CampoParametroFixo.tsx`) —
  some do drawer de qualquer caso automaticamente (`CasoDrawer.tsx` itera
  `ORDEM_PARAMETRO_FIXO` genericamente, sem mudança direta).
- `registrador` removido de `ParametrosFixosCancer`/
  `carregarParametrosFixosCancer` (`cancerConsulta.ts`, server) e de
  `buscarParametrosFixosCancer` (`cancer.ts`, client) — para de ser
  lido/gravado em `qa_parametros`.
- `ExportacaoRhcCard` perde a prop `registradorPadrao` (não há mais fonte de
  valor padrão); campo do formulário passa a iniciar vazio, preenchido a
  cada exportação como já era o comportamento real.
- Migration `20260825160000_qualidade_cancer_remove_parametro_registrador.sql`
  remove a linha órfã `cancer.registrador` de `qa_parametros`.
- `cancerRegras.ts`/testes atualizados: `ParametrosFixosCancer` deixa de ser
  superset de `ColunasFixasExportacaoCancer` (ambas com as mesmas 15 chaves),
  removido o teste que cobria o campo extra.

`npx tsc --noEmit` limpo no módulo, suíte de testes completa (185 testes)
passando, `/code-review` sem findings.
