import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoteFaturamento, LotePreviaAplis, NfAPreencherAplis } from '../types';
import {
  competenciaDaEmissao,
  corpoTituloAplis,
  corteAplisPadrao,
  emParalelo,
  observacaoAplis,
  PISO_CORTE_APLIS,
  resumoExecucao,
  selecaoPadraoAplis,
  selecaoPadraoNfs,
} from './atualizarAplis';

describe('corteAplisPadrao', () => {
  it('é o 1º dia do mês anterior', () => {
    expect(corteAplisPadrao(new Date(2026, 10, 15))).toBe('2026-10-01');
  });

  it('na virada de ano, volta para dezembro do ano anterior', () => {
    expect(corteAplisPadrao(new Date(2027, 0, 5))).toBe('2026-12-01');
  });

  it('no último dia do mês não pula para dois meses antes', () => {
    expect(corteAplisPadrao(new Date(2027, 2, 31))).toBe('2027-02-01');
  });

  it('nunca cai antes do piso de 01/09/2026 (em 30/09, agosto vira setembro)', () => {
    expect(PISO_CORTE_APLIS).toBe('2026-09-01');
    expect(corteAplisPadrao(new Date(2026, 8, 30))).toBe('2026-09-01');
  });

  it('no mês seguinte ao piso, o mês anterior é o próprio piso', () => {
    expect(corteAplisPadrao(new Date(2026, 9, 1))).toBe('2026-09-01');
  });
});

function itemPrevia(parcial: Partial<LotePreviaAplis> & { idLote?: number } = {}): LotePreviaAplis {
  const { idLote = 7001, ...resto } = parcial;
  return {
    lote: { idLote, dtaCriacao: '2026-09-02', nfeNumero: null } as LoteFaturamento,
    bloqueio: null,
    jaRecebidoAplis: false,
    semNf: true,
    desvinculado: null,
    ...resto,
  };
}

describe('competenciaDaEmissao', () => {
  it('é o mês da emissão', () => {
    expect(competenciaDaEmissao('2026-08-31')).toBe('2026-08');
    expect(competenciaDaEmissao('2027-01-01')).toBe('2027-01');
  });
});

describe('observacaoAplis', () => {
  it('leva a data local em DD/MM', () => {
    expect(observacaoAplis(new Date(2026, 9, 5, 23, 30))).toBe('Criado pelo Atualizar a partir do apLIS em 05/10');
  });
});

describe('selecaoPadraoAplis', () => {
  it('marca os válidos e deixa de fora bloqueados e desvinculados', () => {
    const selecao = selecaoPadraoAplis([
      itemPrevia({ idLote: 1 }),
      itemPrevia({ idLote: 2, bloqueio: 'sem-valor' }),
      itemPrevia({
        idLote: 3,
        desvinculado: { idNota: 'n1', numeroNota: '123', em: '2026-09-10T12:00:00Z', motivo: 'lote errado' },
      }),
      itemPrevia({ idLote: 4, jaRecebidoAplis: true }),
    ]);
    expect([...selecao].sort()).toEqual([1, 4]);
  });
});

describe('corpoTituloAplis', () => {
  const hoje = new Date(2026, 9, 1);

  it('1 lote, emissão = fechamento do lote e competência = mês dessa emissão', () => {
    const corpo = corpoTituloAplis({ idLote: 6601, dtaFechamento: '2026-08-28', nfeNumero: null }, hoje);
    expect(corpo).toEqual({
      idsLote: [6601],
      dataEmissao: '2026-08-28',
      competencia: '2026-08',
      observacoes: 'Criado pelo Atualizar a partir do apLIS em 01/10',
    });
  });

  it('leva a NF-e do lote como número da nota, quando já existe', () => {
    const corpo = corpoTituloAplis({ idLote: 6602, dtaFechamento: '2026-09-03', nfeNumero: '4521' }, hoje);
    expect(corpo.numeroNota).toBe('4521');
  });

  describe('lote sem data de fechamento', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 10, 3, 10));
    });
    afterEach(() => vi.useRealTimers());

    it('emissão e competência saem da mesma conta (hoje)', () => {
      const corpo = corpoTituloAplis({ idLote: 6603, dtaFechamento: null, nfeNumero: null }, hoje);
      expect(corpo.dataEmissao).toBe('2026-11-03');
      expect(corpo.competencia).toBe('2026-11');
    });
  });
});

describe('resumoExecucao', () => {
  it('conta criados e falhas', () => {
    expect(resumoExecucao(['criado', 'criado', 'falhou', 'criado'])).toEqual({
      criados: 3,
      falharam: 1,
      nfsPreenchidas: 0,
      texto: '3 títulos criados, 1 falhou',
    });
  });

  it('singular e sem falhas', () => {
    expect(resumoExecucao(['criado']).texto).toBe('1 título criado');
  });

  it('só falhas', () => {
    expect(resumoExecucao(['falhou', 'falhou']).texto).toBe('0 títulos criados, 2 falharam');
  });

  it('ignora linhas que não chegaram a rodar', () => {
    expect(resumoExecucao(['criado', 'aguardando', 'criando']).criados).toBe(1);
  });

  it('inclui as NFs preenchidas', () => {
    expect(
      resumoExecucao(
        ['criado', 'criado', 'falhou'],
        ['preenchido', 'preenchido', 'ja-preenchido', 'falhou', 'aguardando'],
      ),
    ).toEqual({
      criados: 2,
      falharam: 1,
      nfsPreenchidas: 2,
      texto: '2 títulos criados, 1 falhou, 2 NFs preenchidas, 1 NF já preenchida, 1 NF falhou',
    });
  });

  it('só NFs: não fala de títulos', () => {
    expect(resumoExecucao([], ['preenchido']).texto).toBe('1 NF preenchida');
  });

  it('"já preenchido" não conta como falha nem como preenchida', () => {
    const resumo = resumoExecucao([], ['ja-preenchido', 'ja-preenchido']);
    expect(resumo.nfsPreenchidas).toBe(0);
    expect(resumo.texto).toBe('0 NFs preenchidas, 2 NFs já preenchidas');
  });
});

describe('selecaoPadraoNfs', () => {
  const nf = (idNota: string, situacao: NfAPreencherAplis['situacao']): NfAPreencherAplis => ({
    idNota, idsLote: [1], operadora: 'X', situacao, nfeNumeros: ['1'],
  });

  it('marca as preenchíveis e deixa as divergentes de fora', () => {
    expect(selecaoPadraoNfs([nf('a', 'preenchivel'), nf('b', 'divergente'), nf('c', 'preenchivel')]))
      .toEqual(new Set(['a', 'c']));
  });
});

describe('emParalelo', () => {
  it('nunca passa do limite de chamadas simultâneas e processa todos', async () => {
    let ativos = 0;
    let pico = 0;
    const feitos: number[] = [];
    await emParalelo([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (n) => {
      ativos += 1;
      pico = Math.max(pico, ativos);
      await new Promise((r) => setTimeout(r, 1));
      ativos -= 1;
      feitos.push(n);
    });
    expect(pico).toBe(4);
    expect(feitos.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('uma falha não interrompe as demais', async () => {
    const feitos: number[] = [];
    await emParalelo([1, 2, 3], 2, async (n) => {
      if (n === 1) throw new Error('falhou');
      feitos.push(n);
    });
    expect(feitos.sort()).toEqual([2, 3]);
  });

  it('parar() impede novas chamadas, sem cortar as que já começaram', async () => {
    const iniciados: number[] = [];
    let parado = false;
    await emParalelo(
      [1, 2, 3, 4, 5],
      2,
      async (n) => {
        iniciados.push(n);
        await new Promise((r) => setTimeout(r, 1));
        parado = true;
      },
      () => parado,
    );
    expect(iniciados.sort()).toEqual([1, 2]);
  });
});
