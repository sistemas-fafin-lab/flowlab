// Claude Sonnet 5.5 — o provedor principal da EVA (D2, plano §9.1).
import Anthropic from '@anthropic-ai/sdk';
import { mensagemDeErro, type ClienteIA, type PedidoIA, type TentativaIA } from './tipos.js';

/** D2: só o Sonnet 5.5, sem variável para trocar e sem outro modelo Claude de reserva. */
export const MODELO_CLAUDE = 'claude-sonnet-5-5';

/** Tempo e novas tentativas abaixo do padrão do SDK, para sobrar tempo ao Gemini (RNF03). */
const TEMPO_LIMITE_MS = 90_000;
const NOVAS_TENTATIVAS = 1;

type ClienteMensagens = Pick<Anthropic, 'messages'>;

export interface OpcoesClaude {
  env?: Record<string, string | undefined>;
  /** Injeção para testes. */
  cliente?: ClienteMensagens;
  agora?: () => number;
}

function criarCliente(env: Record<string, string | undefined>): ClienteMensagens {
  const workspace = env.CLAUDE_WORKSPACE_ID?.trim();
  return new Anthropic({
    apiKey: env.CLAUDE_API_KEY,
    // A chave é da organização (multi-workspace): sem este cabeçalho, 400 (plano §3).
    defaultHeaders: workspace ? { 'anthropic-workspace-id': workspace } : undefined,
    timeout: TEMPO_LIMITE_MS,
    maxRetries: NOVAS_TENTATIVAS,
  });
}

/** 400/401/403/404 precisam de gente (chave, workspace, pedido mal formado): `configuracao`. */
function classificarErro(e: unknown): TentativaIA['resultado'] {
  if (
    e instanceof Anthropic.AuthenticationError ||
    e instanceof Anthropic.PermissionDeniedError ||
    e instanceof Anthropic.BadRequestError ||
    e instanceof Anthropic.NotFoundError
  ) {
    return 'configuracao';
  }
  return 'erro';
}

export function criarClienteClaude(opcoes: OpcoesClaude = {}): ClienteIA {
  const env = opcoes.env ?? process.env;
  const agora = opcoes.agora ?? Date.now;
  let cliente = opcoes.cliente;

  return {
    provedor: 'claude',
    modelo: MODELO_CLAUDE,
    async chamar(pedido: PedidoIA): Promise<TentativaIA> {
      const inicio = agora();
      const base = { provedor: 'claude' as const, modelo: MODELO_CLAUDE };
      if (!env.CLAUDE_API_KEY && !opcoes.cliente) {
        return { ...base, resultado: 'configuracao', erro: 'CLAUDE_API_KEY não configurada.', duracaoMs: 0 };
      }
      cliente ??= criarCliente(env);

      // Instruções e contexto no system, com cache no último bloco estável (plano §12.3).
      const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: pedido.instrucoes }];
      if (pedido.contexto) system.push({ type: 'text', text: pedido.contexto });
      system[system.length - 1].cache_control = { type: 'ephemeral' };

      try {
        // Sem `thinking`: no Sonnet 5.5 o padrão é adaptativo e `disabled` dá 400.
        // Sem o fallback de recusa do servidor: ele trocaria de modelo Claude (D2).
        const resposta = await cliente.messages.create({
          model: MODELO_CLAUDE,
          max_tokens: 16000,
          system,
          messages: [{ role: 'user', content: pedido.conteudo }],
          output_config: { effort: pedido.esforco, format: { type: 'json_schema', schema: pedido.schema } },
        });

        const uso = resposta.usage;
        const tokens = {
          tokensEntrada: (uso.input_tokens ?? 0) + (uso.cache_read_input_tokens ?? 0) + (uso.cache_creation_input_tokens ?? 0),
          tokensSaida: uso.output_tokens ?? 0,
          duracaoMs: agora() - inicio,
        };
        if (resposta.stop_reason === 'refusal') {
          return { ...base, ...tokens, resultado: 'recusa', erro: 'O Claude recusou a tarefa.' };
        }
        if (resposta.stop_reason === 'max_tokens') {
          return { ...base, ...tokens, resultado: 'cortada', erro: 'Resposta cortada no limite de tokens.' };
        }
        const texto = resposta.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        return { ...base, ...tokens, resultado: 'ok', texto };
      } catch (e) {
        return { ...base, resultado: classificarErro(e), erro: mensagemDeErro(e), duracaoMs: agora() - inicio };
      }
    },
  };
}
