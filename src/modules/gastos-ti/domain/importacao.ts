// Importação de despesas por planilha (RF15, plano §7.1). Tudo puro: recebe as
// linhas já lidas do Excel (objetos cabeçalho → célula) e o contexto do banco,
// devolve cada linha com a despesa pronta para gravar, erros e avisos.

import { competencia as montarCompetencia, MESES_ABREVIADOS } from './competencia';
import { chaveTexto } from './listaDespesas';
import { normalizarDespesa, validarDespesa, type ErrosDespesa } from './validacaoDespesa';
import { parseValorBR } from './valores';
import type { DespesaInput, FormaPagamento, NaturezaGasto, Recorrencia, TipoValor } from '../types';

export type CampoImportacao =
  | 'descricao'
  | 'categoria'
  | 'fornecedor'
  | 'cnpj'
  | 'valor'
  | 'tipoValor'
  | 'recorrencia'
  | 'inicio'
  | 'fim'
  | 'diaVencimento'
  | 'formaPagamento'
  | 'meioPagamento'
  | 'autorizadoPor'
  | 'autorizadoEm'
  | 'setor'
  | 'natureza'
  | 'quantidade'
  | 'unidade'
  | 'contrato'
  | 'renovacaoAutomatica'
  | 'avisoRenovacao'
  | 'moedaOriginal'
  | 'valorOriginal'
  | 'observacoes';

export interface ColunaModelo {
  campo: CampoImportacao;
  cabecalho: string;
  obrigatoria: boolean;
  formato: string;
  seVazia: string;
}

/** As 24 colunas da aba Despesas, na ordem do modelo (§7.1). */
export const COLUNAS_MODELO: ColunaModelo[] = [
  { campo: 'descricao', cabecalho: 'Descrição', obrigatoria: true, formato: 'Texto', seVazia: 'erro' },
  { campo: 'categoria', cabecalho: 'Categoria', obrigatoria: true, formato: 'Nome de uma categoria (aba Listas)', seVazia: 'erro' },
  { campo: 'fornecedor', cabecalho: 'Fornecedor', obrigatoria: true, formato: 'Texto', seVazia: 'erro' },
  { campo: 'cnpj', cabecalho: 'CNPJ do fornecedor', obrigatoria: false, formato: '14 dígitos, com ou sem pontuação', seVazia: 'casa só pelo nome' },
  { campo: 'valor', cabecalho: 'Valor', obrigatoria: true, formato: '2480 / 2480,00 / 2.480,00', seVazia: 'erro' },
  { campo: 'tipoValor', cabecalho: 'Tipo de valor', obrigatoria: false, formato: 'Fixo / Variável', seVazia: 'Fixo' },
  { campo: 'recorrencia', cabecalho: 'Recorrência', obrigatoria: true, formato: 'Única, Mensal, Bimestral, Trimestral, Semestral, Anual', seVazia: 'erro' },
  { campo: 'inicio', cabecalho: 'Início', obrigatoria: true, formato: '10/2026, out/2026 ou uma data (vale o mês)', seVazia: 'erro' },
  { campo: 'fim', cabecalho: 'Fim', obrigatoria: false, formato: 'Mesmo formato do Início; ignorado na recorrência Única', seVazia: 'sem fim' },
  { campo: 'diaVencimento', cabecalho: 'Dia de vencimento', obrigatoria: true, formato: '1 a 31', seVazia: 'erro' },
  { campo: 'formaPagamento', cabecalho: 'Forma de pagamento', obrigatoria: true, formato: 'PIX, Boleto, Cartão corporativo, Débito automático, Transferência, Outro', seVazia: 'erro' },
  { campo: 'meioPagamento', cabecalho: 'Detalhe do pagamento', obrigatoria: false, formato: 'Texto (ex.: cartão final 1234)', seVazia: '—' },
  { campo: 'autorizadoPor', cabecalho: 'Autorizado por', obrigatoria: true, formato: 'Texto', seVazia: 'erro' },
  { campo: 'autorizadoEm', cabecalho: 'Data da autorização', obrigatoria: false, formato: 'Data (dd/mm/aaaa)', seVazia: '—' },
  { campo: 'setor', cabecalho: 'Setor', obrigatoria: false, formato: 'Um setor da aba Listas', seVazia: '—' },
  { campo: 'natureza', cabecalho: 'Natureza', obrigatoria: false, formato: 'OPEX / CAPEX', seVazia: 'natureza padrão da categoria' },
  { campo: 'quantidade', cabecalho: 'Quantidade', obrigatoria: false, formato: 'Inteiro maior que zero', seVazia: '—' },
  { campo: 'unidade', cabecalho: 'Unidade', obrigatoria: false, formato: 'Texto (licença, usuário, GB…)', seVazia: '—' },
  { campo: 'contrato', cabecalho: 'Nº do contrato', obrigatoria: false, formato: 'Texto', seVazia: '—' },
  { campo: 'renovacaoAutomatica', cabecalho: 'Renovação automática', obrigatoria: false, formato: 'Sim / Não', seVazia: 'Não' },
  { campo: 'avisoRenovacao', cabecalho: 'Aviso de renovação (dias)', obrigatoria: false, formato: 'Inteiro de 0 a 365', seVazia: '30' },
  { campo: 'moedaOriginal', cabecalho: 'Moeda original', obrigatoria: false, formato: 'USD, EUR…', seVazia: '—' },
  { campo: 'valorOriginal', cabecalho: 'Valor original', obrigatoria: false, formato: 'Número', seVazia: '—' },
  { campo: 'observacoes', cabecalho: 'Observações', obrigatoria: false, formato: 'Texto', seVazia: '—' },
];

const ROTULO_DO_CAMPO = Object.fromEntries(COLUNAS_MODELO.map((c) => [c.campo, c.cabecalho])) as Record<CampoImportacao, string>;

/** Cabeçalho comparável: sem acento, minúsculo, sem "*" e sem espaços repetidos. */
export const normalizarCabecalho = (cabecalho: string): string => chaveTexto(cabecalho.replace(/\*/g, ''));

/**
 * Casa os cabeçalhos da planilha com as colunas do modelo. Devolve, para cada
 * campo encontrado, o cabeçalho original (para ler a célula) e os cabeçalhos
 * obrigatórios que faltam.
 */
export function mapearCabecalhos(cabecalhos: readonly string[]): { mapa: Map<CampoImportacao, string>; faltando: string[] } {
  const porNome = new Map(cabecalhos.map((c) => [normalizarCabecalho(c), c]));
  const mapa = new Map<CampoImportacao, string>();
  for (const coluna of COLUNAS_MODELO) {
    const original = porNome.get(normalizarCabecalho(coluna.cabecalho));
    if (original !== undefined) mapa.set(coluna.campo, original);
  }
  const faltando = COLUNAS_MODELO.filter((c) => c.obrigatoria && !mapa.has(c.campo)).map((c) => c.cabecalho);
  return { mapa, faltando };
}

// ─── Leitura de células ───────────────────────────────────────────────────────

const texto = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/** Data serial do Excel (dias desde 30/12/1899) → 'YYYY-MM-DD'. */
export function dataDoSerialExcel(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Data em 'dd/mm/aaaa', 'aaaa-mm-dd' ou serial do Excel → 'YYYY-MM-DD'; null se não for data. */
export function lerData(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return dataDoSerialExcel(v);
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const t = texto(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

const MESES_POR_EXTENSO = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * Competência ('YYYY-MM-01') a partir de "10/2026", "10-2026", "out/2026",
 * "outubro/2026", uma data ou um serial do Excel (vale o mês da data).
 */
export function lerCompetencia(v: unknown): string | null {
  const t = chaveTexto(texto(v));
  let m = /^(\d{1,2})[/-](\d{4})$/.exec(t);
  if (m) {
    const mes = Number(m[1]);
    return mes >= 1 && mes <= 12 ? montarCompetencia(Number(m[2]), mes) : null;
  }
  m = /^([a-z]+)[/\s-]+(?:de\s+)?(\d{4})$/.exec(t);
  if (m) {
    const abreviado = (MESES_ABREVIADOS as readonly string[]).indexOf(m[1]);
    const indice = abreviado >= 0 ? abreviado : MESES_POR_EXTENSO.indexOf(m[1]);
    return indice >= 0 ? montarCompetencia(Number(m[2]), indice + 1) : null;
  }
  const data = lerData(v);
  return data ? `${data.slice(0, 7)}-01` : null;
}

const RECORRENCIAS: Record<string, Recorrencia> = {
  unica: 'unica', mensal: 'mensal', bimestral: 'bimestral', trimestral: 'trimestral', semestral: 'semestral', anual: 'anual',
};
const FORMAS: Record<string, FormaPagamento> = {
  pix: 'pix',
  boleto: 'boleto',
  'cartao corporativo': 'cartao_corporativo',
  cartao: 'cartao_corporativo',
  'cartao de credito': 'cartao_corporativo',
  'debito automatico': 'debito_automatico',
  transferencia: 'transferencia',
  ted: 'transferencia',
  outro: 'outro',
};
const TIPOS: Record<string, TipoValor> = { fixo: 'fixo', variavel: 'variavel' };
const NATUREZAS: Record<string, NaturezaGasto> = { opex: 'opex', capex: 'capex' };
const SIM = new Set(['sim', 's', 'yes', 'true', '1', 'x']);
const NAO = new Set(['nao', 'n', 'no', 'false', '0']);

function lerInteiro(v: unknown): number | null | 'invalido' {
  if (texto(v) === '') return null;
  const n = typeof v === 'number' ? v : Number(texto(v).replace(',', '.'));
  return Number.isInteger(n) ? n : 'invalido';
}

// ─── Análise ──────────────────────────────────────────────────────────────────

export interface ContextoImportacao {
  /** 'YYYY-MM-DD' */
  hoje: string;
  categorias: readonly { id: string; nome: string; ativo: boolean; naturezaPadrao: NaturezaGasto }[];
  fornecedores: readonly { id: string; nome: string; cnpj: string | null }[];
  despesasExistentes: readonly { descricao: string; fornecedorNome: string; competenciaInicio: string }[];
  setores: readonly string[];
}

export interface LinhaImportada {
  /** Número da linha na planilha (o cabeçalho é a 1). */
  numero: number;
  /** null quando a linha tem erro. Categoria nova vem com categoriaId = PREFIXO_CATEGORIA_NOVA + chave. */
  despesa: DespesaInput | null;
  /** Nome da categoria que ainda não existe e seria criada (quando permitido). */
  categoriaNova: string | null;
  erros: string[];
  avisos: string[];
  /** Parece já cadastrada (mesma descrição, fornecedor e início): vem desmarcada. */
  jaExiste: boolean;
  resumo: { descricao: string; categoria: string; valor: number | null; recorrencia: string; inicio: string | null };
}

export const PREFIXO_CATEGORIA_NOVA = 'nova:';

const chaveDuplicidade = (descricao: string, fornecedor: string, inicio: string | null) =>
  `${chaveTexto(descricao)}|${chaveTexto(fornecedor)}|${inicio ?? ''}`;

/** Mensagens de validarDespesa com o nome da coluna da planilha na frente. */
const ROTULO_DO_ERRO: Partial<Record<keyof ErrosDespesa, CampoImportacao>> = {
  descricao: 'descricao',
  categoriaId: 'categoria',
  fornecedorNome: 'fornecedor',
  valorBase: 'valor',
  competenciaInicio: 'inicio',
  competenciaFim: 'fim',
  diaVencimento: 'diaVencimento',
  autorizadoPor: 'autorizadoPor',
  autorizadoEm: 'autorizadoEm',
  quantidade: 'quantidade',
  moedaOriginal: 'moedaOriginal',
  valorOriginal: 'valorOriginal',
  avisoRenovacaoDias: 'avisoRenovacao',
};

/**
 * Analisa as linhas da aba Despesas. Linhas totalmente vazias são ignoradas.
 * Uma linha com erro não impede as outras (vira `despesa: null`).
 */
export function analisarPlanilha(
  linhas: readonly Record<string, unknown>[],
  mapa: ReadonlyMap<CampoImportacao, string>,
  contexto: ContextoImportacao,
  opcoes: { criarCategorias: boolean },
): LinhaImportada[] {
  const categoriaPorChave = new Map(contexto.categorias.map((c) => [chaveTexto(c.nome), c]));
  const fornecedorPorCnpj = new Map(
    contexto.fornecedores.filter((f) => f.cnpj).map((f) => [String(f.cnpj).replace(/\D/g, ''), f]),
  );
  const fornecedorPorNome = new Map(contexto.fornecedores.map((f) => [chaveTexto(f.nome), f]));
  const setorPorChave = new Map(contexto.setores.map((s) => [chaveTexto(s), s]));
  const existentes = new Set(contexto.despesasExistentes.map((d) => chaveDuplicidade(d.descricao, d.fornecedorNome, d.competenciaInicio)));
  const vistasNaPlanilha = new Map<string, number>();
  const resultado: LinhaImportada[] = [];

  linhas.forEach((linha, indice) => {
    const celula = (campo: CampoImportacao): unknown => {
      const cabecalho = mapa.get(campo);
      return cabecalho === undefined ? '' : linha[cabecalho];
    };
    if (COLUNAS_MODELO.every((c) => texto(celula(c.campo)) === '')) return;

    const numero = indice + 2;
    const erros: string[] = [];
    const avisos: string[] = [];
    const erroDe = (campo: CampoImportacao, msg: string) => erros.push(`${ROTULO_DO_CAMPO[campo]}: ${msg}`);

    // Enumerações: valor fora da lista é erro, vazio cai no padrão (ou no erro de obrigatório).
    const enumeracao = <T>(campo: CampoImportacao, mapaValores: Record<string, T>, padrao: T | null): T | null => {
      const t = texto(celula(campo));
      if (!t) return padrao;
      const valor = mapaValores[chaveTexto(t)];
      if (valor === undefined) {
        erroDe(campo, `"${t}" não reconhecido.`);
        return padrao;
      }
      return valor;
    };

    const recorrencia = enumeracao('recorrencia', RECORRENCIAS, null);
    if (!recorrencia && !texto(celula('recorrencia'))) erroDe('recorrencia', 'obrigatória.');
    const formaPagamento = enumeracao('formaPagamento', FORMAS, null);
    if (!formaPagamento && !texto(celula('formaPagamento'))) erroDe('formaPagamento', 'obrigatória.');
    const tipoValor = enumeracao('tipoValor', TIPOS, 'fixo') ?? 'fixo';

    // Categoria
    const nomeCategoria = texto(celula('categoria'));
    let categoriaId = '';
    let categoriaNova: string | null = null;
    let naturezaPadrao: NaturezaGasto = 'opex';
    if (nomeCategoria) {
      const categoria = categoriaPorChave.get(chaveTexto(nomeCategoria));
      if (categoria && categoria.ativo) {
        categoriaId = categoria.id;
        naturezaPadrao = categoria.naturezaPadrao;
      } else if (categoria) {
        erroDe('categoria', `"${categoria.nome}" está desativada. Reative-a ou use outra.`);
      } else if (opcoes.criarCategorias) {
        categoriaNova = nomeCategoria.replace(/\s+/g, ' ');
        categoriaId = `${PREFIXO_CATEGORIA_NOVA}${chaveTexto(nomeCategoria)}`;
      } else {
        erroDe('categoria', `"${nomeCategoria}" não existe.`);
      }
    }
    const natureza = enumeracao('natureza', NATUREZAS, naturezaPadrao) ?? naturezaPadrao;

    // Fornecedor: CNPJ primeiro, depois nome.
    const nomeFornecedor = texto(celula('fornecedor'));
    const documento = texto(celula('cnpj')).replace(/\D/g, '');
    const fornecedor = (documento && fornecedorPorCnpj.get(documento)) || fornecedorPorNome.get(chaveTexto(nomeFornecedor)) || null;
    if (nomeFornecedor && !fornecedor) avisos.push('Fornecedor não cadastrado: a despesa guarda só o nome.');

    // Valores, datas e números
    const valorTexto = texto(celula('valor'));
    const valor = parseValorBR(celula('valor') as string | number);
    if (valorTexto && valor === null) erroDe('valor', `"${valorTexto}" não é um valor.`);

    const inicioTexto = texto(celula('inicio'));
    const inicio = inicioTexto ? lerCompetencia(celula('inicio')) : null;
    if (inicioTexto && !inicio) erroDe('inicio', `"${inicioTexto}" não é um mês (use 10/2026 ou out/2026).`);
    const fimTexto = texto(celula('fim'));
    let fim = fimTexto ? lerCompetencia(celula('fim')) : null;
    if (fimTexto && !fim) erroDe('fim', `"${fimTexto}" não é um mês.`);
    if (recorrencia === 'unica' && fim) {
      avisos.push('Fim ignorado: a recorrência é Única.');
      fim = null;
    }

    const dia = lerInteiro(celula('diaVencimento'));
    if (dia === 'invalido') erroDe('diaVencimento', 'use um número de 1 a 31.');
    const quantidade = lerInteiro(celula('quantidade'));
    if (quantidade === 'invalido') erroDe('quantidade', 'use um número inteiro.');
    const aviso = lerInteiro(celula('avisoRenovacao'));
    if (aviso === 'invalido') erroDe('avisoRenovacao', 'use um número inteiro de dias.');

    const autorizadoEmTexto = texto(celula('autorizadoEm'));
    const autorizadoEm = autorizadoEmTexto ? lerData(celula('autorizadoEm')) : null;
    if (autorizadoEmTexto && !autorizadoEm) erroDe('autorizadoEm', `"${autorizadoEmTexto}" não é uma data.`);

    const renovacaoTexto = chaveTexto(texto(celula('renovacaoAutomatica')));
    let renovacaoAutomatica = false;
    if (SIM.has(renovacaoTexto)) renovacaoAutomatica = true;
    else if (renovacaoTexto && !NAO.has(renovacaoTexto)) erroDe('renovacaoAutomatica', 'use Sim ou Não.');

    const setorTexto = texto(celula('setor'));
    const setor = setorTexto ? setorPorChave.get(chaveTexto(setorTexto)) ?? null : null;
    if (setorTexto && !setor) erroDe('setor', `"${setorTexto}" não é um setor da lista.`);

    const valorOriginalTexto = texto(celula('valorOriginal'));
    const valorOriginal = valorOriginalTexto ? parseValorBR(celula('valorOriginal') as string | number) : null;
    if (valorOriginalTexto && valorOriginal === null) erroDe('valorOriginal', `"${valorOriginalTexto}" não é um valor.`);

    const despesa = normalizarDespesa({
      descricao: texto(celula('descricao')),
      categoriaId,
      natureza,
      quantidade: quantidade === 'invalido' ? null : quantidade,
      unidade: texto(celula('unidade')),
      fornecedorId: fornecedor?.id ?? null,
      fornecedorNome: fornecedor?.nome ?? nomeFornecedor,
      setor,
      responsavelId: null,
      tipoValor,
      valorBase: valor,
      recorrencia: recorrencia ?? 'mensal',
      competenciaInicio: inicio,
      competenciaFim: fim,
      diaVencimento: dia === 'invalido' ? null : dia,
      formaPagamento: formaPagamento ?? 'outro',
      meioPagamentoDetalhe: texto(celula('meioPagamento')),
      moedaOriginal: texto(celula('moedaOriginal')),
      valorOriginal,
      numeroContrato: texto(celula('contrato')),
      renovacaoAutomatica,
      avisoRenovacaoDias: aviso === 'invalido' ? 30 : aviso ?? 30,
      autorizadoPor: texto(celula('autorizadoPor')),
      autorizadoEm,
      observacoes: texto(celula('observacoes')),
    });

    // Validação do cadastro (as mesmas regras do formulário), sem repetir o que já foi apontado acima.
    const jaApontados = new Set(erros.map((e) => e.split(':')[0]));
    for (const [campo, mensagem] of Object.entries(validarDespesa(despesa, contexto.hoje)) as [keyof ErrosDespesa, string][]) {
      const coluna = ROTULO_DO_ERRO[campo];
      const rotulo = coluna ? ROTULO_DO_CAMPO[coluna] : String(campo);
      if (!jaApontados.has(rotulo)) erros.push(`${rotulo}: ${mensagem}`);
    }

    const chave = chaveDuplicidade(despesa.descricao, despesa.fornecedorNome, despesa.competenciaInicio);
    const repetidaEm = vistasNaPlanilha.get(chave);
    if (repetidaEm !== undefined) avisos.push(`Repetida na planilha (linha ${repetidaEm}).`);
    else vistasNaPlanilha.set(chave, numero);
    const jaExiste = existentes.has(chave);
    if (jaExiste) avisos.push('Parece já estar cadastrada (mesma descrição, fornecedor e início).');

    resultado.push({
      numero,
      despesa: erros.length > 0 ? null : despesa,
      categoriaNova: erros.length > 0 ? null : categoriaNova,
      erros,
      avisos,
      jaExiste,
      resumo: {
        descricao: despesa.descricao,
        categoria: nomeCategoria,
        valor,
        recorrencia: texto(celula('recorrencia')),
        inicio,
      },
    });
  });

  return resultado;
}

/** Nomes distintos das categorias que a importação criaria (para a opção "Criar estas categorias"). */
export function categoriasDesconhecidas(
  linhas: readonly Record<string, unknown>[],
  mapa: ReadonlyMap<CampoImportacao, string>,
  categorias: readonly { nome: string }[],
): string[] {
  const conhecidas = new Set(categorias.map((c) => chaveTexto(c.nome)));
  const cabecalho = mapa.get('categoria');
  if (cabecalho === undefined) return [];
  const novas = new Map<string, string>();
  for (const linha of linhas) {
    const nome = texto(linha[cabecalho]).replace(/\s+/g, ' ');
    if (nome && !conhecidas.has(chaveTexto(nome)) && !novas.has(chaveTexto(nome))) novas.set(chaveTexto(nome), nome);
  }
  return [...novas.values()];
}
