import { describe, expect, it } from 'vitest';
import {
  aplicarRegraPrazo,
  calendarioDeRecursos,
  classificarRequisicao,
  eventosDaRequisicao,
  eventoEdicaoManual,
  eventosDoLote,
  fixarGlosa,
  prazoParaRecorrer,
  prazosDasRequisicoes,
  prazosDoLote,
  resumirAcompanhamento,
  resumirDashboard,
  somarGlosasDoTitulo,
  somarGlosasPorLote,
  statusDashboard,
  valorRecebidoGlosa,
} from './recursoGlosa.js';
import type {
  EdicoesRequisicao,
  LoteParaPrazo,
  RegraPrazo,
  RegrasPrazoLote,
  RequisicaoCalendario,
  RequisicaoDashboard,
  RequisicaoFoto,
  RequisicaoGlosaAplis,
  RequisicaoTitulo,
} from './recursoGlosa.js';

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

describe('statusDashboard', () => {
  it('Aberta: glosado sem recurso (status 6)', () => {
    expect(statusDashboard(foto({ status: 6, emLoteRecurso: false, loteEnviado: false, valorRecursado: null })))
      .toBe('aberta');
  });

  it.each([7, 16])('Em recurso: status %i ainda sem classificação final', (status) => {
    expect(statusDashboard(foto({ status }))).toBe('em-recurso');
    expect(statusDashboard(foto({ status, loteEnviado: false }))).toBe('em-recurso');
    expect(statusDashboard(foto({ status, emLoteRecurso: false, loteEnviado: false }))).toBe('em-recurso');
  });

  it('Revertida: deferido ou deferido parcial, mesmo com o apLIS ainda em 1º/2º recurso', () => {
    expect(statusDashboard(foto({ status: 7, recebido: 1000 }))).toBe('revertida');
    expect(statusDashboard(foto({ status: 16, recebido: 800 }))).toBe('revertida');
    expect(statusDashboard(foto({ status: 33, recebido: 800 }))).toBe('revertida');
  });

  it.each([34, 17])('Revertida: status %i (deferido total), mesmo sem lote nem base fixada', (status) => {
    expect(statusDashboard(foto({ status, recebido: 1000 }))).toBe('revertida');
    expect(statusDashboard(foto({ status, recebido: 1000, recebidoFixacao: null, valorRecursado: null, emLoteRecurso: false, loteEnviado: false })))
      .toBe('revertida');
    // Deferido total pelo apLIS vale mesmo com o lote não enviado ou sem recursado.
    expect(statusDashboard(foto({ status, recebido: 1000, loteEnviado: false }))).toBe('revertida');
    expect(statusDashboard(foto({ status, recebido: 1000, recebidoFixacao: 1000, valorRecursado: null }))).toBe('revertida');
  });

  it('o recebido de glosa editado à mão decide entre em recurso e revertida', () => {
    expect(statusDashboard(foto(), { valorRecebidoGlosa: 120 })).toBe('revertida');
    expect(statusDashboard(foto({ recebido: 1000 }), { valorRecebidoGlosa: 0 })).toBe('em-recurso');
  });

  it.each([15, 18, 8])('Definitiva: status %i (indeferido ou glosa acatada), mesmo com parte recebida', (status) => {
    expect(statusDashboard(foto({ status }))).toBe('definitiva');
    expect(statusDashboard(foto({ status, recebido: 800 }))).toBe('definitiva');
    expect(statusDashboard(foto({ status, emLoteRecurso: false, loteEnviado: false, valorRecursado: null })))
      .toBe('definitiva');
  });

  it('fora dos quatro: em tratativas sem nada recebido fora de lote', () => {
    expect(statusDashboard(foto({ status: 33, emLoteRecurso: false, loteEnviado: false }))).toBeNull();
  });
});

describe('valorRecebidoGlosa', () => {
  it('é o que entrou de recebido desde a fixação (ΔRec)', () => {
    expect(valorRecebidoGlosa(foto({ recebido: 820.5 }))).toBe(120.5);
  });

  it('o valor corrigido pelo lápis vale acima do apLIS', () => {
    expect(valorRecebidoGlosa(foto({ recebido: 1000 }), { valorRecebidoGlosa: 50 })).toBe(50);
  });

  it('deferido total sem lote: sem base, fica em branco', () => {
    expect(valorRecebidoGlosa(foto({ status: 34, recebidoFixacao: null }))).toBeNull();
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

describe('resumirDashboard', () => {
  function glosa(overrides: Partial<RequisicaoDashboard> = {}): RequisicaoDashboard {
    return {
      foto: foto({ status: 6, emLoteRecurso: false, loteEnviado: false, valorRecursado: null }),
      glosaFixada: 300,
      convenio: 'BRADESCO',
      procedimentos: ['40301630 HEMOGRAMA'],
      motivos: ['1801 PROCEDIMENTO NÃO AUTORIZADO'],
      ...overrides,
    };
  }
  const aberta = (glosaFixada = 300) => glosa({ glosaFixada });
  const emRecurso = (glosaFixada = 300) => glosa({ foto: foto(), glosaFixada });
  // Deferido parcial: R = 300, ΔRec = 100.
  const revertida = () => glosa({ foto: foto({ recebido: 800 }) });
  const definitiva = () => glosa({ foto: foto({ status: 15 }) });

  it('cards: glosa fixada, e nas Revertidas o valor deferido, com a variação sobre o mês anterior', () => {
    const resumo = resumirDashboard('2026-10', {
      '2026-09': [aberta(200), emRecurso(500), emRecurso(500)],
      '2026-10': [aberta(), aberta(), emRecurso(), revertida(), definitiva()],
    });
    expect(resumo.cards).toEqual({
      aberta: { quantidade: 2, valor: 600, variacao: 200 },
      'em-recurso': { quantidade: 1, valor: 300, variacao: -70 },
      // R$ 100 deferidos, não os R$ 300 da glosa fixada.
      revertida: { quantidade: 1, valor: 100, variacao: null },
      definitiva: { quantidade: 1, valor: 300, variacao: null },
    });
  });

  it('evolução: Abertas, Em recurso e Revertidas nos 6 meses até o período, atravessando o ano', () => {
    const resumo = resumirDashboard('2026-02', {
      '2025-08': [aberta(999)], // fora dos 6 meses
      '2025-09': [aberta(100)],
      '2025-12': [emRecurso(250), revertida(), definitiva()],
      '2026-02': [aberta(), aberta()],
    });
    expect(resumo.evolucao).toEqual([
      { competencia: '2025-09', aberta: 100, emRecurso: 0, revertida: 0 },
      { competencia: '2025-10', aberta: 0, emRecurso: 0, revertida: 0 },
      { competencia: '2025-11', aberta: 0, emRecurso: 0, revertida: 0 },
      { competencia: '2025-12', aberta: 0, emRecurso: 250, revertida: 100 },
      { competencia: '2026-01', aberta: 0, emRecurso: 0, revertida: 0 },
      { competencia: '2026-02', aberta: 600, emRecurso: 0, revertida: 0 },
    ]);
  });

  it('distribuição: total de glosas, quantidade e percentual de cada status', () => {
    const semStatus = glosa({ foto: foto({ status: 33, emLoteRecurso: false, loteEnviado: false }) });
    const resumo = resumirDashboard('2026-10', {
      '2026-10': [aberta(), aberta(), aberta(), emRecurso(), revertida(), definitiva(), semStatus],
    });
    expect(resumo.distribuicao).toEqual({
      // A requisição fora dos quatro status não entra no total.
      total: 6,
      status: [
        { status: 'aberta', quantidade: 3, valor: 900, percentual: 50 },
        { status: 'em-recurso', quantidade: 1, valor: 300, percentual: 16.7 },
        { status: 'revertida', quantidade: 1, valor: 100, percentual: 16.7 },
        { status: 'definitiva', quantidade: 1, valor: 300, percentual: 16.7 },
      ],
    });
    expect(resumirDashboard('2026-10', {}).distribuicao.status[0]).toEqual(
      { status: 'aberta', quantidade: 0, valor: 0, percentual: 0 },
    );
  });

  it('procedimentos: por maior valor e por mais ocorrências, com percentual do total glosado', () => {
    const resumo = resumirDashboard('2026-10', {
      '2026-10': [
        glosa({ glosaFixada: 600, procedimentos: ['TSH'] }),
        // A glosa da requisição se divide entre os procedimentos glosados dela.
        glosa({ glosaFixada: 200, procedimentos: ['HEMOGRAMA', 'TSH'] }),
        glosa({ glosaFixada: 100, procedimentos: ['HEMOGRAMA'] }),
        glosa({ glosaFixada: 100, procedimentos: ['HEMOGRAMA'] }),
        glosa({ glosaFixada: 0, procedimentos: [] }),
      ],
    });
    expect(resumo.procedimentos.porValor).toEqual([
      { nome: 'TSH', valor: 700, quantidade: 2, percentual: 70 },
      { nome: 'HEMOGRAMA', valor: 300, quantidade: 3, percentual: 30 },
    ]);
    // Percentual das ocorrências sobre as 5 ocorrências de procedimento.
    expect(resumo.procedimentos.porOcorrencias).toEqual([
      { nome: 'HEMOGRAMA', valor: 300, quantidade: 3, percentual: 60 },
      { nome: 'TSH', valor: 700, quantidade: 2, percentual: 40 },
    ]);
  });

  it('procedimentos: só os 10 primeiros de cada ordem', () => {
    const muitos = Array.from({ length: 12 }, (_, i) => glosa({ glosaFixada: 100 + i, procedimentos: [`P${i}`] }));
    const { porValor } = resumirDashboard('2026-10', { '2026-10': muitos }).procedimentos;
    expect(porValor).toHaveLength(10);
    expect(porValor[0].nome).toBe('P11');
  });

  it('convênios: os que mais glosam, com valor e percentual do total glosado', () => {
    const resumo = resumirDashboard('2026-10', {
      '2026-10': [
        glosa({ convenio: 'CASSI', glosaFixada: 100 }),
        glosa({ convenio: 'BRADESCO', glosaFixada: 500 }),
        glosa({ convenio: 'BRADESCO', glosaFixada: 250 }),
        glosa({ convenio: null, glosaFixada: 150 }),
      ],
    });
    expect(resumo.convenios).toEqual([
      { nome: 'BRADESCO', valor: 750, quantidade: 2, percentual: 75 },
      { nome: 'Sem convênio', valor: 150, quantidade: 1, percentual: 15 },
      { nome: 'CASSI', valor: 100, quantidade: 1, percentual: 10 },
    ]);
  });

  it('motivos: por ocorrências, os 5 primeiros e o resto em "Outros"', () => {
    const comMotivos = (motivos: string[], n: number) =>
      Array.from({ length: n }, () => glosa({ glosaFixada: 100, motivos }));
    const resumo = resumirDashboard('2026-10', {
      '2026-10': [
        ...comMotivos(['M1'], 6),
        ...comMotivos(['M2'], 5),
        ...comMotivos(['M3'], 4),
        ...comMotivos(['M4', 'M5'], 3),
        ...comMotivos(['M6'], 2),
        ...comMotivos(['M7'], 2),
      ],
    });
    // 25 ocorrências de motivo.
    expect(resumo.motivos).toEqual([
      { nome: 'M1', valor: 600, quantidade: 6, percentual: 24 },
      { nome: 'M2', valor: 500, quantidade: 5, percentual: 20 },
      { nome: 'M3', valor: 400, quantidade: 4, percentual: 16 },
      { nome: 'M4', valor: 150, quantidade: 3, percentual: 12 },
      { nome: 'M5', valor: 150, quantidade: 3, percentual: 12 },
      { nome: 'Outros', valor: 400, quantidade: 4, percentual: 16 },
    ]);
  });

  it('motivos: só o catálogo do apLIS; com até 6 motivos não há "Outros"', () => {
    const resumo = resumirDashboard('2026-10', {
      // Procedimento recebido abaixo do líquido, sem motivo no apLIS: fica fora do resumo.
      '2026-10': [glosa({ motivos: ['M1'] }), glosa({ motivos: [] })],
    });
    expect(resumo.motivos).toEqual([{ nome: 'M1', valor: 300, quantidade: 1, percentual: 100 }]);
  });

  it('rankings: contam as mesmas glosas da distribuição (os quatro status)', () => {
    const semStatus = glosa({
      foto: foto({ status: 33, emLoteRecurso: false, loteEnviado: false }),
      convenio: 'CASSI',
      procedimentos: ['TSH'],
      motivos: ['M9'],
    });
    const resumo = resumirDashboard('2026-10', { '2026-10': [glosa(), semStatus] });
    expect(resumo.convenios.map((c) => c.nome)).toEqual(['BRADESCO']);
    expect(resumo.procedimentos.porValor.map((p) => p.nome)).toEqual(['40301630 HEMOGRAMA']);
    expect(resumo.motivos.map((m) => m.nome)).toEqual(['1801 PROCEDIMENTO NÃO AUTORIZADO']);
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

describe('prazosDasRequisicoes', () => {
  // Recurso de 300 enviado em 01/10, sem resposta da operadora.
  const emAnalise: RequisicaoFoto = {
    status: 7,
    liquido: 1000,
    recebido: 700,
    recebidoFixacao: 700,
    valorRecursado: 300,
    emLoteRecurso: true,
    loteEnviado: true,
  };

  function lote(overrides: Partial<LoteParaPrazo> = {}): LoteParaPrazo {
    return { dataEnvio: '2026-10-01', dataRetornoReal: null, requisicoes: [{ foto: emAnalise }], ...overrides };
  }

  const regras: RegrasPrazoLote = {
    glosaAnalise: { tipo: 'dias_corridos', n: 30 },
    glosaPagamento: { tipo: 'dias_corridos', n: 10 },
  };

  it('em análise num lote enviado: datas previstas, sem resultado final e o recursado em aberto', () => {
    expect(prazosDasRequisicoes(lote(), regras)).toEqual([{
      requisicao: { foto: emAnalise },
      dataRetornoPrevista: '2026-10-31',
      dataPagamentoPrevista: '2026-11-10',
      classe: 'em-analise',
      resultadoFinal: false,
      valorEmAberto: 300,
      motivoSemData: null,
    }]);
  });

  it('lote não enviado: sem datas previstas, pelo motivo de não ter sido enviado', () => {
    const naoEnviada = { foto: { ...emAnalise, loteEnviado: false } };
    const [prazos] = prazosDasRequisicoes(lote({ dataEnvio: null, requisicoes: [naoEnviada] }), regras);
    expect(prazos).toMatchObject({
      dataRetornoPrevista: null,
      dataPagamentoPrevista: null,
      resultadoFinal: false,
      valorEmAberto: 300,
      motivoSemData: 'lote-nao-enviado',
    });
  });

  it('convênio sem regra ligada: sem datas, por falta da regra de Análise', () => {
    const [prazos] = prazosDasRequisicoes(lote(), null);
    expect(prazos).toMatchObject({ dataRetornoPrevista: null, dataPagamentoPrevista: null, motivoSemData: 'sem-regra-analise' });
  });

  it('regra de Análise sem prazo: sem datas, por falta da regra de Análise', () => {
    const semAnalise = { ...regras, glosaAnalise: { tipo: 'sem_prazo' as const, n: null } };
    const [prazos] = prazosDasRequisicoes(lote(), semAnalise);
    expect(prazos).toMatchObject({ dataRetornoPrevista: null, dataPagamentoPrevista: null, motivoSemData: 'sem-regra-analise' });
  });

  it('regra de Pagamento sem prazo: o retorno previsto continua, sem data de pagamento', () => {
    const semPagamento = { ...regras, glosaPagamento: { tipo: 'sem_prazo' as const, n: null } };
    const [prazos] = prazosDasRequisicoes(lote(), semPagamento);
    expect(prazos).toMatchObject({
      dataRetornoPrevista: '2026-10-31',
      dataPagamentoPrevista: null,
      motivoSemData: 'sem-regra-pagamento',
    });
  });

  it('data real de retorno substitui a prevista como base do pagamento, mesmo sem regra de Análise', () => {
    const [comRegras] = prazosDasRequisicoes(lote({ dataRetornoReal: '2026-11-20' }), regras);
    expect(comRegras).toMatchObject({ dataRetornoPrevista: '2026-10-31', dataPagamentoPrevista: '2026-11-30', motivoSemData: null });

    const semAnalise = { ...regras, glosaAnalise: { tipo: 'sem_prazo' as const, n: null } };
    const [semRegraAnalise] = prazosDasRequisicoes(lote({ dataRetornoReal: '2026-11-20' }), semAnalise);
    expect(semRegraAnalise).toMatchObject({ dataRetornoPrevista: null, dataPagamentoPrevista: '2026-11-30', motivoSemData: null });
  });

  function situacao(foto: RequisicaoFoto, edicoes?: EdicoesRequisicao) {
    const [prazos] = prazosDasRequisicoes(lote({ requisicoes: [{ foto, edicoes }] }), regras);
    return { resultadoFinal: prazos.resultadoFinal, valorEmAberto: prazos.valorEmAberto };
  }

  it('deferido total: resultado final, nada em aberto', () => {
    expect(situacao({ ...emAnalise, recebido: 1000 })).toEqual({ resultadoFinal: true, valorEmAberto: 0 });
  });

  it('deferido total sem base fixada (status 34): resultado final, nada em aberto', () => {
    expect(situacao({ ...emAnalise, status: 34, recebido: 1000, recebidoFixacao: null }))
      .toEqual({ resultadoFinal: true, valorEmAberto: 0 });
  });

  it('indeferido (status 15): resultado final, com o recursado ainda não recebido', () => {
    expect(situacao({ ...emAnalise, status: 15 })).toEqual({ resultadoFinal: true, valorEmAberto: 300 });
  });

  it.each([18, 8])('acatada (status %i): resultado final', (status) => {
    expect(situacao({ ...emAnalise, status }).resultadoFinal).toBe(true);
  });

  it('deferido parcial: não é resultado final, com a diferença em aberto', () => {
    expect(situacao({ ...emAnalise, recebido: 800 })).toEqual({ resultadoFinal: false, valorEmAberto: 200 });
  });

  it('edições do lápis valem acima do apLIS no valor em aberto e no resultado', () => {
    expect(situacao(emAnalise, { valorRecursado: 500 })).toEqual({ resultadoFinal: false, valorEmAberto: 500 });
    expect(situacao(emAnalise, { valorRecebidoGlosa: 120 })).toEqual({ resultadoFinal: false, valorEmAberto: 180 });
    expect(situacao(emAnalise, { valorRecebidoGlosa: 300 })).toEqual({ resultadoFinal: true, valorEmAberto: 0 });
  });
});

describe('prazoParaRecorrer', () => {
  const noventaDias = { tipo: 'dias_corridos' as const, n: 90 };

  it('conta a regra GLOSA – RECURSO da data de recebimento: antes do prazo, no prazo', () => {
    expect(prazoParaRecorrer('2026-08-10', noventaDias, '2026-11-07')).toEqual({
      prazo: '2026-11-08',
      selo: 'no-prazo',
    });
  });

  it('hoje é o prazo: vence hoje; depois dele: atrasado', () => {
    expect(prazoParaRecorrer('2026-08-10', noventaDias, '2026-11-08').selo).toBe('vence-hoje');
    expect(prazoParaRecorrer('2026-08-10', noventaDias, '2026-11-09').selo).toBe('atrasado');
  });

  it('convênio sem regra, regra sem prazo ou requisição sem data de recebimento: "—"', () => {
    const traco = { prazo: null, selo: 'sem-regra' };
    expect(prazoParaRecorrer('2026-08-10', null, '2026-11-09')).toEqual(traco);
    expect(prazoParaRecorrer('2026-08-10', { tipo: 'sem_prazo', n: null }, '2026-11-09')).toEqual(traco);
    expect(prazoParaRecorrer(null, noventaDias, '2026-11-09')).toEqual(traco);
  });
});

describe('eventosDaRequisicao', () => {
  const foto = { status: 7, recebido: 700, idLoteRecurso: 441 };

  it('primeira sincronização: um único evento de início do acompanhamento', () => {
    expect(eventosDaRequisicao(null, foto)).toEqual([{
      tipo: 'inicio_acompanhamento',
      valorAnterior: null,
      valorNovo: '7',
      descricao: 'Início do acompanhamento (1º recurso)',
    }]);
  });

  it('sem mudança não gera evento', () => {
    expect(eventosDaRequisicao(foto, { ...foto })).toEqual([]);
  });

  it.each([
    [7, 16, 'Foi para 2º recurso'],
    [7, 18, 'Glosa acatada (recebido a menor)'],
    [6, 7, 'Entrou em 1º recurso'],
    [7, 15, 'Recurso não acatado'],
    [16, 34, 'Glosa recebida'],
    [7, 17, 'Recurso pago'],
    [7, 8, 'Glosa definitiva – acatada pela diretoria'],
    [7, 33, 'Em tratativas com o convênio'],
    [7, 6, 'Voltou para glosado sem recurso'],
  ])('status %i → %i: "%s"', (de, para, texto) => {
    expect(eventosDaRequisicao({ ...foto, status: de }, { ...foto, status: para })).toEqual([{
      tipo: 'mudanca_status',
      valorAnterior: String(de),
      valorNovo: String(para),
      descricao: texto,
    }]);
  });

  it('status fora do catálogo: diz de qual para qual', () => {
    expect(eventosDaRequisicao({ ...foto, status: 7 }, { ...foto, status: 99 })[0].descricao)
      .toBe('Status mudou de 1º recurso para evento 99');
  });

  it('entra num lote de recurso', () => {
    expect(eventosDaRequisicao({ ...foto, idLoteRecurso: null }, foto)).toEqual([{
      tipo: 'entrada_lote_recurso',
      valorAnterior: null,
      valorNovo: '441',
      descricao: 'Entrou no lote de recurso 441',
    }]);
  });

  it('passa para outro lote de recurso', () => {
    expect(eventosDaRequisicao(foto, { ...foto, idLoteRecurso: 520 })).toEqual([
      expect.objectContaining({ tipo: 'entrada_lote_recurso', valorAnterior: '441', valorNovo: '520' }),
    ]);
  });

  it('sair do lote de recurso não é entrada', () => {
    expect(eventosDaRequisicao(foto, { ...foto, idLoteRecurso: null })).toEqual([]);
  });

  it('recebido mudou: valores em reais, com centavos', () => {
    expect(eventosDaRequisicao(foto, { ...foto, recebido: 850.5 })).toEqual([{
      tipo: 'mudanca_recebido',
      valorAnterior: '700.00',
      valorNovo: '850.50',
      descricao: 'Recebido mudou de R$ 700,00 para R$ 850,50',
    }]);
  });

  it('diferença abaixo de um centavo não é mudança', () => {
    expect(eventosDaRequisicao(foto, { ...foto, recebido: 700.001 })).toEqual([]);
  });

  it('várias mudanças na mesma sincronização: lote, status e recebido, nessa ordem', () => {
    const anterior = { status: 6, recebido: 700, idLoteRecurso: null };
    const nova = { status: 34, recebido: 1000, idLoteRecurso: 441 };
    expect(eventosDaRequisicao(anterior, nova).map((e) => e.tipo))
      .toEqual(['entrada_lote_recurso', 'mudanca_status', 'mudanca_recebido']);
  });

  // O valor recebido de glosa editado vale acima do recebido do apLIS: a
  // mudança do recebido não é evento, porque a sincronização é ignorada nele.
  it('recebido de glosa editado à mão: a mudança do recebido não gera evento', () => {
    const anterior = { status: 7, recebido: 700, idLoteRecurso: 441 };
    const nova = { status: 16, recebido: 850, idLoteRecurso: 441 };
    expect(eventosDaRequisicao(anterior, nova, { recebidoGlosaEditado: true }).map((e) => e.tipo))
      .toEqual(['mudanca_status']);
  });
});

describe('eventosDoLote', () => {
  const criado = { idLoteRecurso: 441, dataEnvio: null };
  const enviado = { idLoteRecurso: 441, dataEnvio: '2026-10-22' };

  it('lote enviado desde a última sincronização', () => {
    expect(eventosDoLote(criado, enviado, { acompanhado: true })).toEqual([{
      tipo: 'envio_lote',
      valorAnterior: null,
      valorNovo: '2026-10-22',
      descricao: 'Lote de recurso 441 enviado em 22/10/2026',
    }]);
  });

  it('a data de envio mudou no apLIS', () => {
    expect(eventosDoLote({ ...enviado, dataEnvio: '2026-10-20' }, enviado, { acompanhado: true })).toEqual([{
      tipo: 'envio_lote',
      valorAnterior: '2026-10-20',
      valorNovo: '2026-10-22',
      descricao: 'Data de envio do lote de recurso 441 mudou de 20/10/2026 para 22/10/2026',
    }]);
  });

  it('sem mudança não gera evento', () => {
    expect(eventosDoLote(enviado, { ...enviado }, { acompanhado: true })).toEqual([]);
    expect(eventosDoLote(criado, { ...criado }, { acompanhado: true })).toEqual([]);
  });

  // Lote novo na foto que junta requisições já acompanhadas: foi criado e
  // enviado entre duas sincronizações.
  it('lote novo já enviado, com requisições já acompanhadas: registra o envio', () => {
    expect(eventosDoLote(null, enviado, { acompanhado: true })).toEqual([
      expect.objectContaining({ tipo: 'envio_lote', valorAnterior: null, valorNovo: '2026-10-22' }),
    ]);
  });

  it('lote novo só com requisições novas é carga inicial: sem reconstruir o passado', () => {
    expect(eventosDoLote(null, enviado, { acompanhado: false })).toEqual([]);
  });

  it('lote novo ainda não enviado não gera evento', () => {
    expect(eventosDoLote(null, criado, { acompanhado: true })).toEqual([]);
  });

  it('data de envio editada à mão: o envio no apLIS não gera evento', () => {
    expect(eventosDoLote(criado, enviado, { acompanhado: true, envioEditado: true })).toEqual([]);
  });
});

describe('eventoEdicaoManual', () => {
  it('data de envio corrigida: data anterior e nova', () => {
    expect(eventoEdicaoManual('dataEnvio', '2026-10-20', '2026-10-22')).toEqual({
      tipo: 'edicao_manual',
      valorAnterior: '2026-10-20',
      valorNovo: '2026-10-22',
      descricao: 'Data de envio editada manualmente: de 20/10/2026 para 22/10/2026',
    });
  });

  it('data real de retorno registrada pela primeira vez: sem valor anterior', () => {
    expect(eventoEdicaoManual('dataRetornoReal', null, '2026-11-05')).toEqual({
      tipo: 'edicao_manual',
      valorAnterior: null,
      valorNovo: '2026-11-05',
      descricao: 'Data real de retorno editada manualmente: de — para 05/11/2026',
    });
  });

  it('valor recursado corrigido: em reais, com centavos', () => {
    expect(eventoEdicaoManual('valorRecursado', 300, 250.5)).toEqual({
      tipo: 'edicao_manual',
      valorAnterior: '300.00',
      valorNovo: '250.50',
      descricao: 'Valor recursado editado manualmente: de R$ 300,00 para R$ 250,50',
    });
  });

  it('edição removida: volta a valer o valor do apLIS', () => {
    expect(eventoEdicaoManual('valorRecebidoGlosa', 120, 80, { removida: true })).toEqual({
      tipo: 'edicao_manual',
      valorAnterior: '120.00',
      valorNovo: '80.00',
      descricao: 'Edição manual do valor recebido de glosa removida: volta a valer R$ 80,00 (apLIS)',
    });
  });

  it('edição removida de um campo que o apLIS não tem', () => {
    expect(eventoEdicaoManual('dataPagamentoReal', '2026-11-30', null, { removida: true }).descricao)
      .toBe('Edição manual da data real de pagamento removida');
  });
});

describe('somarGlosasPorLote', () => {
  function daFoto(overrides: Partial<RequisicaoFoto> = {}, extra: Partial<RequisicaoTitulo> = {}): RequisicaoTitulo {
    return { idLoteFaturamento: 10, glosaFixada: 300, foto: foto(overrides), ...extra };
  }

  it('Glosado: líquido − recebido das requisições em glosa ainda em disputa (6, 7 e 16), por lote', () => {
    const porLote = somarGlosasPorLote([
      daFoto({ status: 6, emLoteRecurso: false, liquido: 1000, recebido: 700 }),
      daFoto({ status: 6, emLoteRecurso: false, liquido: 233.17, recebido: 221.18 }),
      // 1º e 2º recurso seguem glosados até o resultado.
      daFoto({ status: 7, liquido: 3419.56, recebido: 0 }),
      daFoto({ status: 16, liquido: 200, recebido: 150 }),
      daFoto({ status: 6, emLoteRecurso: false, liquido: 80, recebido: 0 }, { idLoteFaturamento: 20 }),
      // Fora da disputa: recebido, acatada, indeferido, deferido.
      daFoto({ status: 5, liquido: 100, recebido: 100 }),
      daFoto({ status: 18, liquido: 42.35, recebido: 32.64 }),
      daFoto({ status: 15 }),
      daFoto({ status: 34, recebido: 1000 }),
    ]);
    expect(porLote.get(10)?.glosado).toBe(3781.55);
    expect(porLote.get(20)?.glosado).toBe(80);
  });

  it('Glosa recebida: o valor deferido dos recursos (total ou parcial), com o lápis acima do apLIS', () => {
    const porLote = somarGlosasPorLote([
      // Deferido total: ΔRec = 1000 − 700 = R.
      daFoto({ recebido: 1000 }),
      // Deferido parcial: 100 de 300.
      daFoto({ recebido: 800 }),
      // Recebido de glosa corrigido pelo lápis: 50, não os 300 do apLIS.
      { ...daFoto({ recebido: 1000 }), edicoes: { valorRecebidoGlosa: 50 } },
      // Em análise: nada voltou ainda.
      daFoto(),
      // Deferido total pelo apLIS (34) sem base: em branco até o lápis, conta 0.
      daFoto({ status: 34, recebidoFixacao: null, emLoteRecurso: false }, { glosaFixada: null }),
    ]);
    expect(porLote.get(10)?.glosaRecebida).toBe(450);
  });

  it('Glosa acatada: o saldo negativo (líquido − recebido) das requisições em 18, 8 e 15 (perda definitiva)', () => {
    const porLote = somarGlosasPorLote([
      daFoto({ status: 18, liquido: 1000, recebido: 850 }),
      daFoto({ status: 8, liquido: 400, recebido: 0, emLoteRecurso: false }, { glosaFixada: 400 }),
      // Recurso não acatado pela operadora: também perda, sai do saldo.
      daFoto({ status: 15, liquido: 300, recebido: 72.11 }),
    ]);
    expect(porLote.get(10)).toEqual({ glosado: 0, glosaRecebida: 0, glosaAcatada: 777.89, recursoNaoAcatado: 227.89 });
  });
});

describe('somarGlosasDoTitulo', () => {
  it('soma os lotes de faturamento do título; lote sem glosa na foto conta 0', () => {
    const porLote = new Map([
      [10, { glosado: 300, glosaRecebida: 100.1, glosaAcatada: 0, recursoNaoAcatado: 0 }],
      [20, { glosado: 50, glosaRecebida: 0.2, glosaAcatada: 75, recursoNaoAcatado: 25.1 }],
      [30, { glosado: 999, glosaRecebida: 999, glosaAcatada: 999, recursoNaoAcatado: 999 }],
    ]);
    expect(somarGlosasDoTitulo([10, 20, 40], porLote))
      .toEqual({ glosado: 350, glosaRecebida: 100.3, glosaAcatada: 75, recursoNaoAcatado: 25.1 });
    expect(somarGlosasDoTitulo([], porLote)).toEqual({ glosado: 0, glosaRecebida: 0, glosaAcatada: 0, recursoNaoAcatado: 0 });
  });
});

describe('calendarioDeRecursos', () => {
  const trintaDias: RegraPrazo = { tipo: 'dias_corridos', n: 30 };
  const AMIL = 10;
  const regras = new Map<number, RegraPrazo>([[AMIL, trintaDias]]);

  function glosada(overrides: Partial<RequisicaoCalendario> & { id?: number } = {}): RequisicaoCalendario & { id: number } {
    return {
      id: 1,
      idLoteFaturamento: 500,
      protocoloLoteFaturamento: 'P-500',
      fontePagadora: { id: AMIL, nome: 'AMIL' },
      status: 6,
      // + 30 dias = quarta, 11/11/2026
      dataRecebimento: '2026-10-12',
      glosaFixada: 100,
      motivos: ['1801 Procedimento não autorizado'],
      loteRecursoEnviado: false,
      ...overrides,
    };
  }

  it('agrupa as requisições do mesmo lote de faturamento e mesmo prazo num item, com quantidade e valor', () => {
    const cal = calendarioDeRecursos(
      [glosada({ id: 1, glosaFixada: 100.1 }), glosada({ id: 2, glosaFixada: 50.2 }), glosada({ id: 3, idLoteFaturamento: 501, protocoloLoteFaturamento: null })],
      regras,
      '2026-11',
      '2026-11-02',
    );
    expect(cal.mes.map((i) => ({
      lote: i.idLoteFaturamento,
      protocolo: i.protocolo,
      convenio: i.fontePagadora.nome,
      prazo: i.prazo,
      dataExibicao: i.dataExibicao,
      quantidade: i.quantidade,
      valor: i.valor,
      ids: i.requisicoes.map((r) => r.id),
    }))).toEqual([
      { lote: 500, protocolo: 'P-500', convenio: 'AMIL', prazo: '2026-11-11', dataExibicao: '2026-11-11', quantidade: 2, valor: 150.3, ids: [1, 2] },
      { lote: 501, protocolo: null, convenio: 'AMIL', prazo: '2026-11-11', dataExibicao: '2026-11-11', quantidade: 1, valor: 100, ids: [3] },
    ]);
  });

  it('lote com requisições de recebimentos diferentes aparece em dois dias', () => {
    const cal = calendarioDeRecursos(
      [glosada({ id: 1 }), glosada({ id: 2, dataRecebimento: '2026-10-13' })],
      regras,
      '2026-11',
      '2026-11-02',
    );
    expect(cal.mes.map((i) => [i.idLoteFaturamento, i.prazo, i.requisicoes.map((r) => r.id)])).toEqual([
      [500, '2026-11-11', [1]],
      [500, '2026-11-12', [2]],
    ]);
  });

  it('prazo no sábado ou no domingo aparece na sexta anterior, com o selo do dia real', () => {
    const cal = calendarioDeRecursos(
      [
        // + 30 = sábado 14/11 e domingo 15/11
        glosada({ id: 1, dataRecebimento: '2026-10-15' }),
        glosada({ id: 2, dataRecebimento: '2026-10-16' }),
        // + 30 = sexta 13/11
        glosada({ id: 3, dataRecebimento: '2026-10-14' }),
      ],
      regras,
      '2026-11',
      '2026-11-02',
    );
    expect(cal.mes.map((i) => [i.prazo, i.dataExibicao, i.venceEm])).toEqual([
      ['2026-11-13', '2026-11-13', null],
      ['2026-11-14', '2026-11-13', 'sab'],
      ['2026-11-15', '2026-11-13', 'dom'],
    ]);
  });

  it('virada de mês: prazo no domingo 1º fica na sexta do mês anterior', () => {
    // + 30 dias de 02/10/2026 = domingo 01/11/2026 → sexta 30/10/2026
    const requisicoes = [glosada({ dataRecebimento: '2026-10-02' })];
    expect(calendarioDeRecursos(requisicoes, regras, '2026-11', '2026-10-01').mes).toEqual([]);
    const outubro = calendarioDeRecursos(requisicoes, regras, '2026-10', '2026-10-01').mes;
    expect(outubro.map((i) => [i.prazo, i.dataExibicao, i.venceEm])).toEqual([['2026-11-01', '2026-10-30', 'dom']]);
  });

  it('selos pela data de exibição: hoje, amanhã (próximo dia útil), atrasado (prazo real) e futuro', () => {
    // Hoje é sexta 13/11/2026: amanhã é segunda 16/11.
    const cal = calendarioDeRecursos(
      [
        glosada({ id: 1, dataRecebimento: '2026-10-12' }), // prazo qua 11/11: atrasado
        glosada({ id: 2, dataRecebimento: '2026-10-14' }), // sex 13/11: hoje
        glosada({ id: 3, dataRecebimento: '2026-10-15' }), // sáb 14/11 → sex 13/11: hoje
        glosada({ id: 4, dataRecebimento: '2026-10-17' }), // seg 16/11: amanhã
        glosada({ id: 5, dataRecebimento: '2026-10-18' }), // ter 17/11: futuro
        glosada({ id: 6, dataRecebimento: '2026-09-01' }), // 01/10: atrasado, de outro mês
      ],
      regras,
      '2026-11',
      '2026-11-13',
    );
    expect(cal.datas).toEqual({ hoje: '2026-11-13', amanha: '2026-11-16' });
    expect(cal.mes.map((i) => [i.prazo, i.selo])).toEqual([
      ['2026-11-11', 'atrasado'],
      ['2026-11-13', 'hoje'],
      ['2026-11-14', 'hoje'],
      ['2026-11-16', 'amanha'],
      ['2026-11-17', 'futuro'],
    ]);
    expect(cal.paineis.hoje.map((i) => i.prazo)).toEqual(['2026-11-13', '2026-11-14']);
    expect(cal.paineis.amanha.map((i) => i.prazo)).toEqual(['2026-11-16']);
    // Os atrasados são de qualquer mês, do mais antigo ao mais recente.
    expect(cal.paineis.atrasados.map((i) => i.prazo)).toEqual(['2026-10-01', '2026-11-11']);
  });

  it('olhando no fim de semana, o prazo de sábado ainda é de hoje e o de segunda é de amanhã', () => {
    const cal = calendarioDeRecursos(
      [glosada({ id: 1, dataRecebimento: '2026-10-15' }), glosada({ id: 2, dataRecebimento: '2026-10-17' })],
      regras,
      '2026-11',
      '2026-11-14',
    );
    expect(cal.datas.amanha).toBe('2026-11-16');
    expect(cal.mes.map((i) => [i.prazo, i.selo])).toEqual([['2026-11-14', 'hoje'], ['2026-11-16', 'amanha']]);
  });

  it('só entra requisição em status 6, com glosa, com motivo e fora de lote de recurso enviado', () => {
    const cal = calendarioDeRecursos(
      [
        glosada({ id: 1 }),
        glosada({ id: 2, status: 7 }),
        glosada({ id: 3, glosaFixada: 0 }),
        glosada({ id: 4, glosaFixada: null }),
        glosada({ id: 5, motivos: [] }),
        glosada({ id: 6, loteRecursoEnviado: true }),
        // Lote de recurso ainda não enviado: continua no calendário.
        glosada({ id: 7, loteRecursoEnviado: false }),
      ],
      regras,
      '2026-11',
      '2026-11-02',
    );
    expect(cal.mes.flatMap((i) => i.requisicoes.map((r) => r.id))).toEqual([1, 7]);
    expect(cal.semPrazo).toEqual([]);
  });

  it('convênio sem regra, regra sem prazo e requisição sem recebimento vão para a lista sem prazo, por lote', () => {
    const SELECT = 20;
    const SEM_VINCULO = 30;
    const cal = calendarioDeRecursos(
      [
        glosada({ id: 1, idLoteFaturamento: 600, fontePagadora: { id: SELECT, nome: 'SELECT' }, glosaFixada: 10 }),
        glosada({ id: 2, idLoteFaturamento: 600, fontePagadora: { id: SELECT, nome: 'SELECT' }, glosaFixada: 15, dataRecebimento: '2026-10-20' }),
        glosada({ id: 3, idLoteFaturamento: 700, fontePagadora: { id: SEM_VINCULO, nome: 'CASSI' }, glosaFixada: 500 }),
        glosada({ id: 4, idLoteFaturamento: 800, dataRecebimento: null, glosaFixada: 20 }),
        glosada({ id: 5, idLoteFaturamento: 900, fontePagadora: { id: null, nome: null }, glosaFixada: 1 }),
      ],
      new Map<number, RegraPrazo>([[AMIL, trintaDias], [SELECT, { tipo: 'sem_prazo', n: null }]]),
      '2026-11',
      '2026-11-02',
    );
    expect(cal.mes).toEqual([]);
    expect(cal.semPrazo.map((i) => ({
      lote: i.idLoteFaturamento,
      convenio: i.fontePagadora.nome,
      motivo: i.motivoSemPrazo,
      quantidade: i.quantidade,
      valor: i.valor,
    }))).toEqual([
      { lote: 700, convenio: 'CASSI', motivo: 'sem-regra', quantidade: 1, valor: 500 },
      { lote: 600, convenio: 'SELECT', motivo: 'regra-sem-prazo', quantidade: 2, valor: 25 },
      { lote: 800, convenio: 'AMIL', motivo: 'sem-recebimento', quantidade: 1, valor: 20 },
      { lote: 900, convenio: null, motivo: 'sem-regra', quantidade: 1, valor: 1 },
    ]);
  });

  it('uma regra alterada muda o prazo na próxima leitura', () => {
    const requisicoes = [glosada()];
    const antes = calendarioDeRecursos(requisicoes, regras, '2026-11', '2026-11-02');
    const depois = calendarioDeRecursos(requisicoes, new Map([[AMIL, { tipo: 'dias_corridos', n: 31 } as RegraPrazo]]), '2026-11', '2026-11-02');
    expect([antes.mes[0].prazo, depois.mes[0].prazo]).toEqual(['2026-11-11', '2026-11-12']);
  });

  it('principais motivos do item: os mais frequentes entre as requisições, até três', () => {
    const cal = calendarioDeRecursos(
      [
        glosada({ id: 1, motivos: ['A', 'B'] }),
        glosada({ id: 2, motivos: ['B', 'C'] }),
        glosada({ id: 3, motivos: ['B', 'D', 'C'] }),
        glosada({ id: 4, motivos: ['E'] }),
      ],
      regras,
      '2026-11',
      '2026-11-02',
    );
    expect(cal.mes[0].motivos).toEqual([
      { motivo: 'B', quantidade: 3 },
      { motivo: 'C', quantidade: 2 },
      { motivo: 'A', quantidade: 1 },
    ]);
    expect(cal.mes[0].qtdOutrosMotivos).toBe(2);
  });
});
