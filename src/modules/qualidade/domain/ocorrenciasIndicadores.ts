// Agregação pura (R5) — portada verbatim de
// apps/backend/src/modules/ocorrencias/indicadores.ts (agregarOcorrencias),
// sem I/O, sem `new Date()` (P4). Roda no browser agora porque o volume de
// linhas por período é pequeno (centenas) — se isso deixar de ser
// verdade, vira `.rpc()` no Postgres (capability indicadores-via-sql já
// prevista na proposta), sem mudar a assinatura desta função.

import type { IndicadorOcorrenciasResposta } from '../types';

export interface LinhaIndicadorOcorrencia {
  dtaOcorrencia: string;
  statusCuradoria: string;
  motivoId: string | null;
  motivoNome: string | null;
  setorErroId: string | null;
  setorErroNome: string | null;
  colaboradorId: string | null;
  colaboradorNome: string | null;
}

function trimestreDoMes(mes: number): number {
  return Math.ceil(mes / 3);
}

function incrementar(mapa: Map<string, { nome: string; total: number }>, id: string, nome: string): void {
  const atual = mapa.get(id);
  mapa.set(id, { nome, total: (atual?.total ?? 0) + 1 });
}

/** `status_curadoria` é campo de curadoria (R5, ocorrenciasRegras.ts) — nunca vem do LIS, que não expõe status de ocorrência. */
function statusCuradoriaConcluida(linha: LinhaIndicadorOcorrencia): boolean {
  return linha.statusCuradoria === 'concluida';
}

export function agregarOcorrencias(
  periodo: { inicio: string; fim: string },
  linhas: readonly LinhaIndicadorOcorrencia[],
): IndicadorOcorrenciasResposta {
  const concluidas = linhas.filter(statusCuradoriaConcluida);
  const aClassificar = linhas.filter((linha) => !statusCuradoriaConcluida(linha)).length;

  const porMotivo = new Map<string, { nome: string; total: number }>();
  const porSetor = new Map<string, { nome: string; total: number }>();
  const porColaborador = new Map<string, { nome: string; total: number }>();
  const porMes = new Map<string, number>();
  const porTrimestre = new Map<string, number>();

  for (const linha of concluidas) {
    if (linha.motivoId && linha.motivoNome) incrementar(porMotivo, linha.motivoId, linha.motivoNome);
    if (linha.setorErroId && linha.setorErroNome) incrementar(porSetor, linha.setorErroId, linha.setorErroNome);
    if (linha.colaboradorId && linha.colaboradorNome) {
      incrementar(porColaborador, linha.colaboradorId, linha.colaboradorNome);
    }

    const [anoStr, mesStr] = linha.dtaOcorrencia.split('-');
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    const chaveMes = `${anoStr}-${mesStr}`;
    porMes.set(chaveMes, (porMes.get(chaveMes) ?? 0) + 1);
    const chaveTrimestre = `${ano}-Q${trimestreDoMes(mes)}`;
    porTrimestre.set(chaveTrimestre, (porTrimestre.get(chaveTrimestre) ?? 0) + 1);
  }

  const ordenarPorChave = <T extends [string, unknown]>(a: T, b: T) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

  return {
    periodo,
    aClassificar,
    porMotivo: [...porMotivo.entries()]
      .map(([motivoId, v]) => ({ motivoId, motivoNome: v.nome, total: v.total }))
      .sort((a, b) => b.total - a.total),
    porSetor: [...porSetor.entries()]
      .map(([setorId, v]) => ({ setorId, setorNome: v.nome, total: v.total }))
      .sort((a, b) => b.total - a.total),
    porColaborador: [...porColaborador.entries()]
      .map(([colaboradorId, v]) => ({ colaboradorId, colaboradorNome: v.nome, total: v.total }))
      .sort((a, b) => b.total - a.total),
    serieMensal: [...porMes.entries()].sort(ordenarPorChave).map(([mes, total]) => ({ mes, total })),
    serieTrimestral: [...porTrimestre.entries()]
      .sort(ordenarPorChave)
      .map(([trimestre, total]) => ({ trimestre, total })),
  };
}
