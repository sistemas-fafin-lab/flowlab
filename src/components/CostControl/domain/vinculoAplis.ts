import type { Exam } from '../../../hooks/useCostControl';
import type { CobrancaAplis } from '../../../hooks/useCobrancasTestesAplis';

// ═══════════════════════════════════════════════════════════════════════════════
// Vínculo do exame do catálogo com cobrança/teste do apLIS
// (.scratch/controle-custos-vinculo-aplis-tuss/spec.md). O mesmo par não pode
// ficar em dois exames — o índice uq_custo_exames_vinculo_aplis garante no
// banco; aqui a tela descobre QUAL exame já tem o par, para a mensagem.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Outro exame (que não `idProprio`) já ligado a `cobranca` + `teste`. "Sem teste"
 * conta como um valor, igual ao índice do banco.
 */
export const exameComMesmoVinculoAplis = (
  exams: Exam[],
  idProprio: string | null,
  cobranca: number,
  teste: number | null
): Exam | null =>
  exams.find(
    e => e.id !== idProprio && e.aplisIdExameTipo === cobranca && (e.aplisIdTeste ?? null) === teste
  ) ?? null;

/** Nome da cobrança e do teste no apLIS; o id quando a lista não tem (ou não carregou). */
export const nomesVinculoAplis = (
  cobrancas: CobrancaAplis[],
  idCobranca: number | null,
  idTeste: number | null
): { cobranca: string; teste: string } => {
  const cobranca = cobrancas.find(c => c.id === idCobranca);
  const teste = cobranca?.testes.find(t => t.id === idTeste);
  return {
    cobranca: idCobranca == null ? '' : cobranca?.nome ?? `Cobrança #${idCobranca}`,
    teste: idTeste == null ? '' : teste?.nome ?? `Teste #${idTeste}`,
  };
};

/** "PCR · Genotipagem HPV 28 - PCR", ou só a cobrança quando o exame vale para ela sem teste. */
export const descricaoVinculoAplis = (cobrancas: CobrancaAplis[], exam: Exam): string => {
  const nomes = nomesVinculoAplis(cobrancas, exam.aplisIdExameTipo, exam.aplisIdTeste);
  return nomes.teste ? `${nomes.cobranca} · ${nomes.teste}` : nomes.cobranca;
};
