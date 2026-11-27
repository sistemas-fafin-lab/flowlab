// Parâmetros da regra do Valor colaborador (Tabela Colaborador). Ver
// .scratch/tabela-colaborador/spec.md → "Parâmetros da regra". Gravados na
// linha única de public.custo_tabela_colaborador_parametros e editados na aba
// "Tabela Colaborador" do Controle de Custos.
//
// Sem import nenhum: a lista do modo colaborador (servidor, api/_lib) vai usar
// este módulo para a regra de preço.

export type ParametrosTabelaColaborador = {
  /** % (hoje 48). */
  parcelaA: number;
  /** % (hoje 2,5). */
  parcelaB: number;
  /** Fração do preço Particular (hoje 0,9). */
  limitePoucaVantagem: number;
};

/** fator = (100 − parcela A − parcela B) / 100. Valor colaborador = custo ÷ fator. */
export function fatorTabelaColaborador(
  parcelas: Pick<ParametrosTabelaColaborador, 'parcelaA' | 'parcelaB'>,
): number {
  return (100 - parcelas.parcelaA - parcelas.parcelaB) / 100;
}

/** O que a aba do Controle de Custos edita: os parâmetros e os rótulos das parcelas. */
export type ConfiguracaoTabelaColaborador = ParametrosTabelaColaborador & {
  rotuloParcelaA: string;
  rotuloParcelaB: string;
};

export type CampoParametros =
  | 'parcelaA'
  | 'parcelaB'
  | 'fator'
  | 'limitePoucaVantagem'
  | 'rotuloParcelaA'
  | 'rotuloParcelaB';

/** Mensagem por campo; vazio = pode salvar. Mesmas regras dos CHECK do banco. */
export type ErrosParametros = Partial<Record<CampoParametros, string>>;

export function validarParametrosTabelaColaborador(
  config: ConfiguracaoTabelaColaborador,
): ErrosParametros {
  const erros: ErrosParametros = {};
  for (const campo of ['parcelaA', 'parcelaB'] as const) {
    if (!(Number.isFinite(config[campo]) && config[campo] >= 0)) {
      erros[campo] = 'Informe um percentual maior ou igual a zero.';
    }
  }
  if (!erros.parcelaA && !erros.parcelaB && config.parcelaA + config.parcelaB >= 100) {
    erros.fator = 'As parcelas precisam somar menos de 100% (fator maior que zero).';
  }
  // 0% mandaria todo exame com preço Particular para "consultar a gestão".
  const limite = config.limitePoucaVantagem;
  if (!(limite > 0 && limite <= 1)) {
    erros.limitePoucaVantagem = 'Informe um limite maior que 0% e até 100%.';
  }
  for (const campo of ['rotuloParcelaA', 'rotuloParcelaB'] as const) {
    if (!config[campo].trim()) erros[campo] = 'Informe o nome da parcela.';
  }
  return erros;
}
