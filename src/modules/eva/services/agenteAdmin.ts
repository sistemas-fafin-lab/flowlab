// Leituras e ações da administração da EVA (/it/eva). Leitura direto no Supabase (RLS
// das tabelas ti_agente_*); escrita só por RPC (sugestões, permissões) ou pelas policies
// de quem configura (membros, config). Ver supabase/migrations/20261013150000_eva_tabelas.sql
// e 20261015160000_eva_papeis_por_pessoa.sql.
import { supabase } from '../../../lib/supabase';
import { origemDosPapeis, papeisDoCargo, papeisDoPerfil, type LinhaPapeis, type OrigemPapeis, type PapeisEva } from '../domain/papeis';
import { chamarEva } from './agenteApi';

export type TipoSugestao = 'criar_card' | 'atualizar_card' | 'comentar_card';
export type StatusSugestao = 'pendente' | 'aprovada' | 'rejeitada' | 'substituida';
export type OrigemSugestao = 'reuniao' | 'whatsapp' | 'comentario' | 'chat';

export interface PropostaCard {
  titulo?: string;
  descricao?: string | null;
  responsaveis?: string[];
  prazo?: string | null;
  prazo_texto?: string | null;
  prioridade?: string;
  kanban_status?: string;
  projeto_id?: string | null;
  sprint_id?: string | null;
  comentario?: string;
}

export interface CardResumo {
  id: string;
  codigo: string;
  title: string;
  kanban_status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string[] | null;
}

export interface Sugestao {
  id: string;
  reuniao_id: string | null;
  origem: OrigemSugestao;
  proposta_por: string | null;
  tipo: TipoSugestao;
  card_id: string | null;
  proposta: PropostaCard;
  trecho: string;
  confianca: 'alta' | 'media' | 'baixa';
  avisos: string[];
  status: StatusSugestao;
  decidido_por: string | null;
  decidido_em: string | null;
  motivo_rejeicao: string | null;
  card_resultante_id: string | null;
  created_at: string;
  reuniao: { titulo: string; provedor: string | null; motivo_reserva: string | null } | null;
  card: CardResumo | null;
}

export interface Reuniao {
  id: string;
  origem: 'granola' | 'manual';
  titulo: string;
  realizada_em: string | null;
  web_url: string | null;
  fonte_atualizada_em: string | null;
  status: 'pendente' | 'analisando' | 'analisada' | 'erro';
  erro: string | null;
  analisada_em: string | null;
  provedor: 'claude' | 'gemini' | null;
  motivo_reserva: string | null;
  observacoes: string | null;
  created_at: string;
  sugestoes: { count: number }[];
}

export interface Membro {
  id: string;
  user_id: string;
  apelidos: string[];
  whatsapp: string | null;
  recebe_cobranca: boolean;
  ativo: boolean;
  nome: string;
  /** Os papéis da EVA pela regra do banco (papeisDoPerfil): admin tem os três (D31); a aba Permissões vale no lugar do cargo (D33). */
  papeis: PapeisEva;
  /** De onde vêm os papéis: do cargo, da aba Permissões ou do admin. */
  origemPapeis: OrigemPapeis;
  /** Nome do cargo no FlowLab (Usuários → Cargos e Permissões); "Administrador" para o admin sem cargo. */
  cargo: string | null;
}

export interface ConfigEva {
  granola_folder_id: string | null;
  /** Cursor do Granola (maior updated_at de nota visto), não a hora da execução. */
  granola_ultima_sync_em: string | null;
  /** Fim da última sincronização sem erro. */
  granola_verificado_em: string | null;
  granola_ultimo_erro: string | null;
  whatsapp_ativo: boolean;
  cobranca_ativa: boolean;
  dias_parado: number;
  waha_status: string | null;
  waha_verificado_em: string | null;
  /** Grupo da equipe no WhatsApp (…@g.us) e o nome, como estava na lista quando foi escolhido (D29). */
  whatsapp_grupo_id: string | null;
  whatsapp_grupo_nome: string | null;
  /** Grupos do número da EVA, lidos pela VPS a cada 30 min. */
  waha_grupos: { id: string; nome: string }[];
  /** null = a VPS relê na próxima execução (botão "Atualizar lista"). */
  waha_grupos_em: string | null;
  fechamento_diario_ativo: boolean;
  resumo_reuniao_grupo_ativo: boolean;
}

type CampoEditavel =
  | 'granola_folder_id' | 'whatsapp_ativo' | 'cobranca_ativa' | 'dias_parado'
  | 'whatsapp_grupo_id' | 'whatsapp_grupo_nome' | 'waha_grupos_em' | 'fechamento_diario_ativo' | 'resumo_reuniao_grupo_ativo';

export interface Pessoa { id: string; name: string; department?: string | null }

/** Uma pessoa na aba Permissões (D33): os papéis que valem e de onde vêm. */
export interface PessoaPermissoes {
  id: string;
  nome: string;
  departamento: string | null;
  /** Nome do cargo; "Administrador" para o admin sem cargo. */
  cargo: string | null;
  origem: OrigemPapeis;
  /** Os que valem (admin, linha ou cargo). */
  papeis: PapeisEva;
  /** Os que o cargo dá: para onde "Voltar ao cargo" leva. */
  doCargo: PapeisEva;
  definidoPor: string | null;
  definidoEm: string | null;
}

type LinhaComCarimbo = LinhaPapeis & { user_id: string; updated_at?: string | null; updated_by?: string | null };

const porPessoa = (linhas: LinhaComCarimbo[] | null) =>
  new Map((linhas ?? []).map((l) => [l.user_id, l]));

const SELECT_SUGESTAO = `id, reuniao_id, origem, proposta_por, tipo, card_id, proposta, trecho, confianca, avisos, status,
  decidido_por, decidido_em, motivo_rejeicao, card_resultante_id, created_at,
  reuniao:ti_agente_reunioes(titulo, provedor, motivo_reserva),
  card:it_requests!ti_agente_sugestoes_card_id_fkey(id, codigo, title, kanban_status, priority, due_date, assigned_to)`;

function erro(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

export const agenteAdmin = {
  async listarSugestoes(filtro: { status?: StatusSugestao | 'todas'; reuniaoId?: string } = {}): Promise<Sugestao[]> {
    let q = supabase.from('ti_agente_sugestoes').select(SELECT_SUGESTAO).order('created_at', { ascending: false }).limit(300);
    if (filtro.status && filtro.status !== 'todas') q = q.eq('status', filtro.status);
    if (filtro.reuniaoId) q = q.eq('reuniao_id', filtro.reuniaoId);
    const { data, error } = await q;
    erro(error);
    return (data ?? []) as unknown as Sugestao[];
  },

  /** Sugestões pendentes; com `reuniaoId`, só as dessa reunião. */
  async contarPendentes(reuniaoId?: string): Promise<number> {
    let q = supabase.from('ti_agente_sugestoes').select('id', { count: 'exact', head: true }).eq('status', 'pendente');
    if (reuniaoId) q = q.eq('reuniao_id', reuniaoId);
    const { count, error } = await q;
    erro(error);
    return count ?? 0;
  },

  /** Aprova (e executa) uma sugestão; `proposta` substitui a original quando o gestor editou. */
  async aprovar(id: string, proposta?: PropostaCard): Promise<string> {
    const { data, error } = await supabase.rpc('ti_agente_aprovar_sugestao', { p_id: id, p_proposta: proposta ?? null });
    erro(error);
    return data as string;
  },

  async rejeitar(id: string, motivo: string): Promise<void> {
    const { error } = await supabase.rpc('ti_agente_rejeitar_sugestao', { p_id: id, p_motivo: motivo });
    erro(error);
  },

  /** D28: proposta vinda de um comentário ou do chat. Com `aprovar`, o gestor já aprova e a EVA executa. */
  async propor(p: { tipo: TipoSugestao; cardId: string | null; proposta: PropostaCard; trecho: string; origem: 'comentario' | 'chat'; aprovar: boolean }): Promise<string> {
    const { data, error } = await supabase.rpc('ti_agente_propor_sugestao', {
      p_tipo: p.tipo, p_card_id: p.cardId, p_proposta: p.proposta, p_trecho: p.trecho, p_origem: p.origem, p_aprovar: p.aprovar,
    });
    erro(error);
    return data as string;
  },

  async listarReunioes(): Promise<Reuniao[]> {
    const { data, error } = await supabase
      .from('ti_agente_reunioes')
      .select('id, origem, titulo, realizada_em, web_url, fonte_atualizada_em, status, erro, analisada_em, provedor, motivo_reserva, observacoes, created_at, sugestoes:ti_agente_sugestoes(count)')
      .order('created_at', { ascending: false })
      .limit(100);
    erro(error);
    return (data ?? []) as unknown as Reuniao[];
  },

  async ultimaReuniaoAnalisada(): Promise<Pick<Reuniao, 'id' | 'titulo' | 'realizada_em' | 'observacoes' | 'analisada_em'> | null> {
    const { data, error } = await supabase
      .from('ti_agente_reunioes')
      .select('id, titulo, realizada_em, observacoes, analisada_em')
      .eq('status', 'analisada')
      .order('analisada_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    erro(error);
    return data;
  },

  colarReuniao: (titulo: string, resumo: string, realizadaEm: string) =>
    chamarEva<{ reuniaoId: string; sugestoes: unknown[]; provedor: string | null }>('agente-analisar', { titulo, resumo, realizada_em: realizadaEm }),

  reanalisar: (reuniaoId: string) => chamarEva<{ sugestoes: unknown[] }>('agente-analisar', { reuniao_id: reuniaoId }),

  buscarAgora: () =>
    chamarEva<{ novas: number; atualizadas: number; analisadas: unknown[]; pendentesRestantes: number }>('agente-sincronizar', {}),

  async listarMembros(): Promise<Membro[]> {
    const [{ data, error }, papeis] = await Promise.all([
      supabase
        .from('ti_agente_membros')
        .select(`id, user_id, apelidos, whatsapp, recebe_cobranca, ativo,
          perfil:user_profiles!ti_agente_membros_user_id_fkey(name, role, deleted_at, disabled_at, custom_roles(name, permissions))`)
        .order('created_at'),
      supabase.from('ti_agente_papeis').select('user_id, configura, gestor, aprova'),
    ]);
    erro(error);
    // Sem a tabela (migration ainda não aplicada), os papéis seguem o cargo.
    const linhas = porPessoa(papeis.error ? [] : (papeis.data as LinhaComCarimbo[]));
    type Perfil = {
      name: string; role: string | null; deleted_at: string | null; disabled_at: string | null;
      custom_roles: { name: string; permissions: unknown } | null;
    } | null;
    return (data ?? []).map((m) => {
      const { perfil, ...resto } = m as unknown as Omit<Membro, 'nome' | 'papeis' | 'origemPapeis' | 'cargo'> & { perfil: Perfil };
      const perfilPapeis = perfil && { ...perfil, permissoes: perfil.custom_roles?.permissions };
      const linha = linhas.get(resto.user_id) ?? null;
      return {
        ...resto,
        nome: perfil?.name ?? '—',
        papeis: papeisDoPerfil(perfilPapeis, linha),
        origemPapeis: origemDosPapeis(perfilPapeis, linha),
        cargo: perfil?.custom_roles?.name ?? (perfil?.role === 'admin' ? 'Administrador' : null),
      };
    });
  },

  /** Aba Permissões (D33): todas as pessoas ativas, com os papéis que valem e de onde vêm. */
  async listarPermissoes(): Promise<PessoaPermissoes[]> {
    const [p, l] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, name, department, role, deleted_at, disabled_at, custom_roles(name, permissions)')
        .is('deleted_at', null)
        .is('disabled_at', null)
        .order('name')
        .limit(1000),
      supabase.from('ti_agente_papeis').select('user_id, configura, gestor, aprova, updated_at, updated_by'),
    ]);
    erro(p.error);
    erro(l.error);
    type Linha = {
      id: string; name: string | null; department: string | null; role: string | null;
      deleted_at: string | null; disabled_at: string | null;
      custom_roles: { name: string; permissions: unknown } | null;
    };
    const pessoas = (p.data ?? []) as unknown as Linha[];
    const linhas = porPessoa(l.data as LinhaComCarimbo[]);
    const nomes = new Map(pessoas.map((x) => [x.id, x.name ?? '']));
    return pessoas.map((x) => {
      const perfil = { role: x.role, permissoes: x.custom_roles?.permissions, deleted_at: x.deleted_at, disabled_at: x.disabled_at };
      const linha = linhas.get(x.id) ?? null;
      const origem = origemDosPapeis(perfil, linha);
      return {
        id: x.id,
        nome: x.name ?? '—',
        departamento: x.department ?? null,
        cargo: x.custom_roles?.name ?? (x.role === 'admin' ? 'Administrador' : null),
        origem,
        papeis: papeisDoPerfil(perfil, linha),
        doCargo: origem === 'admin' ? papeisDoPerfil(perfil) : papeisDoCargo(perfil),
        definidoPor: linha?.updated_by ? nomes.get(linha.updated_by) || null : null,
        definidoEm: linha?.updated_at ?? null,
      };
    });
  },

  /** Define as três da pessoa, no lugar do cargo. */
  async definirPapeis(userId: string, papeis: PapeisEva): Promise<void> {
    const { error } = await supabase.rpc('ti_agente_definir_papeis', {
      p_user: userId, p_configura: papeis.configura, p_gestor: papeis.gestor, p_aprova: papeis.aprova,
    });
    erro(error);
  },

  /** Apaga o que foi definido: a pessoa volta a seguir o cargo. */
  async voltarAoCargo(userId: string): Promise<void> {
    const { error } = await supabase.rpc('ti_agente_voltar_ao_cargo', { p_user: userId });
    erro(error);
  },

  /** Projetos e sprints (ativas e planejadas) para o card novo de uma sugestão. */
  async projetosESprints(): Promise<{ projetos: { id: string; name: string }[]; sprints: { id: string; project_id: string; name: string; status: string }[] }> {
    const [p, s] = await Promise.all([
      supabase.from('it_projects').select('id, name').order('name').limit(1000),
      supabase.from('it_sprints').select('id, project_id, name, status').in('status', ['active', 'planned']).order('start_date').limit(1000),
    ]);
    erro(p.error);
    erro(s.error);
    return { projetos: p.data ?? [], sprints: s.data ?? [] };
  },

  /** Painel de Configurações: última análise com erro, última mensagem, última cobrança e a semana. */
  async situacao(): Promise<{
    ultimoErroAnalise: { titulo: string; erro: string | null; created_at: string } | null;
    ultimaMensagem: { enviada_em: string | null; status: string } | null;
    ultimaCobranca: string | null;
    semana: { enviadas: number; falhas: number; pendentes: number };
  }> {
    const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [r, m, c, s] = await Promise.all([
      supabase.from('ti_agente_reunioes').select('titulo, erro, created_at').eq('status', 'erro').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('ti_agente_mensagens').select('enviada_em, status').eq('direcao', 'saida').not('enviada_em', 'is', null).order('enviada_em', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('ti_agente_mensagens').select('created_at').eq('tipo', 'cobranca').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('ti_agente_mensagens').select('status').eq('direcao', 'saida').gte('created_at', desde).limit(2000),
    ]);
    erro(r.error);
    // A fila só é lida por gestor (D24); para os demais, as linhas simplesmente não vêm.
    const st = (s.data ?? []).map((x) => x.status as string);
    return {
      ultimoErroAnalise: r.data,
      ultimaMensagem: m.error ? null : m.data,
      ultimaCobranca: (c.data?.created_at as string | undefined) ?? null,
      semana: {
        enviadas: st.filter((x) => x === 'enviada' || x === 'entregue' || x === 'lida').length,
        falhas: st.filter((x) => x === 'falhou').length,
        pendentes: st.filter((x) => x === 'pendente').length,
      },
    };
  },

  /** "Enviar teste" (RF19): a mensagem vai para a fila e o script da VPS envia em até 1 min. */
  enviarTeste: (membroId: string) => chamarEva<{ mensagemId: string }>('agente-teste', { membro_id: membroId }),

  async statusMensagem(id: string): Promise<{ status: string; erro: string | null } | null> {
    const { data, error } = await supabase.from('ti_agente_mensagens').select('status, erro').eq('id', id).maybeSingle();
    erro(error);
    return data as { status: string; erro: string | null } | null;
  },

  /** Histórico de um membro (RF21): enviadas, falhas e recebidas. */
  async historicoMembro(membroId: string): Promise<{ id: string; direcao: 'saida' | 'entrada'; tipo: string; texto: string; status: string; erro: string | null; created_at: string; enviada_em: string | null }[]> {
    const { data, error } = await supabase
      .from('ti_agente_mensagens')
      .select('id, direcao, tipo, texto, status, erro, created_at, enviada_em')
      .eq('membro_id', membroId)
      .order('created_at', { ascending: false })
      .limit(30);
    erro(error);
    return (data ?? []) as never;
  },

  /** Última mensagem que falhou de cada membro: "número fora do WhatsApp" aparece na aba Membros. */
  async ultimasFalhas(): Promise<Record<string, { erro: string | null; created_at: string }>> {
    const { data, error } = await supabase
      .from('ti_agente_mensagens')
      .select('membro_id, status, erro, created_at')
      .eq('direcao', 'saida')
      .in('status', ['falhou', 'enviada', 'entregue', 'lida'])
      .order('created_at', { ascending: false })
      .limit(500);
    erro(error);
    const ultima: Record<string, { status: string; erro: string | null; created_at: string }> = {};
    for (const m of data ?? []) if (m.membro_id && !ultima[m.membro_id as string]) ultima[m.membro_id as string] = m as never;
    // Só conta a falha se ela for a última notícia do membro (um envio depois dela resolve).
    return Object.fromEntries(Object.entries(ultima).filter(([, v]) => v.status === 'falhou').map(([k, v]) => [k, { erro: v.erro, created_at: v.created_at }]));
  },

  async pessoasAtivas(): Promise<Pessoa[]> {
    const { data, error } = await supabase.from('user_profiles').select('id, name, department').is('deleted_at', null).order('name').limit(1000);
    erro(error);
    return (data ?? []) as Pessoa[];
  },

  async salvarMembro(m: { id?: string; user_id: string; apelidos: string[]; whatsapp: string | null; recebe_cobranca: boolean; ativo: boolean }): Promise<void> {
    const linha = { user_id: m.user_id, apelidos: m.apelidos, whatsapp: m.whatsapp, recebe_cobranca: m.recebe_cobranca, ativo: m.ativo };
    const { error } = m.id
      ? await supabase.from('ti_agente_membros').update(linha).eq('id', m.id)
      : await supabase.from('ti_agente_membros').insert(linha);
    erro(error);
  },

  async lerConfig(): Promise<ConfigEva | null> {
    const { data, error } = await supabase
      .from('ti_agente_config')
      .select(`granola_folder_id, granola_ultima_sync_em, granola_verificado_em, granola_ultimo_erro, whatsapp_ativo, cobranca_ativa, dias_parado,
        waha_status, waha_verificado_em, whatsapp_grupo_id, whatsapp_grupo_nome, waha_grupos, waha_grupos_em, fechamento_diario_ativo, resumo_reuniao_grupo_ativo`)
      .eq('id', true)
      .maybeSingle();
    erro(error);
    if (!data) return null;
    const c = data as unknown as ConfigEva;
    return { ...c, waha_grupos: Array.isArray(c.waha_grupos) ? c.waha_grupos : [] };
  },

  /** "Enviar teste" do grupo da equipe (Configurações): mesma fila e mesmo acompanhamento do teste de membro. */
  enviarTesteGrupo: () => chamarEva<{ mensagemId: string }>('agente-teste', { grupo: true }),

  async salvarConfig(mudanca: Partial<Pick<ConfigEva, CampoEditavel>>): Promise<void> {
    const { data, error } = await supabase.from('ti_agente_config').update(mudanca).eq('id', true).select('id');
    erro(error);
    if (!data?.length) throw new Error('Sem permissão para alterar a configuração da EVA.');
  },

  /** Uso da IA nos últimos 7 dias (RN14): por provedor e finalidade, e o último erro do Claude. */
  async usoIA(): Promise<{ provedor: string; finalidade: string; resultado: string; tokens_entrada: number | null; tokens_saida: number | null; erro: string | null; created_at: string }[]> {
    const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from('ti_agente_chamadas_ia')
      .select('provedor, finalidade, resultado, tokens_entrada, tokens_saida, erro, created_at')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(1000);
    erro(error);
    return data ?? [];
  },
};
