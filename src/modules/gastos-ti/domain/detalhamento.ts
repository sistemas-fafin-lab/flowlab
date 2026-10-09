// Detalhamento avançado do dashboard (RF25, RN11): mapa de calor categoria ×
// mês, maiores desvios contra o previsto original, custo unitário e economias
// de renegociação. Tudo puro, com `hoje` como argumento (RN14).

import { competenciaDaData, partesCompetencia, somarMeses } from './competencia';
import { MESES_DO_CICLO, equivalenteMensal, quantidadeVigente, situacaoDespesa, valorVigente } from './recorrencia';
import type { OcorrenciaDoMes } from './situacao';
import type { Despesa } from '../types';

const valorPago = (o: OcorrenciaDoMes): number => (o.situacao === 'paga' ? o.lancamento?.valorPago ?? 0 : 0);

// ─── Mapa de calor ────────────────────────────────────────────────────────────

export interface LinhaMapaCalor {
  chave: string;
  nome: string;
  /** Pago em cada mês, alinhado com `MapaCalor.meses`. */
  valores: number[];
  total: number;
}

export interface MapaCalor {
  meses: string[];
  linhas: LinhaMapaCalor[];
  /** Maior célula: topo da escala. */
  maximo: number;
}

/** Pago por categoria × mês (competência). Só categorias com pagamento, da maior para a menor. */
export function mapaDeCalor(ocorrencias: readonly OcorrenciaDoMes[], meses: readonly string[], nomeCategoria: (id: string) => string): MapaCalor {
  const indice = new Map(meses.map((m, i) => [m, i]));
  const linhas = new Map<string, LinhaMapaCalor>();
  for (const o of ocorrencias) {
    const i = indice.get(o.competencia);
    const valor = valorPago(o);
    if (i === undefined || valor === 0) continue;
    const id = o.despesa.categoriaId;
    const linha = linhas.get(id) ?? { chave: id, nome: nomeCategoria(id), valores: meses.map(() => 0), total: 0 };
    linha.valores[i] += valor;
    linha.total += valor;
    linhas.set(id, linha);
  }
  const ordenadas = [...linhas.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { meses: [...meses], linhas: ordenadas, maximo: Math.max(0, ...ordenadas.flatMap((l) => l.valores)) };
}

/**
 * Faixa da escala sequencial (0 = mais claro … passos-1 = mais escuro) para o
 * valor. null para zero: célula sem gasto não é "pouco gasto", fica neutra.
 */
export function faixaSequencial(valor: number, maximo: number, passos = 7): number | null {
  if (valor <= 0 || maximo <= 0) return null;
  return Math.min(passos - 1, Math.floor((valor / maximo) * passos));
}

// ─── Maiores desvios (RN11) ───────────────────────────────────────────────────

export interface DesvioDespesa {
  despesaId: string;
  descricao: string;
  fornecedorNome: string;
  /** Despesa de valor variável: o previsto é estimativa, desvio é esperado. */
  variavel: boolean;
  /** Cobranças pagas que entraram na conta. */
  cobrancas: number;
  previstoOriginal: number;
  /** Previsto já com os ajustes do mês: mostra se o desvio foi antecipado. */
  previstoAjustado: number;
  pago: number;
  /** pago − previsto original: positivo = pagou mais. */
  desvio: number;
  /** % sobre o previsto original; null quando ele é zero. */
  percentual: number | null;
}

/**
 * Despesas cujo pago no período difere do previsto ORIGINAL (RN11), do maior
 * desvio absoluto para o menor. Só cobranças pagas entram, dos dois lados, para
 * comparar a mesma coisa. Lançamento fora da recorrência tem alerta próprio e
 * não entra (o previsto dele não existe).
 */
export function maioresDesvios(ocorrencias: readonly OcorrenciaDoMes[], limite = 10): DesvioDespesa[] {
  const porDespesa = new Map<string, DesvioDespesa>();
  for (const o of ocorrencias) {
    if (o.situacao !== 'paga' || o.foraDaRecorrencia || o.lancamento?.valorPago === null || o.lancamento?.valorPago === undefined) continue;
    const d = o.despesa;
    const atual = porDespesa.get(d.id) ?? {
      despesaId: d.id,
      descricao: d.descricao,
      fornecedorNome: d.fornecedorNome,
      variavel: d.tipoValor === 'variavel',
      cobrancas: 0,
      previstoOriginal: 0,
      previstoAjustado: 0,
      pago: 0,
      desvio: 0,
      percentual: null,
    };
    atual.cobrancas += 1;
    atual.previstoOriginal += o.previstoOriginal;
    atual.previstoAjustado += o.valorPrevisto;
    atual.pago += o.lancamento.valorPago;
    porDespesa.set(d.id, atual);
  }
  return [...porDespesa.values()]
    .map((d) => {
      const desvio = Math.round((d.pago - d.previstoOriginal) * 100) / 100;
      return { ...d, desvio, percentual: d.previstoOriginal > 0 ? (desvio / d.previstoOriginal) * 100 : null };
    })
    .filter((d) => d.desvio !== 0)
    .sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio) || a.descricao.localeCompare(b.descricao, 'pt-BR'))
    .slice(0, limite);
}

// ─── Custo unitário ───────────────────────────────────────────────────────────

export interface CustoUnitario {
  despesa: Despesa;
  /** Unidade cadastrada (licença, usuário…); "unidade" quando vazia. */
  unidade: string;
  quantidade: number;
  /** Equivalente mensal da despesa hoje. */
  mensal: number;
  /** Por unidade, por mês, hoje. */
  unitario: number;
  /** Por unidade, por mês, em janeiro (ou no início da despesa, se começou no ano). null se começou neste mês. */
  unitarioInicio: number | null;
  /** Variação % de `unitarioInicio` para `unitario`. */
  variacao: number | null;
}

/** Despesas recorrentes ativas com quantidade: quanto custa cada licença/usuário por mês e como mudou no ano. */
export function custoUnitario(despesas: readonly Despesa[], hoje: string): CustoUnitario[] {
  const atual = competenciaDaData(hoje) as string;
  const janeiro = `${partesCompetencia(atual).ano}-01-01`;
  const linhas: CustoUnitario[] = [];
  for (const d of despesas) {
    if (MESES_DO_CICLO[d.recorrencia] === 0 || situacaoDespesa(d, atual) !== 'ativa') continue;
    const quantidade = quantidadeVigente(d.quantidade, d.reajustes, atual);
    const mensal = equivalenteMensal(d, atual);
    if (!quantidade || mensal === null) continue;
    const unitario = mensal / quantidade;
    const referencia = d.competenciaInicio > janeiro ? d.competenciaInicio : janeiro;
    let unitarioInicio: number | null = null;
    if (referencia < atual) {
      const qtdInicio = quantidadeVigente(d.quantidade, d.reajustes, referencia);
      const mensalInicio = equivalenteMensal(d, referencia);
      if (qtdInicio && mensalInicio !== null) unitarioInicio = mensalInicio / qtdInicio;
    }
    linhas.push({
      despesa: d,
      unidade: d.unidade?.trim() || 'unidade',
      quantidade,
      mensal,
      unitario,
      unitarioInicio,
      variacao: unitarioInicio ? ((unitario - unitarioInicio) / unitarioInicio) * 100 : null,
    });
  }
  return linhas.sort((a, b) => b.mensal - a.mensal || a.despesa.descricao.localeCompare(b.despesa.descricao, 'pt-BR'));
}

// ─── Economias de renegociação ────────────────────────────────────────────────

export interface Economia {
  despesa: Despesa;
  reajusteId: string;
  vigenteDesde: string;
  /** Valor por cobrança antes e depois da renegociação. */
  anterior: number;
  novo: number;
  /** (anterior − novo) por mês × 12. */
  anualizada: number;
}

/**
 * Reajustes com motivo "renegociação" que baixaram o valor, com vigência no
 * período. A economia é anualizada pelo ciclo (uma anual que caiu R$ 1.200
 * economiza R$ 1.200/ano; uma mensal que caiu R$ 100, R$ 1.200/ano).
 */
export function economiasDeRenegociacao(despesas: readonly Despesa[], desde: string, ate: string): Economia[] {
  const economias: Economia[] = [];
  for (const d of despesas) {
    const ciclo = MESES_DO_CICLO[d.recorrencia];
    if (ciclo === 0) continue;
    for (const r of d.reajustes) {
      if (r.motivo !== 'renegociacao' || r.vigenteDesde < desde || r.vigenteDesde > ate) continue;
      const anterior = valorVigente(d, somarMeses(r.vigenteDesde, -1));
      if (r.valor >= anterior) continue;
      economias.push({ despesa: d, reajusteId: r.id, vigenteDesde: r.vigenteDesde, anterior, novo: r.valor, anualizada: ((anterior - r.valor) / ciclo) * 12 });
    }
  }
  return economias.sort((a, b) => b.anualizada - a.anualizada || a.vigenteDesde.localeCompare(b.vigenteDesde));
}
