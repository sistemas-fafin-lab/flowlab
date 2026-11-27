import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cobranca.js', async (original) => ({
  ...(await original<typeof import('./cobranca.js')>()),
  lerConfigCobranca: vi.fn(),
  lerMembrosCobranca: vi.fn(),
}));
vi.mock('./gestao.js', () => ({ lerDestinatariosDeGestao: vi.fn() }));
vi.mock('./dados.js', async (original) => ({ ...(await original<typeof import('./dados.js')>()), lerQuemTem: vi.fn() }));

import { lerConfigCobranca, lerMembrosCobranca } from './cobranca.js';
import { lerQuemTem } from './dados.js';
import { lerDestinatariosDeGestao } from './gestao.js';
import { veGastos, verificarVencimentos } from './vencimentos.js';

// Dados fictícios. Terça, 01/12/2026, 10h em Brasília.
const AS_10H = new Date('2026-12-01T10:00:00-03:00');
const LINK = 'https://app/it/gastos/despesas';
type Linha = Record<string, unknown>;

function criarDb(despesas: Linha[]) {
  const mensagens: Linha[] = [];
  const from = (tabela: string) => {
    let upsert: Linha | null = null;
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'not', 'neq', 'limit']) q[m] = () => q;
    q.upsert = (v: Linha) => { upsert = v; return q; };
    const rodar = () => {
      if (tabela === 'ti_despesas') return { data: despesas, error: null };
      if (upsert) {
        if (mensagens.some((l) => l.chave_dia === upsert!.chave_dia)) return { data: [], error: null };
        mensagens.push(upsert);
        return { data: [{ id: `m${mensagens.length}` }], error: null };
      }
      return { data: [], error: null };
    };
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(rodar()).then(ok);
    return q;
  };
  return { db: { from } as never, mensagens };
}

const M365 = {
  id: 'd1', descricao: 'Microsoft 365', fornecedor_nome: 'Microsoft', recorrencia: 'anual', competencia_fim: '2026-12-01',
  renovacao_automatica: true, aviso_renovacao_dias: 30, responsavel_id: 'u-ana',
};
const SSL = { ...M365, id: 'd2', descricao: 'Certificado SSL', fornecedor_nome: 'Sectigo', competencia_fim: '2027-03-01', renovacao_automatica: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lerConfigCobranca).mockResolvedValue({ whatsapp_ativo: true } as never);
  vi.mocked(lerDestinatariosDeGestao).mockResolvedValue([
    { membroId: 'm-gil', userId: 'u-gil', nome: 'Gil Prado' },
    { membroId: 'm-bia', userId: 'u-bia', nome: 'Bia Lopes' },
  ]);
  vi.mocked(lerMembrosCobranca).mockResolvedValue([
    { id: 'm-ana', user_id: 'u-ana', nome: 'Ana Souza', ativo: true, recebe_cobranca: true, whatsapp: '5561999990000' },
  ] as never);
  // Gil vê o Gastos de TI pelo cargo; Ana gerencia; Bia não vê.
  vi.mocked(lerQuemTem).mockImplementation(async (_db, chave) => (chave === 'canViewGastosTI' ? ['u-gil'] : ['u-ana']));
});

describe('verificarVencimentos', () => {
  it('na antecedência, avisa os gestores e o responsável que veem o Gastos de TI, uma vez', async () => {
    const { db, mensagens } = criarDb([M365, SSL]);
    expect(await verificarVencimentos(db, { agora: AS_10H, link: LINK })).toEqual({ pulado: null, avisos: 1, gravados: 2 });
    expect(mensagens.map((m) => m.membro_id).sort()).toEqual(['m-ana', 'm-gil']);
    expect(mensagens[0]).toMatchObject({ tipo: 'alerta', status: 'pendente', chave_dia: 'vencimento:m-gil:d1:2026-12-31:30' });
    expect(String(mensagens[0].texto)).toContain('Microsoft 365 (Microsoft) renova sozinha em 30 dias');
    // O relógio roda de novo: nada sai duas vezes.
    expect((await verificarVencimentos(db, { agora: new Date('2026-12-01T10:10:00-03:00'), link: LINK })).gravados).toBe(0);
    // A 7 dias, o segundo aviso.
    expect((await verificarVencimentos(db, { agora: new Date('2026-12-24T10:00:00-03:00'), link: LINK })).gravados).toBe(2);
  });

  it('fora do horário da EVA ou com o WhatsApp desligado, não avisa', async () => {
    const { db } = criarDb([M365]);
    expect((await verificarVencimentos(db, { agora: new Date('2026-12-01T22:00:00-03:00'), link: LINK })).pulado).toBe('Fora do horário da EVA.');
    vi.mocked(lerConfigCobranca).mockResolvedValue({ whatsapp_ativo: false } as never);
    expect((await verificarVencimentos(db, { agora: AS_10H, link: LINK })).pulado).toBe('O WhatsApp da EVA está desligado.');
  });

  it('veGastos: as duas chaves do Gastos de TI', () => {
    expect(veGastos({ permissoes: ['canViewGastosTI'] })).toBe(true);
    expect(veGastos({ permissoes: ['canManageGastosTI'] })).toBe(true);
    expect(veGastos({ permissoes: ['canManageAgenteTI', 'canManageIT'] })).toBe(false);
    expect(veGastos(null)).toBe(false);
  });
});
