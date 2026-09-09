// Busca de exames e fontes pagadoras em Controle de Custos, extraída da lógica
// hoje embutida em PayorsScreen.tsx para poder ser testada sem montar
// componente React — ver busca.test.ts. Base pro ticket 02 (tela de busca de
// exame → fontes pagadoras daquele exame).

import type { Exam, Payor } from '../../../hooks/useCostControl';

function normalizar(valor: string): string {
  return removerAcentos(valor.trim().toLowerCase());
}

function removerAcentos(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Compara `texto` com `termo` ignorando acentos e maiúsculas/minúsculas, e
 *  casando de forma fuzzy: basta os caracteres de `termo` aparecerem em
 *  `texto`, em ordem, não necessariamente contíguos (ex.: termo "bsd" casa
 *  com "Bradesco Saúde"). Termo vazio nunca casa — quem quiser tratar termo
 *  vazio como "casa com tudo" decide isso antes de chamar. */
export function casaFuzzy(texto: string, termo: string): boolean {
  const textoNormalizado = normalizar(texto);
  const termoNormalizado = normalizar(termo);
  if (!termoNormalizado) return false;

  let posicao = 0;
  for (const caractere of termoNormalizado) {
    posicao = textoNormalizado.indexOf(caractere, posicao);
    if (posicao === -1) return false;
    posicao += 1;
  }
  return true;
}

/** Exames cujo nome OU código TUSS casam com `termo` — ignora acentos e
 *  maiúsculas/minúsculas, e a correspondência é fuzzy (não precisa ser
 *  substring contígua). Termo vazio (ou só espaços) devolve lista vazia, não
 *  a lista inteira. */
export function buscarExamesPorTermo(exams: Exam[], termo: string): Exam[] {
  if (!normalizar(termo)) return [];

  return exams.filter(
    (exame) => casaFuzzy(exame.name, termo) || casaFuzzy(exame.tuss, termo),
  );
}

/** Fontes pagadoras do código TUSS exato de um exame, ordenadas por valor
 *  cobrado crescente (mais barato primeiro). */
export function fontesPagadorasPorTuss(payors: Payor[], tuss: string): Payor[] {
  const tussNormalizado = normalizar(tuss);
  if (!tussNormalizado) return [];

  return payors
    .filter((fonte) => normalizar(fonte.tus) === tussNormalizado)
    .sort((a, b) => a.price - b.price);
}

/** Nomes de fonte pagadora (deduplicados) cujo nome casa com `termo` —
 *  ignora acentos e maiúsculas/minúsculas, e a correspondência é fuzzy (não
 *  precisa ser substring contígua). Termo vazio (ou só espaços) devolve
 *  lista vazia, não a lista inteira. */
export function buscarFontesPagadorasPorTermo(payors: Payor[], termo: string): string[] {
  if (!normalizar(termo)) return [];

  const nomes = payors
    .map((fonte) => fonte.payor)
    .filter((nome) => casaFuzzy(nome, termo));

  return Array.from(new Set(nomes));
}

/** Nomes de tabela associada (deduplicados) cujo nome casa com `termo` —
 *  ignora acentos e maiúsculas/minúsculas, e a correspondência é fuzzy (não
 *  precisa ser substring contígua). Termo vazio (ou só espaços) devolve
 *  lista vazia, não a lista inteira. */
export function buscarTabelasAssociadasPorTermo(payors: Payor[], termo: string): string[] {
  if (!normalizar(termo)) return [];

  const tabelas = payors
    .map((fonte) => fonte.table)
    .filter((tabela) => casaFuzzy(tabela, termo));

  return Array.from(new Set(tabelas));
}

/** Um exame coberto por uma fonte pagadora, com os campos exibidos na
 *  tabela de exames por fonte pagadora.
 *
 *  custo vem do "Custo Total" (direct + indirect) cadastrado pro TUSS na
 *  aba Exames; dif é valorCobrado - custo; percentualCsp é custo / valorCobrado
 *  (em %) — quanto do valor cobrado é consumido pelo custo. atendido reflete
 *  se aquele exame é atendido pelo plano de saúde da fonte pagadora ou só
 *  como particular (Payor.atendido, editável na tela). */
export interface ExameDaFontePagadora {
  payorId: string;
  exame: string;
  tuss: string;
  tabelaAssociada: string;
  valorCobrado: number;
  custo: number;
  dif: number;
  percentualCsp: number;
  atendido: boolean;
}

/** Exame cujo TUSS bate com `tuss` — TUSS pode se repetir entre exames (sem
 *  examId confiável vindo do APLIS), então usa a mesma regra de "último
 *  vence" adotada em examesPorFontePagadora. */
export function examePorTuss(exams: Exam[], tuss: string): Exam | undefined {
  return exams.reduce<Exam | undefined>(
    (ultimo, atual) => (atual.tuss === tuss ? atual : ultimo),
    undefined,
  );
}

/** Exames cobertos por uma fonte pagadora — join pelo TUSS
 *  (`Payor.tus` ↔ `Exam.tuss`), ordenados por valor cobrado crescente. */
export function examesPorFontePagadora(
  exams: Exam[],
  payors: Payor[],
  nomeFontePagadora: string,
): ExameDaFontePagadora[] {
  const nomeNormalizado = normalizar(nomeFontePagadora);
  if (!nomeNormalizado) return [];

  const examesPorTuss = new Map(exams.map((exame) => [exame.tuss, exame]));

  return payors
    .filter((fonte) => normalizar(fonte.payor) === nomeNormalizado)
    .flatMap((fonte) => {
      const exame = examesPorTuss.get(fonte.tus);
      if (!exame) return [];
      const custo = exame.direct + exame.indirect;
      return [
        {
          payorId: fonte.id,
          exame: exame.name,
          tuss: exame.tuss,
          tabelaAssociada: fonte.table,
          valorCobrado: fonte.price,
          custo,
          dif: fonte.price - custo,
          percentualCsp: fonte.price > 0 ? (custo / fonte.price) * 100 : 0,
          atendido: fonte.atendido,
        },
      ];
    })
    .sort((a, b) => a.valorCobrado - b.valorCobrado);
}
