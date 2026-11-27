// Vencimentos de licenças, contratos, domínios e certificados (D49, issue 36). Puro: a api/
// (NodeNext) importa, com ".js".
//
// A fonte é o módulo de Gastos de TI (decisão do usuário, 24/Nov): o término é a última competência
// da despesa (competencia_fim), e cada despesa já diz se renova sozinha e com quanta antecedência
// avisar (aviso_renovacao_dias). A regra do término é a mesma de gastos-ti/domain/alertas.ts
// (terminoDaDespesa), reescrita aqui porque aquele domínio não roda na api/.
// Sem valores: o alerta pelo WhatsApp diz o que vence e quando; o quanto fica no Gastos de TI.
import { diferencaDias, formatarDiaMes, type Dia } from './datas.js';

/** O recorte de ti_despesas que a EVA lê. */
export interface DespesaVencimento {
  id: string;
  descricao: string;
  fornecedor_nome: string;
  recorrencia: 'unica' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
  /** Última competência ('YYYY-MM-01'), ou null sem prazo. */
  competencia_fim: string | null;
  renovacao_automatica: boolean;
  aviso_renovacao_dias: number;
  responsavel_id: string | null;
}

/** O que as perguntas de gestão enxergam à frente. */
export const JANELA_VENCIMENTOS_DIAS = 90;
/** O segundo aviso, perto do fim (o primeiro é a antecedência da própria despesa). */
export const AVISO_FINAL_DIAS = 7;

export interface Vencimento {
  despesa: DespesaVencimento;
  /** Último dia da última competência. */
  termino: Dia;
  /** Dias corridos até o término (0 = hoje). */
  dias: number;
}

const ultimoDiaDoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/** O fim do contrato: o último dia da competência final. Sem fim, ou cobrança única, não há vencimento. */
export function terminoDe(d: DespesaVencimento): Dia | null {
  if (!d.competencia_fim || d.recorrencia === 'unica') return null;
  const [ano, mes] = d.competencia_fim.slice(0, 7).split('-').map(Number);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaDoMes(ano, mes)).padStart(2, '0')}`;
}

/** As despesas que terminam ou renovam de hoje até `janela` dias, da mais próxima para a mais distante. */
export function vencimentosAte(despesas: readonly DespesaVencimento[], hoje: Dia, janela = JANELA_VENCIMENTOS_DIAS): Vencimento[] {
  return despesas
    .flatMap((despesa) => {
      const termino = terminoDe(despesa);
      if (!termino) return [];
      const dias = diferencaDias(hoje, termino);
      return dias >= 0 && dias <= janela ? [{ despesa, termino, dias }] : [];
    })
    .sort((a, b) => a.dias - b.dias || a.despesa.descricao.localeCompare(b.despesa.descricao, 'pt-BR'));
}

/**
 * O aviso que cabe agora: a antecedência da despesa ou os 7 dias finais, o mais perto do fim que já
 * chegou. null = ainda é cedo (ou a despesa pediu 0 dias de aviso e o fim não está a 7 dias).
 * Cada marco sai uma vez: quem é avisado com 30 dias recebe de novo com 7.
 */
export function marcoDoAviso(v: Vencimento): number | null {
  const marcos = Array.from(new Set([v.despesa.aviso_renovacao_dias, AVISO_FINAL_DIAS].filter((m) => m > 0))).sort((a, b) => a - b);
  return marcos.find((m) => v.dias <= m) ?? null;
}

const quando = (dias: number) => (dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`);

/** O alerta pelo WhatsApp. */
export function textoDoVencimento(v: Vencimento, link: string): string {
  const { despesa: d } = v;
  const qual = `${d.descricao} (${d.fornecedor_nome})`;
  const corpo = d.renovacao_automatica
    ? `🔁 ${qual} renova sozinha ${quando(v.dias)}, em ${formatarDiaMes(v.termino)}. Se for renegociar ou cancelar, a hora é agora.`
    : `⏳ ${qual} termina ${quando(v.dias)}, em ${formatarDiaMes(v.termino)}, e não renova sozinha. Vale decidir se renova.`;
  return `${corpo}\n\nDetalhes em Gastos de TI: ${link}`;
}

/** A chave do alerta na fila: uma vez por pessoa, despesa, término e marco. */
export const chaveDoVencimento = (membroId: string, v: Vencimento, marco: number) => `vencimento:${membroId}:${v.despesa.id}:${v.termino}:${marco}`;

/** O bloco do contexto da IA, para "o que vence de licença?" (só para quem vê o Gastos de TI). */
export function montarBlocoVencimentos(vencimentos: Vencimento[]): string {
  return [
    `VENCIMENTOS DO GASTOS DE TI (licenças, contratos, domínios e certificados que terminam nos próximos ${JANELA_VENCIMENTOS_DIAS} dias)`,
    ...(vencimentos.length
      ? vencimentos.map((v) => `- ${v.despesa.descricao} (${v.despesa.fornecedor_nome}): ${v.despesa.renovacao_automatica ? 'renova sozinha' : 'termina, sem renovação automática'} em ${formatarDiaMes(v.termino)} (${quando(v.dias)})`)
      : ['- (nenhum)']),
  ].join('\n');
}
