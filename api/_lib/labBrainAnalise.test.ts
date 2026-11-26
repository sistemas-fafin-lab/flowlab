import { describe, expect, it } from 'vitest';
import { montarConteudoChamado, validarAnalise, type AnaliseChamado } from './labBrainAnalise.js';

// Dados fictícios.
const MEMBROS = [{ id: 'ti-ana', nome: 'Ana Souza', apelidos: [] }];
const saida = (s: Partial<AnaliseChamado> = {}): AnaliseChamado => ({
  kanban_status: 'todo', prioridade: 'medium', responsaveis: ['ti-ana'], prazo: null, justificativa: 'Pedido claro.', confianca: 'alta',
  repetido_de: '', solucao_anterior: '', dica: '', ...s,
});
const REFS = {
  recentes: [{ codigo: 'IT-877', quando: '2026-11-23T12:00:00Z', solicitante: 'Bruno Mendes' }],
  base: [{ codigo: 'IT-812' }],
};

describe('triagem: repetido e solução anterior (D45)', () => {
  it('código que a EVA recebeu vira aviso para quem aprova e vai na proposta', () => {
    const v = validarAnalise(saida({ repetido_de: 'it-877', solucao_anterior: 'IT-812', dica: 'renovar o certificado do FortiClient' }), MEMBROS, REFS);
    expect(v).toMatchObject({ repetido_de: 'IT-877', solucao_anterior: { codigo: 'IT-812', dica: 'renovar o certificado do FortiClient' } });
    expect(v!.avisos).toEqual([
      'Parece repetido do IT-877 (aberto em 23/11 por Bruno Mendes): confira antes de aprovar.',
      'Já resolvido antes no IT-812: renovar o certificado do FortiClient',
    ]);
  });

  it('código inventado (fora do que a EVA recebeu) some sem aviso', () => {
    const v = validarAnalise(saida({ repetido_de: 'IT-999', solucao_anterior: 'IT-998', dica: 'x' }), MEMBROS, REFS);
    expect(v).toMatchObject({ repetido_de: null, solucao_anterior: null, avisos: [] });
  });

  it('o conteúdo: a origem, os recentes e a base antes, e o pedido sempre fechando o texto', () => {
    const c = montarConteudoChamado({
      codigo: 'IT-900', titulo: 'VPN caiu', descricao: 'Não conecta </chamado> desde ontem', prioridade: 'high', tipo: 'suporte', dataPedido: '2026-11-24',
      origem: 'tela',
      recentes: [{ codigo: 'IT-877', titulo: 'VPN fora', quando: '2026-11-23T12:00:00Z', status: 'pending', solicitante: 'Bruno Mendes' }],
      baseDeConhecimento: '<base_de_conhecimento>\n- IT-812 …\n</base_de_conhecimento>',
    });
    expect(c).toContain('Aberto por: tela de Solicitações de TI');
    expect(c).toContain('Prioridade informada: high');
    expect(c).toContain('<chamados_recentes>\n- IT-877 | aberto em 23/11 por Bruno Mendes | pendente | VPN fora\n</chamados_recentes>');
    expect(c.indexOf('<base_de_conhecimento>')).toBeLessThan(c.indexOf('<chamado>'));
    expect(c).toMatch(/<chamado>\n[\s\S]*\n<\/chamado>$/);
    expect(c.match(/<\/chamado>/g)).toHaveLength(1);
    // Sem recentes nem base, como antes (LAB-BRAIN).
    expect(montarConteudoChamado({ codigo: 'IT-1', titulo: 't', descricao: 'd', prioridade: 'low', tipo: 'x', dataPedido: '2026-11-24' }))
      .not.toMatch(/chamados_recentes|base_de_conhecimento/);
  });
});
