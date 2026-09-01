// Agregação pura (R5) dos 8 indicadores de "Indicadores Gerais do
// Laboratório" — sem I/O, sem `new Date()` "agora" (P4; o cálculo de dias
// entre duas datas do LIS usa `Date.UTC` com valores explícitos, não a hora
// atual). "Não Conformidades por Setor" NÃO é calculado aqui — reaproveita
// `agregarOcorrencias(...).porSetor` (domain/ocorrenciasIndicadores.ts),
// juntado em requisicoes.ts na leitura.
//
// Limitação assumida (documentada, sem acesso ao projeto de referência):
// o universo de linhas é sempre "requisições SOLICITADAS no período" (mesmo
// recorte que o sync usa para consultar o LIS — ver bdLabQualidade.ts). Um
// laudo liberado ou retificado bem depois da solicitação ainda conta aqui,
// mesmo que a liberação/retificação em si caia fora do período escolhido.

import type { IndicadorSecaoRequisicaoResposta, IndicadoresGeraisLaboratorioResposta, SecaoRequisicao } from '../types';

export interface LinhaIndicadorRequisicao {
  dtaColeta: string | null;
  dtaAmostraRecebida: string | null;
  dtaAdmissao: string | null;
  dtaPrevista: string | null;
  dtaLiberacao: string | null;
  patologistaNomeLis: string | null;
  retificado: boolean;
}

export type IndicadoresGeraisSemNaoConformidades = Omit<IndicadoresGeraisLaboratorioResposta, 'naoConformidadesPorSetor'>;

/** Dias corridos entre duas datas `YYYY-MM-DD`, sem depender do fuso local. */
function diasEntre(inicio: string, fim: string): number {
  const [anoI, mesI, diaI] = inicio.slice(0, 10).split('-').map(Number);
  const [anoF, mesF, diaF] = fim.slice(0, 10).split('-').map(Number);
  const msInicio = Date.UTC(anoI, mesI - 1, diaI);
  const msFim = Date.UTC(anoF, mesF - 1, diaF);
  return Math.round((msFim - msInicio) / 86_400_000);
}

function incrementarMedico(mapa: Map<string, number>, nome: string): void {
  mapa.set(nome, (mapa.get(nome) ?? 0) + 1);
}

export function agregarIndicadoresGerais(
  periodo: { inicio: string; fim: string },
  linhas: readonly LinhaIndicadorRequisicao[],
): IndicadoresGeraisSemNaoConformidades {
  const amostrasRecebidas = linhas.filter((l) => l.dtaAmostraRecebida !== null).length;
  const amostrasAdmitidas = linhas.filter((l) => l.dtaAdmissao !== null).length;
  const liberadas = linhas.filter((l) => l.dtaLiberacao !== null);
  const laudosRetificados = linhas.filter((l) => l.retificado).length;

  const porMedico = new Map<string, number>();
  for (const linha of liberadas) {
    if (linha.patologistaNomeLis) incrementarMedico(porMedico, linha.patologistaNomeLis);
  }

  let somaTat = 0;
  let contagemTat = 0;
  let laudosForaDoPrazo = 0;
  for (const linha of liberadas) {
    const dataBase = linha.dtaColeta ?? null;
    if (dataBase && linha.dtaLiberacao) {
      somaTat += diasEntre(dataBase, linha.dtaLiberacao);
      contagemTat++;
    }
    if (linha.dtaPrevista && linha.dtaLiberacao && diasEntre(linha.dtaPrevista, linha.dtaLiberacao) > 0) {
      laudosForaDoPrazo++;
    }
  }

  return {
    periodo,
    amostrasRecebidas,
    laudosLiberados: liberadas.length,
    laudosLiberadosPorMedico: [...porMedico.entries()]
      .map(([medicoNome, total]) => ({ medicoNome, total }))
      .sort((a, b) => b.total - a.total),
    amostrasAdmitidas,
    tatMedioDias: contagemTat === 0 ? null : Math.round((somaTat / contagemTat) * 10) / 10,
    laudosForaDoPrazo,
    laudosRetificados,
  };
}

// ─── Seções extras (Biologia Molecular / Patologia-AP / Histologia-Citologia /
// IHQ-parceiro) — mesmas 4 métricas (total/liberados/TAT/fora do prazo),
// só variando a seção e as linhas de entrada (já filtradas por `secao_lis`
// em requisicoes.ts). Compartilhado em vez de duplicado 4x — os 4 domains
// de seção (biologiaMolecularIndicadores.ts e irmãos) são wrappers finos
// sobre esta função, cada um com o próprio teste.

export interface LinhaIndicadorSecaoRequisicao {
  dtaColeta: string | null;
  dtaPrevista: string | null;
  dtaLiberacao: string | null;
}

export function agregarIndicadorSecao(
  periodo: { inicio: string; fim: string },
  secao: SecaoRequisicao,
  linhas: readonly LinhaIndicadorSecaoRequisicao[],
): IndicadorSecaoRequisicaoResposta {
  const liberadas = linhas.filter((l) => l.dtaLiberacao !== null);

  let somaTat = 0;
  let contagemTat = 0;
  let laudosForaDoPrazo = 0;
  for (const linha of liberadas) {
    if (linha.dtaColeta && linha.dtaLiberacao) {
      somaTat += diasEntre(linha.dtaColeta, linha.dtaLiberacao);
      contagemTat++;
    }
    if (linha.dtaPrevista && linha.dtaLiberacao && diasEntre(linha.dtaPrevista, linha.dtaLiberacao) > 0) {
      laudosForaDoPrazo++;
    }
  }

  return {
    periodo,
    secao,
    totalRequisicoes: linhas.length,
    laudosLiberados: liberadas.length,
    tatMedioDias: contagemTat === 0 ? null : Math.round((somaTat / contagemTat) * 10) / 10,
    laudosForaDoPrazo,
  };
}
