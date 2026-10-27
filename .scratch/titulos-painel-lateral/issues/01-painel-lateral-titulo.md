# 01 — Detalhes do título em painel lateral

**What to build:** trocar a linha expandida da tabela de Títulos por um painel
lateral aberto pelo olho, com cabeçalho de resumo e ações. Ver `../spec.md`.

**Status:** done

- [x] Olho na primeira coluna no lugar do chevron; linha não clicável; destaque da linha aberta
- [x] Painel lateral 640px (overlay, Esc, clique fora, scroll lock) com o conteúdo do expandido
- [x] Cabeçalho: NF, operadora, status, vencimento, valores, fechar, ações (podeEditar)
- [x] Modais de Editar/Baixa acima do painel; Esc em camadas
- [x] Painel fecha ao mudar filtro/página/busca ou quando o título sai da lista

**Notas da implementação:** `TituloPainelLateral.tsx` (montado com `key` do
título, estado de um título só), `TituloSelos.tsx` (Atraso, SeloAplis) e
`utils/tituloStatus.ts` (rótulos/cores) compartilhados com a lista.
`BaixaModal`/`EditarTituloModal` subiram para `z-[60]` e ganharam Esc (que
ignora o Esc já tratado por Select/DatePicker e não fecha durante o
salvamento); `ContasReceberPage` passa `camadaSobreposta` para o painel não
fechar junto. Conferido no app: olho → painel, guias do lote, Editar por cima,
1º Esc fecha o modal, 2º fecha o painel.
