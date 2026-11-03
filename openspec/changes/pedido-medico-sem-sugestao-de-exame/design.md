## Context

Fluxo atual da leitura do pedido médico:

1. **Tela** (`LeituraPedidoMedicoModal`): o atendente envia fotos ou PDFs do pedido.
2. **Handler** (`atendimento-gerador-orcamento-pedido-medico`): monta o prompt com os nomes da tabela de preços e chama o Gemini.
3. **Servidor** (`casarExamesLidos`): liga cada exame lido a um item da tabela e devolve `{ nomeNoPedido, item: { tuss, nome } | null }[]`.
4. **Tela** (`resolverLeituraDoPedido`): separa o resultado em `reconhecidos` e `semCorrespondencia: string[]`.

O servidor liga um exame a um item em duas tentativas: primeiro o `matched` da IA, depois uma busca em que todas as palavras de 3 letras ou mais do nome lido aparecem dentro do nome do item. Essa busca, junto com o prompt que pede o "correspondente mais próximo", produziu "Lipo B" → LIPOPROTEÍNA - a e "Células LE" → CARIÓTIPO … CÉLULAS. As regras vieram portadas da Tabela-Particular, e os testes atuais fixam a busca por palavras.

Restrições: o contrato da API é interno, e frontend e servidor são publicados no mesmo deploy. Não há banco envolvido.

## Goals / Non-Goals

**Goals:**
- Nenhum exame diferente do pedido entra como reconhecido.
- Os não encontrados ficam visíveis, com um aviso que ajuda o atendente: "realizamos apenas X".
- O texto do aviso é previsível e testável.

**Non-Goals:**
- Nível de confiança ou estado intermediário ("Confira").
- Adicionar um relacionado ao carrinho pelo aviso.
- Avaliar ou trocar o modelo Gemini.
- Registrar os não encontrados para análise.

## Decisions

### D1. Reconhecer só por igualdade exata normalizada
`casarExamesLidos` mantém duas tentativas, ambas por igualdade com `normalizar()` (sem acento, minúsculas, sem espaços nas pontas): (1) o `matched` da IA; (2) o nome lido. A busca por palavras sai.
- *Alternativa:* endurecer a busca, exigindo palavras inteiras e mantendo palavras curtas. Rejeitada: continua errando em exames de nomes parecidos, e o custo de um falso positivo aqui é clínico e financeiro. O trabalho de entender siglas e sinônimos fica com a IA, e o código só confere.

### D2. Novo formato de resposta da IA
```json
{
  "exams": [
    { "name": "TGO", "matched": "TGO - TRANSAMINASE ...", "relacionados": [], "tipo": null },
    { "name": "Lipo B", "matched": null, "relacionados": ["LIPOPROTEÍNA - a"], "tipo": "variante" }
  ]
}
```
- `relacionados` e `tipo` só têm sentido quando `matched` é `null`. Se o exame for reconhecido, o servidor os ignora.
- O prompt define cada valor de `tipo`: `variante` quando o pedido especifica uma variante que não está na tabela; `generico` quando o pedido não especifica qual exame da família quer.
- O prompt também define as regras de `matched`: só para o mesmo exame (nome, sigla consagrada, sinônimo inequívoco); `null` na dúvida, quando só parte do nome coincide ou quando é outro exame da família. A frase "correspondente mais próximo" sai.
- Linha que pede mais de um exame ("FSH e LH", "Função renal (creatinina, ureia, ácido úrico)") vira um exame por item. Sem isso, a IA devolvia a linha inteira como `generico` e o atendente teria de adicionar à mão exames que a tabela tem (visto na validação com pedidos reais).
- Material diferente (soro × urina × saliva) ou outro analito (albumina × proteína, IgG/IgM × anticorpos totais) é **outro exame**, então `matched` vem `null` e o item vai para `relacionados`. A validação mostrou a IA ainda casando "relação albumina/creatinina" com "Relação Proteína/Creatinina" e "Cortisol (manhã)" com "Cortisol salivar".
- O comentário de `promptPedidoMedico.ts` já amarra o formato ao leitor, e os dois mudam no mesmo commit.

### D3. O servidor valida os relacionados contra a tabela
`casarExamesLidos` converte cada nome de `relacionados` para o item da tabela pela mesma comparação normalizada. Descarta os que não existem e os repetidos, mantém a ordem da IA e devolve o nome como está na tabela. `tipo` fora de `variante | generico` vira `null`. Assim a IA não consegue citar um exame que o laboratório não tem.
- *Alternativa:* o código achar os relacionados sozinho, por semelhança de palavras. Rejeitada: é a mesma busca que causou o bug. A IA entende a família do exame, e o código só filtra o que ela devolve.

### D4. Contrato da API
`ExameLido` (servidor) e `ExameLidoNoPedido` (domínio da tela) passam a ser:
```ts
{ nomeNoPedido: string; item: { tuss: string; nome: string } | null; relacionados: string[]; tipo: 'variante' | 'generico' | null }
```
Os relacionados chegam como nomes, sem preço nem TUSS, porque são só informativos. Na tela, `LeituraDoPedido.semCorrespondencia` deixa de ser `string[]` e vira `{ nomeNoPedido, relacionados, tipo }[]`.

### D5. A frase do aviso é uma função pura do domínio
`fraseDoNaoEncontrado({ nomeNoPedido, relacionados, tipo })` em `domain/pedidoMedico.ts` devolve o texto fixo do caso, conforme os modelos do spec. Na tela, a frase fica numa linha e os relacionados numa lista logo abaixo, então a função devolve a parte do texto sem a lista. A lista em si (3 nomes visíveis e "ver mais (+k)") é estado local do modal, por aviso. A função é testada no `pedidoMedico.test.ts`, sem DOM.

### D6. Layout do modal
A ordem é: seção "Não encontrados na tabela (n)" em âmbar, com `AlertTriangle` e o texto fixo; depois um cartão por exame, com a frase e a lista de relacionados; por fim "Reconhecidos", sem mudanças. A seção atual em chips ("Sem correspondência") sai. Os reconhecidos continuam vindo marcados, e o botão "Adicionar n ao carrinho" só considera eles.

## Risks / Trade-offs

- **[Menos reconhecimentos automáticos]** Grafias que a busca por palavras salvava, como "glicemia jejum" → "Glicemia de Jejum", passam a depender da IA preencher `matched`. → A IA continua recebendo a tabela inteira e a instrução de usar siglas e sinônimos. Esse custo é aceito, já que um falso negativo só obriga o atendente a buscar manualmente.
- **[A IA ainda pode errar o `matched`]** O código não detecta que "Lipoproteína (a)" não é "Lipo B" se a IA apontar isso com convicção. → A mitigação é o prompt mais rígido e a revisão humana que já existe (o atendente vê "No pedido: 'X'" ao lado do item). Validar com o pedido real do relato (tarefa de verificação); se ainda falhar, endurecer o prompt.
- **[Relacionados enganosos]** A IA pode citar como relacionado um exame de outra família. → O aviso é só texto e nada vai ao carrinho, então o efeito fica limitado.
- **[Mudança de formato]** Resposta no formato antigo ou com os campos novos ausentes → `relacionados: []` e `tipo: null`, com a frase neutra. A leitura não quebra.

## Migration Plan

Deploy único (frontend e servidor juntos). Sem migration nem flag. Para reverter, basta reverter o commit.

## Open Questions

(nenhuma: decisões fechadas no grill-me.)
