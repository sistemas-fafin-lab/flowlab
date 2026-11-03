## 1. Servidor: casamento e prompt

- [x] 1.1 `leituraPedidoMedico.test.ts`: revisar os testes que fixam a busca por palavras ("glicemia jejum" por aproximação, matched inexistente que cai na aproximação) e incluir as regressões "Lipo B" e "Células LE" (lista com LIPOPROTEÍNA - a e CARIÓTIPO … CÉLULAS → `item: null`), TGO por `matched`, nome lido idêntico sem `matched`, e exame como texto simples só por igualdade (vermelho primeiro)
- [x] 1.2 Testes de `relacionados` e `tipo`: nome válido convertido para o nome da tabela, nome inventado descartado, repetidos removidos com a ordem mantida, `tipo` inválido → `null`, campos ausentes → `[]`/`null`, e exame reconhecido com `relacionados` vazios (D3)
- [x] 1.3 `leituraPedidoMedico.ts`: remover a busca por palavras (D1), ler `relacionados`/`tipo` e validar contra a tabela (D3), estender `ExameLido` (D4) e atualizar o comentário do topo
- [x] 1.4 `promptPedidoMedico.ts`: regra rígida de `matched`, sem "correspondente mais próximo", com o novo formato (`relacionados`, `tipo`) e a definição de `variante`/`generico` (D2); teste do texto do prompt conforme o spec
- [x] 1.5 Handler `atendimento-gerador-orcamento-pedido-medico.ts`: devolver `relacionados` e `tipo` em cada exame
- [x] 1.6 Prompt (validação real): uma linha com vários exames vira um exame por item; material ou analito diferente é outro exame (D2); teste do texto

## 2. Domínio da tela

- [x] 2.1 `pedidoMedico.test.ts`: `semCorrespondencia` traz `{ nomeNoPedido, relacionados, tipo }`; `fraseDoNaoEncontrado` cobre os quatro modelos do spec (variante, genérico, sem tipo, sem relacionados) com o nome como está no pedido (vermelho primeiro)
- [x] 2.2 `domain/pedidoMedico.ts`: estender `ExameLidoNoPedido` e `LeituraDoPedido`, ajustar `resolverLeituraDoPedido` e criar `fraseDoNaoEncontrado` (D4, D5)
- [x] 2.3 `api.ts`: tipos da resposta, com padrão `relacionados: []` e `tipo: null` quando os campos faltarem

## 3. Modal

- [x] 3.1 `LeituraPedidoMedicoModal.tsx`: seção "Não encontrados na tabela (n)" acima dos reconhecidos, com `AlertTriangle`, o texto fixo e um cartão por exame (frase + lista estruturada de relacionados), sem checkbox nem botão (D6); remover os chips de "Sem correspondência"
- [x] 3.2 "ver mais (+k)" por aviso quando houver mais de 3 relacionados, e "ver menos" para recolher
- [x] 3.3 Atualizar o comentário do componente (reconhecidos marcados; não encontrados como aviso informativo)

## 4. Verificação

- [x] 4.1 `npm test` e build sem erros (falham só `permissions.test.ts` e `gerarEstruturado.test.ts`, que já falhavam na `main`)
- [ ] 4.2 No navegador, com o pedido do relato ("Lipo B", "Células LE"): os dois aparecem em "Não encontrados" e nenhum vai ao carrinho; conferir as frases, o "ver mais", o modo claro/escuro e o mobile
- [x] 4.3 Com um pedido que tenha siglas comuns (TGO, TGP, TSH, Hemograma): continuam reconhecidos e marcados
