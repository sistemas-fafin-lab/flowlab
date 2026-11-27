// Rotinas da TI que viram card sozinhas (D50, issue 36). Puro: a api/ (NodeNext) importa, com ".js".
//
// Backup mensal, revisão de acessos, troca de senha de serviço: o que não tem custo e por isso não
// está no Gastos de TI. O gestor cadastra na aba Rotinas da EVA; alguns dias antes de cada data, o
// relógio (D44) cria o card no Kanban, com os responsáveis e o prazo, e já anda para a próxima data.
// Cadastrar a rotina é a aprovação (D28): o card sai sem passar pela fila de sugestões.
import { diaDaSemana, formatarDiaMes, somarDias, type Dia } from './datas.js';
import type { Prioridade } from './demandas.js';

export type Frequencia = 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

interface DefFrequencia { valor: Frequencia; rotulo: string; dias?: number; meses?: number }

export const FREQUENCIAS: readonly DefFrequencia[] = [
  { valor: 'semanal', rotulo: 'Toda semana', dias: 7 },
  { valor: 'quinzenal', rotulo: 'A cada 2 semanas', dias: 14 },
  { valor: 'mensal', rotulo: 'Todo mês', meses: 1 },
  { valor: 'bimestral', rotulo: 'A cada 2 meses', meses: 2 },
  { valor: 'trimestral', rotulo: 'A cada 3 meses', meses: 3 },
  { valor: 'semestral', rotulo: 'A cada 6 meses', meses: 6 },
  { valor: 'anual', rotulo: 'Todo ano', meses: 12 },
];
const DEF = Object.fromEntries(FREQUENCIAS.map((f) => [f.valor, f])) as Record<Frequencia, DefFrequencia>;

/** A antecedência de sempre e o teto (mais que isso, o card fica tempo demais parado no Kanban). */
export const ANTECEDENCIA_PADRAO = 3;
export const MAX_ANTECEDENCIA = 60;
export const MAX_TITULO_ROTINA = 200;

/** O recorte de ti_agente_rotinas que as regras usam. */
export interface Rotina {
  id: string;
  titulo: string;
  descricao: string | null;
  frequencia: Frequencia;
  /** O dia do mês da primeira data: o "todo dia 31" cai no último dia dos meses curtos e volta a 31 depois. */
  dia_ancora: number;
  /** A data (o prazo) do próximo card. */
  proxima_em: Dia;
  /** Quantos dias antes da data o card é criado. */
  antecedencia_dias: number;
  responsaveis: string[];
  prioridade: Prioridade;
  projeto_id: string | null;
  ativa: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ultimoDiaDoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const NOME_DIA_PLURAL = ['aos domingos', 'às segundas', 'às terças', 'às quartas', 'às quintas', 'às sextas', 'aos sábados'];

/** A data depois de `dia`: 7 ou 14 dias depois, ou o dia da âncora N meses depois, sem passar do fim do mês. */
export function proximaOcorrencia(dia: Dia, frequencia: Frequencia, ancora: number): Dia {
  const f = DEF[frequencia];
  if (f.dias) return somarDias(dia, f.dias);
  const [ano, mes] = dia.split('-').map(Number);
  const total = mes - 1 + (f.meses ?? 1);
  const a = ano + Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${a}-${pad(m)}-${pad(Math.min(ancora, ultimoDiaDoMes(a, m)))}`;
}

/** O dia em que o card de uma data é criado. */
export const diaDeCriar = (r: Pick<Rotina, 'antecedencia_dias'>, data: Dia) => somarDias(data, -r.antecedencia_dias);

/**
 * O que o relógio faz com a rotina hoje. As datas que já passaram ficam para trás, sem card (uma
 * rotina não vira card atrasado); a próxima vira card quando chega o dia de criar.
 * - `criarPara`: o prazo do card a criar agora, ou null;
 * - `proxima`: a data a gravar (igual à atual quando não há nada a fazer).
 */
export function planoDaRotina(r: Rotina, hoje: Dia): { criarPara: Dia | null; proxima: Dia } {
  let data = r.proxima_em;
  for (let i = 0; data < hoje && i < 1000; i += 1) data = proximaOcorrencia(data, r.frequencia, r.dia_ancora);
  if (diaDeCriar(r, data) <= hoje) return { criarPara: data, proxima: proximaOcorrencia(data, r.frequencia, r.dia_ancora) };
  return { criarPara: null, proxima: data };
}

/** "Todo mês, dia 5", "Toda semana, às segundas", "Todo ano, em 05/12". */
export function descreverRotina(r: Pick<Rotina, 'frequencia' | 'dia_ancora' | 'proxima_em'>): string {
  const f = DEF[r.frequencia];
  if (f.dias) return `${f.rotulo}, ${NOME_DIA_PLURAL[diaDaSemana(r.proxima_em)]}`;
  if (r.frequencia === 'anual') return `${f.rotulo}, em ${formatarDiaMes(r.proxima_em)}`;
  return `${f.rotulo}, dia ${r.dia_ancora}`;
}

/** A descrição do card criado: a da rotina e de onde ele veio. */
export function descricaoDoCard(r: Pick<Rotina, 'descricao' | 'frequencia' | 'dia_ancora' | 'proxima_em'>): string {
  return [r.descricao?.trim(), `Card de rotina criado pela EVA (${descreverRotina(r).toLowerCase()}).`].filter(Boolean).join('\n\n');
}

export type RotinaValidada = { ok: true; rotina: Omit<Rotina, 'id'> } | { ok: false; erro: string };

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** O cadastro da tela: título, frequência, primeira data e antecedência. A âncora sai da data. */
export function validarRotina(
  e: { titulo: string; descricao?: string | null; frequencia: string; proxima_em: string; antecedencia_dias: number; responsaveis: string[]; prioridade: string; projeto_id?: string | null; ativa?: boolean },
  hoje: Dia,
): RotinaValidada {
  const titulo = e.titulo.trim();
  if (!titulo) return { ok: false, erro: 'Dê um título à rotina (ex.: "Backup mensal do servidor").' };
  if (titulo.length > MAX_TITULO_ROTINA) return { ok: false, erro: `O título passa de ${MAX_TITULO_ROTINA} caracteres.` };
  if (!(e.frequencia in DEF)) return { ok: false, erro: 'Escolha a frequência.' };
  if (!DIA.test(e.proxima_em)) return { ok: false, erro: 'Escolha a data do próximo card.' };
  if (e.proxima_em < hoje) return { ok: false, erro: 'A data do próximo card já passou.' };
  if (!Number.isInteger(e.antecedencia_dias) || e.antecedencia_dias < 0 || e.antecedencia_dias > MAX_ANTECEDENCIA) {
    return { ok: false, erro: `A antecedência vai de 0 a ${MAX_ANTECEDENCIA} dias.` };
  }
  if (!['low', 'medium', 'high', 'critical'].includes(e.prioridade)) return { ok: false, erro: 'Escolha a prioridade.' };
  return {
    ok: true,
    rotina: {
      titulo,
      descricao: e.descricao?.trim() || null,
      frequencia: e.frequencia as Frequencia,
      dia_ancora: Number(e.proxima_em.slice(8, 10)),
      proxima_em: e.proxima_em,
      antecedencia_dias: e.antecedencia_dias,
      responsaveis: Array.from(new Set(e.responsaveis)),
      prioridade: e.prioridade as Prioridade,
      projeto_id: e.projeto_id || null,
      ativa: e.ativa ?? true,
    },
  };
}
