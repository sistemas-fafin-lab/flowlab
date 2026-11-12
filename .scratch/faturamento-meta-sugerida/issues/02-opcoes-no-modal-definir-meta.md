# 02: Opções no modal "Definir meta"

**What to build:** no card **Meta** do Contas a Receber, o modal passa a mostrar as três candidatas do mês corrente, calculadas a partir do apLIS:

- **90/10**: 0,9 × Elegíveis(M-1) + 0,1 × Elegíveis(M-2).
- **Média de 2 meses**: média dos Elegíveis de M-1 e M-2.
- **Média de 3 meses**: média dos Elegíveis de M-1, M-2 e M-3.

A coordenação escolhe uma opção ou digita outro valor e salva como hoje. A regra dos Elegíveis e o contrato da rota estão na spec (`../spec.md`, Implementation Decisions).

**Blocked by:** None (can start immediately).

**Status:** done (12/11/2026; tela não conferida no navegador)

- [x] O modal abre a qualquer momento do mês, mesmo com a meta já salva.
- [x] Cada opção mostra o valor, os meses usados e os Elegíveis de cada mês.
- [x] O modal mostra "dados até DD/MM" (o `dadoAte` de `requisicao.DtaSolicitacao`).
- [x] A 90/10 vem pré-selecionada.
- [x] Escolher uma opção e salvar grava o valor da opção. Digitar outro valor grava o valor digitado.
- [x] Quem só tem permissão de ver o Contas a Receber abre o modal em modo leitura ("Ver sugestões"), sem salvar. Salvar continua restrito a quem já pode editar a meta.
- [x] Opção com algum mês sem Elegíveis aparece como indisponível.
- [x] Os Elegíveis só contam os convênios com `is_considerada_meta`, lidos a cada chamada (sem lista fixa no código), e excluem `EVENTOS_NAO_COBRAVEIS`.
- [x] Com o apLIS fora do ar, o modal mostra aviso com "Tentar novamente" e continua permitindo digitar e salvar a meta.
- [x] Testes da função de cálculo, no padrão de `indicadoresFaturamento.test.ts`:
  - as três fórmulas com os Elegíveis da planilha de jul–set/2026, batendo até o centavo com as candidatas de outubro (90/10 R$ 1.177.059,29, média de 3 R$ 1.103.521,18, média de 2 R$ 1.138.669,22);
  - virada de ano;
  - mês ausente;
  - Elegíveis zero contando como valor;
  - arredondamento em centavos.
- [x] Testes da rota, no padrão de `faturamento-pendencias-particulares.test.ts`:
  - sem sessão ou sem permissão;
  - `mes` inválido devolve 400;
  - a lista de fontes consideradas é repassada à consulta;
  - o formato da resposta, com `dadoAte`;
  - apLIS fora do ar devolve a resposta própria, não 500.
- [x] `npm test` e o typecheck passam.

## Entrega (12/11/2026)

- Rota `GET /api/faturamento/meta-sugerida?mes=YYYY-MM` (`api/_lib/handlers/faturamento-meta-sugerida.ts`), com a consulta `listarElegiveisPorMes` em `bdLab.ts`. A SQL foi conferida ao vivo e bate com o relatório da 01 (ago, set e out/2026).
- Cálculo puro em `src/modules/faturamento/utils/metaSugerida.ts` (`calcularCandidatas`). A conta é feita em centavos inteiros e arredondada só no fim.
- Tela: hook `useMetaSugerida.ts` (só busca com o modal aberto) e `MetaMensalModal.tsx` com as três opções e "Outro valor". O botão do card fica sempre visível ("Ver sugestões" sem permissão de editar).
- **Fixture dos testes:** os Elegíveis de jul e ago/2026 da planilha (R$ 1.033.225,10 e R$ 1.090.681,63) foram deduzidos das candidatas de outubro, porque a planilha não está no repositório. Julho tem folga de ±1 centavo.
- A origem ainda não é gravada: isso é a issue 03. Salvar continua gravando só o valor.
- Quando a 90/10 não está disponível (apLIS fora do ar ou mês sem dado), o modal já abre com "Outro valor" escolhido.
