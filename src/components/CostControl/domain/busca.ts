// Busca de exames e fontes pagadoras em Controle de Custos, extraída da lógica
// hoje embutida em PayorsScreen.tsx para poder ser testada sem montar
// componente React — ver busca.test.ts. Base pro ticket 02 (tela de busca de
// exame → fontes pagadoras daquele exame).

import type { Exam, Payor } from '../../../hooks/useCostControl';

/** Exames cujo nome OU código TUSS contém `termo` — correspondência parcial e
 *  case-insensitive. Termo vazio (ou só espaços) devolve lista vazia, não a
 *  lista inteira. */
export function buscarExamesPorTermo(exams: Exam[], termo: string): Exam[] {
  const termoNormalizado = termo.trim().toLowerCase();
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
  const tussNormalizado = tuss.trim().toLowerCase();
  if (!tussNormalizado) return [];

  return payors
    .filter((fonte) => fonte.tus.toLowerCase() === tussNormalizado)
    .sort((a, b) => a.price - b.price);
}
