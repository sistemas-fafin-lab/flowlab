# Ajustes em Laudos, Culturas e Temperatura (Análises Clínicas)

Spec resultante de sessão de grilling com o usuário em 2026-08-18. Cobre três
funcionalidades independentes dentro do módulo `src/modules/analises-clinicas/`.
Cada uma vira uma issue própria em `issues/`.

## Contexto geral

Módulo: Análises Clínicas (`src/modules/analises-clinicas/`). Três telas afetadas:

- `LaudosPage.tsx` — lista de laudos como cards.
- `CulturasPage.tsx` — cadastro/acompanhamento de culturas microbiológicas.
- `TemperaturaEquipamentosPage.tsx` — monitoramento de temperatura de equipamentos.

## 1. Laudos: aba separada para liberados

**Problema:** a lista de laudos mistura laudos "vivos" (aguardando ou parcialmente
liberados) com laudos já totalmente liberados, poluindo a tela com muitos cards.

**Decisão:** criar uma segunda aba "Liberados" na página, usando o padrão de abas
já existente no projeto (pill buttons + badge, ver `EnvioApoioPage.tsx`).

- Aba "Liberados" mostra **apenas** status `laudo_completo_liberado` (não inclui
  `laudo_parcial_liberado`, que continua na aba principal).
- Remove o corte automático de 30 dias hoje existente em `useLaudos.ts`
  (`cutoffLiberacaoIso` + query `.or(status.neq...,liberado_em.gte...)`). A aba
  "Liberados" mostra o histórico completo, sem limite de tempo.
- A aba principal (renomear para algo como "Em andamento") passa a excluir
  **todo** `laudo_completo_liberado`, e não só os com mais de 30 dias.

Detalhes técnicos e arquivos: ver `issues/01-laudos-aba-liberados.md`.

## 2. Culturas: restringir a 3 tipos (SWAB)

**Problema:** hoje qualquer exame do catálogo marcado `is_cultura = true` pode
virar uma cultura, incluindo urina e fezes — e o formulário ainda aceita texto
livre, então na prática qualquer coisa pode ser cadastrada.

**Decisão:** restringir o cadastro de nova cultura a exatamente 3 tipos:

1. Cultura Seletiva para Streptococcus Grupo B (`ac_exames.nome = 'CULTURA SELETIVA PARA STREPTOCOCCUS GRUPO B'`)
2. Cultura para Fungos + Antifungigrama (`'CULTURA PARA FUNGOS + ANTIFUNGIGRAMA'`)
3. Cultura + Antibiograma — a variante genérica, material `DIV`, **não** a de
   urina (`'CULTURA + ANTIBIOGRAMA'`, mnemônico `CT+ABD`)

Verificado no catálogo completo (529 exames): não há duplicatas ocultas para os
tipos 1 e 2 (as demais linhas que citam "Streptococcus"/"fungo" são PCR/painéis/
exames diretos, metodologia diferente de cultura — corretamente já fora). Para o
tipo 3 há ruído (duplicatas de urina + uma linha ambígua), mas ele já está
coberto pela lista de exclusão abaixo.

Os outros 5 exames hoje marcados `is_cultura = true` recebem `is_cultura = false`
(saem do fluxo de Culturas, mas **continuam existindo e solicitáveis** no
catálogo geral de exames — não são desativados):

- `COPROCULTURA`
- `COPROCULTURA-FEZES`
- `CULTURA BACTERIANA (EM DIVERSOS MATERIAIS BIOLÓGICOS)` — nota: pode ser
  duplicata/outro código de faturamento do tipo 3, ou um exame de cultura
  genuinamente distinto (cultura sem antibiograma embutido). De qualquer forma
  não é um dos 3 tipos nomeados, então sai do fluxo de Culturas de qualquer
  jeito. Vale confirmar com o responsável técnico do laboratório depois, sem
  bloquear esta implementação.
- `CULTURA, URINA COM CONTAGEM DE COLÔNIAS` (mesmo TUSS de `UROCULTURA COM ANTIBIOGRAMA`, provável duplicata de nomenclatura)
- `UROCULTURA COM ANTIBIOGRAMA`

**Histórico:** culturas já registradas desses 5 tipos continuam intactas —
`ac_culturas.exame_nome` é snapshot, não é recalculado quando `is_cultura` muda.

**Formulário:** remove a opção de "tipo livre" (texto digitado fora do
catálogo) do `NovaCulturaModal` — vira seleção fechada entre os 3 tipos
permitidos.

Detalhes técnicos e arquivos: ver `issues/02-culturas-restringir-swab.md`.

## 3. Temperatura: catálogo de frascos por leitura

**Problema:** o usuário quer contar quantos frascos de urina/fezes (e
potencialmente outros tipos, no futuro) vão em cada remessa transportada por um
equipamento monitorado — hoje não existe nada parecido no sistema. "Cooler" era
só o apelido informal do usuário para essa ideia, não uma entidade nova: o
sistema já não tem conceito de cooler, só "equipamentos" monitorados
(geladeira, freezer, estufa, incubadora, banho-maria, ambiente, outro).

**Decisão:**

- Frascos não é um novo tipo de equipamento — é um campo adicional no
  formulário de **leitura** de temperatura (`LeituraModal`), disponível para
  **qualquer** tipo de equipamento.
- Preenchido a cada leitura (não é configuração fixa do equipamento), porque a
  quantidade varia por remessa.
- **Opcional** — pode ficar vazio quando não se aplica (ex: geladeira de
  estoque fixo que não transporta nada).
- Tipos de frasco vêm de um **catálogo gerenciável**, com tela de administração
  simples dentro da própria página de Temperatura (mesma permissão de hoje,
  `canManageColetas`, que já libera cadastrar equipamento).
- Seed inicial do catálogo: **Urina** e **Fezes** apenas. Outros tipos são
  adicionados depois pela tela, sem depender de nova implementação.
- Modelagem: tabela relacional filha (`tipo_frasco_id` + `quantidade`),
  seguindo o padrão já usado no projeto (ex: `ac_coleta_insumos`), em vez de um
  JSON solto — mantém consistência com o catálogo e facilita relatórios/
  agregações futuras.

Detalhes técnicos e arquivos: ver `issues/03-temperatura-frascos-catalogo.md`.

## Fora de escopo (não pedido, não implementar)

- Qualquer mudança na aba "parcial liberado" de laudos.
- Reativar/desativar exames de urina/fezes no catálogo geral (eles continuam
  ativos e solicitáveis, só saem do fluxo de Culturas).
- Vincular cultura a cooler/equipamento/frasco — são módulos independentes,
  sem relação entre si.
- Configuração de frascos fixa por equipamento (decidido: só por leitura).
