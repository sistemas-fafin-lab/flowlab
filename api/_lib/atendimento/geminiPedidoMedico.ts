// api/_lib/atendimento/geminiPedidoMedico.ts
// Chamada ao Gemini da leitura do pedido médico — mesmo SDK e variáveis do envio ao
// apoio (api/_lib/apoio/gemini.ts): todos os arquivos vão como partes inline numa só
// generateContent, e a IA lê o conjunto como um pedido só. Devolve o texto bruto; a
// leitura do JSON fica em leituraPedidoMedico.ts.

import { GoogleGenAI } from '@google/genai';

export interface ArquivoPedidoMedico {
  data: Buffer;
  mimeType: string;
}

const MODELO_PADRAO = 'gemini-3.1-flash-lite';
// Abaixo do maxDuration da função (vercel.json) e do timeout do navegador, para o
// handler ainda responder 504 e apagar os arquivos.
const TEMPO_LIMITE_MS = 40_000;

/** A IA não respondeu dentro de TEMPO_LIMITE_MS. */
export class TempoEsgotadoIaError extends Error {
  constructor() {
    super('A IA não respondeu a tempo.');
    this.name = 'TempoEsgotadoIaError';
  }
}

export async function lerPedidoMedicoComGemini(arquivos: ArquivoPedidoMedico[], prompt: string): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');
  const modelo = (process.env.GEMINI_MODEL ?? '').trim() || MODELO_PADRAO;

  const sinal = AbortSignal.timeout(TEMPO_LIMITE_MS);
  try {
    const resposta = await new GoogleGenAI({ apiKey }).models.generateContent({
      model: modelo,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            ...arquivos.map((a) => ({ inlineData: { mimeType: a.mimeType, data: a.data.toString('base64') } })),
          ],
        },
      ],
      config: { abortSignal: sinal },
    });
    return resposta.text ?? '';
  } catch (err) {
    if (sinal.aborted) throw new TempoEsgotadoIaError();
    throw err;
  }
}
