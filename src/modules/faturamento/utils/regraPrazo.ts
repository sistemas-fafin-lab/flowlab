// Regras de prazo por convênio da tela Glosas e Recursos
// (.scratch/glosas-recursos-dashboard/spec.md, tabela glosa_prazo_regras):
// descrição e validação de uma regra no cadastro. O cálculo da data a partir
// da regra é do servidor (api/_lib/faturamento/recursoGlosa.ts).

export type TipoRegraPrazo =
  | 'dias_corridos'
  | 'dias_uteis'
  | 'dia_mes_seguinte'
  | 'dia_util_mes_seguinte'
  | 'ultimo_dia_mes_seguinte'
  | 'sem_prazo';

export interface RegraPrazo {
  tipo: TipoRegraPrazo;
  /** N dos tipos que contam: dias, dia do mês ou N-ésimo dia útil. null nos outros. */
  n: number | null;
}

export function descreverRegraPrazo(regra: RegraPrazo): string {
  const n = regra.n ?? 0;
  switch (regra.tipo) {
    case 'dias_corridos':
      return n === 1 ? '1 dia corrido' : `${n} dias corridos`;
    case 'dias_uteis':
      return n === 1 ? '1 dia útil' : `${n} dias úteis`;
    case 'dia_mes_seguinte':
      return `Dia ${n} do mês seguinte`;
    case 'dia_util_mes_seguinte':
      return `${n}º dia útil do mês seguinte`;
    case 'ultimo_dia_mes_seguinte':
      return 'Último dia do mês seguinte';
    case 'sem_prazo':
      return 'Sem prazo';
  }
}

/** Tipos cujo prazo depende de N. */
export const TIPOS_COM_N: TipoRegraPrazo[] = ['dias_corridos', 'dias_uteis', 'dia_mes_seguinte', 'dia_util_mes_seguinte'];

/** Teto de N por tipo: um mês tem no máximo 31 dias e 23 dias úteis. */
const MAXIMO_N: Partial<Record<TipoRegraPrazo, number>> = {
  dia_mes_seguinte: 31,
  dia_util_mes_seguinte: 23,
};

/** Regra a partir do que foi digitado no cadastro. */
export function lerRegraPrazo(tipo: TipoRegraPrazo, nBruto: string): { regra: RegraPrazo } | { erro: string } {
  if (!TIPOS_COM_N.includes(tipo)) return { regra: { tipo, n: null } };
  const texto = nBruto.trim();
  const n = Number(texto);
  if (!/^\d+$/.test(texto) || n < 1) return { erro: 'Informe um número inteiro maior que zero.' };
  const maximo = MAXIMO_N[tipo];
  if (maximo !== undefined && n > maximo) return { erro: `O máximo para este tipo é ${maximo}.` };
  return { regra: { tipo, n } };
}

/** As quatro regras de cada convênio, na ordem da planilha. */
export type ChaveRegraPrazo = 'pagamentoFatura' | 'glosaRecurso' | 'glosaAnalise' | 'glosaPagamento';

export const REGRAS_PRAZO: { chave: ChaveRegraPrazo; label: string; usoNaTela: string }[] = [
  { chave: 'pagamentoFatura', label: 'Pagamento (fatura)', usoNaTela: 'Só cadastrada por enquanto' },
  { chave: 'glosaRecurso', label: 'Glosa – Recurso', usoNaTela: 'Prazo para recorrer, contado do recebimento da requisição' },
  { chave: 'glosaAnalise', label: 'Glosa – Análise', usoNaTela: 'Data de retorno, contada do envio do lote de recurso' },
  { chave: 'glosaPagamento', label: 'Glosa – Pagamento', usoNaTela: 'Data de pagamento, contada da data de retorno' },
];

export const TIPOS_REGRA_PRAZO: { tipo: TipoRegraPrazo; label: string }[] = [
  { tipo: 'dias_corridos', label: 'N dias corridos' },
  { tipo: 'dias_uteis', label: 'N dias úteis' },
  { tipo: 'dia_mes_seguinte', label: 'Dia N do mês seguinte' },
  { tipo: 'dia_util_mes_seguinte', label: 'N-ésimo dia útil do mês seguinte' },
  { tipo: 'ultimo_dia_mes_seguinte', label: 'Último dia do mês seguinte' },
  { tipo: 'sem_prazo', label: 'Sem prazo' },
];

export interface RegraPrazoCadastro extends RegraPrazo {
  /** O que o contrato diz, como veio da planilha: guia quem completa um "sem prazo". */
  texto: string | null;
}

export interface FontePagadoraRegra {
  /** `fatinstituicao.IdInstituicao`. */
  id: number;
  nome: string;
}

export interface RegrasPrazoConvenio {
  id: string;
  convenio: string;
  regras: Record<ChaveRegraPrazo, RegraPrazoCadastro>;
  fontes: FontePagadoraRegra[];
  atualizadoEm: string;
}
