## ADDED Requirements

### Requirement: Reconhecimento só do mesmo exame
Cada exame lido no pedido SHALL ser classificado em exatamente um destes estados: **Reconhecido**, quando está ligado a um item da tabela de preços, ou **Não encontrado**. Para ser Reconhecido, uma de duas condições MUST valer: o `matched` devolvido pela IA é igual ao nome de um item da tabela, ou o nome lido no pedido é igual ao nome de um item da tabela. Nas duas comparações, acento, maiúsculas e espaços nas pontas são ignorados. O sistema MUST NOT ligar um exame a um item por coincidência parcial de palavras, por semelhança de nome ou por qualquer outra aproximação.

#### Scenario: Matched apontado pela IA existe na tabela
- **WHEN** a IA devolve `{ name: "TGO", matched: "TGO - TRANSAMINASE OXALACETICA" }` e esse item existe na tabela
- **THEN** "TGO" é Reconhecido e ligado a esse item

#### Scenario: Matched com acento e caixa diferentes
- **WHEN** a IA devolve `matched: "GLICEMIA DE JEJUM "` e a tabela tem "Glicemia de Jejum"
- **THEN** o exame é Reconhecido e ligado a "Glicemia de Jejum"

#### Scenario: Nome lido idêntico ao da tabela, sem matched
- **WHEN** a IA devolve `{ name: "Hemograma Completo", matched: null }` e a tabela tem "HEMOGRAMA COMPLETO"
- **THEN** o exame é Reconhecido e ligado a "HEMOGRAMA COMPLETO"

#### Scenario: Coincidência parcial de palavras não reconhece (Lipo B)
- **WHEN** a IA devolve `{ name: "Lipo B", matched: null }` e a tabela tem "LIPOPROTEÍNA - a" mas nenhum item chamado "Lipo B"
- **THEN** "Lipo B" é Não encontrado

#### Scenario: Coincidência parcial de palavras não reconhece (Células LE)
- **WHEN** a IA devolve `{ name: "Células LE", matched: null }` e a tabela tem "CARIÓTIPO COM BANDA G PARA 100 CÉLULAS" mas nenhum item chamado "Células LE"
- **THEN** "Células LE" é Não encontrado

#### Scenario: Matched inexistente na tabela
- **WHEN** a IA devolve `matched: "HEMOGRAMA COM PLAQUETAS"`, esse nome não existe na tabela e o nome lido também não é igual a nenhum item
- **THEN** o exame é Não encontrado

#### Scenario: Exame devolvido só como texto
- **WHEN** a resposta traz o exame como texto simples (`"glicemia jejum"`), sem objeto
- **THEN** ele só é Reconhecido se o texto for igual ao nome de um item da tabela; caso contrário, é Não encontrado

### Requirement: Instrução à IA contra aproximação
O prompt enviado à IA SHALL instruir que `matched` seja preenchido somente quando o exame lido for o mesmo exame do item da tabela, pelo nome, por uma sigla consagrada (ex.: TGO, TGP, GGT, TSH) ou por um sinônimo inequívoco. Nos outros casos, `matched` MUST vir `null`: dúvida, coincidência de apenas parte do nome, ou outro exame da mesma família. O prompt MUST NOT pedir o "correspondente mais próximo". Exame com material diferente (soro, urina, saliva) ou outro analito MUST ser tratado como outro exame. Uma linha do pedido com mais de um exame MUST ser devolvida como um exame por item.

#### Scenario: Texto do prompt
- **WHEN** o prompt é montado com a lista de exames da tabela
- **THEN** ele contém a regra de `matched` só para o mesmo exame e a proibição de escolher exame diferente por proximidade, e não contém o pedido de "correspondente mais próximo"

#### Scenario: Linha com mais de um exame
- **WHEN** o pedido traz "FSH e LH" numa linha só
- **THEN** a IA é instruída a devolver "FSH" e "LH" como exames separados

#### Scenario: Material ou analito diferente
- **WHEN** o pedido traz "Relação albumina/creatinina" e a tabela só tem "Relação Proteína/Creatinina Urinária"
- **THEN** a IA é instruída a devolver `matched: null`, com o item da tabela em `relacionados`

### Requirement: Exames relacionados aos não encontrados
Para cada exame sem `matched`, a resposta da IA SHALL poder trazer `relacionados`, uma lista de nomes da tabela do mesmo tipo ou da mesma família, e `tipo`. O `tipo` é `variante` quando o pedido especifica uma variante que o laboratório não realiza e `generico` quando o pedido não especifica qual exame da família quer. O servidor MUST descartar, dos `relacionados`, todo nome que não exista na tabela (mesma comparação sem acento e sem caixa) e os nomes repetidos, mantendo a ordem da IA e usando o nome como está na tabela. O `tipo` MUST ser descartado quando não for `variante` nem `generico`. Os relacionados MUST NOT tornar o exame Reconhecido nem entrar no carrinho.

#### Scenario: Relacionado válido
- **WHEN** a IA devolve `{ name: "Lipo B", matched: null, relacionados: ["LIPOPROTEINA - A"], tipo: "variante" }` e a tabela tem "LIPOPROTEÍNA - a"
- **THEN** "Lipo B" é Não encontrado com relacionados `["LIPOPROTEÍNA - a"]` e tipo `variante`

#### Scenario: Relacionado inventado
- **WHEN** a IA devolve um relacionado que não existe na tabela
- **THEN** esse nome é descartado e não aparece na tela

#### Scenario: Tipo inválido
- **WHEN** a IA devolve `tipo: "parecido"`
- **THEN** o exame fica sem tipo e o aviso usa a frase neutra

### Requirement: Seção de não encontrados no topo da revisão
Quando houver ao menos um exame Não encontrado, a janela de revisão da leitura SHALL mostrar, acima dos reconhecidos, a seção "Não encontrados na tabela (n)", com ícone de aviso e o texto "Estes exames do pedido não foram identificados na tabela. Confira o pedido e busque manualmente antes de enviar o orçamento." Sem não encontrados, a seção MUST NOT aparecer. Os reconhecidos continuam vindo marcados para o carrinho.

#### Scenario: Pedido com reconhecidos e não encontrados
- **WHEN** a leitura traz 1 reconhecido e 2 não encontrados
- **THEN** a janela mostra primeiro "Não encontrados na tabela (2)" com o aviso e depois "Reconhecidos (1)" com o item marcado

#### Scenario: Pedido só com reconhecidos
- **WHEN** todos os exames lidos são reconhecidos
- **THEN** a seção de não encontrados não aparece

### Requirement: Aviso informativo por exame não encontrado
Cada exame Não encontrado SHALL ser exibido como um aviso só de texto, sem checkbox nem botão de adicionar. O aviso usa o nome **como está escrito no pedido**, e a frase vem de um modelo fixo do sistema (nunca texto livre da IA):
- tipo `variante` com relacionados: "Não realizamos o exame '<nome no pedido>'. Realizamos apenas: <relacionados>."
- tipo `generico` com relacionados: "O pedido cita '<nome no pedido>' sem especificar. O laboratório realiza somente: <relacionados>."
- sem tipo, com relacionados: "'<nome no pedido>' não foi encontrado na tabela. Exames relacionados que realizamos: <relacionados>."
- sem relacionados, com qualquer tipo: "'<nome no pedido>' não foi encontrado na tabela."

Os relacionados SHALL aparecer como lista estruturada. Com mais de 3, só os 3 primeiros aparecem de início, e a ação "ver mais (+k)" revela o restante.

#### Scenario: Variante não realizada
- **WHEN** "Lipo B" é Não encontrado com tipo `variante` e relacionados `["LIPOPROTEÍNA - a"]`
- **THEN** o aviso diz "Não realizamos o exame 'Lipo B'. Realizamos apenas: LIPOPROTEÍNA - a."

#### Scenario: Pedido genérico
- **WHEN** "Lipoproteína" é Não encontrado com tipo `generico` e relacionados `["LIPOPROTEÍNA - a"]`
- **THEN** o aviso diz "O pedido cita 'Lipoproteína' sem especificar. O laboratório realiza somente: LIPOPROTEÍNA - a."

#### Scenario: Sem relacionados
- **WHEN** "Células LE" é Não encontrado sem relacionados
- **THEN** o aviso diz "'Células LE' não foi encontrado na tabela."

#### Scenario: Lista longa de relacionados
- **WHEN** um não encontrado tem 5 relacionados
- **THEN** o aviso mostra os 3 primeiros e "ver mais (+2)"; ao clicar, os 5 aparecem

#### Scenario: Nada vai ao carrinho pelo aviso
- **WHEN** o atendente clica em "Adicionar" na revisão
- **THEN** só os reconhecidos marcados entram no carrinho; nenhum relacionado entra
