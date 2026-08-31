import { describe, expect, it } from 'vitest';
import { agruparCiclosPlanoAcao, ordenarReavaliacoesPorData, pontaDoCiclo, reavaliacaoMaisRecente } from './riscosGerenciamento.js';
import type { PlanoAcaoDTO, ReavaliacaoRiscoDTO } from '../types';

function reavaliacao(overrides: Partial<ReavaliacaoRiscoDTO> = {}): ReavaliacaoRiscoDTO {
  return {
    id: 'r1',
    riscoId: 'risco-1',
    probabilidade: 2,
    severidade: 2,
    score: 4,
    observacao: null,
    reavaliadoPor: 'user-1',
    reavaliadoEm: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function plano(overrides: Partial<PlanoAcaoDTO> = {}): PlanoAcaoDTO {
  return {
    id: 'p1',
    riscoId: 'risco-1',
    acao: 'Ação de teste',
    responsavelId: 'user-1',
    responsavelNome: 'Fulano',
    dataPrevista: null,
    dataConclusao: null,
    status: 'planejado',
    evidencias: [],
    eficaz: null,
    avaliadoEm: null,
    avaliadoPor: null,
    observacaoEficacia: null,
    planoAnteriorId: null,
    criadoPor: 'user-1',
    criadoEm: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ordenarReavaliacoesPorData', () => {
  it('ordena da mais recente para a mais antiga', () => {
    const antiga = reavaliacao({ id: 'antiga', reavaliadoEm: '2026-01-01T00:00:00Z' });
    const recente = reavaliacao({ id: 'recente', reavaliadoEm: '2026-06-01T00:00:00Z' });
    expect(ordenarReavaliacoesPorData([antiga, recente]).map((r) => r.id)).toEqual(['recente', 'antiga']);
  });

  it('não muta o array original', () => {
    const lista = [reavaliacao({ id: 'a', reavaliadoEm: '2026-01-01T00:00:00Z' })];
    const resultado = ordenarReavaliacoesPorData(lista);
    expect(resultado).not.toBe(lista);
  });
});

describe('reavaliacaoMaisRecente', () => {
  it('retorna null quando o risco nunca foi reavaliado', () => {
    expect(reavaliacaoMaisRecente([])).toBeNull();
  });

  it('retorna a reavaliação mais recente (risco residual atual)', () => {
    const antiga = reavaliacao({ id: 'antiga', reavaliadoEm: '2026-01-01T00:00:00Z' });
    const recente = reavaliacao({ id: 'recente', reavaliadoEm: '2026-06-01T00:00:00Z' });
    expect(reavaliacaoMaisRecente([antiga, recente])?.id).toBe('recente');
  });
});

describe('agruparCiclosPlanoAcao', () => {
  it('um único plano sem antecessor forma um ciclo de 1', () => {
    const p1 = plano({ id: 'p1' });
    const ciclos = agruparCiclosPlanoAcao([p1]);
    expect(ciclos).toEqual([[p1]]);
  });

  it('planos independentes (nenhum vinculado) viram ciclos separados', () => {
    const p1 = plano({ id: 'p1' });
    const p2 = plano({ id: 'p2' });
    const ciclos = agruparCiclosPlanoAcao([p1, p2]);
    expect(ciclos).toHaveLength(2);
  });

  it('encadeia plano "não eficaz" → próximo plano preservando a ordem do ciclo', () => {
    const p1 = plano({ id: 'p1', eficaz: false });
    const p2 = plano({ id: 'p2', planoAnteriorId: 'p1', eficaz: false });
    const p3 = plano({ id: 'p3', planoAnteriorId: 'p2', eficaz: true });
    const ciclos = agruparCiclosPlanoAcao([p3, p1, p2]);
    expect(ciclos).toHaveLength(1);
    expect(ciclos[0].map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('dois riscos com ciclos independentes não se misturam', () => {
    const p1 = plano({ id: 'p1', eficaz: false });
    const p2 = plano({ id: 'p2', planoAnteriorId: 'p1' });
    const q1 = plano({ id: 'q1', riscoId: 'risco-2' });
    const ciclos = agruparCiclosPlanoAcao([p1, p2, q1]);
    expect(ciclos).toHaveLength(2);
  });
});

describe('pontaDoCiclo', () => {
  it('retorna o plano mais recente do ciclo', () => {
    const p1 = plano({ id: 'p1' });
    const p2 = plano({ id: 'p2', planoAnteriorId: 'p1' });
    expect(pontaDoCiclo([p1, p2])?.id).toBe('p2');
  });

  it('retorna null para ciclo vazio', () => {
    expect(pontaDoCiclo([])).toBeNull();
  });
});
