Status: needs-info
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

## Pergunta para o setor

Além do número da nota (já registrado), é necessário anexar o arquivo (PDF)
da NF dentro do flowlab? Se sim, para quê especificamente (conferência,
envio ao convênio, auditoria)?

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), ação "Anexar/selecionar NF" na lista de Títulos/Lotes.
