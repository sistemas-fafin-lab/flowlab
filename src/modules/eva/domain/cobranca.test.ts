import { describe, expect, it } from 'vitest';
import {
  JANELA_COBRANCA_MS, chaveDia, destinatarios, montarCobrancaManual, montarMensagemDiaria, pendenciasDoMembro, podeCobrar, proximaJanelaDeCobranca,
  type MembroCobranca,
} from './cobranca';
import { card } from './testes/fabricas';

const HOJE = '2026-10-13'; // terça
const SEXTA = '2026-10-16';
const EU = 'u-gabriel';
const prazo = (dia: string) => `${dia}T00:00:00.000Z`;

describe('pendenciasDoMembro (mesmas regras do Início)', () => {
  const atrasado = card({ codigo: 'IT-045', title: 'Robô de pré-faturamento', assigned_to: [EU], due_date: prazo('2026-10-10') });
  const hoje = card({ codigo: 'IT-050', assigned_to: [EU], due_date: prazo(HOJE) });
  const amanha = card({ codigo: 'IT-052', title: 'Hub de Laudos', assigned_to: [EU], due_date: prazo('2026-10-14') });
  const depois = card({ assigned_to: [EU], due_date: prazo('2026-10-15') });
  const parado = card({ codigo: 'IT-038', title: 'Auditoria Área', assigned_to: [EU], kanban_status: 'in_progress', updated_at: '2026-10-06T12:00:00Z' });
  const atrasadoEParado = card({ assigned_to: [EU], kanban_status: 'review', due_date: prazo('2026-10-01'), updated_at: '2026-10-01T12:00:00Z' });
  const deOutro = card({ assigned_to: ['u-ana'], due_date: prazo('2026-10-01') });
  const feito = card({ assigned_to: [EU], due_date: prazo('2026-10-01'), kanban_status: 'done', status: 'resolved' });
  const todos = [atrasado, hoje, amanha, depois, parado, atrasadoEParado, deOutro, feito];

  it('separa atrasadas, as que vencem hoje ou no próximo dia útil e as paradas; cada card numa seção só', () => {
    const p = pendenciasDoMembro(todos, EU, HOJE, 5);
    expect(p.atrasadas.map((c) => c.id)).toEqual([atrasadoEParado.id, atrasado.id]);
    expect(p.vencendo.map((c) => c.codigo)).toEqual(['IT-050', 'IT-052']);
    expect(p.paradas.map((c) => c.codigo)).toEqual(['IT-038']);
  });

  it('comentário recente tira o card de "parado" (RN04)', () => {
    const p = pendenciasDoMembro([parado], EU, HOJE, 5, { [parado.id]: '2026-10-12T15:00:00Z' });
    expect(p.paradas).toEqual([]);
  });

  it('na sexta, o próximo dia útil é segunda', () => {
    const segunda = card({ assigned_to: [EU], due_date: prazo('2026-10-19') });
    expect(pendenciasDoMembro([segunda], EU, SEXTA, 5).vencendo).toHaveLength(1);
  });
});

describe('montarMensagemDiaria (D11)', () => {
  const base = { nome: 'Gabriel Carneiro', hoje: HOJE, diasParado: 5, linkInicio: 'https://app/it/inicio' };

  it('segue o modelo do §10', () => {
    const p = {
      atrasadas: [card({ codigo: 'IT-045', title: 'Robô de pré-faturamento', due_date: prazo('2026-10-10') })],
      vencendo: [card({ codigo: 'IT-052', title: 'Hub de Laudos', due_date: prazo('2026-10-14') })],
      paradas: [card({ codigo: 'IT-038', title: 'Auditoria Área', kanban_status: 'in_progress', updated_at: '2026-10-06T12:00:00Z' })],
    };
    expect(montarMensagemDiaria({ ...base, pendencias: p })).toBe([
      'Bom dia, Gabriel! Suas pendências de hoje (13/10):',
      '',
      '⚠️ Atrasadas',
      '• IT-045 Robô de pré-faturamento: venceu 10/10',
      '⏰ Vencem hoje ou amanhã',
      '• IT-052 Hub de Laudos: vence amanhã',
      '💤 Paradas há 5 dias ou mais',
      '• IT-038 Auditoria Área: sem atualização desde 06/10',
      '',
      'Responda aqui para atualizar (ex.: "IT-045 concluída", "IT-052 vai para sexta").',
      'Início: https://app/it/inicio',
    ].join('\n'));
  });

  it('sem pendência, sem mensagem (RN12)', () => {
    expect(montarMensagemDiaria({ ...base, pendencias: { atrasadas: [], vencendo: [], paradas: [] } })).toBeNull();
  });

  it('seção vazia some; acima de 8 itens, "e outras N no Início"', () => {
    const atrasadas = Array.from({ length: 11 }, () => card({ due_date: prazo('2026-10-10') }));
    const t = montarMensagemDiaria({ ...base, pendencias: { atrasadas, vencendo: [], paradas: [] } })!;
    expect(t.match(/^• /gm)).toHaveLength(8);
    expect(t).toContain('… e outras 3 no Início.');
    expect(t).not.toContain('Vencem');
    expect(t).not.toContain('Paradas');
  });

  it('na sexta, a seção diz "até segunda"', () => {
    const vencendo = [card({ codigo: 'IT-060', due_date: prazo('2026-10-19') })];
    const t = montarMensagemDiaria({ ...base, hoje: SEXTA, pendencias: { atrasadas: [], vencendo, paradas: [] } })!;
    expect(t).toContain('⏰ Vencem até segunda');
    expect(t).toContain('IT-060 Card');
    expect(t).toContain(': vence segunda (19/10)');
  });

  it('uma chave por pessoa por dia', () => {
    expect(chaveDia('m1', HOJE)).toBe('cobranca:m1:2026-10-13');
  });
});

describe('horário de cobrança: dia útil, das 7h às 20h de Brasília', () => {
  const sp = (isoLocal: string) => Date.parse(`${isoLocal}-03:00`);
  it('dentro da janela pode cobrar agora', () => {
    expect(proximaJanelaDeCobranca(sp('2026-10-13T07:00:00'))).toBeNull();
    expect(proximaJanelaDeCobranca(sp('2026-10-13T19:59:00'))).toBeNull();
  });
  it('noite de dia útil: no dia seguinte às 7h; madrugada: no mesmo dia', () => {
    expect(proximaJanelaDeCobranca(sp('2026-10-13T20:00:00'))).toBe(sp('2026-10-14T07:00:00'));
    expect(proximaJanelaDeCobranca(sp('2026-10-14T05:30:00'))).toBe(sp('2026-10-14T07:00:00'));
  });
  it('fim de semana nunca: sexta à noite, sábado e domingo vão para segunda às 7h', () => {
    expect(proximaJanelaDeCobranca(sp('2026-10-16T21:00:00'))).toBe(sp('2026-10-19T07:00:00'));
    expect(proximaJanelaDeCobranca(sp('2026-10-17T10:00:00'))).toBe(sp('2026-10-19T07:00:00'));
    expect(proximaJanelaDeCobranca(sp('2026-10-18T23:00:00'))).toBe(sp('2026-10-19T07:00:00'));
  });
});

describe('cobrança sob demanda (D22, RN16)', () => {
  const doBruno = card({ codigo: 'IT-031', title: 'Firewall', assigned_to: ['u-bruno'], due_date: prazo('2026-10-10') });
  const meu = card({ codigo: 'IT-032', title: 'Backup', assigned_to: [EU], due_date: prazo('2026-10-12') });
  const agora = new Date('2026-10-13T15:00:00Z').getTime();
  const ok = { usuarioId: EU, ehGestor: true, podeGerenciar: true, whatsappAtivo: true, ultimaManualEm: null, agora, hoje: HOJE };

  it('texto do protótipo, com o código do card', () => {
    expect(montarCobrancaManual({ nome: 'Bruno Mendes', card: doBruno, hoje: HOJE, modo: 'cobrar' }))
      .toBe('Bruno, a task "Firewall" (IT-031) está atrasada há 3 dias. Consegue atualizar o status?\n\nResponda aqui para atualizar (ex.: "IT-031 concluída").');
    expect(montarCobrancaManual({ nome: 'Gabriel', card: meu, hoje: HOJE, modo: 'lembrar' })).toMatch(/^Lembrete, Gabriel: a task "Backup" \(IT-032\) está atrasada há 1 dia\./);
  });

  it('Lembrar o próprio card; Cobrar o de outra pessoa só gestor', () => {
    expect(podeCobrar({ ...ok, card: meu, ehGestor: false })).toEqual({ ok: true, modo: 'lembrar' });
    expect(podeCobrar({ ...ok, card: doBruno })).toEqual({ ok: true, modo: 'cobrar' });
    expect(podeCobrar({ ...ok, card: doBruno, ehGestor: false })).toMatchObject({ ok: false, status: 403 });
  });

  it('WhatsApp desligado, card em dia ou sem responsável: 422', () => {
    expect(podeCobrar({ ...ok, card: doBruno, whatsappAtivo: false })).toMatchObject({ ok: false, status: 422 });
    expect(podeCobrar({ ...ok, card: { ...doBruno, due_date: prazo('2026-10-20') } })).toMatchObject({ ok: false, status: 422, motivo: 'O IT-031 não está atrasado.' });
    expect(podeCobrar({ ...ok, card: { ...doBruno, assigned_to: [] } })).toMatchObject({ ok: false, status: 422 });
  });

  it('uma por card a cada 4 h: 409 com o horário da próxima', () => {
    const r = podeCobrar({ ...ok, card: doBruno, ultimaManualEm: '2026-10-13T13:12:00Z' });
    expect(r).toEqual({ ok: false, status: 409, motivo: 'O IT-031 já foi cobrado às 10:12. A próxima cobrança pode sair a partir das 14:12.' });
    const depois = new Date('2026-10-13T13:12:00Z').getTime() + JANELA_COBRANCA_MS;
    expect(podeCobrar({ ...ok, card: doBruno, ultimaManualEm: '2026-10-13T13:12:00Z', agora: depois })).toMatchObject({ ok: true });
  });

  it('destinatários: cada responsável com adesão e WhatsApp; no Lembrar, só quem clicou', () => {
    const m = (user_id: string, extra: Partial<MembroCobranca> = {}): MembroCobranca =>
      ({ id: `m-${user_id}`, user_id, nome: user_id, ativo: true, recebe_cobranca: true, whatsapp: '5561999990000', ...extra });
    const membros = [m('u-ana'), m('u-bruno', { recebe_cobranca: false }), m(EU)];
    const doisDonos = { ...doBruno, assigned_to: ['u-ana', 'u-bruno', EU] };
    expect(destinatarios(doisDonos, 'cobrar', 'u-x', membros).map((x) => x.user_id)).toEqual(['u-ana', EU]);
    expect(destinatarios(doisDonos, 'lembrar', EU, membros).map((x) => x.user_id)).toEqual([EU]);
  });
});
