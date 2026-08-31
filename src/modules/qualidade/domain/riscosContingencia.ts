// Plano de contingência — histórico de testes (.scratch/qualidade-riscos-indicadores/issues/03-riscos-contingencia.md).
// Agregação pura (mesmo padrão de riscosGerenciamento.ts), sem I/O.

import type { TesteContingenciaDTO } from '../types';

/** Data do teste mais recente primeiro — ordem de exibição do histórico. */
export function ordenarTestesPorData(testes: readonly TesteContingenciaDTO[]): readonly TesteContingenciaDTO[] {
  return [...testes].sort((a, b) => b.dataTeste.localeCompare(a.dataTeste));
}

/** Teste mais recente — `null` se o plano nunca foi testado. */
export function testeMaisRecente(testes: readonly TesteContingenciaDTO[]): TesteContingenciaDTO | null {
  return ordenarTestesPorData(testes)[0] ?? null;
}

/** Próxima data prevista informada no teste mais recente — `null` se não houver testes ou o mais recente não previu uma. */
export function proximaDataPrevistaAtual(testes: readonly TesteContingenciaDTO[]): string | null {
  return testeMaisRecente(testes)?.proximaDataPrevista ?? null;
}
