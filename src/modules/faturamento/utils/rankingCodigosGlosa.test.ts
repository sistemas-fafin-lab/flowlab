import { describe, expect, it } from 'vitest';
import { periodosComparativos } from './comparativos';
import {
  csvRequisicoesDoCodigo,
  montarRankingCodigosPorMes,
  rankingCodigos,
  requisicoesPorCodigo,
  SEM_CODIGO,
  type GlosaParaRanking,
  type ProcedimentoGlosado,
} from './rankingCodigosGlosa';

const proc = (codigo: string | null, valor: number | null, parcial: Partial<ProcedimentoGlosado> = {}): ProcedimentoGlosado => ({
  procedimento: '40301630',
  procedimentoDescricao: 'HEMOGRAMA',
  codigo,
  descricao: codigo ? `Motivo ${codigo}` : null,
  valor,
  data: '2026-10-20',
  ...parcial,
});

let seq = 0;
function glosa(parcial: Partial<GlosaParaRanking> & Pick<GlosaParaRanking, 'classe' | 'valor'>): GlosaParaRanking {
  seq += 1;
  return {
    idRequisicao: seq,
    codRequisicao: `R${seq}`,
    numGuia: `G${seq}`,
    lote: '1001',
    convenio: 'CASSI',
    statusAplis: 18,
    procedimentos: [],
    ...parcial,
  };
}

describe('rankingCodigos', () => {
  it('Acatada soma só as acatadas e Total soma todas as classes, como o funil', () => {
    const linhas = requisicoesPorCodigo([
      glosa({ classe: 'acatada', valor: 150, procedimentos: [proc('1705', 150)] }),
      glosa({ classe: 'em-disputa', valor: 100, statusAplis: 6, procedimentos: [proc('1705', 100)] }),
      glosa({ classe: 'recuperada', valor: 300, statusAplis: 17, procedimentos: [proc('3096', 300)] }),
    ]);

    const acatada = rankingCodigos(linhas, 'acatada');
    const total = rankingCodigos(linhas, 'total');

    expect(acatada.total).toBe(150);
    expect(acatada.linhas).toEqual([
      { codigo: '1705', descricao: 'Motivo 1705', valor: 150, quantidade: 1, percentual: 100 },
    ]);
    expect(total.total).toBe(550);
    expect(total.linhas.map((l) => [l.codigo, l.valor, l.quantidade])).toEqual([
      ['3096', 300, 1],
      ['1705', 250, 2],
    ]);
  });

  it('ordena por valor, depois quantidade, e deixa "Sem código" por último', () => {
    const linhas = requisicoesPorCodigo([
      glosa({ classe: 'acatada', valor: 999, procedimentos: [] }),
      glosa({ classe: 'acatada', valor: 50, procedimentos: [proc('2001', 50)] }),
      glosa({ classe: 'acatada', valor: 25, procedimentos: [proc('1001', 25)] }),
      glosa({ classe: 'acatada', valor: 25, procedimentos: [proc('1001', 25)] }),
      glosa({ classe: 'acatada', valor: 50, procedimentos: [proc('3001', 50)] }),
    ]);

    expect(rankingCodigos(linhas, 'acatada').linhas.map((l) => l.codigo)).toEqual(['1001', '2001', '3001', null]);
  });

  it('percentual sobre o total do modo, com 1 casa', () => {
    const linhas = requisicoesPorCodigo([
      glosa({ classe: 'acatada', valor: 1, procedimentos: [proc('1', 1)] }),
      glosa({ classe: 'acatada', valor: 2, procedimentos: [proc('2', 2)] }),
    ]);
    expect(rankingCodigos(linhas, 'acatada').linhas.map((l) => l.percentual)).toEqual([66.7, 33.3]);
  });

  it('modo sem glosa devolve total 0 e nenhuma linha', () => {
    expect(rankingCodigos([], 'acatada')).toEqual({ total: 0, linhas: [] });
  });
});

describe('requisicoesPorCodigo', () => {
  it('divide o valor da requisição entre os códigos pelo peso glosado, em centavos, sem perder centavo', () => {
    const linhas = requisicoesPorCodigo([
      glosa({
        classe: 'acatada',
        valor: 100,
        procedimentos: [proc('1', 10), proc('2', 10), proc('3', 10)],
      }),
    ]);

    expect(linhas.map((l) => l.valor)).toEqual([33.34, 33.33, 33.33]);
    expect(rankingCodigos(linhas, 'acatada').total).toBe(100);
  });

  it('código que veio junto de reimportações divergentes ("1705, 3096") vira dois códigos', () => {
    const linhas = requisicoesPorCodigo([glosa({ classe: 'acatada', valor: 80, procedimentos: [proc('1705, 3096', 80)] })]);
    expect(linhas.map((l) => [l.codigo, l.valor])).toEqual([['1705', 40], ['3096', 40]]);
  });

  it('sem valor glosado no apLIS, divide igualmente entre os códigos', () => {
    const linhas = requisicoesPorCodigo([
      glosa({ classe: 'acatada', valor: 10, procedimentos: [proc('1', null), proc('2', null)] }),
    ]);
    expect(linhas.map((l) => l.valor)).toEqual([5, 5]);
  });

  it('procedimento sem valor glosado pesa como a média dos que têm valor, e não some do rateio', () => {
    const linhas = requisicoesPorCodigo([
      glosa({ classe: 'acatada', valor: 90, procedimentos: [proc('1', 20), proc('2', 40), proc('3', null)] }),
    ]);
    // Pesos 20, 40 e 30 (média) → 20, 40, 30.
    expect(linhas.map((l) => [l.codigo, l.valor])).toEqual([['1', 20], ['2', 40], ['3', 30]]);
  });

  it('junta os procedimentos do mesmo código numa linha só', () => {
    const [linha] = requisicoesPorCodigo([
      glosa({
        classe: 'acatada',
        valor: 30,
        procedimentos: [
          proc('1705', 10, { procedimento: '40301630', procedimentoDescricao: 'HEMOGRAMA', data: '2026-10-02' }),
          proc('1705', 20, { procedimento: '40302040', procedimentoDescricao: 'GLICOSE', data: '2026-10-09' }),
        ],
      }),
    ]);
    expect(linha).toMatchObject({
      codigo: '1705',
      valor: 30,
      procedimento: '40301630 – HEMOGRAMA; 40302040 – GLICOSE',
      data: '2026-10-09',
    });
  });

  it('código sem descrição fica com descrição null (a tela mostra só o código)', () => {
    const linhas = requisicoesPorCodigo([
      glosa({ classe: 'acatada', valor: 10, procedimentos: [proc('3292', 10, { descricao: null })] }),
    ]);
    expect(rankingCodigos(linhas, 'acatada').linhas[0]).toMatchObject({ codigo: '3292', descricao: null });
  });

  it('procedimento glosado sem código manda a parte dele para "Sem código"', () => {
    const linhas = requisicoesPorCodigo([
      glosa({ classe: 'acatada', valor: 40, procedimentos: [proc('1705', 30), proc(null, 10)] }),
    ]);
    expect(linhas.map((l) => [l.codigo, l.valor])).toEqual([['1705', 30], [null, 10]]);
  });

  it('requisição sem código no apLIS entra inteira em "Sem código"', () => {
    const [linha] = requisicoesPorCodigo([glosa({ classe: 'em-disputa', valor: 12.34, procedimentos: [] })]);
    expect(linha).toMatchObject({ codigo: null, valor: 12.34, procedimento: '' });
    expect(SEM_CODIGO).toBe('Sem código');
  });
});

describe('csvRequisicoesDoCodigo', () => {
  it('tem as colunas pedidas, valor com vírgula e nenhum nome de paciente', () => {
    const linhas = requisicoesPorCodigo([
      glosa({ classe: 'acatada', valor: 1234.5, codRequisicao: '0042', numGuia: '987', procedimentos: [proc('1705', 1234.5)] }),
    ]);
    const csv = csvRequisicoesDoCodigo(linhas);
    const [cabecalho, primeira] = csv.replace('\uFEFF', '').split('\r\n');

    expect(cabecalho).toBe('Requisição;Guia;Lote;Convênio;Procedimento;Código;Valor glosado;Status;Classe no funil;Data');
    expect(primeira).toBe('0042;987;1001;CASSI;40301630 – HEMOGRAMA;1705;1234,50;Recebido a menor – acatado;Acatada;20/10/2026');
    expect(csv.toLowerCase()).not.toContain('paciente');
  });
});

describe('montarRankingCodigosPorMes', () => {
  it('um bloco por período, na ordem dos períodos, com os dois modos', () => {
    const periodos = periodosComparativos('2026-01')!;
    const meses = montarRankingCodigosPorMes(periodos, [
      { mes: '2025-12', glosa: glosa({ classe: 'acatada', valor: 10, procedimentos: [proc('1', 10)] }) },
      { mes: '2025-12', glosa: glosa({ classe: 'em-disputa', valor: 5, procedimentos: [proc('1', 5)] }) },
      { mes: '2025-09', glosa: glosa({ classe: 'acatada', valor: 99, procedimentos: [proc('1', 99)] }) },
    ]);

    expect(meses.map((m) => m.mes)).toEqual(['2026-01', '2025-12', '2025-11']);
    expect(meses[0]).toMatchObject({ ranking: { total: { total: 0 }, acatada: { total: 0 } }, requisicoes: [] });
    expect(meses[1].ranking.acatada.total).toBe(10);
    expect(meses[1].ranking.total.total).toBe(15);
    expect(meses[1].requisicoes).toHaveLength(2);
  });
});
