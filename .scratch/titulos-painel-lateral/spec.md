# Contas a Receber: detalhes do título em painel lateral

Status: done

## Problem Statement

Na aba Títulos, os detalhes de cada título (observações, baixas, glosas do
apLIS, correções, lotes e guias) abrem numa linha expandida embaixo da linha
clicada. Com títulos de muitos lotes a tabela "pula" e o usuário perde a
referência das colunas. Em Glosas & Recursos → "Glosas recentes" os detalhes
abrem num painel lateral pelo ícone de olho, e o setor quer o mesmo padrão nos
títulos.

## Decisões (grilling de 26/10/2026)

1. O olho substitui o chevron na primeira coluna e é o **único** gatilho; a
   linha deixa de ser clicável. Linha aberta fica destacada em azul (como em
   `GlosasRecentesLista`).
2. O painel mostra **todo** o conteúdo do expandido atual, na mesma ordem:
   observações, baixas registradas, glosas do apLIS, alterações (correções),
   lotes — com as guias abrindo dentro de cada lote e o "Desvincular lote" com
   a confirmação inline.
3. Cabeçalho do painel com o resumo do título: NF, operadora, status,
   vencimento, valores (total, recebido, glosado, saldo) e botão fechar.
4. Editar, Registrar baixa e Cancelar também no cabeçalho do painel (gate
   `podeEditar`), sem sair da linha.
5. Painel fixo à direita, **640px**, mesmo visual do de glosas (bordas
   arredondadas, overlay com blur, Esc/clique fora fecha, página atrás não rola).
6. Sem navegação anterior/próximo entre títulos nesta versão.
7. Editar/Baixa abrem **por cima** do painel; o painel continua aberto e reflete
   o resultado ao salvar.
8. Cancelar pelo painel: o painel continua aberto mostrando "Cancelada", com as
   ações desabilitadas.
9. Esc fecha uma camada por vez: com modal de Editar/Baixa aberto, Esc não
   fecha o painel.
10. O painel fecha quando muda filtro, página ou busca, ou quando o título sai
    da lista após um refetch.

## Implementação

- Conteúdo do expandido sai de `TitulosList.tsx` para um componente do painel.
- `BaixaModal` e `EditarTituloModal` (hoje `z-50`, igual ao painel) sobem de
  camada para ficar acima do painel.
