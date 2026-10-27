// api/_lib/faturamento/pontuacaoSetor.ts
// Pontuação do setor (.scratch/faturamento-pontuacao/spec.md): regra inteira dos
// pontos do mês de cada Frente, em funções puras. Não acessa banco nem relógio:
// recebe o mês, os fatos já lidos, os lançamentos manuais e os membros.
//
// Pontos com uma casa decimal; as somas arredondam só no fim (0,1 × 12 = 1,2).

export type FrentePontuacao = 'faturamento' | 'recursoGlosa';
export type TipoCriterio = 'automatico' | 'manual';

export type ChaveCriterio =
  | 'guiasSemLote'
  | 'tarefasPendentes'
  | 'dominioPops'
  | 'melhoriaSetor'
  | 'metaMensal'
  | 'zeroGlosa'
  | 'metaSuperada'
  | 'intrasetorial'
  | 'refaturamento'
  | 'reversaoGlosa'
  | 'destravarRecursos';

export interface DefinicaoCriterio {
  chave: ChaveCriterio;
  frente: FrentePontuacao;
  rotulo: string;
  tipo: TipoCriterio;
  pontosBase: number;
  /** Pontos base valem por convênio (guias sem lote, zero glosa). */
  porConvenio?: true;
}

/** A tabela de regras da spec, na mesma ordem. Mudar um valor aqui é mudar a spec. */
export const CRITERIOS: readonly DefinicaoCriterio[] = [
  { chave: 'guiasSemLote', frente: 'faturamento', rotulo: 'Guias sem lote', tipo: 'automatico', pontosBase: 0.1, porConvenio: true },
  { chave: 'tarefasPendentes', frente: 'faturamento', rotulo: 'Tarefas pendentes', tipo: 'automatico', pontosBase: 1 },
  { chave: 'dominioPops', frente: 'faturamento', rotulo: 'Domínio dos POPs', tipo: 'manual', pontosBase: 1 },
  { chave: 'melhoriaSetor', frente: 'faturamento', rotulo: 'Melhoria do setor', tipo: 'manual', pontosBase: 2 },
  { chave: 'metaMensal', frente: 'faturamento', rotulo: 'Meta mensal', tipo: 'automatico', pontosBase: 5 },
  { chave: 'zeroGlosa', frente: 'faturamento', rotulo: 'Zero glosa', tipo: 'automatico', pontosBase: 0.5, porConvenio: true },
  { chave: 'metaSuperada', frente: 'faturamento', rotulo: 'Meta superada', tipo: 'automatico', pontosBase: 10 },
  { chave: 'intrasetorial', frente: 'recursoGlosa', rotulo: 'Intrasetorial', tipo: 'manual', pontosBase: 0.1 },
  { chave: 'tarefasPendentes', frente: 'recursoGlosa', rotulo: 'Tarefas pendentes', tipo: 'automatico', pontosBase: 1 },
  { chave: 'dominioPops', frente: 'recursoGlosa', rotulo: 'Domínio dos POPs', tipo: 'manual', pontosBase: 1 },
  { chave: 'melhoriaSetor', frente: 'recursoGlosa', rotulo: 'Melhoria do setor', tipo: 'manual', pontosBase: 2 },
  { chave: 'refaturamento', frente: 'recursoGlosa', rotulo: 'Refaturamento', tipo: 'manual', pontosBase: 5 },
  { chave: 'reversaoGlosa', frente: 'recursoGlosa', rotulo: 'Reversão de glosa', tipo: 'manual', pontosBase: 0.5 },
  { chave: 'destravarRecursos', frente: 'recursoGlosa', rotulo: 'Destravar recursos', tipo: 'manual', pontosBase: 10 },
];

export const FRENTES: readonly { frente: FrentePontuacao; rotulo: string }[] = [
  { frente: 'faturamento', rotulo: 'Faturamento' },
  { frente: 'recursoGlosa', rotulo: 'Recurso de Glosa' },
];

/** Meta mensal do FlowLab: faturado por emissão e a meta cadastrada (null sem meta). */
export interface FatoMeta {
  valorMeta: number | null;
  faturado: number;
}

/** Tarefas do apLIS abertas às 23h59 do último dia do mês. */
export interface FatoTarefas {
  /** Pendências por usuário do apLIS; usuário ausente não tem nenhuma. */
  porUsuario: Record<number, number>;
  /** Endereçadas ao setor "GLOSA – FATURAMENTO", sem destinatário: contam nas duas Frentes. */
  doSetor: number;
}

/** Fatos do mês, já lidos e achatados. Fato ausente: o critério não aparece. */
export interface FatosPontuacao {
  meta?: FatoMeta;
  tarefas?: FatoTarefas;
}

export interface LancamentoManual {
  frente: FrentePontuacao;
  chave: ChaveCriterio;
  pontos: number;
  observacao: string;
}

export interface MembroFrente {
  frente: FrentePontuacao;
  idUsuarioAplis: number;
  nome: string;
}

export interface EntradaPontuacao {
  /** 'YYYY-MM'. */
  mes: string;
  fatos: FatosPontuacao;
  lancamentos: LancamentoManual[];
  membros: MembroFrente[];
}

export interface DetalheMeta {
  tipo: 'meta';
  meta: number | null;
  faturado: number;
  /** Faturado sobre a meta, uma casa; null sem meta. */
  percentual: number | null;
}

export interface DetalheTarefas {
  tipo: 'tarefas';
  /** Membros da Frente, na ordem da lista, com as pendências de cada um. */
  pessoas: { idUsuarioAplis: number; nome: string; pendencias: number }[];
  /** Pendências do setor "GLOSA – FATURAMENTO". */
  setor: number;
}

export type DetalheCriterio = DetalheMeta | DetalheTarefas;

export interface CriterioPontuado extends Omit<DefinicaoCriterio, 'frente'> {
  pontosAtingidos: number;
  observacao: string;
  detalhe: DetalheCriterio | null;
}

export interface FrentePontuada {
  frente: FrentePontuacao;
  rotulo: string;
  criterios: CriterioPontuado[];
  total: number;
}

export interface ResumoPontuacao {
  mes: string;
  frentes: FrentePontuada[];
}

const umaCasa = (n: number): number => Math.round(n * 10) / 10;

/** Meta zerada (o banco aceita 0) vale como não cadastrada: senão qualquer faturado daria 115%. */
const temMeta = (valorMeta: number | null): valorMeta is number => valorMeta !== null && valorMeta > 0;

/** Faixa do faturado contra a meta, em centavos inteiros: 115% exato não escorrega no ponto flutuante. */
function faixaDaMeta({ valorMeta, faturado }: FatoMeta): 'semMeta' | 'abaixo' | 'atingida' | 'superada' {
  if (!temMeta(valorMeta)) return 'semMeta';
  const meta = Math.round(valorMeta * 100);
  const feito = Math.round(faturado * 100);
  if (feito * 100 >= meta * 115) return 'superada';
  if (feito >= meta) return 'atingida';
  return 'abaixo';
}

function detalheDaMeta(fato: FatoMeta): DetalheMeta {
  return {
    tipo: 'meta',
    meta: fato.valorMeta,
    faturado: fato.faturado,
    percentual: temMeta(fato.valorMeta) ? umaCasa((fato.faturado / fato.valorMeta) * 100) : null,
  };
}

const OBSERVACOES_META: Record<ReturnType<typeof faixaDaMeta>, { metaMensal: string; metaSuperada: string }> = {
  semMeta: { metaMensal: 'Meta não cadastrada', metaSuperada: 'Meta não cadastrada' },
  abaixo: { metaMensal: 'Faturado abaixo da meta', metaSuperada: 'Faturado abaixo da meta' },
  atingida: { metaMensal: 'Meta atingida', metaSuperada: 'Abaixo de 115% da meta' },
  superada: { metaMensal: 'Substituída pela meta superada', metaSuperada: 'Faturado a partir de 115% da meta' },
};

/** Só ganha o ponto a Frente com todos os membros, e o setor, zerados. */
function pontuarTarefas(def: DefinicaoCriterio, fato: FatoTarefas, membros: MembroFrente[]): Omit<CriterioPontuado, keyof DefinicaoCriterio> {
  const pessoas = membros
    .filter((m) => m.frente === def.frente)
    .map(({ idUsuarioAplis, nome }) => ({ idUsuarioAplis, nome, pendencias: fato.porUsuario[idUsuarioAplis] ?? 0 }));
  const quem = pessoas.filter((p) => p.pendencias > 0).map((p) => p.nome);
  if (fato.doSetor > 0) quem.push('SETOR');
  const total = fato.doSetor + pessoas.reduce((soma, p) => soma + p.pendencias, 0);
  return {
    pontosAtingidos: total === 0 ? def.pontosBase : 0,
    observacao: total === 0 ? 'Nenhuma tarefa pendente' : `${total} ${total === 1 ? 'pendência' : 'pendências'}: ${quem.join(', ')}`,
    detalhe: { tipo: 'tarefas', pessoas, setor: fato.doSetor },
  };
}

/** Pontos e observação de um critério automático, ou null quando ainda não há fato para ele. */
function pontuarAutomatico(def: DefinicaoCriterio, fatos: FatosPontuacao, membros: MembroFrente[]): Omit<CriterioPontuado, keyof DefinicaoCriterio> | null {
  if (def.chave === 'tarefasPendentes' && fatos.tarefas) return pontuarTarefas(def, fatos.tarefas, membros);
  if ((def.chave === 'metaMensal' || def.chave === 'metaSuperada') && fatos.meta) {
    const faixa = faixaDaMeta(fatos.meta);
    const ganha = def.chave === 'metaMensal' ? faixa === 'atingida' : faixa === 'superada';
    return {
      pontosAtingidos: ganha ? def.pontosBase : 0,
      observacao: OBSERVACOES_META[faixa][def.chave],
      detalhe: detalheDaMeta(fatos.meta),
    };
  }
  return null;
}

/** Os critérios de cada Frente, na ordem da tabela de regras, e o total. */
export function pontuarMes({ mes, fatos, lancamentos, membros }: EntradaPontuacao): ResumoPontuacao {
  const frentes = FRENTES.map(({ frente, rotulo }) => {
    const criterios: CriterioPontuado[] = [];
    for (const def of CRITERIOS.filter((c) => c.frente === frente)) {
      const { chave, rotulo: rotuloCriterio, tipo, pontosBase, porConvenio } = def;
      const base = { chave, rotulo: rotuloCriterio, tipo, pontosBase, ...(porConvenio ? { porConvenio } : {}) };
      if (def.tipo === 'automatico') {
        const pontuado = pontuarAutomatico(def, fatos, membros);
        if (pontuado) criterios.push({ ...base, ...pontuado });
        continue;
      }
      const lancamento = lancamentos.find((l) => l.frente === frente && l.chave === def.chave);
      if (lancamento) {
        criterios.push({ ...base, pontosAtingidos: umaCasa(lancamento.pontos), observacao: lancamento.observacao, detalhe: null });
      }
    }
    const total = umaCasa(criterios.reduce((soma, c) => soma + c.pontosAtingidos, 0));
    return { frente, rotulo, criterios, total };
  });
  return { mes, frentes };
}
