// api/_lib/rh/holeritesParsing.ts
// Lógica pura (sem I/O) do auto-split de holerites (issue 05): normalização de CPF,
// extração de CPF e competência ("Ref.: Mês/Ano") do texto de uma página, e
// agrupamento de páginas consecutivas que compartilham o mesmo CPF em blocos.
//
// Separado de holeritesPdf.ts (que faz I/O real: pdf-parse/pdf-lib) para ser
// testável sem depender de um PDF de verdade — a mesma função de agrupamento é
// reutilizada tanto pela pré-visualização (rh-holerites-preview) quanto pela
// confirmação (rh-holerites-confirmar), que reprocessa o PDF do zero em vez de
// confiar em blocos vindos do cliente (ver cabeçalho dos handlers).

/** Remove tudo que não for dígito. Espelha src/utils/cpf.ts (duplicado de propósito — módulos api/ e src/ não compartilham build). */
export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Dígito verificador (módulo 11) — mesmo cálculo de cpf_valido() na migration 20260914150000. */
export function cpfValido(valor: string): boolean {
  const cpf = normalizarCpf(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcularDigito = (tamanho: number): number => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(cpf[i]) * (tamanho + 1 - i);
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return calcularDigito(9) === Number(cpf[9]) && calcularDigito(10) === Number(cpf[10]);
}

const PADRAO_CPF = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/;
const PADRAO_CPF_ROTULADO = new RegExp(`CPF\\s*[:\\-]?\\s*${PADRAO_CPF.source}`, 'i');

/**
 * Extrai o CPF de uma página. Tenta primeiro o padrão rotulado ("CPF: 000.000.000-00"),
 * mais confiável; cai para qualquer substring no formato de CPF que seja válida pelo
 * dígito verificador, para tolerar variação de layout entre folhas de pagamento.
 * Retorna null quando nada legível/válido é encontrado (página cai em "sem CPF legível").
 */
export function extrairCpfDaPagina(texto: string): string | null {
  const rotulado = texto.match(PADRAO_CPF_ROTULADO);
  if (rotulado && cpfValido(rotulado[1])) {
    return normalizarCpf(rotulado[1]);
  }

  const candidatos = texto.match(new RegExp(PADRAO_CPF.source, 'g')) ?? [];
  for (const candidato of candidatos) {
    if (cpfValido(candidato)) return normalizarCpf(candidato);
  }
  return null;
}

const MESES_PT: Record<string, number> = {
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  marco: 3, março: 3, mar: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
};

const PADRAO_REF = /Ref\.?\s*:?\s*([A-Za-zçÇÃã]+|\d{1,2})\s*[/-]\s*(\d{2,4})/i;

const removerAcentos = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Extrai a competência ("Ref.: Agosto/2026" ou "Ref.: 08/2026") como
 * "YYYY-MM-01" (dia 1, formato da coluna `competencia`). Retorna null quando a
 * página não traz um "Ref." legível — o bloco correspondente fica sem
 * competência detectada (ver rh-holerites-preview/confirmar).
 */
export function extrairCompetenciaDaPagina(texto: string): string | null {
  const match = texto.match(PADRAO_REF);
  if (!match) return null;

  const [, mesBruto, anoBruto] = match;
  let mes: number;
  if (/^\d+$/.test(mesBruto)) {
    mes = Number(mesBruto);
  } else {
    mes = MESES_PT[removerAcentos(mesBruto.toLowerCase())] ?? 0;
  }
  if (mes < 1 || mes > 12) return null;

  let ano = Number(anoBruto);
  if (anoBruto.length === 2) ano += 2000;
  if (ano < 2000 || ano > 2100) return null;

  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

export interface PaginaExtraida {
  /** 1-based, ordem original no PDF consolidado. */
  numero: number;
  cpf: string | null;
  competencia: string | null;
}

export interface BlocoPaginas {
  cpf: string;
  /** Primeira competência detectada entre as páginas do bloco (null se nenhuma página trouxe "Ref." legível). */
  competencia: string | null;
  paginaInicio: number;
  paginaFim: number;
}

export interface PaginaSemCpf {
  numero: number;
}

export interface AgrupamentoPaginas {
  blocos: BlocoPaginas[];
  paginasSemCpf: PaginaSemCpf[];
}

/**
 * Agrupa páginas consecutivas que compartilham o mesmo CPF em blocos — um bloco
 * por colaborador, sem assumir número fixo de páginas (spec: "não é garantido
 * pra todo caso real"). Páginas sem CPF legível NÃO se juntam aos blocos
 * vizinhos — ficam reportadas à parte, para tratamento manual.
 */
export function agruparPaginasPorCpf(paginas: PaginaExtraida[]): AgrupamentoPaginas {
  const blocos: BlocoPaginas[] = [];
  const paginasSemCpf: PaginaSemCpf[] = [];

  let blocoAtual: BlocoPaginas | null = null;

  for (const pagina of paginas) {
    if (!pagina.cpf) {
      blocoAtual = null;
      paginasSemCpf.push({ numero: pagina.numero });
      continue;
    }

    if (blocoAtual && blocoAtual.cpf === pagina.cpf) {
      blocoAtual.paginaFim = pagina.numero;
      if (!blocoAtual.competencia && pagina.competencia) {
        blocoAtual.competencia = pagina.competencia;
      }
      continue;
    }

    blocoAtual = {
      cpf: pagina.cpf,
      competencia: pagina.competencia,
      paginaInicio: pagina.numero,
      paginaFim: pagina.numero,
    };
    blocos.push(blocoAtual);
  }

  return { blocos, paginasSemCpf };
}
