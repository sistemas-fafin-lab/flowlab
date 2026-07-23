// api/_lib/apoio/gemini.ts
// OCR da requisição médica via Gemini (port de _ocr_png/_ocr_pdf do envio_alvaro).
// Diferença do legado: em vez de fundir várias fotos numa imagem única (Pillow) ou
// concatenar PDFs, mandamos todos os arquivos como partes inline numa única chamada
// generateContent — o Gemini lê o conjunto como uma requisição só.

import { GoogleGenAI } from '@google/genai';
import type { PipelineLog } from './log.js';

export interface ArquivoRequisicao {
  data: Buffer;
  mimeType: string;
  filename: string;
}

const MODELO_PADRAO = 'gemini-3.1-flash-lite';

const MIME_POR_EXTENSAO: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.pdf': 'application/pdf',
};

export function mimePorNome(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return MIME_POR_EXTENSAO[ext] ?? 'image/png';
}

// O Gemini às vezes devolve o JSON dentro de cerca markdown apesar da instrução.
function parseRespostaJson(texto: string, log: PipelineLog): Record<string, unknown> {
  let clean = texto.trim();
  if (clean.startsWith('```')) {
    const linhas = clean.split('\n');
    const fim = linhas[linhas.length - 1].trim().startsWith('```') ? -1 : linhas.length;
    clean = linhas.slice(1, fim).join('\n').trim();
  }
  try {
    return JSON.parse(clean) as Record<string, unknown>;
  } catch (err) {
    log.error(`Gemini não retornou JSON válido: ${String(err)}`, texto.slice(0, 800));
    return { success: false, erro: `Gemini retornou JSON inválido: ${String(err)}` };
  }
}

export async function ocrRequisicao(
  arquivos: ArquivoRequisicao[],
  prompt: string,
  log: PipelineLog,
): Promise<Record<string, unknown>> {
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const modelo = (process.env.GEMINI_MODEL ?? '').trim() || MODELO_PADRAO;
  const nomes = arquivos.map((a) => `${a.filename} (${a.mimeType})`).join(', ');
  log.send(`Gemini OCR → modelo=${modelo} | ${arquivos.length} arquivo(s): ${nomes} | prompt=${prompt.length} chars`);

  const ai = new GoogleGenAI({ apiKey });
  const resposta = await ai.models.generateContent({
    model: modelo,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          ...arquivos.map((a) => ({
            inlineData: { mimeType: a.mimeType, data: a.data.toString('base64') },
          })),
        ],
      },
    ],
  });

  const texto = resposta.text ?? '';
  log.recv(`Gemini respondeu (${texto.length} chars)`);
  return parseRespostaJson(texto, log);
}
