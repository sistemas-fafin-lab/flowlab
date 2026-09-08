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

/** Resultado da busca unificada: exames e fontes pagadoras que combinam
 *  com o termo, separados por tipo. */
export interface ResultadoBuscaUnificada {
  exames: Exam[];
  fontesPagadoras: string[];
}

/** Busca exames (nome ou TUSS) e fontes pagadoras (nome) que combinam com
 *  `termo`, parcial e case-insensitive. Nomes de fonte pagadora saem
 *  deduplicados. Termo vazio (ou só espaços) devolve listas vazias, não a
 *  lista inteira. */
export function buscarUnificado(
  exams: Exam[],
  payors: Payor[],
  termo: string,
): ResultadoBuscaUnificada {
  const termoNormalizado = normalizar(termo);
  if (!termoNormalizado) return { exames: [], fontesPagadoras: [] };

  const exames = buscarExamesPorTermo(exams, termo);

  const nomesFontesPagadoras = payors
    .map((fonte) => fonte.payor)
    .filter((nome) => nome.toLowerCase().includes(termoNormalizado));
  const fontesPagadoras = Array.from(new Set(nomesFontesPagadoras));

  return { exames, fontesPagadoras };
}

/** Um exame coberto por uma fonte pagadora, com os campos exibidos na
 *  tabela de exames por fonte pagadora. */
export interface ExameDaFontePagadora {
  exame: string;
  tuss: string;
  tabelaAssociada: string;
  valorCobrado: number;
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
      return [
        {
          exame: exame.name,
          tuss: exame.tuss,
          tabelaAssociada: fonte.table,
          valorCobrado: fonte.price,
        },
      ];
    })
    .sort((a, b) => a.valorCobrado - b.valorCobrado);
}
