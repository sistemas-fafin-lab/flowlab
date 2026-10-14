// Gemini 3.8 Flash — a reserva da EVA quando o Claude falha (D17, plano §9.1).
// Molde: api/_lib/apoio/gemini.ts.
import { ApiError, GoogleGenAI } from '@google/genai';
import { limparJson, mensagemDeErro, type ClienteIA, type PedidoIA, type TentativaIA } from './tipos.js';

/** Escolhido pelo usuário em 13/Out; separado do GEMINI_MODEL do Apoio Alvaro. */
export const MODELO_GEMINI_PADRAO = 'gemini-3.8-flash';
// 60 s se mostrou curto no teste com a reunião real (35 s numa rodada, estouro na outra).
const TEMPO_LIMITE_MS = 90_000;

type ClienteModelos = Pick<GoogleGenAI, 'models'>;

export interface OpcoesGemini {
  env?: Record<string, string | undefined>;
  cliente?: ClienteModelos;
  agora?: () => number;
}

function classificarErro(e: unknown): TentativaIA['resultado'] {
  if (e instanceof ApiError && [400, 401, 403, 404].includes(e.status)) return 'configuracao';
  return 'erro';
}

export function criarClienteGemini(opcoes: OpcoesGemini = {}): ClienteIA {
  const env = opcoes.env ?? process.env;
  const agora = opcoes.agora ?? Date.now;
  const modelo = env.AGENTE_TI_GEMINI_MODEL?.trim() || MODELO_GEMINI_PADRAO;
  let cliente = opcoes.cliente;

  return {
    provedor: 'gemini',
    modelo,
    async chamar(pedido: PedidoIA): Promise<TentativaIA> {
      const inicio = agora();
      const base = { provedor: 'gemini' as const, modelo };
      const apiKey = env.GEMINI_API_KEY?.trim();
      if (!apiKey && !opcoes.cliente) {
        return { ...base, resultado: 'configuracao', erro: 'GEMINI_API_KEY não configurada.', duracaoMs: 0 };
      }
      cliente ??= new GoogleGenAI({ apiKey });

      try {
        const resposta = await cliente.models.generateContent({
          model: modelo,
          contents: [{ role: 'user', parts: [{ text: pedido.conteudo }] }],
          config: {
            // As mesmas instruções e o mesmo contexto do Claude (§9.2).
            systemInstruction: [pedido.instrucoes, pedido.contexto].filter(Boolean).join('\n\n'),
            responseMimeType: 'application/json',
            responseJsonSchema: pedido.schema,
            abortSignal: AbortSignal.timeout(TEMPO_LIMITE_MS),
          },
        });
        const tokens = {
          tokensEntrada: resposta.usageMetadata?.promptTokenCount,
          tokensSaida: resposta.usageMetadata?.candidatesTokenCount,
          duracaoMs: agora() - inicio,
        };
        const motivo = resposta.candidates?.[0]?.finishReason;
        if (motivo === 'MAX_TOKENS') return { ...base, ...tokens, resultado: 'cortada', erro: 'Resposta cortada no limite de tokens.' };
        if (motivo === 'SAFETY' || motivo === 'PROHIBITED_CONTENT') return { ...base, ...tokens, resultado: 'recusa', erro: 'O Gemini recusou a tarefa.' };
        return { ...base, ...tokens, resultado: 'ok', texto: limparJson(resposta.text ?? '') };
      } catch (e) {
        return { ...base, resultado: classificarErro(e), erro: mensagemDeErro(e), duracaoMs: agora() - inicio };
      }
    },
  };
}
