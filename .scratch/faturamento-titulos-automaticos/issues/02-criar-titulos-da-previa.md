# 02 — Criar os títulos selecionados na prévia

**What to build:** a prévia da issue 01 ganha seleção e confirmação. Todos os
lotes válidos vêm marcados, exceto os desvinculados (desmarcados, mas
selecionáveis); bloqueados ficam desmarcados e travados. Ao
confirmar, a tela chama a rota existente `titulo-criar` uma vez por lote
(sem mudar a rota), cada um independente, mostrando o resultado por linha e um
resumo no fim. Ver `../spec.md` — "Backend" (criação) e "Frontend".

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Seleção com todos os válidos marcados por padrão, exceto `desvinculado`
      (desmarcado, selecionável); desmarcar/marcar por linha; bloqueados não
      selecionáveis
- [x] Título sem NF é criado normalmente (decisão D3: aceita-se que a baixa
      fique bloqueada até o número ser preenchido — pela 04 ou à mão)
- [x] Confirmar chama `titulo-criar` com `idsLote: [id]`, `dataEmissao`
      explícita = `emissaoPadrao([lote])`, `competencia` = mês dessa mesma
      emissão (as duas saem da mesma conta, inclusive no fallback de lote sem
      data de criação) e `observacoes` = "Criado
      pelo Atualizar a partir do apLIS em DD/MM" (data local)
- [x] Até 4 chamadas em paralelo; uma falha não interrompe as demais.
      Medido: ~6–8 s por lote (4 consultas ao apLIS pelo túnel + Supabase); a
      primeira execução (~180 lotes fechados desde 01/09) leva ~5 min
- [x] Barra de progresso (X de N) e aviso para não fechar o modal durante a
      execução; fechar no meio não desfaz o que já foi criado, e reabrir a
      prévia mostra só o que falta
- [x] Cada linha mostra criando/criado/falhou + mensagem devolvida pela rota
- [x] Resumo ao final ("N títulos criados, M falharam") e recarga da lista de
      títulos
- [x] Funções puras no utilitário (competência a partir da emissão, texto da
      observação, consolidação do resumo) com testes vitest
- [ ] Validação manual: título criado pelo botão fica igual a um criado pelo
      "Novo título" para o mesmo lote (emissão, vencimento, NF, responsável,
      guias), exceto competência e observação

## Comments

**30/09 — implementado.** `AtualizarAplisModal` ganhou seleção, execução e resumo;
funções puras em `utils/atualizarAplis.ts` (`competenciaDaEmissao`, `observacaoAplis`,
`selecaoPadraoAplis`, `corpoTituloAplis`, `resumoCriacao`, `emParalelo`) com testes.
Decisões:

- **Número da nota vai no corpo** (`numeroNota = lote.nfeNumero`). A rota
  `titulo-criar` não deduz o número do lote — no "Novo título" o operador o copia à
  mão —, então a linha da spec "número da nota fica por conta das regras que a rota
  já aplica" não vale para o número; sem isto a user story 20 não se cumpre.
- Não usa o `criarTitulo` do hook (relê a lista a cada título); chama `chamarApi`
  (agora exportado) e relê a lista uma vez no fim, se algo foi criado.
- Fechar no meio pede confirmação; confirmado, nenhum lote novo começa (os que
  estão no ar terminam no servidor). Sair da página tem o mesmo efeito, e há aviso
  de `beforeunload` durante a execução. Reabrir logo após fechar pode listar um lote
  ainda em criação — confirmá-lo cai na recusa da RPC ("falhou"), sem duplicar.
- Extras pequenos: estado "na fila", "Marcar todos" no cabeçalho, e a mensagem de
  sucesso mostra o vencimento devolvido pela rota.
- Resumo sem falhas omite o ", 0 falharam".

Pendente: validação manual no app (título do botão × "Novo título").
