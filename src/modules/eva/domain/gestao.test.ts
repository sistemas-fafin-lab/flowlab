import { describe, expect, it } from 'vitest';
import {
  detectarAlertas, diaUtilAnterior, montarBlocoGestao, montarPainelGestao, montarPautaUmAUm, montarRelatorioDiario, montarRelatorioSemanal,
  periodoAnterior, pontosDeAtencao, semanaAnterior, ultimos7Dias, type ChamadoGestao, type EntradaGestao,
} from './gestao';
import { fotografar } from './tendencias';
import { card, projeto, sprint } from './testes/fabricas';

// Sexta, 13/11, 8h em Brasília. Dados fictícios.
const HOJE = '2026-11-13';
const AGORA = Date.parse('2026-11-13T11:00:00Z');
const LINK = 'https://app/it/inicio';
const prazo = (dia: string) => `${dia}T00:00:00.000Z`;
const ANA = 'u-ana';
const BRUNO = 'u-bruno';
const CARLA = 'u-carla';

const PORTAL = projeto({ id: 'p1', name: 'Portal' });
const SPRINT = sprint({ id: 's1', project_id: 'p1', name: 'Sprint 6', start_date: '2026-11-03', end_date: '2026-11-17' });

const ROBO = card({ codigo: 'IT-045', title: 'Robô de pré-faturamento', priority: 'critical', kanban_status: 'in_progress', assigned_to: [ANA], due_date: prazo('2026-11-12'), project_id: 'p1', sprint_id: 's1', updated_at: '2026-11-12T12:00:00Z' });
const VPN = card({ codigo: 'IT-050', title: 'VPN da filial', assigned_to: [ANA], due_date: prazo('2026-11-05') });
const BACKUP = card({ codigo: 'IT-051', title: 'Backup do LIS', priority: 'high', assigned_to: [ANA], due_date: prazo('2026-11-10') });
const IMPRESSORA = card({ codigo: 'IT-052', title: 'Impressora', assigned_to: [BRUNO], due_date: prazo(HOJE) });
const PARADO = card({ codigo: 'IT-053', title: 'Auditoria', kanban_status: 'in_progress', assigned_to: [BRUNO], updated_at: '2026-11-01T12:00:00Z' });
const FEITO = card({ codigo: 'IT-040', title: 'Firewall', kanban_status: 'done', status: 'resolved', assigned_to: [ANA], project_id: 'p1', sprint_id: 's1', updated_at: '2026-11-11T15:00:00Z' });
const FEITO_ANTES = card({ codigo: 'IT-030', title: 'Antivírus', kanban_status: 'done', status: 'resolved', assigned_to: [BRUNO], updated_at: '2026-11-03T15:00:00Z' });

const chamado = (c: Partial<ChamadoGestao>): ChamadoGestao => ({
  id: 'x', codigo: 'IT-900', title: 'Chamado', priority: 'medium', status: 'pending', created_at: '2026-11-12T12:00:00Z',
  resolved_at: null, kanban_status: 'backlog', kanban_hidden: true, ...c,
});
const CHAMADOS = [
  // Alta, aberto em 09/11: o prazo para iniciar (72 h) venceu em 12/11 12:00 UTC, há 23 h.
  chamado({ id: 'ch1', codigo: 'IT-901', title: 'Sem acesso ao apLIS', priority: 'high', created_at: '2026-11-09T12:00:00Z' }),
  chamado({ id: 'ch2', codigo: 'IT-902', priority: 'low' }),
  chamado({ id: 'ch3', codigo: 'IT-903', status: 'in_progress', kanban_hidden: false }),
  // Resolvido em 28 h, no período; e um de 48 h, no período anterior.
  chamado({ id: 'ch4', status: 'resolved', created_at: '2026-11-10T12:00:00Z', resolved_at: '2026-11-11T16:00:00Z' }),
  chamado({ id: 'ch5', status: 'resolved', created_at: '2026-11-01T12:00:00Z', resolved_at: '2026-11-03T12:00:00Z' }),
];

const entrada = (e: Partial<EntradaGestao> = {}): EntradaGestao => ({
  hoje: HOJE,
  agora: AGORA,
  periodo: ultimos7Dias(HOJE),
  cards: [ROBO, VPN, BACKUP, IMPRESSORA, PARADO, FEITO, FEITO_ANTES],
  projetos: [PORTAL],
  sprints: [SPRINT],
  chamados: CHAMADOS,
  pessoas: { [ANA]: 'Ana Souza', [BRUNO]: 'Bruno Mendes', [CARLA]: 'Carla Dias' },
  equipe: [ANA, BRUNO, CARLA],
  diasParado: 5,
  sugestoesPendentes: 2,
  sugestaoMaisAntiga: '2026-11-10T12:00:00Z',
  cardsSemResposta: ['c-x'],
  ...e,
});

describe('períodos', () => {
  it('últimos 7 dias, a semana anterior de segunda a domingo e o período de comparação', () => {
    expect(ultimos7Dias(HOJE)).toEqual({ de: '2026-11-07', ate: '2026-11-13' });
    expect(semanaAnterior('2026-11-16')).toEqual({ de: '2026-11-09', ate: '2026-11-15' });
    expect(periodoAnterior({ de: '2026-11-09', ate: '2026-11-15' })).toEqual({ de: '2026-11-02', ate: '2026-11-08' });
    // Na segunda, o último relatório foi o de sexta.
    expect(diaUtilAnterior('2026-11-16')).toBe('2026-11-13');
    expect(diaUtilAnterior(HOJE)).toBe('2026-11-12');
  });
});

describe('montarPainelGestao (D38)', () => {
  const p = montarPainelGestao(entrada());

  it('Kanban: as regras do Início, e o atraso novo desde o último dia útil', () => {
    expect(p.kanban).toMatchObject({ abertos: 5, atrasados: 3, novosAtrasos: 1, vencemHoje: 1, parados: 1 });
    expect(p.kanban.criticosAtrasados.map((c) => c.codigo)).toEqual(['IT-045']);
  });

  it('entregas no período e no anterior, pelo updated_at dos concluídos', () => {
    expect(p.entregas).toEqual({ periodo: 1, anterior: 1 });
  });

  it('chamados: fila, prazo para iniciar (SLA), abertos e resolvidos, tempo médio', () => {
    expect(p.chamados).toMatchObject({
      naFila: 2, emAndamento: 1, abertos: 4, resolvidos: 1, tempoMedioMs: 28 * 3600_000,
      abertosAnterior: 1, resolvidosAnterior: 1, tempoMedioAnteriorMs: 48 * 3600_000,
    });
    expect(p.chamados.foraDoPrazo).toEqual([{ chamado: expect.objectContaining({ id: 'ch1' }), atrasoMs: 23 * 3600_000 }]);
  });

  it('por pessoa: só quem tem card, mais atrasados primeiro; o nome como aparece no texto', () => {
    expect(p.pessoas).toEqual([
      { id: ANA, abertos: 3, atrasados: 3, parados: 0, concluidos: 1, ausencia: null, ausente: false },
      { id: BRUNO, abertos: 2, atrasados: 0, parados: 1, concluidos: 0, ausencia: null, ausente: false },
    ]);
    expect(p.nomes).toMatchObject({ [ANA]: 'Ana', [BRUNO]: 'Bruno' });
  });

  it('projetos com o tempo da sprint; pendências do gestor', () => {
    expect(p.projetos).toEqual([expect.objectContaining({ id: 'p1', feitos: 1, total: 2, situacao: 'late' })]);
    expect(p.projetos[0].decorrido).toBeCloseTo(10 / 14);
    expect(p.pendencias).toEqual({ sugestoes: 2, sugestaoHaDias: 3, cobrancasSemResposta: 1 });
  });
});

describe('relatórios', () => {
  const p = montarPainelGestao(entrada());

  it('o do dia: retrato curto e o que pede atenção, do mais grave para o menos', () => {
    expect(montarRelatorioDiario(p, LINK)).toBe([
      '📊 Gestão da TI · sexta, 13/11',
      '',
      'Kanban: 5 abertos · 3 atrasados (1 novo) · 1 vence hoje · 1 parado',
      'Chamados: 2 na fila (1 fora do prazo para iniciar) · 1 em andamento',
      '',
      '⚠️ Atenção',
      '• IT-045 Robô de pré-faturamento: crítico, atrasado há 1 dia · Ana',
      '• Chamado IT-901 Sem acesso ao apLIS: alta, fora do prazo para iniciar há 23h',
      '• Ana: 3 atrasados de 3 abertos',
      '• Portal · Sprint 6: 1 de 2 feitos, 71% do tempo · atrasado',
      '• 2 sugestões aguardam aprovação, a mais antiga há 3 dias',
      '• 1 cobrança sem resposta há mais de 4 h',
      '',
      `Detalhes no Início: ${LINK}`,
    ].join('\n'));
  });

  it('nada pedindo atenção: diz isso, sem lista vazia', () => {
    const calmo = montarPainelGestao(entrada({ cards: [IMPRESSORA], chamados: [], sugestoesPendentes: 0, cardsSemResposta: [], projetos: [] }));
    expect(pontosDeAtencao(calmo)).toEqual([]);
    expect(montarRelatorioDiario(calmo, LINK)).toContain('Nada pedindo atenção agora 👌');
  });

  it('o da semana: o período, a comparação, por pessoa, projetos e atenção', () => {
    const t = montarRelatorioSemanal(p, LINK, '7dias');
    expect(t).toMatch(/^📈 Últimos 7 dias da TI · 07\/11 a 13\/11\n\nNos 7 dias\n/);
    expect(t).toContain('• Entregas: 1 card concluído (7 dias antes: 1)');
    expect(t).toContain('• Chamados: 4 abertos · 1 resolvido (7 dias antes: 1 e 1)');
    expect(t).toContain('• Tempo médio de resolução: 1d 4h (7 dias antes: 2d)');
    expect(t).toContain('Agora\n• Kanban: 5 abertos · 3 atrasados (1 novo) · 1 vence hoje · 1 parado\n• Chamados: 2 na fila');
    expect(t).toContain('👥 Por pessoa (concluídos · abertos · atrasados)\n• Ana: 1 · 3 · 3\n• Bruno: 0 · 2 · 0');
    expect(t).toContain('📁 Projetos\n• Portal · Sprint 6: 1 de 2 feitos, 71% do tempo · atrasado');
    expect(t).toContain('⚠️ Atenção');
    // Na segunda, o recorte é a semana anterior.
    const segunda = montarPainelGestao(entrada({ hoje: '2026-11-16', agora: Date.parse('2026-11-16T11:00:00Z'), periodo: semanaAnterior('2026-11-16') }));
    expect(montarRelatorioSemanal(segunda, LINK, 'semana')).toMatch(/^📈 Semana da TI · 09\/11 a 15\/11\n\nNa semana\n• Entregas: \d+ cards? concluídos? \(semana anterior: \d+\)/);
  });

  it('sem chamado resolvido no período, o tempo médio diz isso', () => {
    const t = montarRelatorioSemanal(montarPainelGestao(entrada({ chamados: [] })), LINK, '7dias');
    expect(t).toContain('• Tempo médio de resolução: sem chamados resolvidos');
  });

  it('o bloco da IA leva os números prontos, para as perguntas de gestão', () => {
    const b = montarBlocoGestao(p);
    expect(b).toMatch(/^PAINEL DE GESTÃO \(números do sistema: use estes, não conte por conta própria\)/);
    expect(b).toContain('Por pessoa (abertos, atrasados, parados, concluídos no período):\n- Ana: 3, 3, 0, 1\n- Bruno: 2, 0, 1, 0');
    expect(b).toContain('Cards críticos atrasados: IT-045 (1 dia, Ana).');
    expect(b).toContain('1 fora do prazo para iniciar (IT-901 Sem acesso ao apLIS (alta, aberto em 09/11, prazo para iniciar vencido há 23h))');
    expect(b).toContain('tempo médio de resolução 1d 4h');
  });
});

describe('alertas na hora (D38)', () => {
  it('chamado alto fora do prazo, card crítico que atrasou e projeto em risco, cada um com a sua chave', () => {
    const a = detectarAlertas(montarPainelGestao(entrada()), LINK);
    expect(a.map((x) => x.chave)).toEqual([`sla:ch1`, `atraso:${ROBO.id}:2026-11-12`, 'projeto:p1:s1:late']);
    expect(a[0].texto).toBe(`🚨 Chamado fora do prazo para iniciar: IT-901 Sem acesso ao apLIS (alta). Aberto em 09/11; o prazo venceu há 23h.\n\nDetalhes no Início: ${LINK}`);
    expect(a[1].texto).toMatch(/^🚨 Card crítico atrasado: IT-045 Robô de pré-faturamento venceu em 12\/11 · Ana\./);
    expect(a[2].texto).toMatch(/^🚨 Projeto atrasado: Portal · Sprint 6: 1 de 2 feitos, 71% do tempo\./);
  });

  it('o que é velho (mais de 3 dias) ou de prioridade menor não vira alerta: já está no relatório', () => {
    const velho = card({ priority: 'critical', assigned_to: [ANA], due_date: prazo('2026-11-05') });
    const baixo = chamado({ id: 'ch9', priority: 'low', created_at: '2026-10-01T12:00:00Z' });
    const a = detectarAlertas(montarPainelGestao(entrada({ cards: [velho], chamados: [baixo], projetos: [] })), LINK);
    expect(a).toEqual([]);
  });
});

describe('ausências no painel (D40)', () => {
  const VENCE_NAS_FERIAS = card({ codigo: 'IT-054', title: 'Migração do e-mail', assigned_to: [BRUNO], due_date: prazo('2026-11-18') });
  const FERIAS_BRUNO = { ausente_de: '2026-11-16', ausente_ate: '2026-11-20', ausencia_motivo: 'férias' };

  it('quem sai nos próximos dias e deixa card vencendo aparece com quem pode cobrir', () => {
    const p = montarPainelGestao(entrada({
      cards: [ROBO, VPN, BACKUP, IMPRESSORA, PARADO, FEITO, FEITO_ANTES, VENCE_NAS_FERIAS],
      ausencias: { [BRUNO]: FERIAS_BRUNO },
    }));
    expect(p.pessoas.find((x) => x.id === BRUNO)).toMatchObject({ ausencia: 'de férias de 16/11 a 20/11', ausente: false });
    // Cobre quem está presente e tem menos cards abertos (a Carla, com nenhum).
    expect(p.coberturas).toEqual([{ id: BRUNO, ausencia: 'de férias de 16/11 a 20/11', vencem: [VENCE_NAS_FERIAS], sugestao: CARLA }]);
    expect(pontosDeAtencao(p)).toContain('Bruno de férias de 16/11 a 20/11: 1 card vence nesse período (IT-054) · pode cobrir: Carla');
    expect(montarBlocoGestao(p)).toContain('- Bruno de férias de 16/11 a 20/11: IT-054; pode cobrir: Carla');
  });

  it('quem já está fora não entra como sobrecarga', () => {
    const p = montarPainelGestao(entrada({ ausencias: { [ANA]: { ausente_de: null, ausente_ate: '2026-11-20', ausencia_motivo: 'licença' } } }));
    expect(p.pessoas.find((x) => x.id === ANA)).toMatchObject({ ausente: true, ausencia: 'ausente até 20/11 (licença)' });
    expect(pontosDeAtencao(p).some((i) => i.startsWith('Ana: 3 atrasados'))).toBe(false);
    expect(montarRelatorioSemanal(p, LINK, '7dias')).toContain('• Ana: 1 · 3 · 3 (ausente até 20/11 (licença))');
  });
});

describe('pauta de 1:1 (D41)', () => {
  const e = entrada({ cardsSemResposta: [VPN.id] });
  const p = montarPainelGestao(e);
  const reuniao = { titulo: 'Sprint review', realizadaEm: '2026-11-10T17:00:00Z', itens: [{ descricao: 'IT-045 Robô de pré-faturamento', status: 'aprovada' }] };

  it('WhatsApp: os números, os cards da pessoa, a reunião e os pontos para conversar', () => {
    expect(montarPautaUmAUm(e, p, ANA, reuniao, 'whatsapp')).toBe([
      '🗒️ 1:1 com Ana · 13/11',
      '',
      'Nos últimos 7 dias: 1 card concluído (7 dias antes: 0)',
      'Agora: 3 abertos · 3 atrasados · 0 parados',
      '',
      '⚠️ Atrasados',
      '• IT-050 VPN da filial: venceu 05/11 (há 8 dias)',
      '• IT-051 Backup do LIS: venceu 10/11 (há 3 dias)',
      '• IT-045 Robô de pré-faturamento: venceu 12/11 (há 1 dia)',
      '',
      '📭 Cobranças sem resposta',
      '• IT-050 VPN da filial',
      '',
      '📝 Da última reunião ("Sprint review", 10/11)',
      '• IT-045 Robô de pré-faturamento: aprovada',
      '',
      '💬 Para conversar',
      '• Repactuar o prazo do IT-050 (atrasado há 8 dias)',
      '• Combinar o andamento de IT-050: as cobranças ficaram sem resposta',
      '• Reconhecer as entregas da semana (1 card concluído)',
    ].join('\n'));
  });

  it('chat: negrito e listas do TextoEva; o parado vira "destravar"', () => {
    const t = montarPautaUmAUm(e, p, BRUNO, null, 'chat');
    expect(t).toMatch(/^\*\*1:1 com Bruno\*\*\n\nNos últimos 7 dias: 0 cards concluídos/);
    expect(t).toContain('**Parados**\n- IT-053 Auditoria: sem mudança desde 01/11');
    expect(t).toContain('**Vencem nos próximos 7 dias**\n- IT-052 Impressora: 13/11');
    expect(t).toContain('**Para conversar**\n- Destravar o IT-053: o que está impedindo?\n- Nenhuma entrega nos últimos 7 dias: entender o que travou');
  });

  it('sem nada para destacar, sugere outro assunto', () => {
    const calma = entrada({ cards: [], cardsSemResposta: [] });
    expect(montarPautaUmAUm(calma, montarPainelGestao(calma), CARLA, null, 'whatsapp'))
      .toContain('💬 Para conversar\n• Sem pendências para destacar: bom momento para falar de prioridades e desenvolvimento.');
  });
});

describe('histórico e tendências (D42)', () => {
  const ANTES = fotografar(montarPainelGestao(entrada({ hoje: '2026-11-06', agora: Date.parse('2026-11-06T21:00:00Z'), periodo: { de: '2026-11-06', ate: '2026-11-06' } })));
  const comFoto = montarPainelGestao(entrada({ fotoAnterior: { ...ANTES, abertos: 12, atrasados: 9, naFila: 4 } }));

  it('a foto do dia: os números do painel de hoje, por pessoa também', () => {
    const f = fotografar(montarPainelGestao(entrada({ periodo: { de: HOJE, ate: HOJE } })));
    expect(f).toMatchObject({
      dia: HOJE, abertos: 5, atrasados: 3, vencemHoje: 1, parados: 1, criticosAtrasados: 1, entregas: 0,
      naFila: 2, foraDoPrazo: 1, emAndamento: 1,
    });
    expect(f.pessoas).toEqual({
      [ANA]: { abertos: 3, atrasados: 3, concluidos: 0 },
      [BRUNO]: { abertos: 2, atrasados: 0, concluidos: 0 },
    });
  });

  it('entregas das 4 últimas semanas, pela data da resolução', () => {
    const p = montarPainelGestao(entrada());
    expect(p.entregasSemanas).toEqual([
      { semana: '2026-10-19', entregas: 0 },
      { semana: '2026-10-26', entregas: 0 },
      { semana: '2026-11-02', entregas: 1 },
      { semana: '2026-11-09', entregas: 1 },
    ]);
    // Resolvido em 04/11 e editado em 11/11: a entrega é da semana de 02/11.
    const editado = { ...FEITO, resolved_at: '2026-11-04T15:00:00Z' };
    const q = montarPainelGestao(entrada({ cards: [ROBO, VPN, BACKUP, IMPRESSORA, PARADO, editado, FEITO_ANTES] }));
    expect(q.entregas.periodo).toBe(0);
    expect(q.entregasSemanas.slice(2)).toEqual([{ semana: '2026-11-02', entregas: 2 }, { semana: '2026-11-09', entregas: 0 }]);
  });

  it('o relatório da semana compara com a foto de antes do período', () => {
    expect(montarRelatorioSemanal(comFoto, LINK, '7dias')).toContain('• Em 06/11: 9 atrasados e 4 na fila (agora 3 e 2)');
    // Sem foto (as primeiras semanas), a linha não aparece.
    expect(montarRelatorioSemanal(montarPainelGestao(entrada()), LINK, '7dias')).not.toContain('• Em ');
  });

  it('o bloco da IA leva as entregas por semana e a tendência', () => {
    const b = montarBlocoGestao(comFoto);
    expect(b).toContain('Entregas por semana (cards concluídos, das 4 últimas semanas, a última é a atual, até hoje): 19/10: 0; 26/10: 0; 02/11: 1; 09/11: 1.');
    expect(b).toContain('Tendência: em 06/11 eram 12 abertos, 9 atrasados e 4 chamados na fila (agora 5, 3 e 2).');
    expect(montarBlocoGestao(montarPainelGestao(entrada()))).not.toContain('Tendência:');
  });
});
