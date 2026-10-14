import { describe, expect, it } from 'vitest';
import type { AlteracaoLancamento, BaixaCampos, GlosaLancada } from '../types';
import { formatCurrency } from './formato';
import { descreverAlteracao, montarCorrecao, type GlosaEmEdicao } from './correcaoLancamento';

const baixa: BaixaCampos = {
  valorRecebido: 1000,
  dataReceb: '2026-10-10',
  formaRecebimento: 'TED',
  bancoNome: 'BB',
  bancoConta: null,
  observacoes: null,
};

const glosa = (parcial: Partial<GlosaLancada> = {}): GlosaLancada => ({
  id: 'g1',
  valor: 50,
  motivo: 'Guia sem assinatura',
  requisicaoId: null,
  loteId: null,
  status: 'aberta',
  ...parcial,
});

const emEdicao = (g: GlosaLancada): GlosaEmEdicao => ({ ...g });

const base = {
  notaId: 'n1',
  recebimentoId: 'r1',
  motivo: 'Erro de digitação',
};

describe('montarCorrecao', () => {
  it('sem nenhuma alteração, recusa', () => {
    const r = montarCorrecao({
      ...base,
      original: { baixa, glosas: [glosa()] },
      editado: { baixa: { ...baixa }, glosas: [emEdicao(glosa())] },
    });
    expect(r).toEqual({ erro: 'Nenhuma alteração para salvar.' });
  });

  it('exige motivo', () => {
    const r = montarCorrecao({
      ...base,
      motivo: '   ',
      original: { baixa, glosas: [] },
      editado: { baixa: { ...baixa, valorRecebido: 900 }, glosas: [] },
    });
    expect(r).toEqual({ erro: 'Informe o motivo da correção.' });
  });

  it('valor da baixa alterado manda a baixa inteira e conta um campo', () => {
    const r = montarCorrecao({
      ...base,
      original: { baixa, glosas: [] },
      editado: { baixa: { ...baixa, valorRecebido: 100 }, glosas: [] },
    });
    expect(r).toEqual({
      payload: {
        notaId: 'n1',
        recebimentoId: 'r1',
        motivo: 'Erro de digitação',
        baixa: { ...baixa, valorRecebido: 100 },
        glosasAlteradas: [],
        glosasNovas: [],
        glosasExcluidas: [],
      },
      camposAlterados: ['Valor recebido'],
    });
  });

  it('diferença abaixo de um centavo não conta como alteração', () => {
    const r = montarCorrecao({
      ...base,
      original: { baixa, glosas: [] },
      editado: { baixa: { ...baixa, valorRecebido: 1000.001 }, glosas: [] },
    });
    expect(r).toEqual({ erro: 'Nenhuma alteração para salvar.' });
  });

  it('texto só com espaços vira null e não conta como alteração de um null', () => {
    const r = montarCorrecao({
      ...base,
      original: { baixa, glosas: [] },
      editado: { baixa: { ...baixa, observacoes: '  ', bancoNome: ' BB ' }, glosas: [] },
    });
    expect(r).toEqual({ erro: 'Nenhuma alteração para salvar.' });
  });

  it('recusa valor recebido negativo', () => {
    const r = montarCorrecao({
      ...base,
      original: { baixa, glosas: [] },
      editado: { baixa: { ...baixa, valorRecebido: -1 }, glosas: [] },
    });
    expect(r).toEqual({ erro: 'Valor recebido não pode ser negativo.' });
  });

  it('valor recebido apagado (NaN) pede o valor em vez de virar zero', () => {
    const r = montarCorrecao({
      ...base,
      original: { baixa, glosas: [glosa()] },
      editado: { baixa: { ...baixa, valorRecebido: Number.NaN }, glosas: [emEdicao(glosa())] },
    });
    expect(r).toEqual({ erro: 'Informe o valor recebido.' });
  });

  it('recusa baixa sem data', () => {
    const r = montarCorrecao({
      ...base,
      original: { baixa, glosas: [] },
      editado: { baixa: { ...baixa, dataReceb: null }, glosas: [] },
    });
    expect(r).toEqual({ erro: 'Informe a data do recebimento.' });
  });

  it('baixa que ficaria sem valor e sem glosa manda excluir', () => {
    const r = montarCorrecao({
      ...base,
      original: { baixa, glosas: [glosa()] },
      editado: { baixa: { ...baixa, valorRecebido: 0 }, glosas: [] },
    });
    expect(r).toEqual({
      erro: 'A baixa ficaria sem valor e sem glosas — use "Excluir baixa" em vez disso.',
    });
  });

  it('separa glosas alteradas, novas e excluídas', () => {
    const r = montarCorrecao({
      ...base,
      original: { baixa, glosas: [glosa({ id: 'g1' }), glosa({ id: 'g2', valor: 30 })] },
      editado: {
        baixa: { ...baixa },
        glosas: [
          emEdicao(glosa({ id: 'g1', valor: 55, motivo: ' Guia sem assinatura ' })),
          { id: null, valor: 20, motivo: 'Esquecida', requisicaoId: 'req1', loteId: null, status: 'definitiva' },
        ],
      },
    });
    expect(r).toEqual({
      payload: {
        notaId: 'n1',
        recebimentoId: 'r1',
        motivo: 'Erro de digitação',
        glosasAlteradas: [{ id: 'g1', valor: 55, motivo: 'Guia sem assinatura', requisicaoId: null, loteId: null }],
        glosasNovas: [{ valor: 20, motivo: 'Esquecida', requisicaoId: 'req1', loteId: null, status: 'definitiva' }],
        glosasExcluidas: ['g2'],
      },
      camposAlterados: ['Glosa: valor', 'Glosa incluída', 'Glosa excluída'],
    });
  });

  it('glosa existente sem mudança não vai no payload', () => {
    const r = montarCorrecao({
      ...base,
      original: { baixa, glosas: [glosa()] },
      editado: { baixa: { ...baixa, formaRecebimento: 'PIX' }, glosas: [emEdicao(glosa())] },
    });
    expect('payload' in r && r.payload.glosasAlteradas).toEqual([]);
  });

  it('recusa glosa sem motivo ou com valor zero', () => {
    const semMotivo = montarCorrecao({
      ...base,
      original: { baixa, glosas: [glosa()] },
      editado: { baixa, glosas: [emEdicao(glosa({ motivo: ' ' }))] },
    });
    expect(semMotivo).toEqual({ erro: 'Toda glosa precisa de um motivo.' });

    const zerada = montarCorrecao({
      ...base,
      original: { baixa, glosas: [glosa()] },
      editado: { baixa, glosas: [emEdicao(glosa({ valor: 0 }))] },
    });
    expect(zerada).toEqual({ erro: 'Toda glosa precisa de um valor maior que zero.' });
  });

  it('grupo sem baixa: nunca manda baixa e aceita ficar sem glosas', () => {
    const r = montarCorrecao({
      ...base,
      recebimentoId: null,
      original: { baixa: null, glosas: [glosa()] },
      editado: { baixa: null, glosas: [] },
    });
    expect(r).toEqual({
      payload: {
        notaId: 'n1',
        recebimentoId: null,
        motivo: 'Erro de digitação',
        glosasAlteradas: [],
        glosasNovas: [],
        glosasExcluidas: ['g1'],
      },
      camposAlterados: ['Glosa excluída'],
    });
  });
});

describe('descreverAlteracao', () => {
  const alteracao = (parcial: Partial<AlteracaoLancamento>): AlteracaoLancamento => ({
    id: 'a1',
    entidade: 'baixa',
    acao: 'alteracao',
    campo: 'valor_recebido',
    valorAnterior: '1000.00',
    valorNovo: '100.00',
    motivo: 'Digitação',
    feitoPorNome: 'Renata',
    feitoEm: '2026-10-14T13:00:00Z',
    ...parcial,
  });

  it('valor da baixa sai em reais', () => {
    expect(descreverAlteracao(alteracao({}))).toEqual({
      oQue: 'Baixa · valor recebido',
      de: formatCurrency(1000),
      para: formatCurrency(100),
    });
  });

  it('data sai em dd/mm/aaaa e vazio vira travessão', () => {
    expect(descreverAlteracao(alteracao({ campo: 'data_receb', valorAnterior: '2026-10-01', valorNovo: null }))).toEqual({
      oQue: 'Baixa · data',
      de: '01/10/2026',
      para: '—',
    });
  });

  it('inclusão e exclusão de glosa mostram só o valor envolvido', () => {
    expect(descreverAlteracao(alteracao({
      entidade: 'glosa', acao: 'inclusao', campo: null, valorAnterior: null, valorNovo: '20.00',
    }))).toEqual({ oQue: 'Glosa incluída', de: '—', para: formatCurrency(20) });
    expect(descreverAlteracao(alteracao({
      entidade: 'baixa', acao: 'exclusao', campo: null, valorAnterior: '500.00', valorNovo: null,
    }))).toEqual({ oQue: 'Baixa excluída', de: formatCurrency(500), para: '—' });
  });

  it('texto livre passa como está', () => {
    expect(descreverAlteracao(alteracao({
      entidade: 'glosa', campo: 'motivo', valorAnterior: 'Sem assinatura', valorNovo: 'Guia vencida',
    }))).toEqual({ oQue: 'Glosa · motivo', de: 'Sem assinatura', para: 'Guia vencida' });
  });
});
