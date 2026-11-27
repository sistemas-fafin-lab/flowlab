import { describe, expect, it } from 'vitest';
import { TRECHO_REDISTRIBUICAO, periodoDoRitmo, propostasDaRedistribuicao, sugestoesDaRedistribuicao } from './planejamento.js';
import { montarPlanejamento } from '../../../src/modules/eva/domain/planejamento.js';
import { card } from '../../../src/modules/eva/domain/testes/fabricas.js';

// Dados fictícios. Segunda, 30/11/2026, sem sprint planejada.
const HOJE = '2026-11-30';
const PESSOAS = { 'u-ana': 'Ana Souza', 'u-bruno': 'Bruno Mendes' };

function plano() {
  const feitos = (quem: string, n: number) =>
    Array.from({ length: n }, () => card({ kanban_status: 'done', status: 'resolved', assigned_to: [quem], resolved_at: '2026-11-20T15:00:00Z' }));
  const daAna = Array.from({ length: 6 }, (_, i) => card({ id: `a${i}`, codigo: `IT-50${i}`, priority: 'low', assigned_to: ['u-ana'] }));
  return montarPlanejamento({ hoje: HOJE, cards: [...feitos('u-ana', 4), ...feitos('u-bruno', 8), ...daAna], sprints: [], equipe: Object.keys(PESSOAS), pessoas: PESSOAS });
}

describe('redistribuição como sugestões', () => {
  it('as 4 semanas do ritmo terminam hoje', () => {
    expect(periodoDoRitmo(HOJE)).toEqual({ de: '2026-11-03', ate: HOJE });
  });

  it('cada card passado adiante troca o responsável e comenta o motivo', () => {
    const p = plano();
    expect(p.movimentos).toHaveLength(2);
    const s = sugestoesDaRedistribuicao(p);
    expect(s[0]).toEqual({
      tipo: 'atualizar_card', card_id: p.movimentos[0].card.id, trecho: TRECHO_REDISTRIBUICAO, confianca: 'media', avisos: [],
      proposta: {
        responsaveis: ['u-bruno'],
        comentario: 'Redistribuído no planejamento até 11/12: Ana estava acima da capacidade, e Bruno tinha folga.',
      },
    });
  });

  it('no chat, vira cartão com o card de agora (antes → depois)', () => {
    const p = plano();
    const [primeira] = propostasDaRedistribuicao(p);
    expect(primeira.card).toMatchObject({ id: p.movimentos[0].card.id, codigo: p.movimentos[0].card.codigo, assigned_to: ['u-ana'] });
    expect(primeira.proposta.responsaveis).toEqual(['u-bruno']);
  });
});
