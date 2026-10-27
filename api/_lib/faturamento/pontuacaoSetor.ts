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

/** Convênio (fonte pagadora) e quantas requisições dele ainda estão sem lote. */
export interface ConvenioSemLote {
  idFontePagadora: number;
  nome: string;
  pendentes: number;
}

/** Convênios com requisição solicitada no mês anterior (M-1). */
export interface FatoGuiasSemLote {
  convenios: ConvenioSemLote[];
}

/** Convênio com recebimento no mês: requisições pagas e quantas foram glosadas. */
export interface ConvenioRecebido {
  idFontePagadora: number;
  nome: string;
  /** Requisições com pagamento registrado no mês; 0 deixa o convênio fora da conta. */
  recebidas: number;
  /** Requisições com baixa no mês glosadas, pela definição de Glosas e Recursos. */
  glosadas: number;
}

/** Convênios com recebimento registrado no apLIS no mês M. */
export interface FatoZeroGlosa {
  convenios: ConvenioRecebido[];
}

/** Fatos do mês, já lidos e achatados. Fato ausente: o critério não aparece. */
export interface FatosPontuacao {
  meta?: FatoMeta;
  guiasSemLote?: FatoGuiasSemLote;
  zeroGlosa?: FatoZeroGlosa;
  tarefas?: FatoTarefas;
}

/** Quem lançou ou alterou por último, e quando (ISO). */
export interface AutoriaLancamento {
  por: string | null;
  em: string;
}

export interface LancamentoManual {
  frente: FrentePontuacao;
  chave: ChaveCriterio;
  pontos: number;
  observacao: string;
  autoria?: AutoriaLancamento;
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

export interface DetalheGuiasSemLote {
  tipo: 'guiasSemLote';
  semPendencia: Omit<ConvenioSemLote, 'pendentes'>[];
  comPendencia: ConvenioSemLote[];
}

export interface DetalheZeroGlosa {
  tipo: 'zeroGlosa';
  semGlosa: Omit<ConvenioRecebido, 'glosadas'>[];
  comGlosa: ConvenioRecebido[];
}

export type DetalheCriterio = DetalheMeta | DetalheTarefas | DetalheGuiasSemLote | DetalheZeroGlosa;

export interface CriterioPontuado extends Omit<DefinicaoCriterio, 'frente'> {
  pontosAtingidos: number;
  observacao: string;
  detalhe: DetalheCriterio | null;
  /** Só nos critérios manuais: quem lançou e quando; null quando não lançado. */
  lancamento?: AutoriaLancamento | null;
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

/** 0,1 por convênio que fechou o mês anterior sem nenhuma requisição sem lote. */
function pontuarGuiasSemLote(def: DefinicaoCriterio, fato: FatoGuiasSemLote): Omit<CriterioPontuado, keyof DefinicaoCriterio> {
  const semPendencia = fato.convenios
    .filter((c) => c.pendentes === 0)
    .map(({ idFontePagadora, nome }) => ({ idFontePagadora, nome }));
  const comPendencia = fato.convenios.filter((c) => c.pendentes > 0);
  return {
    pontosAtingidos: umaCasa(semPendencia.length * def.pontosBase),
    observacao: fato.convenios.length === 0
      ? 'Nenhuma requisição solicitada no mês anterior'
      : `${semPendencia.length} de ${fato.convenios.length} convênios fechados sem pendência`,
    detalhe: { tipo: 'guiasSemLote', semPendencia, comPendencia },
  };
}

/** 0,5 por convênio recebido no mês sem nenhuma requisição glosada. */
function pontuarZeroGlosa(def: DefinicaoCriterio, fato: FatoZeroGlosa): Omit<CriterioPontuado, keyof DefinicaoCriterio> {
  const recebidos = fato.convenios.filter((c) => c.recebidas > 0);
  const semGlosa = recebidos
    .filter((c) => c.glosadas === 0)
    .map(({ idFontePagadora, nome, recebidas }) => ({ idFontePagadora, nome, recebidas }));
  const comGlosa = recebidos.filter((c) => c.glosadas > 0);
  return {
    pontosAtingidos: umaCasa(semGlosa.length * def.pontosBase),
    observacao: recebidos.length === 0
      ? 'Nenhum convênio recebido no mês'
      : `${semGlosa.length} de ${recebidos.length} ${recebidos.length === 1 ? 'convênio recebido' : 'convênios recebidos'} sem glosa`,
    detalhe: { tipo: 'zeroGlosa', semGlosa, comGlosa },
  };
}

/** Pontos e observação de um critério automático, ou null quando ainda não há fato para ele. */
function pontuarAutomatico(def: DefinicaoCriterio, fatos: FatosPontuacao, membros: MembroFrente[]): Omit<CriterioPontuado, keyof DefinicaoCriterio> | null {
  if (def.chave === 'guiasSemLote' && fatos.guiasSemLote) return pontuarGuiasSemLote(def, fatos.guiasSemLote);
  if (def.chave === 'zeroGlosa' && fatos.zeroGlosa) return pontuarZeroGlosa(def, fatos.zeroGlosa);
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
      // Manual sempre aparece: sem lançamento, "Não lançado" com 0, para a coordenação ver o que falta.
      const lancamento = lancamentos.find((l) => l.frente === frente && l.chave === def.chave);
      criterios.push(lancamento
        ? {
          ...base,
          pontosAtingidos: umaCasa(lancamento.pontos),
          observacao: lancamento.observacao,
          detalhe: null,
          lancamento: lancamento.autoria ?? null,
        }
        : { ...base, pontosAtingidos: 0, observacao: 'Não lançado', detalhe: null, lancamento: null });
    }
    const total = umaCasa(criterios.reduce((soma, c) => soma + c.pontosAtingidos, 0));
    return { frente, rotulo, criterios, total };
  });
  return { mes, frentes };
}

/** NUMERIC(5, 1) de fat_pontuacao_lancamentos. */
const PONTOS_MAXIMOS = 9999.9;

/**
 * Confere o corpo de um lançamento manual antes de gravar: critério manual da
 * Frente, pontos ≥ 0 com uma casa e observação não vazia. A RLS e os CHECKs da
 * tabela repetem a regra; aqui é para o handler responder 400 com mensagem clara.
 */
export function validarLancamento(corpo: Record<string, unknown>): { lancamento: LancamentoManual } | { erro: string } {
  const { frente, chave, pontos, observacao } = corpo;
  const def = CRITERIOS.find((c) => c.frente === frente && c.chave === chave);
  if (!def || def.tipo !== 'manual') {
    return { erro: 'Critério inválido: só os critérios manuais da Frente aceitam lançamento.' };
  }
  if (typeof pontos !== 'number' || !Number.isFinite(pontos) || pontos < 0 || pontos > PONTOS_MAXIMOS) {
    return { erro: 'Pontos inválidos: informe um número de 0 a 9999,9.' };
  }
  const texto = typeof observacao === 'string' ? observacao.trim() : '';
  if (!texto) return { erro: 'A observação é obrigatória.' };
  return { lancamento: { frente: def.frente, chave: def.chave, pontos: umaCasa(pontos), observacao: texto } };
}

/**
 * Confere o corpo de incluir ou desativar um membro: uma das duas Frentes e o id
 * do usuário do apLIS. O nome não vem do corpo; o handler o lê do apLIS.
 */
export function validarMembro(
  corpo: Record<string, unknown>,
): { membro: Pick<MembroFrente, 'frente' | 'idUsuarioAplis'> } | { erro: string } {
  const { frente, idUsuarioAplis } = corpo;
  const def = FRENTES.find((f) => f.frente === frente);
  if (!def) return { erro: 'Frente inválida: use faturamento ou recursoGlosa.' };
  if (typeof idUsuarioAplis !== 'number' || !Number.isInteger(idUsuarioAplis) || idUsuarioAplis <= 0) {
    return { erro: 'Usuário do apLIS inválido.' };
  }
  return { membro: { frente: def.frente, idUsuarioAplis } };
}

/**
 * Fechamento da pontuação: o mês só fecha quando o "dados até" do backup do
 * apLIS ('YYYY-MM-DD HH:MM') já chegou ao último dia dele, para não congelar
 * dado incompleto. Devolve o motivo da recusa, ou null quando pode fechar.
 */
export function motivoParaNaoFechar(mes: string, dadoAte: string | null): string | null {
  const [ano, numeroMes] = mes.split('-').map(Number);
  const ultimoDia = String(new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate()).padStart(2, '0');
  const competencia = `${mes.slice(5, 7)}/${ano}`;
  const precisa = `o fechamento de ${competencia} precisa deles até ${ultimoDia}/${competencia}.`;
  if (!dadoAte) return `Não foi possível saber até quando vão os dados do apLIS; ${precisa}`;
  if (dadoAte.slice(0, 10) >= `${mes}-${ultimoDia}`) return null;
  const [data, hora] = dadoAte.split(' ');
  const [a, m, d] = data.split('-');
  return `Os dados do apLIS vão só até ${d}/${m}/${a}${hora ? ` ${hora}` : ''}; ${precisa}`;
}
