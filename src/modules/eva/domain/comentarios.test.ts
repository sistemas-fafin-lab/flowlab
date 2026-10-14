import { describe, expect, it } from 'vitest';
import {
  comentarioAtrasadas, comentarioKanban, comentarioMinhasTasks, comentarioProjetos, comentarioWhatsapp, montarComentarios,
  type EntradaComentarios,
} from './comentarios';
import { card } from './testes/fabricas';
import type { CardTI } from './demandas';
import type { EvaInsightData, ProjectSummary } from '../types';
import type { MensagemFila } from './whatsapp';

const HOJE = '2026-10-13';
const AGORA = new Date('2026-10-13T15:00:00Z').getTime();
const NOMES = { 'u-ana': 'Ana Costa', 'u-diego': 'Diego Lima', 'u-bruno': 'Bruno Mendes' };

const entrada = (e: Partial<EntradaComentarios>): EntradaComentarios => ({
  visao: 'team', usuarioId: 'u-bruno', hoje: HOJE, cards: [], nomes: NOMES, projetos: [], ehGestor: true,
  config: null, ultimaReuniao: null, pendentesDaReuniao: null, agora: AGORA, ...e,
});

/** Ana com 4 em Revisão, Diego com 1 card em aberto. */
function boardConcentrado(): CardTI[] {
  return [
    card({ kanban_status: 'review', assigned_to: ['u-ana'], priority: 'critical' }),
    card({ kanban_status: 'review', assigned_to: ['u-ana'], priority: 'high' }),
    card({ kanban_status: 'review', assigned_to: ['u-ana'], priority: 'low', codigo: 'IT-045' }),
    card({ kanban_status: 'review', assigned_to: ['u-ana'], priority: 'medium', codigo: 'IT-052' }),
    card({ kanban_status: 'review', assigned_to: ['u-bruno'] }),
    card({ kanban_status: 'in_progress', assigned_to: ['u-diego'] }),
  ];
}

describe('Kanban: coluna concentrada numa pessoa', () => {
  it('propõe passar os 2 cards de menor destaque para quem tem menos carga', () => {
    const c = comentarioKanban(entrada({ cards: boardConcentrado() }))!;
    expect(c.text).toBe('A coluna Revisão tem 5 cards, 4 com Ana. Diego tem menos carga (1 card em aberto).');
    expect(c.acao).toMatchObject({ tipo: 'propor', titulo: 'Passar IT-045 e IT-052 de Ana para Diego?' });
    const propostas = c.acao.tipo === 'propor' ? c.acao.propostas : [];
    expect(propostas.map((p) => [p.card.codigo, p.proposta.responsaveis])).toEqual([['IT-045', ['u-diego']], ['IT-052', ['u-diego']]]);
  });

  it('some sem colega folgado, abaixo do limite ou na Minha visão', () => {
    // Diego e Bruno com 2 ou mais em aberto: ninguém tem 3 a menos que a Ana (4).
    const semFolga = [...boardConcentrado(), card({ assigned_to: ['u-diego'] }), card({ assigned_to: ['u-bruno'] })];
    expect(comentarioKanban(entrada({ cards: semFolga }))).toBeUndefined();
    expect(comentarioKanban(entrada({ cards: boardConcentrado().slice(1) }))).toBeUndefined();
    expect(comentarioKanban(entrada({ cards: boardConcentrado(), visao: 'me' }))).toBeUndefined();
  });
});

describe('Atrasadas', () => {
  it('crítica atrasada sem responsável vem primeiro', () => {
    const cards = [
      card({ due_date: '2026-10-01T00:00:00.000Z', assigned_to: ['u-ana'] }),
      card({ due_date: '2026-10-10T00:00:00.000Z', priority: 'critical', codigo: 'IT-031', title: 'Firewall' }),
    ];
    const c = comentarioAtrasadas(entrada({ cards }))!;
    expect(c.text).toBe('IT-031 (Firewall) está atrasado há 3 dias e sem responsável.');
    expect(c.acao).toEqual({ tipo: 'abrir_card', cardId: cards[1].id });
  });

  it('atraso de 7 dias ou mais pede revisão; menos que isso, nada', () => {
    const longo = card({ due_date: '2026-10-05T00:00:00.000Z', assigned_to: ['u-ana'], codigo: 'IT-020', title: 'LIS' });
    expect(comentarioAtrasadas(entrada({ cards: [longo] }))?.text).toBe('IT-020 (LIS) está atrasado há 8 dias, com Ana. Vale revisar o prazo ou o escopo.');
    expect(comentarioAtrasadas(entrada({ cards: [card({ due_date: '2026-10-10T00:00:00.000Z', assigned_to: ['u-ana'] })] }))).toBeUndefined();
  });

  it('na Minha visão, só os meus', () => {
    const daAna = card({ due_date: '2026-10-01T00:00:00.000Z', assigned_to: ['u-ana'] });
    expect(comentarioAtrasadas(entrada({ cards: [daAna], visao: 'me' }))).toBeUndefined();
  });
});

describe('WhatsApp (gestor)', () => {
  const cfg = { granola_folder_id: null, granola_verificado_em: null, granola_ultimo_erro: null, waha_status: 'WORKING', waha_verificado_em: '2026-10-13T13:00:00Z', whatsapp_ativo: true };

  it('Wa-ha sem sinal com o envio ligado', () => {
    const c = comentarioWhatsapp(entrada({ config: cfg }))!;
    expect(c.text).toBe('O Wa-ha está sem sinal da VPS. As mensagens esperam na fila até a sessão voltar.');
    expect(c.acao).toEqual({ tipo: 'navegar', para: '/it/eva/configuracoes' });
  });

  it('some com a sessão ok, com o envio desligado ou para quem não é gestor', () => {
    expect(comentarioWhatsapp(entrada({ config: { ...cfg, waha_verificado_em: '2026-10-13T14:59:00Z' } }))).toBeUndefined();
    expect(comentarioWhatsapp(entrada({ config: { ...cfg, whatsapp_ativo: false } }))).toBeUndefined();
    expect(comentarioWhatsapp(entrada({ config: cfg, ehGestor: false }))).toBeUndefined();
  });
});

describe('Projetos', () => {
  const reuniao = { id: 'r1', titulo: 'Sprint review', realizada_em: '2026-10-10T17:00:00Z', analisada_em: '2026-10-10T18:00:00Z', observacoes: 'Portal antes do LIS.' };
  const risco: ProjectSummary = { id: 'p1', name: 'Portal', sprint: 'Sprint 6', done: 2, total: 10, due: '17/10', status: 'at_risk', isMine: false };

  it('reunião recente com sugestões pendentes leva às sugestões', () => {
    const c = comentarioProjetos(entrada({ ultimaReuniao: reuniao, pendentesDaReuniao: 3 }))!;
    expect(c.source).toBe('Granola · Sprint review 10/10');
    expect(c.text).toBe('A reunião de 10/10 gerou 3 sugestões que ainda aguardam aprovação.');
    expect(c.acao).toEqual({ tipo: 'navegar', para: '/it/eva' });
  });

  it('sem pendentes, mostra as decisões e abre o chat', () => {
    const c = comentarioProjetos(entrada({ ultimaReuniao: reuniao, pendentesDaReuniao: 0 }))!;
    expect(c.text).toBe('Portal antes do LIS.');
    expect(c.acao.tipo).toBe('chat');
  });

  it('reunião velha dá lugar ao projeto em risco', () => {
    const velha = { ...reuniao, analisada_em: '2026-09-01T18:00:00Z', realizada_em: '2026-09-01T17:00:00Z' };
    const c = comentarioProjetos(entrada({ ultimaReuniao: velha, projetos: [risco] }))!;
    expect(c.text).toBe('O projeto Portal está em risco: 2 de 10 cards feitos, prazo 17/10.');
    expect(c.acao).toEqual({ tipo: 'navegar', para: '/it/projects/p1' });
    expect(comentarioProjetos(entrada({ projetos: [{ ...risco, status: 'on_track' }] }))).toBeUndefined();
  });
});

describe('Minhas tasks', () => {
  it('card meu de hoje parado em Revisão há 3 dias ou mais', () => {
    const parado = card({ assigned_to: ['u-bruno'], kanban_status: 'review', due_date: '2026-10-13T00:00:00.000Z', updated_at: '2026-10-09T12:00:00Z', codigo: 'IT-052', title: 'Upload' });
    expect(comentarioMinhasTasks(entrada({ cards: [parado] }))?.text).toBe('IT-052 (Upload) vence hoje e está em Revisão sem mudança há 4 dias.');
    expect(comentarioMinhasTasks(entrada({ cards: [{ ...parado, updated_at: '2026-10-12T12:00:00Z' }] }))).toBeUndefined();
  });
});

describe('regras com a fila do WhatsApp (gestor, D24)', () => {
  const msg = (m: Partial<MensagemFila>): MensagemFila => ({
    id: 'w1', membro_id: 'm-ana', membro_user_id: 'u-ana', membro_nome: 'Ana Costa', direcao: 'saida', tipo: 'cobranca_manual',
    texto: 't', card_ids: [], status: 'enviada', erro: null, created_at: '2026-10-13T10:00:00Z', enviada_em: '2026-10-13T10:00:20Z', ...m,
  });
  const atrasado = card({ codigo: 'IT-020', title: 'LIS', assigned_to: ['u-ana'], due_date: '2026-10-10T00:00:00.000Z' });
  const cfg = { granola_folder_id: null, granola_verificado_em: null, granola_ultimo_erro: null, waha_status: 'WORKING', waha_verificado_em: '2026-10-13T14:59:00Z', whatsapp_ativo: true };

  it('cobrança sem resposta há mais de 4 h: "Cobrar de novo"', () => {
    const fila = [msg({ card_ids: [atrasado.id] })];
    const c = comentarioAtrasadas(entrada({ cards: [atrasado], fila }))!;
    expect(c.text).toBe('Ana não respondeu à cobrança às 07:00 sobre o IT-020 (LIS).');
    expect(c.acao).toEqual({ tipo: 'cobrar', cardId: atrasado.id });
  });

  it('some com resposta, dentro das 4 h ou para quem não é gestor', () => {
    const cobranca = msg({ card_ids: [atrasado.id] });
    const resposta = msg({ id: 'w2', direcao: 'entrada', tipo: 'recebida', status: 'recebida', created_at: '2026-10-13T11:00:00Z', enviada_em: null });
    expect(comentarioAtrasadas(entrada({ cards: [atrasado], fila: [cobranca, resposta] }))).toBeUndefined();
    expect(comentarioAtrasadas(entrada({ cards: [atrasado], fila: [cobranca], agora: new Date('2026-10-13T12:00:00Z').getTime() }))).toBeUndefined();
    expect(comentarioAtrasadas(entrada({ cards: [atrasado], fila: [cobranca], ehGestor: false }))).toBeUndefined();
  });

  it('mensagem que falhou hoje leva ao histórico', () => {
    const fila = [msg({ status: 'falhou', erro: 'O número 5561988887777 não está no WhatsApp.', membro_nome: 'Diego Lima', created_at: '2026-10-13T11:45:00Z' })];
    const c = comentarioWhatsapp(entrada({ config: cfg, fila }))!;
    expect(c.text).toBe('Uma mensagem para Diego falhou às 08:45: O número 5561988887777 não está no WhatsApp.');
    expect(c.acao).toEqual({ tipo: 'navegar', para: '/it/eva/membros' });
    expect(comentarioWhatsapp(entrada({ config: cfg, fila: [msg({ status: 'falhou', created_at: '2026-10-12T11:45:00Z' })] }))).toBeUndefined();
  });
});

describe('regra de ouro (D28)', () => {
  it('nenhum texto antes da execução diz que a EVA já fez', () => {
    const cards = [
      ...boardConcentrado(),
      card({ due_date: '2026-10-01T00:00:00.000Z', priority: 'critical' }),
      card({ assigned_to: ['u-bruno'], kanban_status: 'review', due_date: '2026-10-13T00:00:00.000Z', updated_at: '2026-10-01T12:00:00Z' }),
    ];
    const todos = montarComentarios(entrada({
      cards,
      config: { granola_folder_id: null, granola_verificado_em: null, granola_ultimo_erro: null, waha_status: null, waha_verificado_em: '2026-10-01T00:00:00Z', whatsapp_ativo: true },
      ultimaReuniao: { id: 'r', titulo: 'Review', realizada_em: '2026-10-12T17:00:00Z', analisada_em: '2026-10-12T18:00:00Z', observacoes: 'x' },
      pendentesDaReuniao: 2,
    }));
    const lista = Object.values(todos).filter(Boolean) as EvaInsightData[];
    expect(lista).toHaveLength(5);
    const textos = lista.flatMap((c) => [c.text, c.ctaLabel, c.askPrompt, c.acao.tipo === 'propor' ? c.acao.titulo : '']);
    for (const t of textos) expect(t).not.toMatch(/\b(movi|atualizei|criei|bloqueei|reservei|passei|cobrei)\b/i);
  });
});
