// Adapter da lista de preços do Gerador de Orçamento: GET /api/atendimento/gerador-orcamento-precos
// com o token da sessão (a rota valida o JWT + canUseGeradorOrcamento). O custo só vem
// para quem tem canViewGeradorOrcamentoCustos; sem ela, o servidor nem o consulta.

import { supabase } from '../../lib/supabase';
import type { ItemGeradorOrcamento } from './types';
import type { ExameLidoNoPedido } from './domain/pedidoMedico';

/** Item como sai do servidor: `nome` é null quando o TUSS não tem exame cadastrado. */
type ItemResposta = Omit<ItemGeradorOrcamento, 'nome'> & { nome: string | null };

interface RespostaPrecos {
  success?: boolean;
  error?: string;
  itens?: ItemResposta[];
  podeVerCustos?: boolean;
}

export interface ListaPrecos {
  exames: ItemGeradorOrcamento[];
  /** Se o usuário tem canViewGeradorOrcamentoCustos (os itens trazem `custo` e o PDF interno vale). */
  podeVerCustos: boolean;
}

const FALHA_PADRAO = 'Não foi possível carregar a lista de exames.';

async function sessaoAtual() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');
  return { token: session.access_token, userId: session.user.id };
}

/** Busca a lista de preços. Lança com uma mensagem pronta para a tela. */
export async function buscarListaPrecos(): Promise<ListaPrecos> {
  const { token } = await sessaoAtual();

  let res: Response;
  try {
    res = await fetch('/api/atendimento/gerador-orcamento-precos', {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error(`${FALHA_PADRAO} Verifique a conexão.`);
  }
  const body = (await res.json().catch(() => ({}))) as RespostaPrecos;
  if (!res.ok || !body.success || !Array.isArray(body.itens)) {
    throw new Error(body.error || FALHA_PADRAO);
  }

  // Item sem nome (TUSS com preço Particular mas sem exame em custo_exames) não é
  // orçável: a Tabela-Particular já o descartava, e o Gerador faz o mesmo.
  return {
    exames: body.itens.filter((i): i is ItemGeradorOrcamento => !!i.nome),
    podeVerCustos: body.podeVerCustos === true,
  };
}

// ── Leitura do pedido médico por IA ─────────────────────────────────────────────
// Mesmo fluxo do envio ao apoio: os arquivos sobem direto no bucket privado
// 'atendimento-pedidos-medicos' e a API recebe só os paths (o corpo não esbarra no
// limite da Vercel). O servidor apaga os arquivos ao fim da análise.

const BUCKET_PEDIDOS_MEDICOS = 'atendimento-pedidos-medicos';
// Acima do tempo-limite do Gemini no servidor (api/_lib/atendimento/geminiPedidoMedico.ts),
// para a tela receber o 504 do servidor em vez de desistir antes.
const TEMPO_LIMITE_ANALISE_MS = 60_000;
const FALHA_ANALISE = 'Não foi possível analisar o pedido médico.';

interface RespostaPedidoMedico {
  success?: boolean;
  error?: string;
  exames?: ExameLidoNoPedido[];
}

// PDF que o navegador não tipou (só a extensão diz o que é) sairia como
// application/octet-stream, que o bucket recusa.
const comTipo = (arquivo: File) =>
  arquivo.type ? arquivo : new File([arquivo], arquivo.name, { type: 'application/pdf' });

/**
 * Sobe os arquivos numa pasta nova dentro da pasta do usuário (`<user id>/<uuid>/`,
 * exigida pela policy e pelo endpoint); se um falha, apaga os que já tinham subido.
 */
async function subirArquivosDoPedido(arquivos: File[], userId: string): Promise<string[]> {
  const pasta = `${userId}/${crypto.randomUUID()}`;
  const paths: string[] = [];
  try {
    for (const [i, arquivo] of arquivos.entries()) {
      // Nome saneado (o path do storage não aceita qualquer caractere); o índice evita
      // colisão entre arquivos de mesmo nome.
      const path = `${pasta}/${i + 1}-${arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from(BUCKET_PEDIDOS_MEDICOS).upload(path, comTipo(arquivo));
      if (error) {
        console.error(`Falha no upload de ${arquivo.name}:`, error);
        throw new Error(`Não foi possível enviar “${arquivo.name}”. Verifique a conexão e tente de novo.`);
      }
      paths.push(path);
    }
    return paths;
  } catch (err) {
    if (paths.length > 0) await supabase.storage.from(BUCKET_PEDIDOS_MEDICOS).remove(paths);
    throw err;
  }
}

/** Envia o pedido médico à IA e devolve os exames lidos. Lança com uma mensagem pronta para a tela. */
export async function analisarPedidoMedico(arquivos: File[]): Promise<ExameLidoNoPedido[]> {
  const { token, userId } = await sessaoAtual();
  const paths = await subirArquivosDoPedido(arquivos, userId);

  let res: Response;
  try {
    res = await fetch('/api/atendimento/gerador-orcamento-pedido-medico', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_ANALISE_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error('A análise demorou demais. Tente de novo, com menos arquivos ou fotos menores.');
    }
    throw new Error(`${FALHA_ANALISE} Verifique a conexão.`);
  }
  const body = (await res.json().catch(() => ({}))) as RespostaPedidoMedico;
  if (!res.ok || !body.success || !Array.isArray(body.exames)) {
    if (res.status === 504 && !body.error) throw new Error('A análise demorou demais. Tente de novo.');
    throw new Error(body.error || FALHA_ANALISE);
  }
  return body.exames;
}
