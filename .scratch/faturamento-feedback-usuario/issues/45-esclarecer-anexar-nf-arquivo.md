Status: done
Type: research

# Esclarecer se é necessário anexar arquivo de NF (PDF), ou se número já basta

## Onde

`src/modules/faturamento/components/NovoTituloModal.tsx`,
`EditarTituloModal.tsx` (campo `numeroNota`, texto livre).

## Contexto

O levantamento de requisitos lista, entre as ações esperadas por linha na
tela de Títulos: "Anexar/selecionar NF". No desenho atual do flowlab, o
título **é** a representação da NF — o campo `numeroNota` é texto livre, não
existe upload de arquivo nem seleção de um documento de NF em nenhum lugar do
módulo (busca por "upload"/"anexo"/"storage" no módulo não retorna nada
relevante). Não há evidência em nenhuma outra parte do feedback (nem em
rodadas anteriores) de que o setor precise guardar o PDF da nota em si — o
fluxo hoje já resolve "vincular NF ao lote/título" via número.

Antes de abrir isso como feature (upload de arquivo, que traz storage,
permissões de acesso e tamanho — mesmo padrão já usado em
`request-attachments`), vale confirmar se é isso mesmo que falta, ou se o
item da transcrição só descreve o fluxo manual atual do setor (imprimir/
guardar a NF em outro lugar) sem implicar que o flowlab precise armazenar o
arquivo.

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), ação "Anexar/selecionar NF" na lista de Títulos/Lotes.

## Resolução (2026-09-03)

Respondido pelo usuário: não é upload de arquivo — "anexar NF" descreve
**adicionar o número da nota fiscal a um título já criado**, que hoje já
existe como feature. Achado ao investigar: essa capacidade já foi
implementada e commitada pela **issue 33** (`f05bbad`, ação "Editar Título"
em `EditarTituloModal.tsx` + `api/_lib/handlers/faturamento-titulo-atualizar-numero-nota.ts`),
cujo `Status` no arquivo estava desatualizado (`ready-for-agent`) e foi
corrigido para `done` nesta mesma sessão.

Fecha sem trabalho novo — "Anexar/selecionar NF" da transcrição já está
coberto pela issue 33. Upload de arquivo PDF segue sem evidência de
necessidade real; se o setor pedir isso especificamente no futuro, abrir
issue nova (o precedente de storage já existe no projeto, bucket
`request-attachments`, `docs/plans/CONFIGURAR_STORAGE_REQUESTS.md`).
