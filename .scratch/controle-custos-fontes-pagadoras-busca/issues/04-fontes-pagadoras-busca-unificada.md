# 04 — Fontes Pagadoras: busca unificada exame + fonte pagadora

**What to build:** o campo de busca da aba "Fontes Pagadoras" passa a
aceitar tanto nome/TUSS de exame quanto nome de fonte pagadora, mostrando
o resultado certo pra cada tipo escolhido.

Contexto: resultado de sessão de grilling com o usuário em 2026-09-08,
continuação do ticket 02. Usa as funções do ticket 03.

- O input de busca (mesmo campo único, sem campo novo) filtra em tempo
  real usando a função de busca unificada do ticket 03.
- Enquanto digita, se houver mais de um resultado no total (exames +
  fontes pagadoras somados), aparece um dropdown de sugestões agrupado em
  duas seções com cabeçalho: "Exames" e "Fontes Pagadoras". Cada linha de
  exame mostra nome + TUSS (como hoje); cada linha de fonte pagadora
  mostra só o nome (já deduplicado pelo ticket 03).
- ~~Se houver exatamente um resultado no total (seja exame ou fonte
  pagadora), seleciona automaticamente, sem precisar clicar — mesmo
  comportamento que já existe hoje pra exame, estendido pros dois tipos.~~
  Revertido em 2026-09-08 (ver comentário): passou a exigir clique mesmo
  com um único resultado.
- Se não houver nenhum resultado, mantém a mensagem "nenhum exame
  encontrado" (ajustar o texto pra cobrir os dois tipos, ex.: "nenhum
  resultado encontrado").
- Ao selecionar (por clique ou auto-seleção), o campo de busca vira um
  chip mostrando o tipo do que foi selecionado (ex.: ícone ou label
  "Exame:" / "Fonte Pagadora:") + o nome, com "x" pra limpar e voltar ao
  estado de busca — mesma interação de hoje, com o indicador de tipo a
  mais.
- Selecionando um **exame**: mostra a tabela que já existe hoje — `Fonte
  Pagadora | Tabela Associada | Valor Cobrado`, ordenada por valor
  crescente.
- Selecionando uma **fonte pagadora**: mostra uma tabela nova — `Exame |
  TUSS | Tabela Associada | Valor Cobrado`, usando a função de exames por
  fonte pagadora do ticket 03, ordenada por valor crescente.
- Mensagem de convite antes de digitar continua igual.

**Blocked by:** 03 — depende das funções de busca unificada e exames por
fonte pagadora.

**Status:** done

- [x] Buscar por nome de fonte pagadora traz resultados, além de buscar
      por nome/TUSS de exame como já funciona hoje
- [x] Dropdown com mais de um resultado agrupa em duas seções com
      cabeçalho: "Exames" e "Fontes Pagadoras"
- [x] ~~Total de exatamente 1 resultado (somando os dois tipos) autosseleciona
      sem exigir clique~~ — revertido em 2026-09-08, ver comentário
- [x] Nenhum resultado mostra mensagem apropriada
- [x] Chip pós-seleção indica visualmente o tipo (exame ou fonte
      pagadora) além do nome, com "x" funcional pra limpar
- [x] Selecionar um exame mostra a tabela `Fonte Pagadora | Tabela
      Associada | Valor Cobrado`, igual ao comportamento atual
- [x] Selecionar uma fonte pagadora mostra a tabela nova `Exame | TUSS |
      Tabela Associada | Valor Cobrado`, ordenada por valor crescente
- [x] A aba "Análise de Rentabilidade" e o cadastro de exames continuam
      funcionando sem nenhuma mudança de comportamento

## Comments

**2026-09-08** — Usuário pediu remoção da auto-seleção quando há exatamente
1 resultado (ex.: digitar "assefaz" selecionava a fonte pagadora sozinho,
sem clique). Comportamento removido: `mostrarDropdown` agora exibe o
dropdown a partir de 1 resultado (`totalMatches >= 1`, antes `> 1`), e a
seleção passou a depender só de `selecao` (estado explícito via clique),
sem fallback automático. Ver `src/components/CostControl/PayorsScreen.tsx`.
