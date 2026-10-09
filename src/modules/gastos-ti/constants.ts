import type { SituacaoDespesa } from './domain/recorrencia';
import type { SituacaoOcorrencia } from './domain/situacao';
import type { FormaPagamento, MotivoReajuste, NaturezaGasto, Recorrencia, TipoValor } from './types';

/** Situação de uma cobrança no Mês a mês. Sempre com rótulo (e ícone na tela), nunca só a cor. */
export const SITUACAO_OCORRENCIA: Record<SituacaoOcorrencia, { rotulo: string; classe: string }> = {
  vencida: { rotulo: 'Vencida', classe: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  a_vencer: { rotulo: 'A vencer', classe: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200' },
  paga: { rotulo: 'Paga', classe: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  dispensada: { rotulo: 'Dispensada', classe: 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400' },
};

export const MOTIVOS_REAJUSTE: { valor: MotivoReajuste; rotulo: string }[] = [
  { valor: 'reajuste_contratual', rotulo: 'Reajuste contratual' },
  { valor: 'renegociacao', rotulo: 'Renegociação' },
  { valor: 'mudanca_quantidade', rotulo: 'Mudança de quantidade' },
  { valor: 'outro', rotulo: 'Outro' },
];

export const MOTIVO_REAJUSTE_ROTULO: Record<MotivoReajuste, string> = Object.fromEntries(
  MOTIVOS_REAJUSTE.map((m) => [m.valor, m.rotulo]),
) as Record<MotivoReajuste, string>;

export const NATUREZAS: { valor: NaturezaGasto; rotulo: string; dica: string }[] = [
  { valor: 'opex', rotulo: 'OPEX', dica: 'Custeio: assinaturas, serviços, consumo' },
  { valor: 'capex', rotulo: 'CAPEX', dica: 'Investimento: equipamento ou licença comprada' },
];

export const NATUREZA_ROTULO: Record<NaturezaGasto, string> = {
  opex: 'OPEX',
  capex: 'CAPEX',
};

export const RECORRENCIAS: { valor: Recorrencia; rotulo: string }[] = [
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'bimestral', rotulo: 'Bimestral' },
  { valor: 'trimestral', rotulo: 'Trimestral' },
  { valor: 'semestral', rotulo: 'Semestral' },
  { valor: 'anual', rotulo: 'Anual' },
  { valor: 'unica', rotulo: 'Única' },
];

export const RECORRENCIA_ROTULO: Record<Recorrencia, string> = Object.fromEntries(
  RECORRENCIAS.map((r) => [r.valor, r.rotulo]),
) as Record<Recorrencia, string>;

/** Lista própria da TI (D7) — a de payment_requests (Caju, Solides, Dinheiro) não serve aqui. */
export const FORMAS_PAGAMENTO: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: 'cartao_corporativo', rotulo: 'Cartão corporativo' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'pix', rotulo: 'PIX' },
  { valor: 'debito_automatico', rotulo: 'Débito automático' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'outro', rotulo: 'Outro' },
];

export const FORMA_PAGAMENTO_ROTULO: Record<FormaPagamento, string> = Object.fromEntries(
  FORMAS_PAGAMENTO.map((f) => [f.valor, f.rotulo]),
) as Record<FormaPagamento, string>;

export const TIPOS_VALOR: { valor: TipoValor; rotulo: string; dica: string }[] = [
  { valor: 'fixo', rotulo: 'Fixo', dica: 'O valor contratado, igual todo mês' },
  { valor: 'variavel', rotulo: 'Variável', dica: 'Estimativa: o real entra mês a mês (cloud, consumo de IA)' },
];

export const TIPO_VALOR_ROTULO: Record<TipoValor, string> = { fixo: 'Fixo', variavel: 'Variável' };

export const SITUACAO_DESPESA: Record<SituacaoDespesa, { rotulo: string; classe: string }> = {
  ativa: {
    rotulo: 'Ativa',
    classe: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  },
  futura: {
    rotulo: 'Futura',
    classe: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  },
  encerrada: {
    rotulo: 'Encerrada',
    classe: 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400',
  },
};
