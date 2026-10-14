import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { gerarEstruturado, paraJsonSchema, type LinhaChamadaIA } from './gerarEstruturado.js';
import { criarClienteClaude } from './claude.js';
import type { ClienteIA, TentativaIA } from './tipos.js';

const Schema = z.object({ resposta: z.string(), itens: z.array(z.string()) });
const VALIDO = JSON.stringify({ resposta: 'ok', itens: ['a'] });

function falso(provedor: 'claude' | 'gemini', t: Partial<TentativaIA>): ClienteIA & { chamar: ReturnType<typeof vi.fn> } {
  const chamar = vi.fn(async () => ({ provedor, modelo: `${provedor}-x`, resultado: 'ok', duracaoMs: 10, ...t }) as TentativaIA);
  return { provedor, modelo: `${provedor}-x`, chamar };
}

async function rodar(claude: ClienteIA, gemini: ClienteIA) {
  const linhas: LinhaChamadaIA[] = [];
  const r = await gerarEstruturado(
    { finalidade: 'analise_reuniao', instrucoes: 'faça', conteudo: 'SEGREDO DA REUNIÃO', schema: Schema, esforco: 'medium', reuniaoId: 'r1' },
    { claude, gemini, registrar: async (l) => { linhas.push(l); } },
  );
  return { r, linhas };
}

describe('paraJsonSchema', () => {
  it('tira os limites numéricos e de tamanho que o Claude recusa (400), sem mudar o resto', () => {
    const json = paraJsonSchema(z.object({ n: z.array(z.number().int()), t: z.string().min(1).max(5), d: z.enum(['a', 'b']).nullable() }));
    const texto = JSON.stringify(json);
    for (const k of ['minimum', 'maximum', 'minLength', 'maxLength', '$schema']) expect(texto).not.toContain(`"${k}"`);
    expect(json).toMatchObject({ type: 'object', required: ['n', 't', 'd'], properties: { n: { type: 'array', items: { type: 'integer' } }, t: { type: 'string' } } });
  });

  it('os schemas da EVA vão sem esses limites', async () => {
    const { SchemaMensagem } = await import('../comandos.js');
    expect(JSON.stringify(paraJsonSchema(SchemaMensagem))).not.toMatch(/"(minimum|maximum|minLength|maxLength)"/);
  });

  it('poucos campos "ou nulo": o Claude recusa a partir de uns 20 ("too many parameters with union types")', async () => {
    const { SchemaMensagem } = await import('../comandos.js');
    const { SchemaChat } = await import('../chat.js');
    const { SchemaSugestoes } = await import('../extracao.js');
    const unioes = (no: unknown): number => {
      if (Array.isArray(no)) return no.reduce((n, x) => n + unioes(x), 0);
      if (!no || typeof no !== 'object') return 0;
      const o = no as Record<string, unknown>;
      const aqui = Array.isArray(o.type) || Array.isArray(o.anyOf) || Array.isArray(o.oneOf) ? 1 : 0;
      return aqui + Object.values(o).reduce<number>((n, v) => n + unioes(v), 0);
    };
    // A análise de reunião (11) roda em produção; a resposta do WhatsApp com 20 foi recusada (14/Out).
    for (const s of [SchemaMensagem, SchemaChat, SchemaSugestoes]) expect(unioes(paraJsonSchema(s))).toBeLessThanOrEqual(12);
  });
});

describe('gerarEstruturado — reserva (D17)', () => {
  it('Claude ok: o Gemini não é chamado', async () => {
    const claude = falso('claude', { texto: VALIDO });
    const gemini = falso('gemini', { texto: VALIDO });
    const { r, linhas } = await rodar(claude, gemini);
    expect(r.ok && r.provedor).toBe('claude');
    expect(gemini.chamar).not.toHaveBeenCalled();
    expect(linhas).toHaveLength(1);
  });

  it.each([
    ['erro passageiro (529, tempo esgotado)', 'erro'],
    ['erro de configuração (401)', 'configuracao'],
    ['recusa', 'recusa'],
    ['resposta cortada (max_tokens)', 'cortada'],
  ] as const)('%s: o Gemini assume e o motivo fica registrado', async (_nome, resultado) => {
    const claude = falso('claude', { resultado, erro: 'detalhe' });
    const gemini = falso('gemini', { texto: VALIDO });
    const { r, linhas } = await rodar(claude, gemini);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.provedor).toBe('gemini');
      expect(r.motivoReserva).toContain('Claude');
    }
    expect(linhas.map((l) => [l.provedor, l.resultado])).toEqual([['claude', resultado], ['gemini', 'ok']]);
  });

  it('JSON fora do schema no Claude vira schema_invalido e o Gemini assume', async () => {
    const claude = falso('claude', { texto: JSON.stringify({ resposta: 1 }) });
    const gemini = falso('gemini', { texto: '```json\n' + VALIDO + '\n```' });
    const { r, linhas } = await rodar(claude, gemini);
    expect(r.ok && r.dados).toEqual({ resposta: 'ok', itens: ['a'] });
    expect(linhas[0].resultado).toBe('schema_invalido');
  });

  it('os dois falham: erro com as duas mensagens', async () => {
    const { r } = await rodar(falso('claude', { resultado: 'erro', erro: 'sobrecarga' }), falso('gemini', { texto: 'não é json' }));
    expect(r.ok).toBe(false);
    if ('erros' in r) {
      expect(r.erros[0]).toContain('Claude: erro (sobrecarga)');
      expect(r.erros[1]).toContain('Gemini: resposta fora do formato');
    }
  });

  it('o registro guarda só metadados: nenhum texto da reunião', async () => {
    const { linhas } = await rodar(falso('claude', { texto: VALIDO, tokensEntrada: 100, tokensSaida: 20 }), falso('gemini', {}));
    expect(linhas[0]).toMatchObject({ finalidade: 'analise_reuniao', reuniao_id: 'r1', tokens_entrada: 100, tokens_saida: 20 });
    expect(JSON.stringify(linhas)).not.toContain('SEGREDO');
  });

  it('falha ao registrar não derruba a resposta', async () => {
    const r = await gerarEstruturado(
      { finalidade: 'chat', instrucoes: 'x', conteudo: 'y', schema: Schema, esforco: 'low' },
      { claude: falso('claude', { texto: VALIDO }), gemini: falso('gemini', {}), registrar: async () => { throw new Error('banco fora'); } },
    );
    expect(r.ok).toBe(true);
  });

  it('o JSON Schema enviado aos provedores não leva "$schema" e fecha os objetos', () => {
    const s = paraJsonSchema(Schema);
    expect(s.$schema).toBeUndefined();
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(['resposta', 'itens']);
  });
});

describe('criarClienteClaude', () => {
  const pedido = { instrucoes: 'faça', contexto: 'ctx', conteudo: 'pergunta', schema: { type: 'object' }, esforco: 'low' as const };

  interface ArgsCriar { model: string; thinking?: unknown; output_config: unknown; system: { cache_control?: unknown }[] }

  function sdkFalso(impl: () => Promise<unknown>) {
    const create = vi.fn<(args: ArgsCriar) => Promise<unknown>>(() => impl());
    return { cliente: { messages: { create } } as unknown as Pick<Anthropic, 'messages'>, create };
  }

  it('manda Sonnet 5.5, esforço, schema e cache no último bloco do system; soma os tokens de cache', async () => {
    const { cliente, create } = sdkFalso(async () => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: VALIDO }],
      usage: { input_tokens: 50, output_tokens: 30, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 },
    }));
    const t = await criarClienteClaude({ cliente, env: {} }).chamar(pedido);
    const args = create.mock.calls[0][0];
    expect(args.model).toBe('claude-sonnet-5-5');
    expect(args.thinking).toBeUndefined();
    expect(args.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: { type: 'object' } } });
    expect(args.system.map((b) => !!b.cache_control)).toEqual([false, true]);
    expect(t).toMatchObject({ resultado: 'ok', texto: VALIDO, tokensEntrada: 950, tokensSaida: 30 });
  });

  it('recusa e corte viram resultados próprios', async () => {
    const recusa = await criarClienteClaude({ cliente: sdkFalso(async () => ({ stop_reason: 'refusal', content: [], usage: { input_tokens: 1, output_tokens: 0 } })).cliente, env: {} }).chamar(pedido);
    const cortada = await criarClienteClaude({ cliente: sdkFalso(async () => ({ stop_reason: 'max_tokens', content: [], usage: { input_tokens: 1, output_tokens: 1 } })).cliente, env: {} }).chamar(pedido);
    expect(recusa.resultado).toBe('recusa');
    expect(cortada.resultado).toBe('cortada');
  });

  it('401 é configuração; 429 é erro passageiro; nada lança exceção', async () => {
    const auth = new Anthropic.AuthenticationError(401, { error: { message: 'chave inválida' } }, 'chave inválida', new Headers());
    const limite = new Anthropic.RateLimitError(429, { error: { message: 'devagar' } }, 'devagar', new Headers());
    const t401 = await criarClienteClaude({ cliente: sdkFalso(async () => { throw auth; }).cliente, env: {} }).chamar(pedido);
    const t429 = await criarClienteClaude({ cliente: sdkFalso(async () => { throw limite; }).cliente, env: {} }).chamar(pedido);
    expect(t401.resultado).toBe('configuracao');
    expect(t429.resultado).toBe('erro');
  });

  it('sem CLAUDE_API_KEY: configuração, sem chamar a API', async () => {
    const t = await criarClienteClaude({ env: {} }).chamar(pedido);
    expect(t).toMatchObject({ resultado: 'configuracao', duracaoMs: 0 });
  });
});
