## Why

Na leitura do pedido médico do Gerador de Orçamento, exames que o laboratório não realiza foram trocados por outros, diferentes: "Lipo B" virou **LIPOPROTEÍNA - a** e "Células LE" virou **CARIÓTIPO COM BANDA G PARA 100 CÉLULAS**, ambos marcados para o carrinho. Isso pode levar a orçar e realizar o exame errado no paciente, além do impacto financeiro. A leitura precisa dizer que **não encontrou** o exame, nunca propor outro no lugar.

Há duas causas:
- **Busca por palavras no servidor:** quando a IA não aponta um item, o código pega o primeiro item da tabela cujo nome *contém* todas as palavras de 3 letras ou mais do nome lido. "B" e "LE" são descartados, sobram `lipo` e `celulas`, e qualquer item com essas palavras serve.
- **Prompt:** pede à IA o "correspondente mais próximo", o que a incentiva a escolher um exame diferente só por ser parecido.

## What Changes

- **BREAKING (comportamento):** sai a busca por palavras. Um exame lido só é reconhecido pelo `matched` que a IA aponta, se esse nome existir na tabela, ou por nome idêntico ao da tabela, ignorando acento e maiúsculas. Fora disso, é **não encontrado**.
- **Prompt mais rígido:** `matched` só quando for o mesmo exame (pelo nome, por uma sigla consagrada como TGO, TGP ou GGT, ou por um sinônimo inequívoco). Na dúvida, quando só parte do nome coincide ou quando é outro exame da mesma família, `matched` vem `null`.
- **Exames relacionados:** a resposta da IA ganha, para cada exame sem `matched`, o campo `relacionados` (nomes exatos da tabela) e o tipo de caso (`variante` ou `generico`). O servidor descarta os nomes que não existem na tabela.
- **Dois estados por exame:** *Reconhecido*, que vem marcado para o carrinho, ou *Não encontrado*. Não há nível de confiança nem estado intermediário.
- **Seção "Não encontrados na tabela (n)" no topo do modal:** tem ícone de aviso e o texto "Estes exames do pedido não foram identificados na tabela. Confira o pedido e busque manualmente antes de enviar o orçamento."
- **Aviso por exame não encontrado:** só texto, sem checkbox nem botão de adicionar. A frase sai de modelos fixos montados pelo código e usa o nome como está escrito no pedido. A lista de relacionados mostra 3 nomes e um "ver mais" revela o restante.
- **Testes de regressão:** cobrem os casos "Lipo B" e "Células LE". Os testes atuais que fixavam a busca por palavras são revistos.

## Capabilities

### New Capabilities
- `gerador-orcamento-leitura-pedido-medico`: leitura do pedido médico por IA no Gerador de Orçamento. Cobre quando um exame lido é reconhecido, quando é declarado não encontrado e o aviso informativo dos exames relacionados.

### Modified Capabilities
(nenhuma: o Gerador de Orçamento ainda não tem spec em `openspec/specs/`.)

## Impact

- **Servidor:**
  - `api/_lib/atendimento/promptPedidoMedico.ts`: novo texto e novo formato de resposta.
  - `api/_lib/atendimento/leituraPedidoMedico.ts`: sem a busca por palavras, com leitura e filtro de `relacionados` e do tipo.
  - `api/_lib/handlers/atendimento-gerador-orcamento-pedido-medico.ts`: devolve relacionados e tipo.
  - `leituraPedidoMedico.test.ts`.
- **Frontend:**
  - `src/modules/gerador-orcamento/domain/pedidoMedico.ts`: `semCorrespondencia` passa a carregar relacionados e tipo, e entram os modelos de frase.
  - `pedidoMedico.test.ts`.
  - `api.ts`: tipos da resposta.
  - `components/LeituraPedidoMedicoModal.tsx`: nova seção e avisos.
- **Contrato da API** `/api/atendimento/gerador-orcamento-pedido-medico`: cada exame ganha `relacionados` e `tipo`. Frontend e servidor são publicados juntos (mesmo deploy na Vercel).
- **Sem mudança** no banco, no bucket, em permissões ou no modelo Gemini.
- **Fora do escopo:**
  - nível de confiança ou estado "Confira";
  - adicionar um exame relacionado pelo aviso;
  - corrigir ou ampliar a tabela de exames;
  - registrar ou medir os não encontrados.
