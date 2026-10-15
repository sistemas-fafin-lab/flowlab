import { describe, expect, it } from 'vitest';
import {
  INSTRUCOES_CHAT, MAX_HISTORICO, SchemaChat, montarContextoChat, montarConteudoChat, recortarParaVisao, validarRespostaChat,
} from './chat.js';
import type { ContextoExtracao, SugestaoBruta } from './extracao.js';

// Dados fictícios (nenhum dado real no repositório).
const CTX: ContextoExtracao = {
  membros: [
    { id: 'u-ana', nome: 'Ana Costa', apelidos: ['Ana'] },
    { id: 'u-bruno', nome: 'Bruno Mendes', apelidos: ['Bruno'] },
  ],
  cards: [
    { id: 'c1', codigo: 'IT-010', title: 'Portal de agendamento', kanban_status: 'in_progress', priority: 'high', assigned_to: ['u-ana'], due_date: '2026-10-20T00:00:00.000Z', project_id: null },
    { id: 'c2', codigo: 'IT-011', title: 'Backup do LIS', kanban_status: 'todo', priority: 'medium', assigned_to: ['u-bruno'], due_date: null, project_id: null },
  ],
  projetos: [],
  sprints: [],
};

const proposta = (s: Partial<SugestaoBruta>): SugestaoBruta => ({
  tipo: 'atualizar_card', card_codigo: null, titulo: null, descricao: null, responsaveis: [], prazo: null, prazo_texto: null,
  prioridade: null, kanban_status: null, projeto_id: null, sprint: null, comentario: null, trecho: 'pedido', confianca: 'alta', ...s,
});

describe('contexto e conteúdo do chat', () => {
  it('leva a data de hoje, o board e a última reunião cortada', () => {
    const c = montarContextoChat(CTX, { titulo: 'Sprint review', realizadaEm: '2026-10-10T17:00:00Z', observacoes: 'Portal antes do LIS.', resumo: 'x'.repeat(9000) }, '2026-10-13');
    expect(c).toContain('Hoje é 2026-10-13.');
    expect(c).toContain('IT-010 | Portal de agendamento');
    expect(c).toContain('Principais decisões: Portal antes do LIS.');
    expect(c).toContain('[resumo cortado]');
  });

  it('sem reunião analisada, diz que não há', () => {
    expect(montarContextoChat(CTX, null, '2026-10-13')).toContain('(nenhuma ainda)');
  });

  it('a fila do WhatsApp só aparece quando vem (gestor, D24)', () => {
    expect(montarContextoChat(CTX, null, '2026-10-13')).not.toContain('FILA DO WHATSAPP');
    const c = montarContextoChat(CTX, null, '2026-10-13', [{ quando: '13/10 10:12', para: 'Ana Costa', direcao: 'saida', status: 'enviada', texto: 'Bom dia, Ana' }]);
    expect(c).toContain('- 13/10 10:12 | para Ana Costa | enviada | Bom dia, Ana');
    expect(montarContextoChat(CTX, null, '2026-10-13', [])).toContain('FILA DO WHATSAPP (últimas mensagens)\n(vazia)');
  });

  it('pergunta e histórico vão delimitados, só as últimas mensagens (RN15)', () => {
    const historico = Array.from({ length: 10 }, (_, i) => ({ de: i % 2 ? 'eva' as const : 'eu' as const, texto: `m${i}` }));
    const c = montarConteudoChat('O que está atrasado?', historico);
    expect(c).toContain('<pergunta>\nO que está atrasado?\n</pergunta>');
    expect(c).not.toContain('m0');
    expect(c.match(/^(Pessoa|EVA): /gm)).toHaveLength(MAX_HISTORICO);
    expect(INSTRUCOES_CHAT).toContain('Nunca diga que já mudou');
  });

  it('Minha visão só leva os cards da pessoa', () => {
    expect(recortarParaVisao(CTX, 'me', 'u-bruno').cards.map((c) => c.codigo)).toEqual(['IT-011']);
    expect(recortarParaVisao(CTX, 'team', 'u-bruno').cards).toHaveLength(2);
  });
});

describe('validarRespostaChat', () => {
  it('descarta códigos citados que não estão no contexto', () => {
    const r = validarRespostaChat({ resposta: ' ok ', cards_citados: ['it-010', 'IT-999', 'IT-010'], propostas: [], avisos: [] }, CTX);
    expect(r).toEqual({ resposta: 'ok', cardsCitados: ['IT-010'], propostas: [], nomes: {}, avisos: [] });
  });

  it('proposta passa pela mesma validação das reuniões e leva o card para exibição', () => {
    const r = validarRespostaChat({
      resposta: 'Preparei a proposta.',
      cards_citados: ['IT-011'],
      propostas: [proposta({ card_codigo: 'IT-011', kanban_status: 'in_progress' }), proposta({ card_codigo: 'IT-010', kanban_status: 'in_progress' })], avisos: [],
    }, CTX);
    // A segunda não muda nada (o card já está em andamento): fica de fora.
    expect(r.propostas).toHaveLength(1);
    expect(r.nomes).toEqual({ 'u-bruno': 'Bruno Mendes' });
    expect(r.propostas[0]).toMatchObject({ tipo: 'atualizar_card', card_id: 'c2', proposta: { kanban_status: 'in_progress' }, card: { id: 'c2', codigo: 'IT-011', title: 'Backup do LIS', kanban_status: 'todo', assigned_to: ['u-bruno'] } });
  });

  it('pedido sobre card fora do contexto não vira card novo, como na reunião', () => {
    const r = validarRespostaChat({ resposta: 'x', cards_citados: [], propostas: [proposta({ card_codigo: 'IT-999', titulo: 'Algo', kanban_status: 'done' })], avisos: [] }, CTX);
    expect(r.propostas).toEqual([]);
  });

  it('aviso pelo WhatsApp (D32): só para pessoa conhecida, com texto, no máximo 3', () => {
    const r = validarRespostaChat({
      resposta: 'Preparei o aviso.', cards_citados: [], propostas: [],
      avisos: [
        { pessoa_id: 'u-bruno', texto: '  A reunião mudou para as 10h.  ' },
        { pessoa_id: 'u-desconhecido', texto: 'oi' },
        { pessoa_id: 'u-bruno', texto: '   ' },
      ],
    }, CTX);
    expect(r.avisos).toEqual([{ pessoaId: 'u-bruno', nome: 'Bruno Mendes', texto: 'A reunião mudou para as 10h.' }]);
    expect(INSTRUCOES_CHAT).toContain('"avisos"');
  });

  it('o contexto diz se quem pergunta pode mandar avisos', () => {
    expect(montarContextoChat(CTX, null, '2026-10-13', null, true)).toContain('Quem pergunta: gestor da EVA (pode mandar avisos pelo WhatsApp).');
    expect(montarContextoChat(CTX, null, '2026-10-13')).toContain('Quem pergunta: equipe (não manda avisos pelo WhatsApp).');
  });

  it('o schema exige os campos', () => {
    expect(SchemaChat.safeParse({ resposta: 'oi', cards_citados: [], propostas: [], avisos: [] }).success).toBe(true);
    expect(SchemaChat.safeParse({ resposta: 'oi' }).success).toBe(false);
  });
});
