// Busca de exames e fontes pagadoras em Controle de Custos, extraída da lógica
// hoje embutida em PayorsScreen.tsx para poder ser testada sem montar
// componente React — ver busca.test.ts. Base pro ticket 02 (tela de busca de
// exame → fontes pagadoras daquele exame).

import type { Exam, Payor } from '../../../hooks/useCostControl';

function normalizar(valor: string): string {
  return valor.trim().toLowerCase();
}

/** Exames cujo nome OU código TUSS contém `termo` — correspondência parcial e
 *  case-insensitive. Termo vazio (ou só espaços) devolve lista vazia, não a
 *  lista inteira. */
export function buscarExamesPorTermo(exams: Exam[], termo: string): Exam[] {
  const termoNormalizado = normalizar(termo);
  if (!termoNormalizado) return [];

  return exams.filter(
    (exame) =>
      exame.name.toLowerCase().includes(termoNormalizado) ||
      exame.tuss.toLowerCase().includes(termoNormalizado),
  );
}

/** Fontes pagadoras do código TUSS exato de um exame, ordenadas por valor
 *  cobrado crescente (mais barato primeiro). */
export function fontesPagadorasPorTuss(payors: Payor[], tuss: string): Payor[] {
  const tussNormalizado = normalizar(tuss);
  if (!tussNormalizado) return [];

  return payors
    .filter((fonte) => fonte.tus.toLowerCase() === tussNormalizado)
    .sort((a, b) => a.price - b.price);
}

/** Nomes de fonte pagadora (deduplicados) cujo nome contém `termo` —
 *  correspondência parcial e case-insensitive. Termo vazio (ou só espaços)
 *  devolve lista vazia, não a lista inteira. */
export function buscarFontesPagadorasPorTermo(payors: Payor[], termo: string): string[] {
  const termoNormalizado = normalizar(termo);
  if (!termoNormalizado) return [];

  const nomes = payors
    .map((fonte) => fonte.payor)
    .filter((nome) => nome.toLowerCase().includes(termoNormalizado));

  return Array.from(new Set(nomes));
}

/** Nomes de tabela associada (deduplicados) cujo nome contém `termo` —
 *  correspondência parcial e case-insensitive. Termo vazio (ou só espaços)
 *  devolve lista vazia, não a lista inteira. */
export function buscarTabelasAssociadasPorTermo(payors: Payor[], termo: string): string[] {
  const termoNormalizado = normalizar(termo);
  if (!termoNormalizado) return [];

  const tabelas = payors
    .map((fonte) => fonte.table)
    .filter((tabela) => tabela.toLowerCase().includes(termoNormalizado));

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
    .filter((fonte) => fonte.payor.toLowerCase() === nomeNormalizado)
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
