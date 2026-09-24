import { describe, expect, it } from 'vitest';
import {
  calcularPendenciaProcedimento,
  procedimentoTemGlosa,
  protocoloEhData,
  resolverCodigoGlosa,
} from './bdLab.js';

// Casos vêm da issue 10 (.scratch/faturamento-feedback-usuario/issues/10-lotes-protocolo-duplicado.md):
// achados reais do banco em 2026-08-18.
describe('protocoloEhData', () => {
  it('reconhece protocolos-data legítimos compartilhados entre operadoras', () => {
    expect(protocoloEhData('07082026')).toBe(true); // AMHP-DF, lotes 6490/6491
    expect(protocoloEhData('03082026')).toBe(true); // Medigest
    expect(protocoloEhData('26062026')).toBe(true); // AMHP-DF + Medigest
    expect(protocoloEhData('11052026')).toBe(true); // ABAC + AMHP-DF
    expect(protocoloEhData('23062026')).toBe(true); // AMHP-DF + INAS GDF
  });

  it('rejeita protocolos de 8 dígitos com dia fora de 01-31', () => {
    expect(protocoloEhData('79957289')).toBe(false); // CASSI, duplicidade real
    expect(protocoloEhData('43421411')).toBe(false); // AMHP-DF, não é data
    expect(protocoloEhData('44579468')).toBe(false); // AMHP-DF, não é data
  });

  it('rejeita formatos que não são 8 dígitos', () => {
    expect(protocoloEhData('760054')).toBe(false); // 6 dígitos, ASSEFAZ/Medigest
    expect(protocoloEhData('')).toBe(false);
    expect(protocoloEhData('123456789')).toBe(false);
    expect(protocoloEhData('ABC12345')).toBe(false);
  });

  it('rejeita mês fora de 01-12', () => {
    expect(protocoloEhData('01132026')).toBe(false);
    expect(protocoloEhData('01002026')).toBe(false);
  });

  it('rejeita dia 00', () => {
    expect(protocoloEhData('00082026')).toBe(false);
  });

  it('aceita dia 31 e mês 12 nos limites', () => {
    expect(protocoloEhData('31122026')).toBe(true);
  });

  it('rejeita dia/mês dentro da faixa mas que não formam uma data real', () => {
    expect(protocoloEhData('31042026')).toBe(false); // abril tem 30 dias
    expect(protocoloEhData('30022026')).toBe(false); // fevereiro não tem 30 dias
    expect(protocoloEhData('29022025')).toBe(false); // 2025 não é bissexto
  });

  it('aceita 29/02 em ano bissexto', () => {
    expect(protocoloEhData('29022024')).toBe(true);
  });
});

// Casos vêm da issue 09 (.scratch/faturamento-feedback-usuario/issues/09-lote-parcial-recebimento-por-requisicao.md):
// requisições reais dos lotes 6108 (Bradesco) e 6075 (PMDF).
describe('calcularPendenciaProcedimento', () => {
  it('marca pendente uma guia glosada integralmente (ValorRecebido = 0)', () => {
    // requisição 0100024943007, lote 6108: líquido 94,51, recebido 0,00, glosa 1702.
    expect(calcularPendenciaProcedimento(94.51, 0)).toEqual({ pendente: true, valorPendente: 94.51 });
  });

  it('marca pendente um recebimento parcial (ValorRecebido < ValorLiquido)', () => {
    // lote 6075, requisição 0040001906000: dois procedimentos parcialmente recebidos.
    expect(calcularPendenciaProcedimento(10.29, 10.08)).toEqual({ pendente: true, valorPendente: 0.21 });
    expect(calcularPendenciaProcedimento(20.37, 19.96)).toEqual({ pendente: true, valorPendente: 0.41 });
  });

  it('não marca pendente um procedimento totalmente recebido', () => {
    expect(calcularPendenciaProcedimento(94.51, 94.51)).toEqual({ pendente: false, valorPendente: 0 });
  });

  it('não marca pendente quando o recebido excede o líquido (nunca fica negativo)', () => {
    expect(calcularPendenciaProcedimento(50, 55)).toEqual({ pendente: false, valorPendente: 0 });
  });
});

// Casos reais do lote 6485 (CASSI), conferidos no banco em 2026-09-24: glosa com
// IdMotivoGlosa NULL e só "3292" no texto livre; o código certo no demonstrativo.
describe('resolverCodigoGlosa', () => {
  const semFontes = { demonstrativo: null, motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: null };

  it('prefere o código do demonstrativo do convênio', () => {
    expect(resolverCodigoGlosa({
      ...semFontes,
      demonstrativo: { codigos: '3292', descricao: '3292', valor: 127.22 },
      desMotivoGlosa: '3292',
      valorNaoRecebido: 127.22,
    })).toEqual({ codigo: '3292', descricao: null, valor: 127.22 });
  });

  it('cai no código do catálogo quando não há demonstrativo', () => {
    expect(resolverCodigoGlosa({
      ...semFontes,
      motivoCodigo: 1006,
      motivoDescricao: 'ATENDIMENTO APÓS O DESLIGAMENTO DO BENEFICIÁRIO',
      desMotivoGlosa: 'texto do operador',
    })).toEqual({ codigo: '1006', descricao: 'ATENDIMENTO APÓS O DESLIGAMENTO DO BENEFICIÁRIO', valor: null });
  });

  it('usa o texto livre como código quando ele é só um número', () => {
    expect(resolverCodigoGlosa({ ...semFontes, desMotivoGlosa: '3292' }))
      .toEqual({ codigo: '3292', descricao: null, valor: null });
  });

  it('usa o texto livre como descrição quando não é só número', () => {
    expect(resolverCodigoGlosa({ ...semFontes, desMotivoGlosa: 'QUANTIDADE ACIMA DA AUTORIZADA' }))
      .toEqual({ codigo: null, descricao: 'QUANTIDADE ACIMA DA AUTORIZADA', valor: null });
  });

  it('valor: demonstrativo tem prioridade sobre o não recebido', () => {
    expect(resolverCodigoGlosa({
      ...semFontes,
      demonstrativo: { codigos: '1705', descricao: null, valor: 469.34 },
      valorNaoRecebido: 500,
    }).valor).toBe(469.34);
  });

  it('valor: sem demonstrativo, usa o que não foi recebido após o retorno', () => {
    expect(resolverCodigoGlosa({ ...semFontes, desMotivoGlosa: '1705', valorNaoRecebido: 234.68 }).valor)
      .toBe(234.68);
  });
});

describe('procedimentoTemGlosa', () => {
  const base = {
    temDemonstrativo: false, idMotivoGlosa: null, desMotivoGlosa: null,
    valor: 100, valorRecebido: 0, dtaRecebido: null,
  };

  it('demonstrativo com valor glosado sempre conta', () => {
    expect(procedimentoTemGlosa({ ...base, temDemonstrativo: true, valorRecebido: 100, dtaRecebido: '2026-09-01' }))
      .toBe(true);
  });

  it('texto de glosa em procedimento recebido por inteiro não é glosa (alarme falso do 6485)', () => {
    expect(procedimentoTemGlosa({
      ...base, desMotivoGlosa: 'QUANTIDADE SOLICITADA ACIMA DA AUTORIZADA',
      valor: 131.01, valorRecebido: 131.01, dtaRecebido: '2026-09-01',
    })).toBe(false);
  });

  it('motivo em procedimento recebido a menor conta', () => {
    expect(procedimentoTemGlosa({
      ...base, desMotivoGlosa: '3292', valor: 146.88, valorRecebido: 73.44, dtaRecebido: '2026-09-01',
    })).toBe(true);
  });

  it('motivo sem retorno da operadora ainda conta', () => {
    expect(procedimentoTemGlosa({ ...base, idMotivoGlosa: 6 })).toBe(true);
  });

  it('sem motivo nem demonstrativo não é glosa', () => {
    expect(procedimentoTemGlosa(base)).toBe(false);
  });
});
