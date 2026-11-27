import { describe, expect, it } from 'vitest';
import {
  AVISO_FINAL_DIAS, chaveDoVencimento, marcoDoAviso, montarBlocoVencimentos, terminoDe, textoDoVencimento, vencimentosAte, type DespesaVencimento,
} from './vencimentos';

// Dados fictícios. Hoje: 01/12/2026.
const HOJE = '2026-12-01';
const LINK = 'https://app/it/gastos/despesas';
let seq = 0;
const despesa = (d: Partial<DespesaVencimento> = {}): DespesaVencimento => ({
  id: `d${++seq}`, descricao: 'Microsoft 365', fornecedor_nome: 'Microsoft', recorrencia: 'mensal', competencia_fim: '2026-12-01',
  renovacao_automatica: true, aviso_renovacao_dias: 30, responsavel_id: null, ...d,
});

describe('terminoDe', () => {
  it('o último dia da última competência', () => {
    expect(terminoDe(despesa({ competencia_fim: '2026-12-01' }))).toBe('2026-12-31');
    expect(terminoDe(despesa({ competencia_fim: '2028-02-01' }))).toBe('2028-02-29');
  });
  it('sem fim ou cobrança única, não vence', () => {
    expect(terminoDe(despesa({ competencia_fim: null }))).toBeNull();
    expect(terminoDe(despesa({ recorrencia: 'unica' }))).toBeNull();
  });
});

describe('vencimentosAte', () => {
  it('de hoje até a janela, do mais próximo para o mais distante; o que já passou fica de fora', () => {
    const a = despesa({ descricao: 'Domínio do site', competencia_fim: '2027-01-01' });
    const b = despesa({ descricao: 'Certificado SSL', competencia_fim: '2026-12-01' });
    const passou = despesa({ competencia_fim: '2026-11-01' });
    const longe = despesa({ competencia_fim: '2027-06-01' });
    expect(vencimentosAte([a, b, passou, longe], HOJE).map((v) => [v.despesa.descricao, v.termino, v.dias])).toEqual([
      ['Certificado SSL', '2026-12-31', 30],
      ['Domínio do site', '2027-01-31', 61],
    ]);
  });
});

describe('marcoDoAviso', () => {
  const v = (dias: number, aviso = 30) => ({ despesa: despesa({ aviso_renovacao_dias: aviso }), termino: '2026-12-31', dias });
  it('a antecedência da despesa e os 7 dias finais, cada um uma vez', () => {
    expect(marcoDoAviso(v(40))).toBeNull();
    expect(marcoDoAviso(v(30))).toBe(30);
    // Ainda dentro dos 30: a mesma chave do primeiro aviso, que não sai de novo.
    expect(marcoDoAviso(v(20))).toBe(30);
    expect(marcoDoAviso(v(AVISO_FINAL_DIAS))).toBe(7);
    expect(marcoDoAviso(v(0))).toBe(7);
  });
  it('despesa com 0 dias de aviso só ganha o dos 7 dias', () => {
    expect(marcoDoAviso(v(10, 0))).toBeNull();
    expect(marcoDoAviso(v(5, 0))).toBe(7);
  });
  it('a chave separa pessoa, despesa, término e marco', () => {
    const x = v(30);
    expect(chaveDoVencimento('m1', x, 30)).toBe(`vencimento:m1:${x.despesa.id}:2026-12-31:30`);
  });
});

describe('textos', () => {
  it('renova sozinha: hora de renegociar ou cancelar', () => {
    const [v] = vencimentosAte([despesa({ competencia_fim: '2026-12-01' })], HOJE);
    expect(textoDoVencimento(v, LINK)).toBe(
      `🔁 Microsoft 365 (Microsoft) renova sozinha em 30 dias, em 31/12. Se for renegociar ou cancelar, a hora é agora.\n\nDetalhes em Gastos de TI: ${LINK}`,
    );
  });
  it('não renova sozinha: decidir se renova', () => {
    const [v] = vencimentosAte([despesa({ descricao: 'Certificado SSL', fornecedor_nome: 'Sectigo', renovacao_automatica: false, competencia_fim: '2026-12-01' })], '2026-12-30');
    expect(textoDoVencimento(v, LINK)).toContain('⏳ Certificado SSL (Sectigo) termina amanhã, em 31/12, e não renova sozinha.');
  });
  it('o bloco do contexto da IA, sem valores', () => {
    const bloco = montarBlocoVencimentos(vencimentosAte([despesa({ renovacao_automatica: false })], HOJE));
    expect(bloco).toContain('VENCIMENTOS DO GASTOS DE TI');
    expect(bloco).toContain('- Microsoft 365 (Microsoft): termina, sem renovação automática em 31/12 (em 30 dias)');
    expect(montarBlocoVencimentos([])).toContain('- (nenhum)');
  });
});
