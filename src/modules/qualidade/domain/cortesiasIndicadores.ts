// Agregação pura de indicadores de Cortesias — portada verbatim de
// apps/backend/src/modules/cortesias/indicadores.ts (agregarCortesias), sem
// I/O, sem `new Date()` (P4). Roda no browser agora (ver
// ocorrenciasIndicadores.ts para o mesmo racional de volume pequeno).

import type { AutorizadorAcompanhado, IndicadorCortesiasResposta, RecortePeriodoCortesia } from '../types';

export interface LinhaIndicadorCortesia {
  valorConcedido: number | null;
  valorConcedidoCorrigido: number | null;
  aprovadaForaDoPrazo: boolean;
  clinicaIdLis: number | null;
  clinicaNome: string | null;
  classificacaoId: string | null;
  classificacaoNome: string | null;
  autorizadoPorCorrigidoNome: string | null;
  autorizadoPorLis: string | null;
  /** Data do recorte selecionado (`dta_solicitacao` ou `dta_autorizacao`) — usada só para o mês do gráfico por autorizador. */
  dataRecorte: string;
}

function incrementarClinica(mapa: Map<number, { nome: string | null; total: number }>, id: number, nome: string | null) {
  const atual = mapa.get(id);
  mapa.set(id, { nome: atual?.nome ?? nome, total: (atual?.total ?? 0) + 1 });
}

function incrementarClassificacao(
  mapa: Map<string, { nome: string | null; total: number }>,
  id: string,
  nome: string | null,
) {
  const atual = mapa.get(id);
  mapa.set(id, { nome: atual?.nome ?? nome, total: (atual?.total ?? 0) + 1 });
}

function normalizarNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Painel: só os 4 autorizadores acompanhados (identidade fixa, não os "top N"
 * — ver dataviz). Casamento por nome normalizado, tolerante a variações —
 * nome curado tem prioridade sobre o texto bruto do LIS.
 */
const AUTORIZADORES_ACOMPANHADOS: AutorizadorAcompanhado[] = [
  'Eduarda Fabri',
  'Mario Gorini',
  'Cristiane Madeiro',
  'Luis Felipe',
];

function casarAutorizador(nome: string | null): AutorizadorAcompanhado | null {
  if (!nome) return null;
  const normalizado = normalizarNome(nome);
  const tokens = normalizado.split(' ').filter(Boolean);
  return (
    AUTORIZADORES_ACOMPANHADOS.find((alvo) => {
      const tokensAlvo = normalizarNome(alvo).split(' ');
      return tokensAlvo.every((token) => tokens.includes(token));
    }) ?? null
  );
}

/**
 * Total concedido IGNORA valores nulos (nunca soma como 0, R4); ajuste
 * manual (`valorConcedidoCorrigido`) é o valor efetivo quando presente.
 */
export function agregarCortesias(
  periodo: { inicio: string; fim: string },
  recorte: RecortePeriodoCortesia,
  linhas: readonly LinhaIndicadorCortesia[],
  cotasExcedidas: number,
): IndicadorCortesiasResposta {
  let totalConcedido = 0;
  let precoNaoCadastradoContagem = 0;
  let aprovadasForaDoPrazo = 0;
  const porClinica = new Map<number, { nome: string | null; total: number }>();
  const porClassificacao = new Map<string, { nome: string | null; total: number }>();
  const porAutorizadorMensal = new Map<string, number>();
  const porOutrosAutorizadoresMensal = new Map<string, number>();

  for (const linha of linhas) {
    const valorEfetivo = linha.valorConcedidoCorrigido ?? linha.valorConcedido;
    if (valorEfetivo === null) {
      precoNaoCadastradoContagem++;
    } else {
      totalConcedido += valorEfetivo;
    }
    if (linha.aprovadaForaDoPrazo) aprovadasForaDoPrazo++;
    if (linha.clinicaIdLis !== null) incrementarClinica(porClinica, linha.clinicaIdLis, linha.clinicaNome);

    const classificacaoChave = linha.classificacaoId ?? '(sem classificação)';
    incrementarClassificacao(porClassificacao, classificacaoChave, linha.classificacaoNome);

    const autorizador = casarAutorizador(linha.autorizadoPorCorrigidoNome) ?? casarAutorizador(linha.autorizadoPorLis);
    const mes = linha.dataRecorte.slice(0, 7);
    if (autorizador) {
      const chave = `${mes}|${autorizador}`;
      porAutorizadorMensal.set(chave, (porAutorizadorMensal.get(chave) ?? 0) + 1);
    } else {
      porOutrosAutorizadoresMensal.set(mes, (porOutrosAutorizadoresMensal.get(mes) ?? 0) + 1);
    }
  }

  return {
    periodo,
    recorte,
    totalCortesias: linhas.length,
    totalConcedido,
    precoNaoCadastradoContagem,
    aprovadasForaDoPrazo,
    porClassificacao: [...porClassificacao.entries()]
      .map(([classificacaoId, v]) => ({
        classificacaoId: classificacaoId === '(sem classificação)' ? null : classificacaoId,
        classificacaoNome: v.nome,
        total: v.total,
      }))
      .sort((a, b) => b.total - a.total),
    porAutorizadorMensal: [...porAutorizadorMensal.entries()]
      .map(([chave, total]) => {
        const [mes, autorizador] = chave.split('|') as [string, AutorizadorAcompanhado];
        return { mes, autorizador, total };
      })
      .sort((a, b) => (a.mes === b.mes ? a.autorizador.localeCompare(b.autorizador) : a.mes.localeCompare(b.mes))),
    outrosAutorizadoresMensal: [...porOutrosAutorizadoresMensal.entries()]
      .map(([mes, total]) => ({ mes, total }))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
    cotasExcedidas,
    porClinica: [...porClinica.entries()]
      .map(([clinicaIdLis, v]) => ({ clinicaIdLis, clinicaNome: v.nome, total: v.total }))
      .sort((a, b) => b.total - a.total),
  };
}
