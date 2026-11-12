// Aba Contas a Receber → Comparativos: períodos de 3 meses e volume de envio por convênio.
// Funções puras, compartilhadas pela rota (api/) e pela tela, como permissoesTelas.ts —
// por isso não importam nada do navegador.

/** Cores dos meses nos gráficos da aba: referência em destaque, M-1 e M-2 mais claros. */
export const CORES_MESES = ['#2563eb', '#60a5fa', '#bfdbfe'];

export interface PeriodoComparativo {
  /** 'YYYY-MM' */
  mes: string;
  /** Primeiro dia, 'YYYY-MM-DD' */
  desde: string;
  /** Último dia, 'YYYY-MM-DD' */
  ate: string;
}

const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Número com 2 dígitos ('03'). */
const dois = (n: number) => String(n).padStart(2, '0');

/** Ano e mês (1–12) de um 'YYYY-MM' válido; `null` caso contrário. */
export function anoEMes(mesReferencia: string): { ano: number; mes: number } | null {
  const m = MES_RE.exec(mesReferencia);
  return m ? { ano: Number(m[1]), mes: Number(m[2]) } : null;
}

/** O período de um mês. `mes` fora de 1–12 é normalizado (0 = dezembro do ano anterior). */
export function periodoDoMes(ano: number, mes: number): PeriodoComparativo {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const ultimoDia = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0)).getUTCDate();
  const prefixo = `${inicio.getUTCFullYear()}-${dois(inicio.getUTCMonth() + 1)}`;
  return { mes: prefixo, desde: `${prefixo}-01`, ate: `${prefixo}-${dois(ultimoDia)}` };
}

/** Referência, M-1 e M-2 (nessa ordem). `null` se `mesReferencia` não for 'YYYY-MM' válido. */
export function periodosComparativos(mesReferencia: string): PeriodoComparativo[] | null {
  const ref = anoEMes(mesReferencia);
  if (!ref) return null;
  // periodoDoMes normaliza meses negativos (janeiro - 1 = dezembro do ano anterior).
  return [0, 1, 2].map((atras) => periodoDoMes(ref.ano, ref.mes - atras));
}

/** Os `quantidade` últimos meses fechados ('YYYY-MM'), do mais recente ao mais antigo. */
export function mesesFechados(quantidade: number, hoje: Date = new Date()): string[] {
  return Array.from({ length: quantidade }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1 - i, 1);
    return `${d.getFullYear()}-${dois(d.getMonth() + 1)}`;
  });
}

/** Padrão do seletor: o último mês fechado (o mês anterior ao de `hoje`). */
export function mesDeReferenciaPadrao(hoje: Date = new Date()): string {
  return mesesFechados(1, hoje)[0];
}

/** Lotes e guias de um convênio em um mês, como a consulta devolve. */
export interface EnvioMensalConvenio {
  mes: string;
  fontePagadoraId: number | null;
  nome: string | null;
  qtdLotes: number;
  qtdGuias: number;
}

export interface VolumeEnvioConvenio {
  fontePagadoraId: number | null;
  nome: string | null;
  /** Um item por período, na ordem de `periodos` (referência, M-1, M-2). */
  meses: { mes: string; qtdLotes: number; qtdGuias: number }[];
}

/**
 * Uma linha por convênio com o volume nos 3 meses. Mês sem envio vira zero; linhas de
 * meses fora dos períodos são ignoradas; ordena pelo total de guias (maior primeiro) e,
 * no empate, pelo nome.
 */
export function montarVolumeEnvio(
  periodos: PeriodoComparativo[],
  linhas: EnvioMensalConvenio[],
): VolumeEnvioConvenio[] {
  const validos = new Set(periodos.map((p) => p.mes));
  const porConvenio = new Map<string, VolumeEnvioConvenio>();

  for (const linha of linhas) {
    if (!validos.has(linha.mes)) continue;
    const chave = linha.fontePagadoraId === null ? `sem-id|${linha.nome ?? ''}` : String(linha.fontePagadoraId);
    let convenio = porConvenio.get(chave);
    if (!convenio) {
      convenio = {
        fontePagadoraId: linha.fontePagadoraId,
        nome: linha.nome,
        meses: periodos.map((p) => ({ mes: p.mes, qtdLotes: 0, qtdGuias: 0 })),
      };
      porConvenio.set(chave, convenio);
    }
    const alvo = convenio.meses.find((m) => m.mes === linha.mes);
    if (alvo) {
      alvo.qtdLotes += linha.qtdLotes;
      alvo.qtdGuias += linha.qtdGuias;
    }
  }

  const totalGuias = (v: VolumeEnvioConvenio) => v.meses.reduce((soma, m) => soma + m.qtdGuias, 0);
  return [...porConvenio.values()].sort(
    (a, b) => totalGuias(b) - totalGuias(a) || (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'),
  );
}
