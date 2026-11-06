import { describe, expect, it } from 'vitest';
import { STATUS_GLOSA } from './recursoGlosa.js';
import type { RequisicaoClassificavel } from './recursoGlosa.js';
import { classificarParaFunil, STATUS_APLIS_RECUPERADA, valorRecuperado } from './glosaRecuperada.js';

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

  it('indeferida não entra no funil', () => {
    expect(classificarParaFunil(req({ status: 15 }), 300)).toBeNull();
  });
});
