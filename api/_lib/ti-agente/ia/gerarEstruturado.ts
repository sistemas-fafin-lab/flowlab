// A única porta de entrada da EVA para IA (plano §9.1): tenta o Claude, cai no Gemini
// quando ele falha, valida as duas respostas com o mesmo zod e registra cada tentativa
// em ti_agente_chamadas_ia (RN14). Nenhum outro código chama os SDKs de IA direto.
import { z } from 'zod';
import { limparJson, type ClienteIA, type Esforco, type Finalidade, type ResultadoChamada, type TentativaIA } from './tipos.js';

/** Uma linha de ti_agente_chamadas_ia — só metadados, nunca o texto (RN14). */
export interface LinhaChamadaIA {
  finalidade: Finalidade;
  reuniao_id: string | null;
  mensagem_id: string | null;
  user_id: string | null;
  provedor: TentativaIA['provedor'];
  modelo: string;
  resultado: ResultadoChamada;
  erro: string | null;
  tokens_entrada: number | null;
  tokens_saida: number | null;
  duracao_ms: number;
}

export interface PedidoEstruturado<T> {
  finalidade: Finalidade;
  instrucoes: string;
  contexto?: string;
  conteudo: string;
  schema: z.ZodType<T>;
  esforco: Esforco;
  reuniaoId?: string;
  mensagemId?: string;
  userId?: string;
}

export interface Dependencias {
  claude: ClienteIA;
  gemini: ClienteIA;
  registrar: (linha: LinhaChamadaIA) => Promise<void>;
}

export type ResultadoEstruturado<T> =
  | { ok: true; dados: T; provedor: 'claude' | 'gemini'; motivoReserva: string | null; tentativas: TentativaIA[] }
  | { ok: false; erros: string[]; tentativas: TentativaIA[] };

/** O JSON Schema que os dois provedores recebem: o do zod 4, sem o "$schema". */
export function paraJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = { ...(z.toJSONSchema(schema) as Record<string, unknown>) };
  delete json.$schema;
  return json;
}

const ROTULO: Record<ResultadoChamada, string> = {
  ok: 'ok',
  erro: 'erro',
  configuracao: 'erro de configuração',
  recusa: 'recusa',
  cortada: 'resposta cortada',
  schema_invalido: 'resposta fora do formato',
};

function descrever(t: TentativaIA): string {
  return `${t.provedor === 'claude' ? 'Claude' : 'Gemini'}: ${ROTULO[t.resultado]}${t.erro ? ` (${t.erro})` : ''}`;
}

/** Interpreta a resposta e valida no zod; uma resposta fora do formato vira `schema_invalido`. */
function validar<T>(t: TentativaIA, schema: z.ZodType<T>): { tentativa: TentativaIA; dados?: T } {
  if (t.resultado !== 'ok') return { tentativa: t };
  let bruto: unknown;
  try {
    bruto = JSON.parse(limparJson(t.texto ?? ''));
  } catch {
    return { tentativa: { ...t, resultado: 'schema_invalido', erro: 'A resposta não é um JSON válido.' } };
  }
  const r = schema.safeParse(bruto);
  if (!r.success) {
    return { tentativa: { ...t, resultado: 'schema_invalido', erro: r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') } };
  }
  return { tentativa: t, dados: r.data };
}

export async function gerarEstruturado<T>(pedido: PedidoEstruturado<T>, deps: Dependencias): Promise<ResultadoEstruturado<T>> {
  const schemaJson = paraJsonSchema(pedido.schema);
  const entrada = { instrucoes: pedido.instrucoes, contexto: pedido.contexto, conteudo: pedido.conteudo, schema: schemaJson, esforco: pedido.esforco };
  const tentativas: TentativaIA[] = [];

  const registrar = async (t: TentativaIA) => {
    try {
      await deps.registrar({
        finalidade: pedido.finalidade,
        reuniao_id: pedido.reuniaoId ?? null,
        mensagem_id: pedido.mensagemId ?? null,
        user_id: pedido.userId ?? null,
        provedor: t.provedor,
        modelo: t.modelo,
        resultado: t.resultado,
        erro: t.erro ?? null,
        tokens_entrada: t.tokensEntrada ?? null,
        tokens_saida: t.tokensSaida ?? null,
        duracao_ms: Math.max(0, Math.round(t.duracaoMs)),
      });
    } catch (e) {
      // O registro nunca derruba a resposta.
      console.error('[EVA/ia] Falha ao registrar chamada:', e);
    }
  };

  for (const cliente of [deps.claude, deps.gemini]) {
    const { tentativa, dados } = validar(await cliente.chamar(entrada), pedido.schema);
    tentativas.push(tentativa);
    await registrar(tentativa);
    if (dados !== undefined) {
      const reserva = tentativas.length > 1 ? descrever(tentativas[0]) : null;
      return { ok: true, dados, provedor: cliente.provedor as 'claude' | 'gemini', motivoReserva: reserva, tentativas };
    }
  }
  return { ok: false, erros: tentativas.map(descrever), tentativas };
}
