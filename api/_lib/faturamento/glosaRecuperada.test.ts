import { describe, expect, it } from 'vitest';
import { STATUS_GLOSA } from './recursoGlosa.js';
import type { RequisicaoClassificavel } from './recursoGlosa.js';
import {
  cardsValorGlosa,
  classificarParaFunil,
  saldoDeGlosaPorOperadora,
  STATUS_APLIS_RECUPERADA,
  valorRecuperado,
} from './glosaRecuperada.js';

function req(parcial: Partial<RequisicaoClassificavel['foto']>, edicoes = {}): RequisicaoClassificavel {
  return {
    foto: {
      status: STATUS_GLOSA.primeiroRecurso,
      liquido: 1000,
      recebido: 0,
      recebidoFixacao: 0,
      valorRecursado: 300,
      emLoteRecurso: true,
      loteEnviado: true,
      ...parcial,
    },
    edicoes,
  };
}

describe('valorRecuperado', () => {
  it('documenta o mapeamento proposto: 34 (glosa recebida) e 17 (recurso pago)', () => {
    expect(STATUS_APLIS_RECUPERADA).toEqual([34, 17]);
  });

  it('recurso deferido total: o que entrou de recebido desde a fixação', () => {
    expect(valorRecuperado(req({ status: STATUS_GLOSA.recursoPago, recebido: 300, recebidoFixacao: 0 }))).toBe(300);
  });

  it('deferido parcial: só o que entrou, não o recursado', () => {
    expect(valorRecuperado(req({ recebido: 120, recebidoFixacao: 0 }))).toBe(120);
  });

  it('recurso ainda sem retorno, indeferido e acatada não recuperam nada', () => {
    expect(valorRecuperado(req({}))).toBe(0);
    expect(valorRecuperado(req({ status: STATUS_GLOSA.recursoNaoAcatado }))).toBe(0);
    expect(valorRecuperado(req({ status: STATUS_GLOSA.recebidoAMenorAcatado, recebido: 50 }))).toBe(0);
    expect(valorRecuperado(req({ status: STATUS_GLOSA.glosaDefinitivaAcatada }))).toBe(0);
  });

  it('glosa sem recurso não é recuperada, mesmo com recebimento posterior', () => {
    expect(valorRecuperado(req({ status: STATUS_GLOSA.glosadoSemRecurso, emLoteRecurso: false, recebido: 200 }))).toBe(0);
    expect(valorRecuperado(req({ status: STATUS_GLOSA.emTratativas, emLoteRecurso: false, recebido: 200 }))).toBe(0);
  });

  it('deferido total sem base (sem lote de recurso) conta 0 até a responsável completar', () => {
    expect(valorRecuperado(req({ status: STATUS_GLOSA.glosaRecebida, emLoteRecurso: false, recebidoFixacao: null }))).toBe(0);
  });

  it('o valor corrigido pelo lápis vale acima do apLIS', () => {
    expect(valorRecuperado(req({ recebido: 120, recebidoFixacao: 0 }, { valorRecebidoGlosa: 90 }))).toBe(90);
  });
});

describe('classificarParaFunil', () => {
  it('acatada: status 18 e 8, pelo líquido − recebido', () => {
    expect(classificarParaFunil(req({ status: 18, liquido: 500, recebido: 380 }), 120)).toEqual({ classe: 'acatada', valor: 120 });
    expect(classificarParaFunil(req({ status: 8, liquido: 200, recebido: 0, emLoteRecurso: false }), 200)).toEqual({ classe: 'acatada', valor: 200 });
  });

  it('em disputa: glosa aberta (6) e em recurso (7, 16), pela glosa fixada', () => {
    expect(classificarParaFunil(req({ status: 6, emLoteRecurso: false }), 80)).toEqual({ classe: 'em-disputa', valor: 80 });
    expect(classificarParaFunil(req({ status: 7 }), 300)).toEqual({ classe: 'em-disputa', valor: 300 });
    expect(classificarParaFunil(req({ status: 16 }), null)).toEqual({ classe: 'em-disputa', valor: 0 });
  });

  it('recuperada: recurso pago, e parcial pelo que já voltou', () => {
    expect(classificarParaFunil(req({ status: 17, recebido: 300, recebidoFixacao: 0 }), 300)).toEqual({ classe: 'recuperada', valor: 300 });
    expect(classificarParaFunil(req({ status: 7, recebido: 120, recebidoFixacao: 0 }), 300)).toEqual({ classe: 'recuperada', valor: 120 });
  });

  it('recurso não acatado (15) é perda definitiva: acatada, líquido − recebido', () => {
    expect(classificarParaFunil(req({ status: 15, liquido: 500, recebido: 272.11 }), 300))
      .toEqual({ classe: 'acatada', valor: 227.89 });
  });
});

describe('cardsValorGlosa', () => {
  // Uma requisição de cada classe do funil, no mês do lote 2026-10.
  const acatada = { ...req({ status: 18, liquido: 500, recebido: 380 }), glosaFixada: 120 };
  const emDisputa = { ...req({ status: 6, emLoteRecurso: false }), glosaFixada: 80 };
  const recuperada = { ...req({ status: 17, recebido: 300, recebidoFixacao: 0 }), glosaFixada: 300 };
  // Em recurso sem retorno, mas já em tratativas: fora do funil.
  const foraDoFunil = { ...req({ status: STATUS_GLOSA.emTratativas }), glosaFixada: 50 };

  it('cada card soma a classe do funil, e o glosado soma as três', () => {
    const cards = cardsValorGlosa('2026-10', { '2026-10': [acatada, emDisputa, recuperada, foraDoFunil] }, 10000);
    expect(cards.glosado).toMatchObject({ valor: 500, quantidade: 3 });
    expect(cards.acatado).toMatchObject({ valor: 120, quantidade: 1 });
    expect(cards.recuperado).toMatchObject({ valor: 300, quantidade: 1 });
    expect(cards.saldoPendente).toMatchObject({ valor: 80, quantidade: 1 });
  });

  it('glosado em % do faturado; acatado e recuperado em % do glosado, com uma casa', () => {
    const cards = cardsValorGlosa('2026-10', { '2026-10': [acatada, emDisputa, recuperada] }, 3000);
    expect(cards.glosado.percentual).toBe(16.7);
    expect(cards.acatado.percentual).toBe(24);
    expect(cards.recuperado.percentual).toBe(60);
    expect(cards.saldoPendente.percentual).toBeNull();
  });

  it('sem faturado o glosado fica sem percentual; sem glosado, acatado e recuperado também', () => {
    expect(cardsValorGlosa('2026-10', { '2026-10': [acatada] }, 0).glosado.percentual).toBeNull();
    const vazio = cardsValorGlosa('2026-10', {}, 3000);
    expect(vazio.glosado).toMatchObject({ valor: 0, quantidade: 0, percentual: 0 });
    expect(vazio.acatado.percentual).toBeNull();
    expect(vazio.recuperado.percentual).toBeNull();
  });

  it('variação de cada card sobre o valor do mês anterior; null sem valor nele', () => {
    const cards = cardsValorGlosa(
      '2026-01',
      {
        '2025-12': [{ ...emDisputa, glosaFixada: 40 }, { ...acatada, foto: { ...acatada.foto, recebido: 440 } }],
        '2026-01': [emDisputa, acatada],
      },
      1000,
    );
    // Dezembro: em disputa 40, acatada 60 → glosado 100. Janeiro: 80 e 120 → 200.
    expect(cards.glosado.variacao).toBe(100);
    expect(cards.saldoPendente.variacao).toBe(100);
    expect(cards.acatado.variacao).toBe(100);
    expect(cards.recuperado.variacao).toBeNull();
    expect(cardsValorGlosa('2026-01', { '2025-12': [emDisputa] }, 0).saldoPendente.variacao).toBe(-100);
  });
});

describe('saldoDeGlosaPorOperadora', () => {
  const amil = { id: 10, nome: 'AMIL' };
  const cassi = { id: 20, nome: 'CASSI' };

  it('soma por operadora só a glosa em disputa, a mesma classe do card Glosa em disputa', () => {
    const requisicoes = [
      { ...req({ status: 6, emLoteRecurso: false }), glosaFixada: 80, fontePagadora: amil },
      { ...req({ status: 7 }), glosaFixada: 120, fontePagadora: amil },
      { ...req({ status: 16 }), glosaFixada: 500, fontePagadora: cassi },
      // Acatada, recuperada e fora do funil não entram.
      { ...req({ status: 18, liquido: 500, recebido: 380 }), glosaFixada: 120, fontePagadora: amil },
      { ...req({ status: 17, recebido: 300 }), glosaFixada: 300, fontePagadora: cassi },
      { ...req({ status: STATUS_GLOSA.emTratativas }), glosaFixada: 50, fontePagadora: cassi },
    ];
    expect(saldoDeGlosaPorOperadora(requisicoes)).toEqual([
      { fonteId: 20, nome: 'CASSI', valor: 500, quantidade: 1 },
      { fonteId: 10, nome: 'AMIL', valor: 200, quantidade: 2 },
    ]);
    const card = cardsValorGlosa('2026-10', { '2026-10': requisicoes }, 0).saldoPendente.valor;
    expect(card).toBe(700);
  });

  it('as 10 maiores, do maior saldo ao menor', () => {
    const requisicoes = Array.from({ length: 12 }, (_, k) => ({
      ...req({ status: 6, emLoteRecurso: false }),
      glosaFixada: 10 * (k + 1),
      fontePagadora: { id: k + 1, nome: `OP ${k + 1}` },
    }));
    const saldo = saldoDeGlosaPorOperadora(requisicoes);
    expect(saldo.map((s) => s.valor)).toEqual([120, 110, 100, 90, 80, 70, 60, 50, 40, 30]);
  });
});
