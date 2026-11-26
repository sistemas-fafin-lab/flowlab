// api/_lib/labBrainSugestao.ts
// Sugestão de promoção de um chamado do LAB-BRAIN na fila da EVA (promover_card).
// Spec: .scratch/lab-brain-aprovacao-eva/spec.md (Rota de criação).
//
// A rota de criação agenda esta função em segundo plano (waitUntil) depois de gravar um
// chamado novo; a resposta 201 já saiu. A sugestão nasce pendente, ligada ao chamado por
// card_id, e quem aprova sugestões da EVA é avisado no sino. Aprovar tira o chamado de
// "fora do Kanban" (ti_agente_aprovar_sugestao_como, 20261113150000_eva_promover_card_lab_brain.sql).
//
// A proposta vem da EVA (labBrainAnalise.ts), pelo caminho de IA estruturada (Claude com o
// Gemini de reserva, cada tentativa em ti_agente_chamadas_ia). Se a IA falhar, passar do
// tempo limite ou devolver algo inválido, vale a regra fixa: coluna "A Fazer", a prioridade
// enviada, sem responsável e sem prazo, com a marca de "sem análise da EVA".

import type { SupabaseClient } from '@supabase/supabase-js';
import { describeError } from './errors.js';
import { avisarQuemTem, lerMembros } from './ti-agente/dados.js';
import { lerChamadosRecentes, lerResolucoes } from './ti-agente/conhecimento.js';
import { gerarEstruturado, type Dependencias } from './ti-agente/ia/gerarEstruturado.js';
import {
  type AnaliseChamado,
  INSTRUCOES_PROMOVER,
  SchemaAnaliseChamado,
  VERSAO_PROMPT_PROMOVER,
  montarContextoChamado,
  montarConteudoChamado,
  validarAnalise,
} from './labBrainAnalise.js';
import { CHAVE_APROVAR } from '../../src/modules/eva/domain/papeis.js';
import { blocoConhecimento, maisParecidos } from '../../src/modules/eva/domain/conhecimento.js';

/** Valor de ti_agente_sugestoes.origem para as sugestões dos chamados do LAB-BRAIN. */
export const ORIGEM_SUGESTAO_LAB_BRAIN = 'lab-brain';
/** D45: a sugestão de um chamado aberto pela tela, criada pela triagem do relógio. */
export const ORIGEM_SUGESTAO_TRIAGEM = 'triagem';
export const TIPO_PROMOVER_CARD = 'promover_card';
/** Pontos mínimos da busca por palavras para um chamado entrar como parecido (D45). */
const MINIMO_PARECIDO = 2.5;

const LOG = '[integracoes/lab-brain-chamado-criar/sugestao]';
const JUSTIFICATIVA_SEM_ANALISE =
  'Sem análise da EVA: proposta pela regra fixa (coluna A Fazer e a prioridade enviada pelo LAB-BRAIN).';

/**
 * Tempo máximo da análise. Cabe o pior caso do Claude (90 s, com uma nova tentativa) e o
 * Gemini de reserva (90 s), e sobra tempo para gravar a regra fixa antes do maxDuration de
 * 300 s das rotas de integração (vercel.json).
 */
export const TEMPO_LIMITE_ANALISE_MS = 280_000;

export interface ChamadoParaSugestao {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  prioridade: string;
  tipo: string;
  /** D45: por onde chegou (padrão: LAB-BRAIN). */
  origem?: 'lab-brain' | 'tela';
}

/** O que a EVA propõe para o chamado. Mesmo formato lido pela tela de Sugestões. */
export interface PropostaPromocao {
  kanban_status: string;
  prioridade: string;
  responsaveis: string[];
  /** YYYY-MM-DD, como nas outras propostas; null = sem prazo. */
  prazo: string | null;
  justificativa: string;
  /** true quando a proposta veio da regra fixa, sem análise da EVA. */
  sem_analise?: true;
  /** Versão das instruções que geraram a proposta; ausente na regra fixa. */
  versao_prompt?: string;
  /** D45: o chamado recente que parece pedir a mesma coisa. */
  repetido_de?: string;
  /** D45: o chamado já resolvido com o mesmo problema, e o que resolveu. */
  solucao_anterior?: { codigo: string; dica: string };
}

/** O que vai para ti_agente_sugestoes além do vínculo com o chamado. */
interface SugestaoMontada {
  proposta: PropostaPromocao;
  confianca: AnaliseChamado['confianca'];
  avisos: string[];
}

export function propostaDaRegraFixa(prioridade: string): PropostaPromocao {
  return {
    kanban_status: 'todo',
    prioridade,
    responsaveis: [],
    prazo: null,
    justificativa: JUSTIFICATIVA_SEM_ANALISE,
    sem_analise: true,
  };
}

function sugestaoDaRegraFixa(chamado: ChamadoParaSugestao): SugestaoMontada {
  // Sem análise não há confiança: fica fora do "aprovar as de confiança alta".
  return { proposta: propostaDaRegraFixa(chamado.prioridade), confianca: 'baixa', avisos: [] };
}

/** Dia de hoje em Brasília (AAAA-MM-DD), para a IA contar os prazos relativos. */
function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const estouro = new Promise<never>((_, falha) => {
    relogio = setTimeout(() => falha(new Error(`a análise passou de ${ms / 1000} s`)), ms);
  });
  return Promise.race([promessa, estouro]).finally(() => clearTimeout(relogio));
}

async function analisar(
  db: SupabaseClient,
  ia: Dependencias,
  chamado: ChamadoParaSugestao,
): Promise<SugestaoMontada | { erro: string }> {
  // D45: os chamados recentes (repetido?) e as resoluções (já resolvido antes?). Sem eles, a
  // análise segue como antes: uma falha de leitura não derruba a sugestão.
  const [membros, recentes, resolucoes] = await Promise.all([
    lerMembros(db),
    lerChamadosRecentes(db, new Date()).catch(() => []),
    lerResolucoes(db).catch(() => []),
  ]);
  const pedido = `${chamado.titulo}\n${chamado.descricao}`;
  const parecidosRecentes = maisParecidos(pedido, recentes, { n: 5, minimo: MINIMO_PARECIDO, excetoId: chamado.id }).map((a) => a.doc);
  const parecidosResolvidos = maisParecidos(pedido, resolucoes, { n: 3, minimo: MINIMO_PARECIDO, excetoId: chamado.id });

  const r = await gerarEstruturado(
    {
      finalidade: 'analise_chamado',
      instrucoes: INSTRUCOES_PROMOVER,
      contexto: montarContextoChamado(membros),
      conteudo: montarConteudoChamado({
        ...chamado,
        dataPedido: hojeEmBrasilia(),
        recentes: parecidosRecentes,
        baseDeConhecimento: blocoConhecimento(parecidosResolvidos),
      }),
      schema: SchemaAnaliseChamado,
      esforco: 'low',
    },
    ia,
  );
  if ('erros' in r) return { erro: r.erros.join(' · ') };

  const v = validarAnalise(r.dados, membros, { recentes: parecidosRecentes, base: parecidosResolvidos.map((a) => a.doc) });
  if (!v) return { erro: 'a análise veio sem justificativa' };
  return {
    proposta: {
      kanban_status: v.kanban_status,
      prioridade: v.prioridade,
      responsaveis: v.responsaveis,
      prazo: v.prazo,
      justificativa: v.justificativa,
      versao_prompt: VERSAO_PROMPT_PROMOVER,
      ...(v.repetido_de ? { repetido_de: v.repetido_de } : {}),
      ...(v.solucao_anterior ? { solucao_anterior: v.solucao_anterior } : {}),
    },
    confianca: v.confianca,
    avisos: v.avisos,
  };
}

/** A proposta da EVA, ou a da regra fixa quando a análise não sai. Nunca lança. */
async function montarSugestao(db: SupabaseClient, ia: Dependencias, chamado: ChamadoParaSugestao): Promise<SugestaoMontada> {
  let falha: string;
  try {
    const r = await comTempoLimite(analisar(db, ia, chamado), TEMPO_LIMITE_ANALISE_MS);
    if (!('erro' in r)) return r;
    falha = r.erro;
  } catch (e) {
    falha = describeError(e);
  }
  console.warn(`${LOG} sem análise da EVA para o chamado ${chamado.codigo}; vale a regra fixa:`, falha);
  return sugestaoDaRegraFixa(chamado);
}

/**
 * Analisa o pedido, grava a sugestão e avisa quem aprova. Nunca lança: roda depois da
 * resposta, e uma falha só vai para o log. O chamado continua visível em Solicitações de TI.
 */
export async function criarSugestaoDePromocao(
  db: SupabaseClient,
  ia: Dependencias,
  chamado: ChamadoParaSugestao,
  /** D45: a triagem dos chamados da tela grava com a origem "triagem" e outro aviso no sino. */
  opcoes: { origem?: typeof ORIGEM_SUGESTAO_LAB_BRAIN | typeof ORIGEM_SUGESTAO_TRIAGEM } = {},
): Promise<boolean> {
  const origem = opcoes.origem ?? ORIGEM_SUGESTAO_LAB_BRAIN;
  const { proposta, confianca, avisos } = await montarSugestao(db, ia, chamado);
  try {
    const { error } = await db.from('ti_agente_sugestoes').insert({
      origem,
      tipo: TIPO_PROMOVER_CARD,
      card_id: chamado.id,
      proposta,
      trecho: proposta.justificativa,
      confianca,
      avisos,
    });
    if (error) throw new Error(describeError(error));
  } catch (e) {
    console.error(`${LOG} falha ao gravar a sugestão do chamado ${chamado.codigo}:`, describeError(e));
    return false;
  }

  try {
    await avisarQuemTem(db, CHAVE_APROVAR, {
      titulo: origem === ORIGEM_SUGESTAO_TRIAGEM ? 'Chamado novo para o Kanban' : 'Chamado do LAB-BRAIN para aprovar',
      conteudo: `${chamado.codigo} · ${chamado.titulo} aguarda a decisão de entrar no Kanban.${proposta.repetido_de ? ` Parece repetido do ${proposta.repetido_de}.` : ''}`,
      link: '/it/eva',
    });
  } catch (e) {
    console.error(`${LOG} sugestão do chamado ${chamado.codigo} gravada, mas o aviso do sino falhou:`, describeError(e));
  }
  return true;
}
