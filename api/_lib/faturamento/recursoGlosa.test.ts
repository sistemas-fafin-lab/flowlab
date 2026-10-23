import { describe, expect, it } from 'vitest';
import { aplicarRegraPrazo, classificarRequisicao, fixarGlosa, prazosDoLote, resumirAcompanhamento } from './recursoGlosa.js';
import type { LoteParaPrazo, RegrasPrazoLote, RequisicaoFoto, RequisicaoGlosaAplis } from './recursoGlosa.js';

function requisicao(overrides: Partial<RequisicaoGlosaAplis> = {}): RequisicaoGlosaAplis {
  return { status: 6, liquido: 1000, recebido: 700, recursado: null, ...overrides };
}

describe('fixarGlosa', () => {
  it('requisição nova antes do envio: líquido − recebido, com o recebido como base', () => {
    expect(fixarGlosa(requisicao(), null, { cargaInicial: false })).toEqual({
      glosaFixada: 300,
      recebidoFixacao: 700,
      valorInicialEstimado: false,
    });
  });

  it('entra depois da carga inicial com o lote de recurso já enviado: estimado', () => {
    const aplis = requisicao({ status: 7, recursado: 250 });
    expect(fixarGlosa(aplis, null, { cargaInicial: false, recursoEnviado: true })).toEqual({
      glosaFixada: 300,
      recebidoFixacao: 700,
      valorInicialEstimado: true,
    });
  });

  it.each([6, 7, 16])('já em %i na primeira sincronização: líquido − recebido, estimado', (status) => {
    expect(fixarGlosa(requisicao({ status, recursado: 250 }), null, { cargaInicial: true })).toEqual({
      glosaFixada: 300,
      recebidoFixacao: 700,
      valorInicialEstimado: true,
    });
  });

  // Deferido total: o recebido já inclui o que voltou do recurso, então a base
  // é o recebido menos o recursado (ΔRec = R na classificação).
  it.each([34, 17])('já em %i: deferido total com o recursado do lote, estimado', (status) => {
    const aplis = requisicao({ status, liquido: 1000, recebido: 1000, recursado: 250 });
    expect(fixarGlosa(aplis, null, { cargaInicial: true })).toEqual({
      glosaFixada: 250,
      recebidoFixacao: 750,
      valorInicialEstimado: true,
    });
  });

  it.each([34, 17])('já em %i sem lote de recurso: glosa em branco, estimado', (status) => {
    const aplis = requisicao({ status, liquido: 1000, recebido: 1000, recursado: null });
    expect(fixarGlosa(aplis, null, { cargaInicial: true })).toEqual({
      glosaFixada: null,
      recebidoFixacao: null,
      valorInicialEstimado: true,
    });
  });

  it('aparece pela primeira vez já deferida depois da carga inicial: mesma regra, estimado', () => {
    const aplis = requisicao({ status: 34, liquido: 1000, recebido: 1000, recursado: 250 });
    expect(fixarGlosa(aplis, null, { cargaInicial: false })).toMatchObject({
      glosaFixada: 250,
      valorInicialEstimado: true,
    });
  });

  it('depois de fixada não muda, mesmo com o recebido e o status novos do apLIS', () => {
    const anterior = { glosaFixada: 300, recebidoFixacao: 700, valorInicialEstimado: false };
    const aplis = requisicao({ status: 34, liquido: 1000, recebido: 1000, recursado: 300 });
    expect(fixarGlosa(aplis, anterior, { cargaInicial: true })).toEqual(anterior);
  });

  it('a glosa em branco do deferido sem lote também fica: só o lápis preenche', () => {
    const anterior = { glosaFixada: null, recebidoFixacao: null, valorInicialEstimado: true };
    const aplis = requisicao({ status: 34, recursado: 250 });
    expect(fixarGlosa(aplis, anterior, { cargaInicial: false })).toEqual(anterior);
  });
});

function foto(overrides: Partial<RequisicaoFoto> = {}): RequisicaoFoto {
  return {
    status: 7,
    liquido: 1000,
    recebido: 700,
    recebidoFixacao: 700,
    valorRecursado: 300,
    emLoteRecurso: true,
    loteEnviado: true,
    ...overrides,
  };
}

describe('classificarRequisicao', () => {
  it('em análise: lote de recurso enviado e nada recebido desde a fixação', () => {
    expect(classificarRequisicao(foto())).toEqual({ classe: 'em-analise', valor: 300 });
  });

  it('deferido no limite: recebeu exatamente o recursado (ΔRec = R)', () => {
    expect(classificarRequisicao(foto({ recebido: 1000 }))).toEqual({ classe: 'deferido', valor: 300 });
  });

  it('deferido: recebeu mais que o recursado, vale o que voltou', () => {
    expect(classificarRequisicao(foto({ recebido: 1050 }))).toEqual({ classe: 'deferido', valor: 350 });
  });

  it('deferido parcial: recebeu parte do recursado, com a diferença a cobrar', () => {
    expect(classificarRequisicao(foto({ recebido: 800 }))).toEqual({
      classe: 'deferido-parcial',
      valor: 100,
      pendente: 200,
    });
  });

  it('indeferido: status 15 (recurso não acatado), valendo o recursado', () => {
    expect(classificarRequisicao(foto({ status: 15 }))).toEqual({ classe: 'indeferido', valor: 300 });
  });

  // O laboratório desistiu do que faltava: vale o saldo negativo de agora,
  // mesmo com parte já recebida e mesmo sem recurso.
  it.each([18, 8])('glosa acatada: status %i, valendo líquido − recebido', (status) => {
    expect(classificarRequisicao(foto({ status, recebido: 800 }))).toEqual({ classe: 'acatada', valor: 200 });
    expect(classificarRequisicao(foto({ status, emLoteRecurso: false, loteEnviado: false, valorRecursado: null })))
      .toEqual({ classe: 'acatada', valor: 300 });
  });

  it('lote de recurso ainda não enviado: sem classificação (o prazo só começa no envio)', () => {
    expect(classificarRequisicao(foto({ loteEnviado: false }))).toBeNull();
    expect(classificarRequisicao(foto({ loteEnviado: false, recebido: 1000 }))).toBeNull();
  });

  it('glosa fora de lote sem nada recebido: sem classificação', () => {
    expect(classificarRequisicao(foto({ status: 6, emLoteRecurso: false, loteEnviado: false, valorRecursado: null })))
      .toBeNull();
  });

  it('deferido total sem lote nem base fixada: deferido com o valor em branco (zero) até o lápis', () => {
    const aplis = foto({ status: 34, recebido: 1000, recebidoFixacao: null, valorRecursado: null, emLoteRecurso: false, loteEnviado: false });
    expect(classificarRequisicao(aplis)).toEqual({ classe: 'deferido', valor: 0 });
  });

  it('o status final do apLIS vale acima do ΔRec e do lote não enviado', () => {
    expect(classificarRequisicao(foto({ status: 15, recebido: 800 }))).toEqual({ classe: 'indeferido', valor: 300 });
    expect(classificarRequisicao(foto({ status: 8, loteEnviado: false }))).toEqual({ classe: 'acatada', valor: 300 });
  });

  it('sem recursado e sem nada recebido continua em análise, não deferido', () => {
    expect(classificarRequisicao(foto({ valorRecursado: null }))).toEqual({ classe: 'em-analise', valor: 0 });
  });

  describe('valores editados à mão valem acima do apLIS', () => {
    it('recebido de glosa editado substitui o ΔRec', () => {
      expect(classificarRequisicao(foto(), { valorRecebidoGlosa: 120 }))
        .toEqual({ classe: 'deferido-parcial', valor: 120, pendente: 180 });
      // O apLIS diz deferido total; a responsável corrigiu para nada recebido.
      expect(classificarRequisicao(foto({ recebido: 1000 }), { valorRecebidoGlosa: 0 }))
        .toEqual({ classe: 'em-analise', valor: 300 });
    });

    it('recursado editado muda o limite do deferido', () => {
      expect(classificarRequisicao(foto({ recebido: 800 }), { valorRecursado: 100 }))
        .toEqual({ classe: 'deferido', valor: 100 });
      expect(classificarRequisicao(foto(), { valorRecursado: 450 })).toEqual({ classe: 'em-analise', valor: 450 });
    });

    it('preenche o deferido total que ficou em branco sem lote', () => {
      const aplis = foto({ status: 34, recebido: 1000, recebidoFixacao: null, valorRecursado: null, emLoteRecurso: false, loteEnviado: false });
      expect(classificarRequisicao(aplis, { valorRecursado: 250, valorRecebidoGlosa: 250 }))
        .toEqual({ classe: 'deferido', valor: 250 });
    });
  });
});

describe('resumirAcompanhamento', () => {
  const emAnalise = { foto: foto() };
  const deferido = { foto: foto({ recebido: 1000 }) };
  const parcial = { foto: foto({ recebido: 800 }) };
  const indeferido = { foto: foto({ status: 15 }) };
  const naoEnviado = { foto: foto({ loteEnviado: false }) };
  const acatadaSemRecurso = { foto: foto({ status: 8, emLoteRecurso: false, loteEnviado: false, valorRecursado: null, recebido: 600 }) };
  const glosaSemRecurso = { foto: foto({ status: 6, emLoteRecurso: false, loteEnviado: false, valorRecursado: null }) };

  it('soma os cards do mês com percentual do total de recursos e a variação do total', () => {
    const atual = [emAnalise, emAnalise, deferido, parcial, indeferido, naoEnviado, acatadaSemRecurso, glosaSemRecurso];
    const anterior = [emAnalise, emAnalise, deferido, indeferido];
    expect(resumirAcompanhamento(atual, anterior)).toEqual({
      // Recursos são as requisições em lote de recurso, enviado ou não.
      total: { quantidade: 6, valor: 1800, variacao: 50 },
      emAnalise: { quantidade: 2, valor: 600, percentual: 33.3 },
      deferidos: { quantidade: 1, valor: 300, percentual: 16.7 },
      indeferidos: { quantidade: 1, valor: 300, percentual: 16.7 },
      deferidoParcial: { quantidade: 1, valor: 100, pendente: 200 },
      // A acatada conta também o que nem foi recorrido.
      acatada: { quantidade: 1, valor: 400 },
    });
  });

  it('aplica as edições de cada requisição', () => {
    const editada = { foto: foto(), edicoes: { valorRecebidoGlosa: 300 } };
    expect(resumirAcompanhamento([editada], []).deferidos).toEqual({ quantidade: 1, valor: 300, percentual: 100 });
  });

  it('sem recursos no mês anterior não há variação; sem recursos no mês, percentuais zerados', () => {
    expect(resumirAcompanhamento([emAnalise], []).total.variacao).toBeNull();
    expect(resumirAcompanhamento([], [emAnalise])).toMatchObject({
      total: { quantidade: 0, valor: 0, variacao: -100 },
      emAnalise: { quantidade: 0, valor: 0, percentual: 0 },
    });
  });
});

describe('aplicarRegraPrazo', () => {
  it('N dias corridos vira o mês', () => {
    expect(aplicarRegraPrazo({ tipo: 'dias_corridos', n: 30 }, '2026-01-15')).toBe('2026-02-14');
  });

  it('N dias úteis pula o fim de semana', () => {
    // 23/10/2026 é sexta.
    expect(aplicarRegraPrazo({ tipo: 'dias_uteis', n: 1 }, '2026-10-23')).toBe('2026-10-26');
    expect(aplicarRegraPrazo({ tipo: 'dias_uteis', n: 5 }, '2026-10-23')).toBe('2026-10-30');
  });

  it('dias úteis a partir de um sábado começam na segunda', () => {
    expect(aplicarRegraPrazo({ tipo: 'dias_uteis', n: 1 }, '2026-10-24')).toBe('2026-10-26');
  });

  it('dia X do mês seguinte vira o ano', () => {
    expect(aplicarRegraPrazo({ tipo: 'dia_mes_seguinte', n: 20 }, '2026-12-28')).toBe('2027-01-20');
  });

  it('dia X que o mês seguinte não tem cai no último dia dele', () => {
    expect(aplicarRegraPrazo({ tipo: 'dia_mes_seguinte', n: 31 }, '2027-01-10')).toBe('2027-02-28');
  });

  it('N-ésimo dia útil do mês seguinte pula os fins de semana', () => {
    // 01/11/2026 é domingo: o 1º dia útil é 02/11.
    expect(aplicarRegraPrazo({ tipo: 'dia_util_mes_seguinte', n: 1 }, '2026-10-23')).toBe('2026-11-02');
    expect(aplicarRegraPrazo({ tipo: 'dia_util_mes_seguinte', n: 20 }, '2026-10-23')).toBe('2026-11-27');
  });

  it('N-ésimo dia útil que o mês não tem cai no último dia útil dele', () => {
    // Fevereiro de 2027 tem 20 dias úteis; o último é sexta, 26/02.
    expect(aplicarRegraPrazo({ tipo: 'dia_util_mes_seguinte', n: 23 }, '2027-01-10')).toBe('2027-02-26');
  });

  it('último dia do mês seguinte', () => {
    expect(aplicarRegraPrazo({ tipo: 'ultimo_dia_mes_seguinte', n: null }, '2028-01-31')).toBe('2028-02-29');
    expect(aplicarRegraPrazo({ tipo: 'ultimo_dia_mes_seguinte', n: null }, '2026-11-05')).toBe('2026-12-31');
  });

  it('sem prazo não tem data', () => {
    expect(aplicarRegraPrazo({ tipo: 'sem_prazo', n: null }, '2026-10-23')).toBeNull();
  });
});

describe('prazosDoLote', () => {
  // Recurso enviado, sem resposta da operadora: em análise.
  function lote(overrides: Partial<LoteParaPrazo> = {}): LoteParaPrazo {
    return {
      dataEnvio: '2026-10-01',
      dataRetornoReal: null,
      requisicoes: [{
        foto: {
          status: 7,
          liquido: 1000,
          recebido: 700,
          recebidoFixacao: 700,
          valorRecursado: 300,
          emLoteRecurso: true,
          loteEnviado: true,
        },
      }],
      ...overrides,
    };
  }

  const regras: RegrasPrazoLote = {
    glosaAnalise: { tipo: 'dias_corridos', n: 30 },
    glosaPagamento: { tipo: 'dias_corridos', n: 10 },
  };

  it('enviado e antes da data de retorno: no prazo, com retorno e pagamento previstos', () => {
    expect(prazosDoLote(lote(), regras, '2026-10-30')).toEqual({
      dataRetornoPrevista: '2026-10-31',
      dataPagamentoPrevista: '2026-11-10',
      selo: 'no-prazo',
    });
  });

  it('hoje é a data de retorno: vence hoje', () => {
    expect(prazosDoLote(lote(), regras, '2026-10-31').selo).toBe('vence-hoje');
  });

  it('depois da data de retorno: atrasado', () => {
    expect(prazosDoLote(lote(), regras, '2026-11-01').selo).toBe('atrasado');
  });

  it('convênio sem regra ligada: "—" e sem datas previstas', () => {
    expect(prazosDoLote(lote(), null, '2026-11-01')).toEqual({
      dataRetornoPrevista: null,
      dataPagamentoPrevista: null,
      selo: 'sem-regra',
    });
  });

  it('regra de análise sem prazo: "—", mesmo com regra de pagamento', () => {
    const semAnalise = { ...regras, glosaAnalise: { tipo: 'sem_prazo' as const, n: null } };
    expect(prazosDoLote(lote(), semAnalise, '2026-11-01')).toEqual({
      dataRetornoPrevista: null,
      dataPagamentoPrevista: null,
      selo: 'sem-regra',
    });
  });

  it('lote não enviado (Criado): sem selo e sem datas previstas', () => {
    expect(prazosDoLote(lote({ dataEnvio: null }), regras, '2026-11-01')).toEqual({
      dataRetornoPrevista: null,
      dataPagamentoPrevista: null,
      selo: null,
    });
  });

  it('com data real de retorno: o selo para e o pagamento conta do retorno real', () => {
    expect(prazosDoLote(lote({ dataRetornoReal: '2026-11-20' }), regras, '2026-12-01')).toEqual({
      dataRetornoPrevista: '2026-10-31',
      dataPagamentoPrevista: '2026-11-30',
      selo: null,
    });
  });

  it('todas as requisições com classificação final: o selo para', () => {
    const indeferida = lote().requisicoes[0];
    const deferida = { foto: { ...indeferida.foto, recebido: 1000 } };
    const requisicoes = [{ foto: { ...indeferida.foto, status: 15 } }, deferida];
    expect(prazosDoLote(lote({ requisicoes }), regras, '2026-12-01').selo).toBeNull();
  });

  it('uma requisição ainda em análise mantém o selo', () => {
    const emAnalise = lote().requisicoes[0];
    const requisicoes = [{ foto: { ...emAnalise.foto, status: 15 } }, emAnalise];
    expect(prazosDoLote(lote({ requisicoes }), regras, '2026-12-01').selo).toBe('atrasado');
  });
});
