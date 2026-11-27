import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./dados.js', async (original) => ({
  ...(await original<typeof import('./dados.js')>()),
  avisarQuemTem: vi.fn(async () => undefined),
  // Quem configura a EVA: o Gabriel.
  lerQuemTem: vi.fn(async () => ['u-gabriel']),
}));

import { avisarQuemTem } from './dados.js';
import { verificarSaude, verificarSaudeSemFalhar } from './saude.js';

const AGORA = new Date('2026-11-24T14:00:00Z');
const OK = {
  whatsapp_ativo: true, granola_folder_id: 'fol_1', granola_verificado_em: '2026-11-24T12:00:00Z', granola_ultimo_erro: null as string | null,
  waha_status: 'WORKING', waha_verificado_em: '2026-11-24T13:59:00Z',
};

interface Estado {
  config: typeof OK;
  abertos: { chave: string; avisado_em: string | null }[];
  gravados: { tabela: string; op: string; linha: Record<string, unknown>; filtro?: Record<string, unknown> }[];
}

function criarDb(e: Estado) {
  const from = (tabela: string) => {
    const f: Record<string, unknown> = {};
    let op: 'select' | 'upsert' | 'update' = 'select';
    let linha: Record<string, unknown> = {};
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'gte', 'order', 'limit', 'not']) q[m] = () => q;
    q.eq = (k: string, v: unknown) => { f[k] = v; return q; };
    q.upsert = (l: Record<string, unknown>) => { op = 'upsert'; linha = l; return q; };
    q.update = (l: Record<string, unknown>) => { op = 'update'; linha = l; return q; };
    q.maybeSingle = async () => ({ data: tabela === 'ti_agente_config' ? e.config : null, error: null });
    const resolver = () => {
      if (op !== 'select') { e.gravados.push({ tabela, op, linha, filtro: { ...f } }); return { data: null, error: null }; }
      if (tabela === 'ti_agente_saude') return { data: e.abertos, error: null };
      if (tabela === 'ti_agente_membros') return { data: [{ id: 'm-gabriel', user_id: 'u-gabriel' }, { id: 'm-ana', user_id: 'u-ana' }], error: null };
      return { data: [], error: null };
    };
    q.then = (ok: (v: unknown) => unknown, erro?: (v: unknown) => unknown) => Promise.resolve(resolver()).then(ok, erro);
    return q;
  };
  return { from };
}

const avisarMock = avisarQuemTem as ReturnType<typeof vi.fn>;
let estado: Estado;
beforeEach(() => {
  vi.clearAllMocks();
  estado = { config: { ...OK }, abertos: [], gravados: [] };
});
const whatsapp = () => estado.gravados.filter((g) => g.tabela === 'ti_agente_mensagens').map((g) => g.linha);

describe('saúde das integrações (D39)', () => {
  it('problema novo: abre a linha e avisa quem configura, no sino e no WhatsApp', async () => {
    estado.config.granola_ultimo_erro = 'a assinatura do workspace do Granola está inativa (renove no Granola para a sincronização voltar)';
    const r = await verificarSaude(criarDb(estado) as never, { agora: AGORA });
    expect(r).toEqual({ problemas: ['granola_erro'], avisados: ['granola_erro'], resolvidos: [] });
    expect(estado.gravados).toContainEqual(expect.objectContaining({ tabela: 'ti_agente_saude', op: 'upsert', linha: expect.objectContaining({ chave: 'granola_erro', ativo: true }) }));
    expect(avisarMock).toHaveBeenCalledWith(expect.anything(), 'canConfigureAgenteTI', expect.objectContaining({
      titulo: 'EVA: Granola sem sincronizar', conteudo: expect.stringContaining('assinatura do workspace do Granola está inativa'), tipo: 'warning',
    }));
    // Só quem configura (o Gabriel) recebe no WhatsApp; a Ana, não.
    expect(whatsapp()).toEqual([expect.objectContaining({ membro_id: 'm-gabriel', tipo: 'alerta', chave_dia: 'saude:m-gabriel:granola_erro:2026-11-24T14' })]);
  });

  it('o mesmo problema antes de 24 h não avisa de novo; depois, avisa que continua', async () => {
    estado.config.granola_ultimo_erro = 'Granola respondeu HTTP 500';
    estado.abertos = [{ chave: 'granola_erro', avisado_em: '2026-11-24T13:00:00Z' }];
    expect(await verificarSaude(criarDb(estado) as never, { agora: AGORA })).toMatchObject({ avisados: [] });
    expect(avisarMock).not.toHaveBeenCalled();

    estado.abertos = [{ chave: 'granola_erro', avisado_em: '2026-11-23T13:00:00Z' }];
    expect(await verificarSaude(criarDb(estado) as never, { agora: AGORA })).toMatchObject({ avisados: ['granola_erro'] });
    expect(avisarMock).toHaveBeenCalledWith(expect.anything(), 'canConfigureAgenteTI', expect.objectContaining({ titulo: 'EVA: Granola sem sincronizar (continua)' }));
  });

  it('resolvido: fecha a linha e avisa que voltou', async () => {
    estado.abertos = [{ chave: 'granola_erro', avisado_em: '2026-11-24T09:00:00Z' }];
    const r = await verificarSaude(criarDb(estado) as never, { agora: AGORA });
    expect(r).toEqual({ problemas: [], avisados: [], resolvidos: ['granola_erro'] });
    expect(estado.gravados).toContainEqual(expect.objectContaining({ tabela: 'ti_agente_saude', op: 'update', linha: expect.objectContaining({ ativo: false }), filtro: { chave: 'granola_erro' } }));
    expect(avisarMock).toHaveBeenCalledWith(expect.anything(), 'canConfigureAgenteTI', expect.objectContaining({ titulo: 'EVA: resolvido', conteudo: 'O Granola voltou a sincronizar.', tipo: 'success' }));
    expect(whatsapp()).toEqual([expect.objectContaining({ texto: '✅ O Granola voltou a sincronizar.' })]);
  });

  it('VPS sem sinal: só o sino (o WhatsApp é o que caiu)', async () => {
    estado.config.waha_verificado_em = '2026-11-24T12:00:00Z';
    const r = await verificarSaude(criarDb(estado) as never, { agora: AGORA });
    expect(r.avisados).toEqual(['waha_sem_sinal']);
    expect(avisarMock).toHaveBeenCalledWith(expect.anything(), 'canConfigureAgenteTI', expect.objectContaining({ titulo: 'EVA: VPS sem sinal' }));
    expect(whatsapp()).toEqual([]);
  });

  it('nos crons: o dryRun não confere, e uma falha não derruba o cron', async () => {
    expect(await verificarSaudeSemFalhar(criarDb(estado) as never, true, 'teste')).toBeNull();
    const quebrado = { from: () => { throw new Error('banco fora'); } };
    expect(await verificarSaudeSemFalhar(quebrado as never, false, 'teste')).toEqual({ erro: 'banco fora' });
  });
});
