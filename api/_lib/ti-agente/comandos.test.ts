import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cobranca.js', async (original) => ({
  ...(await original<typeof import('./cobranca.js')>()),
  lerCardsAbertos: vi.fn(),
  lerMembrosCobranca: vi.fn(async () => []),
  checarCobranca: vi.fn(),
  cobrarCard: vi.fn(),
}));
vi.mock('./dados.js', async (original) => ({
  ...(await original<typeof import('./dados.js')>()),
  lerContexto: vi.fn(),
  lerNomes: vi.fn(async () => ({ 'u-bruno': 'Bruno Mendes', 'u-ana': 'Ana Souza' })),
  lerUltimaReuniao: vi.fn(async () => null),
  avisarQuemTem: vi.fn(async () => undefined),
}));
vi.mock('./grupo.js', async (original) => ({
  ...(await original<typeof import('./grupo.js')>()),
  lerConfigGrupo: vi.fn(),
  enfileirarNoGrupo: vi.fn(async () => ({ gravada: true, id: 'g1', agendadaPara: null })),
}));
vi.mock('./ia/gerarEstruturado.js', () => ({ gerarEstruturado: vi.fn() }));
vi.mock('./aviso.js', async (original) => ({
  ...(await original<typeof import('./aviso.js')>()),
  checarAvisoPessoal: vi.fn(async () => ({ ok: true, membroId: 'm-bruno', userId: 'u-bruno', nome: 'Bruno Mendes', grupo: null })),
  enviarAvisoPessoal: vi.fn(async () => ({ ok: true, id: 'a1', para: 'Bruno Mendes', noGrupo: false, grupoNome: null, agendadaPara: null })),
  checarAvisoEquipe: vi.fn(async () => ({
    ok: true,
    privado: [{ membroId: 'm-bruno', userId: 'u-bruno', nome: 'Bruno Mendes' }, { membroId: 'm-caio', userId: 'u-caio', nome: 'Caio Lima' }],
    noGrupo: { id: '120363000000000001@g.us', nome: 'TI FAFIN', citados: ['Dani'] },
    semDestino: [],
  })),
  enviarAvisoEquipe: vi.fn(async () => ({
    ok: true, ids: ['a1', 'a2', 'a3'], para: ['Bruno Mendes', 'Caio Lima'], citadosNoGrupo: ['Dani'], grupoNome: 'TI FAFIN', semDestino: [], agendadaPara: null,
  })),
}));
// D43: a imagem que espera o código do card (anexos.ts tem os próprios testes, em midia.test).
vi.mock('./anexos.js', () => ({ anexarAguardando: vi.fn(async () => null) }));
// D46: o check-in (checkin.ts tem os próprios testes); por padrão, nenhuma pergunta em aberto.
vi.mock('./checkin.js', () => ({ checkinEmAberto: vi.fn(async () => null), responderCheckin: vi.fn(async () => null) }));
// D47 e D48: o planejamento e a pauta têm os próprios testes; aqui, só o caminho pelo WhatsApp.
vi.mock('./planejamento.js', () => ({ lerPlanejamento: vi.fn(async () => ({})), sugestoesDaRedistribuicao: vi.fn(() => []) }));
vi.mock('../../../src/modules/eva/domain/planejamento.js', () => ({ montarTextoPlanejamento: vi.fn(() => 'PLANEJAMENTO (teste)') }));
vi.mock('./pauta.js', () => ({ lerPautaReuniao: vi.fn(async (_db: unknown, formato: string) => `PAUTA DA REUNIÃO (${formato})`) }));
vi.mock('./gestao.js', () => ({
  relatorioAgora: vi.fn(async (_db: unknown, recorte: string) => `RELATÓRIO (${recorte})`),
  lerBlocoGestao: vi.fn(async () => 'PAINEL DE GESTÃO (teste)'),
  lerPautaUmAUm: vi.fn(async (_db: unknown, pessoa: string, formato: string) => `PAUTA (${pessoa}, ${formato})`),
}));

import { anexarAguardando } from './anexos.js';
import { checkinEmAberto, responderCheckin } from './checkin.js';
import { sugestoesDaRedistribuicao } from './planejamento.js';
import { checarCobranca, cobrarCard, lerCardsAbertos } from './cobranca.js';
import { lerBlocoGestao, relatorioAgora } from './gestao.js';
import { checarAvisoEquipe, checarAvisoPessoal, enviarAvisoEquipe, enviarAvisoPessoal } from './aviso.js';
import { avisarQuemTem, lerContexto } from './dados.js';
import { enfileirarNoGrupo, lerConfigGrupo } from './grupo.js';
import { gerarEstruturado, type Dependencias } from './ia/gerarEstruturado.js';
import {
  CANCELADO, CANCELADO_PROPOSTA, EXPIROU, INSTRUCOES_WHATSAPP, PEDIR_SIM, SEM_LISTA, descreverSugestao, ehNao, ehSim,
  ajuda, fechoDeConversa, lerPedidoDeLista, lerPedidoDeRelatorio, montarContextoMensagem, montarListaSugestoes, processarRecebida,
  type SaidaMensagem, type SugestaoLista,
} from './comandos.js';
import { SEM_INTERPRETACAO } from './respostas.js';
import type { CardTI } from '../../../src/modules/eva/domain/demandas.js';

// Quarta, 14/10, 11h em Brasília: dentro do horário de cobrança.
const AGORA = new Date('2026-10-14T14:00:00Z');
const card = (c: Partial<CardTI>): CardTI => ({
  id: 'c1', codigo: 'IT-045', title: 'Robô de pré-faturamento', priority: 'high', status: 'in_progress', kanban_status: 'in_progress',
  assigned_to: ['u-bruno'], due_date: '2026-10-10T00:00:00.000Z', kanban_hidden: false, project_id: null, sprint_id: null,
  updated_at: '2026-10-10T12:00:00Z', created_at: '2026-10-01T12:00:00Z', ...c,
});
const C1 = card({});
const C9 = card({ id: 'c9', codigo: 'IT-099', title: 'Painel de laudos', assigned_to: ['u-ana'] });
const CTX = {
  membros: [{ id: 'u-bruno', nome: 'Bruno Mendes', apelidos: [] }, { id: 'u-ana', nome: 'Ana Souza', apelidos: [] }],
  cards: [C1, C9], projetos: [], sprints: [],
};
const BRUNO = { id: 'm-bruno', user_id: 'u-bruno', nome: 'Bruno Mendes' };
const ANA = { id: 'm-ana', user_id: 'u-ana', nome: 'Ana Souza' };
const GESTOR = ['canApproveAgenteTI', 'canManageAgenteTI', 'canConfigureAgenteTI', 'canManageIT'];

const sug = (s: Partial<SugestaoLista>): SugestaoLista => ({
  id: 's1', tipo: 'atualizar_card', origem: 'whatsapp', status: 'pendente', proposta: { kanban_status: 'done' }, proposta_por: 'u-bruno',
  card: { codigo: 'IT-045', title: 'Robô de pré-faturamento' }, reuniao: null, ...s,
});

const saida = (s: Partial<SaidaMensagem>): SaidaMensagem => ({
  intencao: 'conversa', resposta: '', itens: [], propostas: [], lembrete_texto: '', lembrete_quando: '', lembrete_id: '',
  cobrar_codigos: [], cobrar_pessoa_id: '', numeros: [], todas: false, motivo: '', aviso: '', aviso_pessoa_id: '', relatorio_periodo: '',
  pessoa_id: '', ausencia_acao: '', ausencia_de: '', ausencia_ate: '', ausencia_motivo: '', confianca: 'alta', ...s,
});
const proposta = (p: Partial<SaidaMensagem['propostas'][number]>): SaidaMensagem['propostas'][number] => ({
  tipo: 'atualizar_card', card_codigo: 'IT-045', titulo: null, descricao: null, responsaveis: [], prazo: null, prazo_texto: null,
  prioridade: null, kanban_status: null, projeto_id: null, sprint: null, comentario: null, trecho: 'pedido', confianca: 'alta', ...p,
});

// ── Banco falso: guarda comandos e sugestões entre as mensagens ──────────────

interface Estado {
  texto: string;
  membro: typeof BRUNO;
  /** null = perfil removido no FlowLab. */
  permissoes: string[] | null;
  /** A linha da aba Permissões (ti_agente_papeis, D33); sem ela, vale o cargo. */
  linha?: { configura: boolean; gestor: boolean; aprova: boolean } | null;
  contagem: number;
  comandos: Record<string, unknown>[];
  sugestoes: SugestaoLista[];
  /** Falas anteriores com a pessoa (ti_agente_mensagens). */
  historico: { direcao: string; tipo: string; status: string; texto: string; created_at: string }[];
  /** Lembretes pendentes (tipo lembrete). */
  lembretes: { id: string; texto: string; proxima_tentativa_em: string; status: string; tipo: string; membro_id: string }[];
  /** As linhas de ti_agente_membros que a ausência (D40) atualiza. */
  membrosTabela?: Record<string, unknown>[];
}

function criarDb(e: Estado) {
  const inserts: { tabela: string; linhas: Record<string, unknown> }[] = [];
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  let seq = 0;
  const from = (tabela: string) => {
    const f: Record<string, unknown> = {};
    let op: 'select' | 'insert' | 'update' = 'select';
    let dados: Record<string, unknown> = {};
    let head = false;
    const q: Record<string, unknown> = {};
    q.select = (_c?: string, o?: { head?: boolean }) => { if (o?.head) head = true; return q; };
    for (const m of ['order', 'limit', 'lt', 'neq', 'gte', 'range']) q[m] = () => q;
    q.eq = (k: string, v: unknown) => { f[k] = v; return q; };
    q.in = (k: string, v: unknown[]) => { f[`in:${k}`] = v; return q; };
    q.gt = (k: string, v: unknown) => { f[`gt:${k}`] = v; return q; };
    q.insert = (l: Record<string, unknown>) => {
      op = 'insert';
      inserts.push({ tabela, linhas: l });
      if (tabela === 'ti_agente_comandos') e.comandos.push({ id: `cmd-${++seq}`, ...l });
      return q;
    };
    q.update = (d: Record<string, unknown>) => { op = 'update'; dados = d; return q; };
    const casa = (linha: object) => {
      const c = linha as Record<string, unknown>;
      return Object.entries(f).every(([k, v]) =>
        k.startsWith('gt:') ? String(c[k.slice(3)]) > String(v) : k.startsWith('in:') ? (v as unknown[]).includes(c[k.slice(3)]) : c[k] === v);
    };
    const resolver = () => {
      if (op === 'insert') return { data: [{ id: `ins-${++seq}` }], error: null };
      if (op === 'update') {
        const linhas: Record<string, unknown>[] = tabela === 'ti_agente_comandos' ? e.comandos
          : tabela === 'ti_agente_mensagens' && f.tipo === 'lembrete' ? e.lembretes
            : tabela === 'ti_agente_membros' ? e.membrosTabela ?? [] : [];
        const alvo = linhas.filter(casa);
        alvo.forEach((c) => Object.assign(c, dados));
        return { data: alvo.map((c) => ({ id: c.id })), error: null };
      }
      if (tabela === 'ti_agente_mensagens') {
        if (head) return { count: f.tipo === 'lembrete' ? e.lembretes.filter(casa).length : e.contagem, error: null };
        return { data: f.tipo === 'lembrete' ? e.lembretes.filter(casa) : e.historico, error: null };
      }
      if (tabela === 'ti_agente_sugestoes') { const l = e.sugestoes.filter(casa); return { data: l, count: l.length, error: null }; }
      return { data: [], error: null };
    };
    q.then = (ok: (v: unknown) => unknown, erro?: (v: unknown) => unknown) => Promise.resolve(resolver()).then(ok, erro);
    q.single = async () => ({
      data: { id: 'msg1', texto: e.texto, membro_id: e.membro.id, created_at: AGORA.toISOString(), membro: { id: e.membro.id, user_id: e.membro.user_id, perfil: { name: e.membro.nome } } },
      error: null,
    });
    q.maybeSingle = async () => {
      if (tabela === 'user_profiles') {
        return {
          data: e.permissoes === null
            ? { deleted_at: '2026-10-01T00:00:00Z', disabled_at: null, custom_roles: null }
            : { deleted_at: null, disabled_at: null, custom_roles: { permissions: e.permissoes } },
          error: null,
        };
      }
      if (tabela === 'ti_agente_comandos') { const l = e.comandos.filter(casa); return { data: l[l.length - 1] ?? null, error: null }; }
      if (tabela === 'ti_agente_papeis') return { data: e.linha ?? null, error: null };
      return { data: null, error: null };
    };
    return q;
  };
  const rpc = async (fn: string, args: Record<string, unknown>) => { rpcs.push({ fn, args }); return { data: 'card-x', error: null }; };
  return { db: { from, rpc }, inserts, rpcs };
}

const respostas = (inserts: { tabela: string; linhas: Record<string, unknown> }[]) =>
  inserts.filter((i) => i.tabela === 'ti_agente_mensagens' && i.linhas.tipo === 'confirmacao').map((i) => i.linhas.texto as string);

const gerarMock = gerarEstruturado as ReturnType<typeof vi.fn>;
const ia = (s: Partial<SaidaMensagem>) => gerarMock.mockResolvedValueOnce({ ok: true, provedor: 'claude', motivoReserva: null, tentativas: [], dados: saida(s) });

let estado: Estado;
let banco: ReturnType<typeof criarDb>;
const mandar = async (texto: string, agora = AGORA) => {
  estado.texto = texto;
  return processarRecebida(banco.db as never, {} as Dependencias, 'msg1', agora);
};

beforeEach(() => {
  vi.clearAllMocks();
  (lerCardsAbertos as ReturnType<typeof vi.fn>).mockResolvedValue([C1, C9]);
  (lerContexto as ReturnType<typeof vi.fn>).mockResolvedValue(CTX);
  (lerConfigGrupo as ReturnType<typeof vi.fn>).mockResolvedValue({ whatsappAtivo: true, grupoId: '120363000000000001@g.us', grupoNome: 'TI FAFIN', fechamento: false, resumoReuniao: false });
  estado = {
    texto: '', membro: ANA, permissoes: GESTOR, contagem: 1, comandos: [], sugestoes: [], historico: [], lembretes: [],
    membrosTabela: [{ id: 'm-ana', user_id: 'u-ana' }, { id: 'm-bruno', user_id: 'u-bruno' }],
  };
  banco = criarDb(estado);
});

// ── Leitura sem IA ───────────────────────────────────────────────────────────

describe('leitura determinística', () => {
  it('SIM, NÃO e agradecimento', () => {
    for (const t of ['SIM', 'Sim!', 's', 'pode', '👍', 'ok']) expect(ehSim(t)).toBe(true);
    for (const t of ['não', 'Nao.', 'cancela', '❌']) expect(ehNao(t)).toBe(true);
    expect(ehSim('sim, terminei o IT-045')).toBe(false);
    for (const t of ['obrigado!', 'Valeu', '🙏', 'muito obrigada']) expect(fechoDeConversa(t)).toBe('obrigado');
    for (const t of ['ok', 'beleza', '👍']) expect(fechoDeConversa(t)).toBe('ok');
    expect(fechoDeConversa('ok, o IT-045 vai para sexta')).toBeNull();
    expect(fechoDeConversa('obrigado, e o que eu tenho hoje?')).toBeNull();
  });

  it('"aprovar 1 e 3", "rejeitar 2, motivo" sobre a lista', () => {
    expect(lerPedidoDeLista('aprovar 1 e 3')).toEqual({ acao: 'aprovar', numeros: [1, 3], todas: false, motivo: null });
    expect(lerPedidoDeLista('Aprova todas')).toEqual({ acao: 'aprovar', numeros: [], todas: true, motivo: null });
    expect(lerPedidoDeLista('aprovar 1,3')).toMatchObject({ numeros: [1, 3] });
    expect(lerPedidoDeLista('rejeitar 2, já existe esse card')).toEqual({ acao: 'rejeitar', numeros: [2], todas: false, motivo: 'já existe esse card' });
    expect(lerPedidoDeLista('Rejeita a 2 e 3 motivo: duplicadas')).toEqual({ acao: 'rejeitar', numeros: [2, 3], todas: false, motivo: 'duplicadas' });
    expect(lerPedidoDeLista('aprovado o orçamento')).toBeNull();
    expect(lerPedidoDeLista('rejeitar')).toBeNull();
    expect(lerPedidoDeLista('IT-045 concluída')).toBeNull();
  });
});

describe('textos', () => {
  it('sugestões em uma linha, com a origem', () => {
    const nomes = { 'u-bruno': 'Bruno Mendes', 'u-ana': 'Ana Souza' };
    expect(descreverSugestao(sug({}), nomes)).toBe('IT-045 Robô de pré-faturamento: → Concluído (WhatsApp, Bruno)');
    expect(descreverSugestao(sug({ tipo: 'criar_card', origem: 'reuniao', proposta_por: null, card: null, reuniao: { titulo: 'Weekly TI' }, proposta: { titulo: 'Painel novo', responsaveis: ['u-ana'], prazo: '2026-10-20' } }), nomes))
      .toBe('Novo card: "Painel novo" · Ana · prazo 20/10 (reunião "Weekly TI")');
    expect(descreverSugestao(sug({ proposta: { prazo: '2026-10-16', prazo_texto: 'sexta' } }), nomes)).toContain('IT-045 Robô de pré-faturamento: prazo 16/10');
  });

  it('chamado do LAB-BRAIN: entra no Kanban com coluna, prioridade e responsáveis', () => {
    const s = sug({
      tipo: 'promover_card', origem: 'lab-brain', proposta_por: null,
      card: { codigo: 'IT-132', title: 'Escrita na API do TiqueTaque' },
      proposta: { kanban_status: 'todo', prioridade: 'high', responsaveis: [], prazo: null, sem_analise: true },
    });
    expect(descreverSugestao(s, {}))
      .toBe('IT-132 Escrita na API do TiqueTaque: entrar no Kanban → A Fazer; prioridade alta; sem responsável; sem análise (LAB-BRAIN)');
  });

  it('lista numerada, com "e mais N no Início" e como responder', () => {
    const t = montarListaSugestoes([sug({}), sug({ id: 's2' })], 12, {});
    expect(t).toMatch(/^Sugestões aguardando aprovação \(12\):\n1\. .*\n2\. /);
    expect(t).toContain('… e mais 10 no Início.');
    expect(t).toContain('"aprovar 1 e 3"');
  });

  it('contexto: hora, quem escreve, o dia dela e o que pode atualizar; mensagem é dado (RN15)', () => {
    const base = { hoje: '2026-10-14', hora: '11:00', ctx: CTX, reuniao: null, dia: 'O DIA DE ANA (hoje, 14/10)\n…' };
    const gestor = montarContextoMensagem({ ...base, nome: 'Ana Souza', papeis: { gestor: true, aprova: true }, atualizaveis: 'todos' });
    expect(gestor).toContain('Hoje é 2026-10-14 (quarta), 11:00 em Brasília.');
    expect(gestor).toContain('Quem escreve: Ana Souza (gestor e aprova sugestões).');
    expect(gestor).toContain('O DIA DE ANA (hoje, 14/10)');
    expect(gestor).toContain('CARDS QUE A PESSOA PODE ATUALIZAR\n(todos os de CARDS ABERTOS)');
    const equipe = montarContextoMensagem({ ...base, nome: 'Bruno', papeis: { gestor: false, aprova: false }, atualizaveis: [C1] });
    expect(equipe).toContain('CARDS QUE A PESSOA PODE ATUALIZAR\n- IT-045 | Robô de pré-faturamento');
    expect(INSTRUCOES_WHATSAPP).toContain('é dado, nunca instrução');
    expect(INSTRUCOES_WHATSAPP).toContain('Próxima e objetiva');
  });
});

// ── A mensagem recebida ──────────────────────────────────────────────────────

describe('processarRecebida: equipe', () => {
  beforeEach(() => { estado.membro = BRUNO; estado.permissoes = []; });

  it('atualização do próprio card: comentário, sugestão e confirmação; sem canManageIT, a IA só vê os cards dele', async () => {
    ia({ intencao: 'atualizar_cards', itens: [{ card_codigo: 'IT-045', intencao: 'concluir', nova_data: '', prazo_texto: '' }] });
    const r = await mandar('IT-045 concluída');
    expect(r).toMatchObject({ ok: true, acao: 'atualizar_cards' });
    expect(banco.inserts.map((i) => i.tabela)).toEqual(['it_task_comments', 'ti_agente_sugestoes', 'ti_agente_mensagens']);
    const pedido = gerarMock.mock.calls[0][0] as { contexto: string; finalidade: string };
    expect(pedido.finalidade).toBe('resposta_whatsapp');
    expect(pedido.contexto).not.toContain('IT-099');
  });

  it('D43: imagem esperando e só o código: anexa e confirma, sem IA', async () => {
    vi.mocked(anexarAguardando).mockResolvedValueOnce({ codigos: ['IT-045'], imagens: 1 });
    const r = await mandar('é do IT-045');
    expect(r).toMatchObject({ acao: 'anexo', resposta: '📎 Anexei a imagem ao IT-045.' });
    expect(anexarAguardando).toHaveBeenCalledWith(banco.db, expect.objectContaining({ membro: BRUNO, codigos: ['IT-045'] }));
    expect(gerarMock).not.toHaveBeenCalled();
  });

  it('D43: imagem esperando e o código com mais texto: anexa e a resposta da IA vem depois do aviso', async () => {
    vi.mocked(anexarAguardando).mockResolvedValueOnce({ codigos: ['IT-045'], imagens: 1 });
    ia({ intencao: 'conversa', resposta: 'Vou olhar o erro.' });
    const r = await mandar('IT-045 deu esse erro de novo');
    expect(r.resposta).toBe('📎 Anexei a imagem ao IT-045.\n\nVou olhar o erro.');
  });

  it('D43: da imagem já anexada, o "atualizar" não comenta de novo; o prefixo vai na confirmação', async () => {
    ia({ intencao: 'atualizar_cards', itens: [{ card_codigo: 'IT-045', intencao: 'atualizar', nova_data: '', prazo_texto: '' }] });
    estado.texto = 'IT-045 deu esse erro de novo';
    const r = await processarRecebida(banco.db as never, {} as Dependencias, 'msg1', AGORA, { prefixo: '📎 Anexei a imagem ao IT-045.', semComentarioEm: ['c1'] });
    expect(banco.inserts.map((i) => i.tabela)).not.toContain('it_task_comments');
    expect(r.resposta).toMatch(/^📎 Anexei a imagem ao IT-045\.\n\n/);
  });

  it('D46: com o check-in de hoje em aberto, a resposta vira o plano do dia, sem a IA principal', async () => {
    vi.mocked(checkinEmAberto).mockResolvedValueOnce({ id: 'ck1' });
    vi.mocked(responderCheckin).mockResolvedValueOnce({ resposta: 'Anotado, Bruno! ☀️ Hoje: IT-045.', planejados: ['IT-045'], bloqueios: [] });
    const r = await mandar('hoje fico no IT-045');
    expect(r).toMatchObject({ acao: 'checkin', resposta: 'Anotado, Bruno! ☀️ Hoje: IT-045.' });
    expect(responderCheckin).toHaveBeenCalledWith(banco.db, expect.anything(), expect.objectContaining({ checkinId: 'ck1', texto: 'hoje fico no IT-045', membro: BRUNO }));
    expect(gerarMock).not.toHaveBeenCalled();
  });

  it('D46: com o check-in em aberto, outro assunto segue o fluxo normal', async () => {
    vi.mocked(checkinEmAberto).mockResolvedValueOnce({ id: 'ck1' });
    ia({ intencao: 'conversa', resposta: 'Oi!' });
    const r = await mandar('tem reunião hoje?');
    expect(r).toMatchObject({ acao: 'conversa', resposta: 'Oi!' });
    expect(gerarMock).toHaveBeenCalledTimes(1);
  });

  it('pedido de gestor vindo da equipe: recusa, sem comando', async () => {
    ia({ intencao: 'cobrar', cobrar_codigos: ['IT-099'] });
    const r = await mandar('cobra a Ana do IT-099');
    expect(r.acao).toBe('sem_permissao');
    expect(r.resposta).toContain('Só gestores da EVA podem pedir cobranças');
    expect(estado.comandos).toEqual([]);
    expect(checarCobranca).not.toHaveBeenCalled();
  });

  it('"aprovar 1" da equipe não vira pedido: vai para a IA', async () => {
    ia({ intencao: 'aprovar', numeros: [1] });
    const r = await mandar('aprovar 1');
    expect(gerarMock).toHaveBeenCalledTimes(1);
    expect(r.acao).toBe('sem_permissao');
  });

  it('"obrigado" recebe um "por nada"; "ok" não recebe nada; nenhum dos dois chama a IA', async () => {
    const r = await mandar('Obrigado!');
    expect(r).toMatchObject({ acao: 'agradecimento', resposta: 'Por nada, Bruno! 😊' });
    const ok = await mandar('ok');
    expect(ok).toMatchObject({ acao: 'agradecimento', resposta: null });
    expect(gerarMock).not.toHaveBeenCalled();
    expect(respostas(banco.inserts)).toEqual(['Por nada, Bruno! 😊']);
  });

  it('a confirmação da atualização sai na voz da IA quando bate com o registrado; senão, a do sistema', async () => {
    ia({ intencao: 'atualizar_cards', resposta: 'Boa, Bruno! Anotei o IT-045 como concluído e mandei para aprovação.', itens: [{ card_codigo: 'IT-045', intencao: 'concluir', nova_data: '', prazo_texto: '' }] });
    expect((await mandar('terminei o robô')).resposta).toBe('Boa, Bruno! Anotei o IT-045 como concluído e mandei para aprovação.');
    // A IA "entendeu" um prazo que não é uma data: a confirmação é a do sistema, que pede a data.
    ia({ intencao: 'atualizar_cards', resposta: 'Fechado, mudei o prazo!', itens: [{ card_codigo: 'IT-045', intencao: 'adiar', nova_data: '', prazo_texto: 'semana que vem' }] });
    expect((await mandar('o robô fica para semana que vem')).resposta).toContain('Para mudar o prazo, me diz a data');
  });

  it('pergunta e conversa saem na voz da IA, com a conversa recente e o dia dele no contexto', async () => {
    // Como o banco devolve: da mais nova para a mais antiga.
    estado.historico = [
      { direcao: 'entrada', tipo: 'recebida', status: 'recebida', texto: 'vou ver o robô agora', created_at: '2026-10-14T11:30:00Z' },
      { direcao: 'saida', tipo: 'cobranca', status: 'lida', texto: 'Bom dia, Bruno! Suas pendências…', created_at: '2026-10-14T11:00:00Z' },
    ];
    ia({ intencao: 'pergunta', resposta: 'Hoje, Bruno: • IT-045 Robô de pré-faturamento, atrasado desde 10/10. Começa por ele.' });
    const r = await mandar('o que eu tenho hoje?');
    expect(r.resposta).toBe('Hoje, Bruno: • IT-045 Robô de pré-faturamento, atrasado desde 10/10. Começa por ele.');
    const pedido = gerarMock.mock.calls[0][0] as { contexto: string; conteudo: string };
    expect(pedido.conteudo).toMatch(/<conversa_recente>\nEVA \(14\/10, 08:00\): Bom dia, Bruno!.*\nPessoa \(14\/10, 08:30\): vou ver o robô agora\n<\/conversa_recente>/s);
    expect(pedido.contexto).toContain('O DIA DE BRUNO (hoje, 14/10)\nAtrasadas:\n- IT-045 | Robô de pré-faturamento | venceu 10/10 | prioridade alta');
    expect(pedido.contexto).toContain('LEMBRETES MARCADOS\n(nenhum)');
  });

  it('pedido de mudança no Kanban sem canManageIT: recusa, nada gravado', async () => {
    ia({ intencao: 'propor', propostas: [proposta({ prioridade: 'critical' })] });
    const r = await mandar('muda a prioridade do IT-045 para crítica');
    expect(r.acao).toBe('sem_permissao');
    expect(banco.inserts.filter((i) => i.tabela === 'ti_agente_sugestoes')).toEqual([]);
  });

  it('pedido de mudança da equipe vai para a fila de aprovação e avisa os gestores, sem SIM', async () => {
    estado.permissoes = ['canManageIT'];
    ia({ intencao: 'propor', propostas: [proposta({ prioridade: 'critical', trecho: 'muda a prioridade do IT-045 para crítica' })] });
    const r = await mandar('muda a prioridade do IT-045 para crítica');
    expect(r.resposta).toBe('Anotado, Bruno! Mandei para aprovação:\n• IT-045 Robô de pré-faturamento: prioridade crítica');
    const sug = banco.inserts.find((i) => i.tabela === 'ti_agente_sugestoes')!.linhas as unknown as Record<string, unknown>[];
    expect(sug).toMatchObject([{ origem: 'whatsapp', proposta_por: 'u-bruno', tipo: 'atualizar_card', card_id: 'c1', proposta: { prioridade: 'critical' } }]);
    expect(estado.comandos).toEqual([]);
    expect(avisarQuemTem).toHaveBeenCalledTimes(1);
  });

  it('lembrete: marcado para a hora pedida; fora do expediente, vai para a próxima janela e avisa', async () => {
    ia({ intencao: 'lembrete_criar', lembrete_texto: 'ligar para o fornecedor', lembrete_quando: '2026-10-15T09:00' });
    expect((await mandar('me lembra amanhã às 9h de ligar para o fornecedor')).resposta).toBe('Combinado, Bruno! Te lembro amanhã às 09:00: ligar para o fornecedor.');
    const lembrete = banco.inserts.find((i) => i.linhas.tipo === 'lembrete')!.linhas;
    expect(lembrete).toMatchObject({ membro_id: 'm-bruno', direcao: 'saida', status: 'pendente', texto: '⏰ Lembrete: ligar para o fornecedor', proxima_tentativa_em: '2026-10-15T12:00:00.000Z' });

    ia({ intencao: 'lembrete_criar', lembrete_texto: 'revisar o backup', lembrete_quando: '2026-10-17T10:00' });
    expect((await mandar('me lembra sábado às 10h de revisar o backup')).resposta)
      .toBe('Combinado, Bruno! Esse horário fica fora do meu expediente (dia útil, das 7h às 20h), então te lembro segunda (19/10) às 07:00: revisar o backup.');

    ia({ intencao: 'lembrete_criar', lembrete_texto: 'algo', lembrete_quando: '2026-10-14T08:00' });
    expect((await mandar('me lembra hoje às 8h')).resposta).toBe('Esse horário já passou. Para quando eu marco?');
  });

  it('lembrete: cancela só o da própria pessoa, pelo id da lista', async () => {
    estado.lembretes = [{ id: 'l1', texto: '⏰ Lembrete: ligar para o fornecedor', proxima_tentativa_em: '2026-10-15T12:00:00Z', status: 'pendente', tipo: 'lembrete', membro_id: 'm-bruno' }];
    ia({ intencao: 'lembrete_cancelar', lembrete_id: 'l1' });
    expect((await mandar('cancela o lembrete do fornecedor')).resposta).toBe('Pronto, cancelei o lembrete de amanhã às 09:00: ligar para o fornecedor.');
    expect(estado.lembretes[0].status).toBe('cancelada');
    ia({ intencao: 'lembrete_cancelar', lembrete_id: 'outro' });
    expect((await mandar('cancela aquele outro')).resposta).toBe('Você não tem lembretes marcados.');
  });

  it('os dois provedores falhando: avisa a pessoa', async () => {
    gerarMock.mockResolvedValueOnce({ ok: false, erros: ['Claude: erro', 'Gemini: erro'], tentativas: [] });
    const r = await mandar('o que vence hoje?');
    expect(r).toMatchObject({ ok: false, acao: 'sem_ia' });
    expect(respostas(banco.inserts)).toEqual([SEM_INTERPRETACAO]);
  });
});

describe('processarRecebida: gestor', () => {
  it('cobrar: mostra o que vai sair, espera o SIM e só então cobra', async () => {
    (checarCobranca as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, card: C1, modo: 'cobrar', alvos: [{ id: 'm-bruno', user_id: 'u-bruno', nome: 'Bruno Mendes' }], grupo: null });
    (cobrarCard as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, modo: 'cobrar', destinatarios: ['Bruno Mendes'], citadosNoGrupo: [], grupoNome: null, agendadaPara: null });
    ia({ intencao: 'cobrar', cobrar_codigos: ['it-045'] });
    const r1 = await mandar('cobra o IT-045');
    expect(r1.resposta).toContain('Vou cobrar pelo WhatsApp:\n• IT-045 Robô de pré-faturamento → Bruno');
    expect(r1.resposta).toContain(PEDIR_SIM);
    expect(cobrarCard).not.toHaveBeenCalled();
    expect(estado.comandos).toMatchObject([{ tipo: 'cobrar', status: 'aguardando', user_id: 'u-ana' }]);

    const r2 = await mandar('SIM');
    expect(r2).toMatchObject({ acao: 'confirmado' });
    expect(r2.resposta).toBe('Pronto: a cobrança sai em instantes.\n• IT-045 → Bruno');
    expect(cobrarCard).toHaveBeenCalledWith(banco.db, expect.objectContaining({ userId: 'u-ana' }), 'c1', AGORA);
    expect(estado.comandos[0].status).toBe('executado');
    expect(gerarMock).toHaveBeenCalledTimes(1);
  });

  it('cobrar quem não recebe pelo WhatsApp (D35): a prévia e o SIM dizem que vai para o grupo, citando o nome', async () => {
    const grupo = { id: '120363000000000001@g.us', nome: 'TI FAFIN', membros: [{ id: 'm-bruno', user_id: 'u-bruno', nome: 'Bruno Mendes' }], citados: ['Bruno'] };
    (checarCobranca as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, card: C1, modo: 'cobrar', alvos: [], grupo });
    (cobrarCard as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, modo: 'cobrar', destinatarios: [], citadosNoGrupo: ['Bruno'], grupoNome: 'TI FAFIN', agendadaPara: null });
    ia({ intencao: 'cobrar', cobrar_codigos: ['IT-045'] });
    const r1 = await mandar('cobra o IT-045');
    expect(r1.resposta).toContain('• IT-045 Robô de pré-faturamento → o grupo "TI FAFIN", citando Bruno');
    const r2 = await mandar('SIM');
    expect(r2.resposta).toBe('Pronto: a cobrança sai em instantes.\n• IT-045 → o grupo "TI FAFIN", citando Bruno');

    // Um responsável recebe no privado, o outro é citado no grupo.
    (checarCobranca as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, card: C1, modo: 'cobrar', alvos: [{ id: 'm-ana', user_id: 'u-ana', nome: 'Ana Souza' }], grupo });
    ia({ intencao: 'cobrar', cobrar_codigos: ['IT-045'] });
    expect((await mandar('cobra o IT-045')).resposta).toContain('→ Ana e o grupo "TI FAFIN", citando Bruno');
  });

  it('cobrar a pessoa: os atrasados dela; quem não está atrasado fica de fora com o motivo', async () => {
    (checarCobranca as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 422, erro: 'O IT-045 não está atrasado.' });
    ia({ intencao: 'cobrar', cobrar_pessoa_id: 'u-bruno' });
    const r = await mandar('cobra o Bruno');
    expect(checarCobranca).toHaveBeenCalledWith(banco.db, expect.anything(), 'c1', AGORA, []);
    expect(r.resposta).toBe('Não dá para cobrar:\n• IT-045: O IT-045 não está atrasado.');
    expect(estado.comandos).toEqual([]);
  });

  it('sugestões pendentes → lista numerada → "aprovar 1 e 2" (sem IA) → SIM aprova em nome do gestor', async () => {
    estado.sugestoes = [sug({ id: 's1' }), sug({ id: 's2', tipo: 'comentar_card', proposta: { comentario: 'Falta o teste' } })];
    ia({ intencao: 'ver_sugestoes' });
    const lista = await mandar('sugestões pendentes');
    expect(lista.resposta).toMatch(/^Sugestões aguardando aprovação \(2\):\n1\. IT-045/);
    expect(estado.comandos).toMatchObject([{ tipo: 'lista_sugestoes', status: 'lista', dados: { ids: ['s1', 's2'] } }]);

    const pedido = await mandar('aprovar 1 e 2');
    expect(gerarMock).toHaveBeenCalledTimes(1);
    expect(pedido.resposta).toMatch(/^Vou aprovar 2 sugestões; a mudança vai direto para o Kanban:\n1\. IT-045.*\n2\. IT-045.*comentário "Falta o teste"/);
    expect(banco.rpcs).toEqual([]);

    const sim = await mandar('sim');
    expect(banco.rpcs).toEqual([
      { fn: 'ti_agente_aprovar_sugestao_como', args: { p_id: 's1', p_proposta: null, p_aprovador: 'u-ana' } },
      { fn: 'ti_agente_aprovar_sugestao_como', args: { p_id: 's2', p_proposta: null, p_aprovador: 'u-ana' } },
    ]);
    expect(sim.resposta).toBe('Pronto: as 1 e 2 foram aprovadas. Já está no Kanban.');
  });

  it('rejeitar sem motivo pergunta o motivo; com motivo, rejeita depois do SIM', async () => {
    estado.sugestoes = [sug({ id: 's1' })];
    estado.comandos.push({ id: 'lista', membro_id: 'm-ana', tipo: 'lista_sugestoes', status: 'lista', dados: { ids: ['s1'] }, expira_em: '2026-10-14T15:00:00.000Z' });
    const sem = await mandar('rejeitar 1');
    expect(sem.resposta).toBe('Qual o motivo para rejeitar a 1? Responda "rejeitar 1 <motivo>".');
    await mandar('rejeitar 1 já existe');
    await mandar('SIM');
    expect(banco.rpcs).toEqual([{ fn: 'ti_agente_rejeitar_sugestao_como', args: { p_id: 's1', p_motivo: 'já existe', p_aprovador: 'u-ana' } }]);
  });

  it('rejeitar a sugestão de um chamado do LAB-BRAIN avisa que ele é cancelado e o motivo vai para o solicitante', async () => {
    estado.sugestoes = [
      sug({ id: 's1' }),
      sug({ id: 's2', tipo: 'promover_card', origem: 'lab-brain', proposta: { kanban_status: 'todo', prioridade: 'high' } }),
    ];
    estado.comandos.push({ id: 'lista', membro_id: 'm-ana', tipo: 'lista_sugestoes', status: 'lista', dados: { ids: ['s1', 's2'] }, expira_em: '2026-10-14T15:00:00.000Z' });
    const pedido = await mandar('rejeitar 2 é com o RH');
    expect(pedido.resposta).toMatch(/O chamado do LAB-BRAIN é cancelado, e o motivo vai para quem pediu\./);
    const outra = await mandar('rejeitar 1 já existe');
    expect(outra.resposta).not.toMatch(/LAB-BRAIN/);
  });

  it('pedido de mudança do gestor: prévia, SIM aplica em nome dele; NÃO deixa a proposta na fila', async () => {
    ia({ intencao: 'propor', propostas: [proposta({ card_codigo: 'IT-099', responsaveis: ['u-bruno'], trecho: 'passa o IT-099 para o Bruno' })] });
    const previa = await mandar('passa o IT-099 para o Bruno');
    expect(previa.resposta).toBe(`Vou aplicar no Kanban:\n• IT-099 Painel de laudos: responsáveis: Bruno\n\n${PEDIR_SIM}`);
    const idSugestao = (estado.comandos[0].dados as { ids: string[] }).ids[0];
    expect(estado.comandos[0]).toMatchObject({ tipo: 'aprovar', status: 'aguardando', dados: { daProposta: true } });
    expect(avisarQuemTem).not.toHaveBeenCalled();
    const sim = await mandar('sim');
    expect(banco.rpcs).toEqual([{ fn: 'ti_agente_aprovar_sugestao_como', args: { p_id: idSugestao, p_proposta: null, p_aprovador: 'u-ana' } }]);
    expect(sim.resposta).toBe('Pronto, já está no Kanban ✅');

    ia({ intencao: 'propor', propostas: [proposta({ tipo: 'criar_card', card_codigo: null, titulo: 'Trocar o nobreak', trecho: 'cria um card para trocar o nobreak' })] });
    await mandar('cria um card para trocar o nobreak');
    expect((await mandar('não')).resposta).toBe(CANCELADO_PROPOSTA);
    expect(banco.rpcs).toHaveLength(1);
  });

  it('sem lista: pede a lista primeiro; número fora da lista: avisa', async () => {
    expect((await mandar('aprovar 1')).resposta).toBe(SEM_LISTA);
    estado.comandos.push({ id: 'lista', membro_id: 'm-ana', tipo: 'lista_sugestoes', status: 'lista', dados: { ids: ['s1'] }, expira_em: '2026-10-14T15:00:00.000Z' });
    expect((await mandar('aprovar 4')).resposta).toBe('Não achei 4 na lista (vai de 1 a 1).');
  });

  it('SIM depois de 30 min: expirou, nada executa; NÃO cancela', async () => {
    estado.comandos.push({ id: 'velho', membro_id: 'm-ana', tipo: 'cobrar', status: 'aguardando', dados: { cards: [{ id: 'c1', codigo: 'IT-045' }] }, expira_em: '2026-10-14T13:50:00.000Z' });
    expect((await mandar('sim')).resposta).toBe(EXPIROU);
    expect(cobrarCard).not.toHaveBeenCalled();
    estado.comandos.push({ id: 'novo', membro_id: 'm-ana', tipo: 'cobrar', status: 'aguardando', dados: { cards: [] }, expira_em: '2026-10-14T14:20:00.000Z' });
    expect((await mandar('não')).resposta).toBe(CANCELADO);
    expect(estado.comandos.map((c) => c.status)).toEqual(['cancelado', 'cancelado']);
  });

  it('deixou de ser gestor antes do SIM: não executa', async () => {
    estado.comandos.push({ id: 'p', membro_id: 'm-ana', tipo: 'cobrar', status: 'aguardando', dados: { cards: [{ id: 'c1', codigo: 'IT-045' }] }, expira_em: '2026-10-14T14:20:00.000Z' });
    estado.permissoes = ['canManageIT'];
    const r = await mandar('SIM');
    expect(r.acao).toBe('sem_permissao');
    expect(cobrarCard).not.toHaveBeenCalled();
    expect(estado.comandos[0].status).toBe('cancelado');
  });

  it('papéis separados (D31): só aprovar não cobra nem avisa; só gestor não vê nem decide sugestões', async () => {
    estado.permissoes = ['canManageIT', 'canApproveAgenteTI'];
    ia({ intencao: 'cobrar', cobrar_codigos: ['IT-045'] });
    expect((await mandar('cobra o IT-045')).resposta).toContain('Só gestores da EVA podem pedir cobranças');
    ia({ intencao: 'avisar_grupo', aviso: 'Oi' });
    expect((await mandar('avisa no grupo: oi')).resposta).toContain('Só gestores da EVA podem mandar avisos no grupo');
    expect(checarCobranca).not.toHaveBeenCalled();

    estado.permissoes = ['canManageIT', 'canManageAgenteTI'];
    ia({ intencao: 'ver_sugestoes' });
    expect((await mandar('sugestões pendentes')).resposta).toContain('Só quem aprova sugestões da EVA pode ver e decidir sugestões');
    // "aprovar 1" de um gestor que não aprova não vira pedido sem IA.
    ia({ intencao: 'aprovar', numeros: [1] });
    expect((await mandar('aprovar 1')).resposta).toContain('Só quem aprova sugestões');
    expect(estado.comandos).toEqual([]);
  });

  it('a aba Permissões vale no lugar do cargo (D33): dá a chave sem cargo e tira a do cargo', async () => {
    estado.permissoes = ['canManageIT'];
    estado.linha = { configura: false, gestor: true, aprova: false };
    ia({ intencao: 'avisar_grupo', aviso: 'Reunião às 10h' });
    expect((await mandar('avisa no grupo que a reunião é às 10h')).resposta).not.toContain('Só gestores');
    expect(estado.comandos.map((c) => c.tipo)).toEqual(['avisar_grupo']);

    estado.permissoes = GESTOR;
    estado.linha = { configura: true, gestor: false, aprova: true };
    ia({ intencao: 'cobrar', cobrar_codigos: ['IT-045'] });
    expect((await mandar('cobra o IT-045')).resposta).toContain('Só gestores da EVA podem pedir cobranças');
    expect(checarCobranca).not.toHaveBeenCalled();
  });

  it('pedido de mudança de um gestor que não aprova (D37): prévia, SIM e aplica em nome dele, sem fila', async () => {
    estado.permissoes = ['canManageIT', 'canManageAgenteTI'];
    ia({ intencao: 'propor', propostas: [proposta({ prioridade: 'low' })] });
    const r1 = await mandar('muda a prioridade do IT-045 para baixa');
    expect(r1.resposta).toMatch(/^Vou aplicar no Kanban:\n• IT-045 Robô de pré-faturamento: prioridade baixa/);
    expect(r1.resposta).toContain(PEDIR_SIM);
    expect(estado.comandos).toMatchObject([{ tipo: 'aprovar', status: 'aguardando', dados: { daProposta: true } }]);
    expect(avisarQuemTem).not.toHaveBeenCalled();

    const r2 = await mandar('sim');
    expect(r2.resposta).toBe('Pronto, já está no Kanban ✅');
    expect(banco.rpcs).toEqual([{ fn: 'ti_agente_aprovar_sugestao_como', args: { p_id: expect.any(String), p_proposta: null, p_aprovador: 'u-ana' } }]);
  });

  it('andamento contado por quem executa direto (D37): "IT-045 concluída" pede o SIM e aplica', async () => {
    estado.permissoes = ['canManageIT', 'canManageAgenteTI'];
    ia({ intencao: 'atualizar_cards', resposta: 'Anotei e mandei para aprovação.', itens: [{ card_codigo: 'IT-045', intencao: 'concluir', nova_data: '', prazo_texto: '' }] });
    const r1 = await mandar('IT-045 concluída');
    // A voz da IA diria "aprovação": aqui vale o texto do sistema, com o que vai ser aplicado.
    expect(r1.resposta).toBe(`Anotado, Ana!\n\nVou aplicar no Kanban:\n• IT-045 Robô de pré-faturamento: → Concluído\n\n${PEDIR_SIM}`);
    expect(banco.inserts.map((i) => i.tabela)).toEqual(['it_task_comments', 'ti_agente_sugestoes', 'ti_agente_comandos', 'ti_agente_mensagens']);
    expect(avisarQuemTem).not.toHaveBeenCalledWith(expect.anything(), 'canApproveAgenteTI', expect.anything());

    expect((await mandar('sim')).resposta).toBe('Pronto, já está no Kanban ✅');
    expect(banco.rpcs).toMatchObject([{ fn: 'ti_agente_aprovar_sugestao_como', args: { p_aprovador: 'u-ana' } }]);
  });

  it('o SIM do próprio pedido (D37) vale para o gestor ou para quem aprova; sem nenhum dos dois, não sai', async () => {
    estado.comandos.push({ id: 'p', membro_id: 'm-ana', tipo: 'aprovar', status: 'aguardando', dados: { ids: ['s1'], numeros: [1], daProposta: true }, expira_em: '2026-10-14T14:20:00.000Z' });
    estado.permissoes = ['canManageIT'];
    const r = await mandar('sim');
    expect(r).toMatchObject({ acao: 'sem_permissao' });
    expect(r.resposta).toContain('Só gestores e quem aprova sugestões');
    expect(banco.rpcs).toEqual([]);
  });

  it('aviso para a equipe toda (D36): quem recebe e onde, o texto exato, e só manda depois do SIM', async () => {
    ia({ intencao: 'avisar_equipe', aviso: 'Reunião geral amanhã às 9h.' });
    const r1 = await mandar('avisa todo mundo que a reunião geral é amanhã às 9h');
    expect(r1.resposta).toBe([
      'Vou mandar no WhatsApp de 2 pessoas: Bruno e Caio.',
      'E no grupo "TI FAFIN", citando Dani, que não tem WhatsApp na aba Membros.',
      '',
      '📢 Aviso de Ana:\nReunião geral amanhã às 9h.',
      '',
      PEDIR_SIM,
    ].join('\n'));
    expect(checarAvisoEquipe).toHaveBeenCalledWith(banco.db, expect.objectContaining({ userId: 'u-ana' }));
    expect(enviarAvisoEquipe).not.toHaveBeenCalled();
    expect(estado.comandos).toMatchObject([{ tipo: 'avisar_equipe', status: 'aguardando', dados: { de: 'Ana Souza', aviso: 'Reunião geral amanhã às 9h.' } }]);

    const r2 = await mandar('sim');
    expect(enviarAvisoEquipe).toHaveBeenCalledWith(banco.db, expect.objectContaining({ userId: 'u-ana' }), { de: 'Ana Souza', aviso: 'Reunião geral amanhã às 9h.' }, AGORA);
    expect(r2.resposta).toBe('Pronto: o aviso sai em instantes no WhatsApp de 2 pessoas e no grupo "TI FAFIN", citando Dani.');
  });

  it('aviso para a equipe: sem gestor, recusa; sem ninguém para receber, diz o motivo e não espera SIM', async () => {
    (checarAvisoEquipe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 422, erro: 'O WhatsApp da EVA está desligado (EVA → Configurações).' });
    ia({ intencao: 'avisar_equipe', aviso: 'Oi' });
    expect((await mandar('avisa todos que oi')).resposta).toBe('Não consigo mandar: O WhatsApp da EVA está desligado (EVA → Configurações).');
    expect(estado.comandos).toEqual([]);

    estado.permissoes = ['canManageIT', 'canApproveAgenteTI'];
    ia({ intencao: 'avisar_equipe', aviso: 'Oi' });
    const r = await mandar('avisa todos que oi');
    expect(r).toMatchObject({ acao: 'sem_permissao' });
    expect(r.resposta).toContain('Só gestores da EVA podem mandar avisos para a equipe');
  });

  it('o SIM confere o papel do pedido: um pedido de aprovar não sai de quem perdeu a chave de aprovar', async () => {
    estado.comandos.push({ id: 'p', membro_id: 'm-ana', tipo: 'aprovar', status: 'aguardando', dados: { ids: ['s1'], numeros: [1] }, expira_em: '2026-10-14T14:20:00.000Z' });
    estado.permissoes = ['canManageIT', 'canManageAgenteTI'];
    const r = await mandar('sim');
    expect(r).toMatchObject({ acao: 'sem_permissao' });
    expect(r.resposta).toContain('Só quem aprova sugestões');
    expect(banco.rpcs).toEqual([]);
  });

  it('aviso para uma pessoa (D32): mostra o texto exato, e só manda depois do SIM', async () => {
    ia({ intencao: 'avisar_pessoa', aviso_pessoa_id: 'u-bruno', aviso: 'A reunião mudou para as 10h.' });
    const r1 = await mandar('avisa o Bruno que a reunião mudou para as 10h');
    expect(r1.resposta).toBe(`Vou mandar para Bruno pelo WhatsApp:\n\n📢 Aviso de Ana:\nA reunião mudou para as 10h.\n\n${PEDIR_SIM}`);
    expect(enviarAvisoPessoal).not.toHaveBeenCalled();
    expect(estado.comandos).toMatchObject([{ tipo: 'avisar_pessoa', status: 'aguardando', dados: { destino: 'u-bruno' } }]);
    const r2 = await mandar('sim');
    expect(enviarAvisoPessoal).toHaveBeenCalledWith(
      banco.db, expect.objectContaining({ userId: 'u-ana' }), 'u-bruno', { de: 'Ana Souza', aviso: 'A reunião mudou para as 10h.' }, AGORA,
    );
    expect(r2.resposta).toBe('Pronto: o aviso para Bruno sai em instantes.');
  });

  it('aviso para quem não tem WhatsApp (D35): vai para o grupo, com o nome citado no texto', async () => {
    (checarAvisoPessoal as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, membroId: 'm-bruno', userId: 'u-bruno', nome: 'Bruno Mendes', grupo: { id: '120363000000000001@g.us', nome: 'TI FAFIN', citado: 'Bruno' },
    });
    (enviarAvisoPessoal as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, id: 'a1', para: 'Bruno Mendes', noGrupo: true, grupoNome: 'TI FAFIN', agendadaPara: null });
    ia({ intencao: 'avisar_pessoa', aviso_pessoa_id: 'u-bruno', aviso: 'A reunião mudou para as 10h.' });
    const r1 = await mandar('avisa o Bruno que a reunião mudou para as 10h');
    expect(r1.resposta).toBe(
      `Bruno não tem WhatsApp na aba Membros. Vou mandar no grupo "TI FAFIN", citando o nome:\n\n📢 Aviso de Ana para Bruno:\nA reunião mudou para as 10h.\n\n${PEDIR_SIM}`,
    );
    expect((await mandar('sim')).resposta).toBe('Pronto: o aviso para Bruno (no grupo "TI FAFIN") sai em instantes.');
  });

  it('aviso para uma pessoa: só gestor; pessoa desconhecida, pergunta quem', async () => {
    estado.permissoes = ['canManageIT', 'canApproveAgenteTI'];
    ia({ intencao: 'avisar_pessoa', aviso_pessoa_id: 'u-bruno', aviso: 'oi' });
    expect((await mandar('avisa o Bruno que oi')).resposta).toContain('Só gestores da EVA podem mandar avisos para outras pessoas');
    estado.permissoes = GESTOR;
    ia({ intencao: 'avisar_pessoa', aviso_pessoa_id: 'u-fulano', aviso: 'oi' });
    expect((await mandar('avisa o Fulano que oi')).resposta).toMatch(/^Para quem é o aviso\?/);
    expect(estado.comandos).toEqual([]);
  });

  it('a ajuda fixa mostra só o que o papel da pessoa permite', () => {
    expect(ajuda({ gestor: false, aprova: false })).not.toContain('cobra');
    expect(ajuda({ gestor: true, aprova: false })).toContain('"cobra o IT-045"');
    expect(ajuda({ gestor: true, aprova: false })).not.toContain('sugestões pendentes');
    expect(ajuda({ gestor: false, aprova: true })).toContain('"sugestões pendentes"');
  });

  it('outra mensagem antes do SIM: o pedido sai de cena', async () => {
    estado.comandos.push({ id: 'p', membro_id: 'm-ana', tipo: 'cobrar', status: 'aguardando', dados: {}, expira_em: '2026-10-14T14:20:00.000Z' });
    ia({ intencao: 'conversa', resposta: 'Bom dia, Ana! 😊 Em que posso ajudar?' });
    const r = await mandar('bom dia, EVA');
    expect(r.resposta).toBe('Bom dia, Ana! 😊 Em que posso ajudar?');
    expect(estado.comandos[0].status).toBe('cancelado');
    // Sem a resposta da IA, a ajuda fixa.
    ia({ intencao: 'conversa' });
    expect((await mandar('oi')).resposta).toBe(ajuda({ gestor: true, aprova: true }));
  });

  it('aviso no grupo: mostra o texto exato, e só grava na fila do grupo depois do SIM', async () => {
    ia({ intencao: 'avisar_grupo', aviso: 'A reunião de amanhã é às 10h.' });
    const r1 = await mandar('avisa no grupo que a reunião de amanhã é às 10h');
    expect(r1.resposta).toBe(`Vou mandar no grupo "TI FAFIN":\n\n📢 Aviso de Ana:\nA reunião de amanhã é às 10h.\n\n${PEDIR_SIM}`);
    expect(enfileirarNoGrupo).not.toHaveBeenCalled();
    const r2 = await mandar('sim');
    expect(enfileirarNoGrupo).toHaveBeenCalledWith(banco.db, expect.objectContaining({ grupoId: '120363000000000001@g.us', texto: '📢 Aviso de Ana:\nA reunião de amanhã é às 10h.', enviadaPor: 'u-ana' }));
    expect(r2.resposta).toBe('Pronto: o aviso vai para o grupo "TI FAFIN" em instantes.');
  });

  it('aviso sem grupo escolhido: diz o que falta, sem pedido', async () => {
    (lerConfigGrupo as ReturnType<typeof vi.fn>).mockResolvedValue({ whatsappAtivo: true, grupoId: null, grupoNome: null, fechamento: false, resumoReuniao: false });
    ia({ intencao: 'avisar_grupo', aviso: 'Oi' });
    const r = await mandar('avisa no grupo: oi');
    expect(r.resposta).toBe('Não consigo mandar no grupo: Nenhum grupo da equipe escolhido (EVA → Configurações).');
    expect(estado.comandos).toEqual([]);
  });

  it('fora do horário (sábado): o pedido avisa quando a mensagem sai', async () => {
    (checarCobranca as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, card: C1, modo: 'cobrar', alvos: [{ id: 'm-bruno', user_id: 'u-bruno', nome: 'Bruno Mendes' }], grupo: null });
    ia({ intencao: 'cobrar', cobrar_codigos: ['IT-045'] });
    const r = await mandar('cobra o IT-045', new Date('2026-10-17T13:00:00Z'));
    expect(r.resposta).toContain('Fora do horário (dia útil, 7h às 20h): sai segunda (19/10) às 07:00.');
  });
});

describe('relatório e perguntas de gestão (D38)', () => {
  it('"relatório" do gestor sai sem IA; "da semana" pede os últimos 7 dias', async () => {
    const r = await mandar('Relatório');
    expect(r).toMatchObject({ acao: 'relatorio', resposta: 'RELATÓRIO (dia)' });
    expect(gerarMock).not.toHaveBeenCalled();
    expect(relatorioAgora).toHaveBeenCalledWith(banco.db, 'dia', expect.stringMatching(/\/it\/inicio$/), AGORA);
    expect((await mandar('manda o relatório da semana!')).resposta).toBe('RELATÓRIO (semana)');
    expect(respostas(banco.inserts)).toEqual(['RELATÓRIO (dia)', 'RELATÓRIO (semana)']);
  });

  it('"como foi a semana?": a IA reconhece o pedido e o sistema monta o relatório', async () => {
    ia({ intencao: 'relatorio', relatorio_periodo: 'semana' });
    expect(await mandar('como foi a semana?')).toMatchObject({ acao: 'relatorio', resposta: 'RELATÓRIO (semana)' });
  });

  it('quem não é gestor não recebe o relatório (e "relatório" não pega o atalho)', async () => {
    estado.permissoes = ['canManageIT'];
    ia({ intencao: 'relatorio', relatorio_periodo: 'dia' });
    const r = await mandar('relatório');
    expect(gerarMock).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ acao: 'sem_permissao' });
    expect(r.resposta).toContain('Só gestores da EVA podem receber o relatório de gestão');
    expect(relatorioAgora).not.toHaveBeenCalled();
  });

  it('o PAINEL DE GESTÃO entra no contexto só do gestor, para as perguntas de gestão', async () => {
    ia({ intencao: 'pergunta', resposta: 'A Ana está com 3 atrasados.' });
    expect((await mandar('quem está sobrecarregado?')).resposta).toBe('A Ana está com 3 atrasados.');
    expect(gerarMock.mock.calls[0][0].contexto).toContain('PAINEL DE GESTÃO (teste)');

    estado.permissoes = ['canManageIT'];
    ia({ intencao: 'pergunta', resposta: 'ok' });
    await mandar('quem está sobrecarregado?');
    expect(gerarMock.mock.calls[1][0].contexto).not.toContain('PAINEL DE GESTÃO');
    expect(lerBlocoGestao).toHaveBeenCalledTimes(1);
  });

  it('sem o painel (falha de leitura), a pergunta é respondida assim mesmo', async () => {
    (lerBlocoGestao as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('banco fora'));
    ia({ intencao: 'pergunta', resposta: 'Sem os números agora, mas a Ana tem cards atrasados.' });
    expect(await mandar('quem está sobrecarregado?')).toMatchObject({ acao: 'pergunta', resposta: 'Sem os números agora, mas a Ana tem cards atrasados.' });
  });

  it('o atalho só pega o pedido do relatório, não uma pergunta sobre ele', () => {
    for (const t of ['relatório', 'Relatorio!', 'manda o relatório', 'me manda o relatório de gestão', 'relatório do dia', 'ver relatório']) {
      expect(lerPedidoDeRelatorio(t)).toBe('dia');
    }
    for (const t of ['relatório da semana', 'manda o relatório semanal']) expect(lerPedidoDeRelatorio(t)).toBe('semana');
    for (const t of ['o relatório de ontem estava certo?', 'relatório de vendas', 'como foi a semana?']) expect(lerPedidoDeRelatorio(t)).toBeNull();
  });

  it('a ajuda fixa do gestor mostra o relatório e as perguntas de gestão', () => {
    expect(ajuda({ gestor: true, aprova: false })).toContain('"relatório" ou "como foi a semana?"');
    expect(ajuda({ gestor: false, aprova: false })).not.toContain('relatório');
  });
});

describe('ausência e 1:1 pelo WhatsApp (D40, D41)', () => {
  const NAS_FERIAS = card({ id: 'c10', codigo: 'IT-100', title: 'Migração do e-mail', assigned_to: ['u-ana'], due_date: '2026-10-21T00:00:00.000Z' });
  const linha = (id: string) => estado.membrosTabela!.find((m) => m.id === id)!;

  it('a própria pessoa marca as férias: grava, diz o que vence no período e avisa os gestores no sino', async () => {
    (lerCardsAbertos as ReturnType<typeof vi.fn>).mockResolvedValue([C1, C9, NAS_FERIAS]);
    ia({ intencao: 'ausencia', ausencia_acao: 'marcar', ausencia_de: '2026-10-20', ausencia_ate: '2026-10-24', ausencia_motivo: 'férias' });
    const r = await mandar('vou estar de férias de 20/10 a 24/10');
    expect(r.resposta).toBe('Anotado, Ana: de férias de 20/10 a 24/10. Nesse período, eu não te cobro.\nVence nesse período: IT-100 (21/10). Se quiser passar para alguém, é só pedir ("passa o IT-045 para a Ana").');
    expect(linha('m-ana')).toMatchObject({ ausente_de: '2026-10-20', ausente_ate: '2026-10-24', ausencia_motivo: 'férias' });
    expect(avisarQuemTem).toHaveBeenCalledWith(expect.anything(), 'canManageAgenteTI', expect.objectContaining({ conteudo: 'Ana Souza: de férias de 20/10 a 24/10. Vence no período: IT-100 (21/10).' }));
  });

  it('"voltei" desfaz', async () => {
    estado.membrosTabela = [{ id: 'm-ana', user_id: 'u-ana', ausente_de: '2026-10-13', ausente_ate: '2026-10-17', ausencia_motivo: 'folga' }];
    ia({ intencao: 'ausencia', ausencia_acao: 'cancelar' });
    expect((await mandar('voltei!')).resposta).toBe('Que bom que voltou, Ana! A cobrança volta no próximo dia útil.');
    expect(linha('m-ana')).toMatchObject({ ausente_de: null, ausente_ate: null, ausencia_motivo: null });
  });

  it('o gestor marca a de outra pessoa; sem ser gestor, não; sem o último dia, pergunta', async () => {
    ia({ intencao: 'ausencia', ausencia_acao: 'marcar', pessoa_id: 'u-bruno', ausencia_ate: '2026-10-16' });
    expect((await mandar('o Bruno está de folga até sexta')).resposta).toBe('Anotado: Bruno ausente até 16/10. Nesse período, Bruno não recebe cobrança.');
    expect(linha('m-bruno')).toMatchObject({ ausente_de: '2026-10-14', ausente_ate: '2026-10-16' });
    expect(avisarQuemTem).not.toHaveBeenCalled();

    estado.permissoes = ['canManageIT'];
    ia({ intencao: 'ausencia', ausencia_acao: 'marcar', pessoa_id: 'u-bruno', ausencia_ate: '2026-10-16' });
    expect((await mandar('o Bruno está de folga até sexta')).resposta).toContain('Só gestores da EVA podem marcar a ausência de outra pessoa');

    ia({ intencao: 'ausencia', ausencia_acao: 'marcar', ausencia_de: '2026-10-20' });
    expect((await mandar('vou tirar uns dias')).resposta).toBe('Até quando? Diga o último dia (ex.: "até 05/12").');
  });

  it('1:1: o gestor recebe a pauta montada pelo sistema; sem a pessoa, pergunta; sem ser gestor, não', async () => {
    ia({ intencao: 'preparar_1a1', pessoa_id: 'u-bruno' });
    expect(await mandar('prepara minha 1:1 com o Bruno')).toMatchObject({ acao: 'preparar_1a1', resposta: 'PAUTA (u-bruno, whatsapp)' });

    ia({ intencao: 'preparar_1a1', pessoa_id: '' });
    expect((await mandar('prepara minha 1:1')).resposta).toBe('Com quem é a 1:1? Ex.: "prepara minha 1:1 com o Bruno".');

    estado.permissoes = ['canManageIT'];
    ia({ intencao: 'preparar_1a1', pessoa_id: 'u-bruno' });
    expect(await mandar('prepara minha 1:1 com o Bruno')).toMatchObject({ acao: 'sem_permissao' });
  });

  it('a ajuda fixa mostra a ausência para todos e a 1:1 para o gestor', () => {
    expect(ajuda({ gestor: false, aprova: false })).toContain('• ausência: "vou estar de férias de 01/12 a 05/12"');
    expect(ajuda({ gestor: true, aprova: false })).toContain('"prepara minha 1:1 com o Bruno"');
  });
});

describe('planejamento e pauta da reunião (D47, D48)', () => {
  it('planejar: o gestor recebe a conta; sem redistribuição, nada vai para a fila', async () => {
    ia({ intencao: 'planejar' });
    expect(await mandar('o que cabe na próxima sprint?')).toMatchObject({ acao: 'planejar', resposta: 'PLANEJAMENTO (teste)' });
    expect(estado.comandos).toEqual([]);
    expect(banco.inserts.filter((i) => i.tabela === 'ti_agente_sugestoes')).toEqual([]);
  });

  it('planejar com redistribuição: vira sugestão do próprio gestor, e o SIM aplica', async () => {
    (sugestoesDaRedistribuicao as ReturnType<typeof vi.fn>).mockReturnValueOnce([{
      tipo: 'atualizar_card', card_id: 'c9', proposta: { responsaveis: ['u-bruno'], comentario: 'Redistribuído no planejamento' },
      trecho: 'Redistribuição proposta pela EVA no planejamento.', confianca: 'media', avisos: [],
    }]);
    ia({ intencao: 'planejar' });
    const previa = await mandar('dá para redistribuir os cards?');
    expect(previa.resposta).toBe(`PLANEJAMENTO (teste)\n\nAplico essa redistribuição no Kanban? Cada card muda de responsável e ganha um comentário com o motivo.\n${PEDIR_SIM}`);
    expect(banco.inserts.find((i) => i.tabela === 'ti_agente_sugestoes')!.linhas).toEqual([expect.objectContaining({
      origem: 'whatsapp', proposta_por: 'u-ana', tipo: 'atualizar_card', card_id: 'c9', proposta: { responsaveis: ['u-bruno'], comentario: 'Redistribuído no planejamento' },
    })]);
    expect(estado.comandos[0]).toMatchObject({ tipo: 'aprovar', status: 'aguardando', dados: { daProposta: true } });
    const sim = await mandar('sim');
    expect(banco.rpcs[0]).toMatchObject({ fn: 'ti_agente_aprovar_sugestao_como', args: { p_aprovador: 'u-ana' } });
    expect(sim.resposta).toBe('Pronto, já está no Kanban ✅');
  });

  it('pauta da reunião: o gestor recebe a pauta montada pelo sistema', async () => {
    ia({ intencao: 'pauta_reuniao' });
    expect(await mandar('pauta da reunião')).toMatchObject({ acao: 'pauta_reuniao', resposta: 'PAUTA DA REUNIÃO (whatsapp)' });
  });

  it('sem ser gestor, nem o planejamento nem a pauta', async () => {
    estado.permissoes = ['canManageIT'];
    ia({ intencao: 'planejar' });
    expect((await mandar('o que cabe na próxima sprint?')).resposta).toContain('Só gestores da EVA podem planejar a sprint');
    ia({ intencao: 'pauta_reuniao' });
    expect((await mandar('pauta da reunião')).resposta).toContain('Só gestores da EVA podem montar a pauta da reunião');
  });

  it('a ajuda do gestor mostra o planejamento e a pauta', () => {
    expect(ajuda({ gestor: true, aprova: false })).toContain('• "o que cabe na próxima sprint?"');
    expect(ajuda({ gestor: true, aprova: false })).toContain('• "pauta da reunião"');
    expect(ajuda({ gestor: false, aprova: false })).not.toContain('pauta da reunião');
  });
});
