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

// ── Regra do Valor colaborador ──────────────────────────────────────────────────
// Ver .scratch/tabela-colaborador/spec.md → "Regra de preço". As contas são feitas
// em frações exatas (BigInt), não em ponto flutuante: 1,01 ÷ 0,4 dá 2,5249999… em
// float e sairia 2,52 em vez de 2,53.

export type MotivoSemValorColaborador = 'sem_custo' | 'custo_maior_ou_igual_particular' | 'pouca_vantagem';

export type PrecoColaborador =
  | { disponivel: true; valor: number }
  | { disponivel: false; motivo: MotivoSemValorColaborador };

/** Um número decimal como fração exata num/den (den = 10^casas). */
interface Fracao {
  num: bigint;
  den: bigint;
}

function fracao(n: number): Fracao {
  // toString dá a representação decimal mais curta que volta ao mesmo número
  // (0.495, 9.73); notação científica só aparece em valores que não ocorrem aqui.
  const texto = Math.abs(n) < 1e-6 || Math.abs(n) >= 1e21 ? n.toFixed(12) : String(n);
  const negativo = texto.startsWith('-');
  const [inteira, decimais = ''] = texto.replace('-', '').split('.');
  const num = BigInt(inteira + decimais) * (negativo ? -1n : 1n);
  return { num, den: 10n ** BigInt(decimais.length) };
}

/** Centavos de um valor em reais com até 2 casas (custo e preço vêm de NUMERIC(12,2)). */
const centavos = (reais: number): bigint => BigInt(Math.round(reais * 100));

/**
 * Valor colaborador de um exame: custo ÷ fator, arredondado em centavos (meio para
 * cima). Sem valor ("consultar a gestão"), na ordem da planilha: sem custo (ausente
 * ou zero) → custo ≥ particular → pouca vantagem (valor ÷ particular ≥ limite).
 * Sem preço Particular, as duas checagens com o particular são puladas.
 */
export function precoColaborador(
  exame: { custo: number | null | undefined; precoParticular: number | null | undefined },
  parametros: ParametrosTabelaColaborador,
): PrecoColaborador {
  const { custo, precoParticular } = exame;
  if (custo == null || !(custo > 0)) return { disponivel: false, motivo: 'sem_custo' };
  const custoCentavos = centavos(custo);
  const particularCentavos = precoParticular == null ? null : centavos(precoParticular);
  if (particularCentavos !== null && custoCentavos >= particularCentavos) {
    return { disponivel: false, motivo: 'custo_maior_ou_igual_particular' };
  }

  // valor = custo ÷ ((100 − A − B) / 100) = custo × 100 ÷ (100 − A − B)
  const a = fracao(parametros.parcelaA);
  const b = fracao(parametros.parcelaB);
  const den = a.den * b.den; // 100 − A − B = (100·den − A·b.den − B·a.den) / den
  const divisor = 100n * den - a.num * b.den - b.num * a.den;
  const numerador = custoCentavos * 100n * den;
  // Meio para cima: ⌊(2n + d) / 2d⌋, com n e d positivos.
  const valorCentavos = (2n * numerador + divisor) / (2n * divisor);

  if (particularCentavos !== null) {
    // valor ÷ particular ≥ limite  ⇔  valor × limite.den ≥ limite.num × particular
    const limite = fracao(parametros.limitePoucaVantagem);
    if (valorCentavos * limite.den >= limite.num * particularCentavos) {
      return { disponivel: false, motivo: 'pouca_vantagem' };
    }
  }
  return { disponivel: true, valor: Number(valorCentavos) / 100 };
}
