import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useNotificationCenter } from '../../../hooks/useNotificationCenter';
import { IT_REQUESTS_PATH, itRequestUrl } from '../../../utils/itRequestLink';
import type { ITRequest } from '../../../components/IT/ITKanbanBoard';
import { evaService, type DadosInicio } from '../services/evaService';
import { hojeSP, pluralDias } from '../domain/datas';
import { estaConcluido, type CardTI, type ColunaKanban, type StatusChamado } from '../domain/demandas';
import type { ProjetoTI, SprintTI } from '../domain/projetos';
import { montarSnapshot } from '../domain/inicio';
import { JANELA_COBRANCA_MS, destinoDaCobranca, situacaoDoCobrar, type MembroNoWhatsapp } from '../domain/cobranca';
import { quandoSera, ultimoContato, type MensagemFila } from '../domain/whatsapp';
import type { EvaView, OverdueFilter, OverdueTask } from '../types';

export interface OverdueRow extends OverdueTask {
  charged: boolean;
  memberName: string;
  lateLabel: string;
  statusText: string;
  /** O botão Cobrar/Lembrar aparece (WhatsApp ligado e permissão para o modo, D22). */
  chargeable: boolean;
  /** Botão desabilitado, com o motivo (ex.: ninguém com WhatsApp). */
  chargeHint?: string;
  /** Botão habilitado, com uma observação (ex.: parte da cobrança vai para o grupo, D35). */
  chargeNote?: string;
}

/** A fila do Início olha os últimos dias (último contato e comentários da EVA). */
const DIAS_FILA = 3;
/** A fila e a contagem de cobranças mudam a cada minuto (o script da VPS). */
const ATUALIZAR_WHATSAPP_MS = 60_000;

interface OpcoesInicio {
  /** Gestor da EVA (canManageAgenteTI, D31): vê a fila e o último contato (D24) e cobra cards dos outros (D22). */
  ehGestor: boolean;
  /** ti_agente_config.whatsapp_ativo: sem ele, o botão Cobrar/Lembrar não aparece. */
  whatsappAtivo: boolean;
  /** Há grupo da equipe escolhido em Configurações: quem não recebe pelo WhatsApp é cobrado lá (D35). */
  temGrupo?: boolean;
  grupoNome?: string | null;
}

export interface AvisoEva {
  id: number;
  texto: string;
  tom: 'sucesso' | 'erro';
  desfazer?: () => void;
}

const SEM_CARDS: CardTI[] = [];
const SEM_PROJETOS: ProjetoTI[] = [];
const SEM_SPRINTS: SprintTI[] = [];

/** Janela para desfazer a conclusão de uma task do dia. */
export const JANELA_DESFAZER_MS = 5000;
/** Mesmo intervalo mínimo entre e-mails de status do Board (ITKanbanBoard). */
const INTERVALO_EMAIL_STATUS_MS = 5 * 60 * 1000;

interface Pendente {
  timer: ReturnType<typeof setTimeout>;
  anterior: { kanban_status: ColunaKanban; status: StatusChamado };
  notificar: () => Promise<void>;
}

export function useEvaHome(defaultView: EvaView = 'team', opcoes: OpcoesInicio = { ehGestor: false, whatsappAtivo: false }) {
  const { userProfile } = useAuth();
  const usuarioId = userProfile?.id ?? '';
  const { sendNotification } = useNotificationCenter();
  const { ehGestor, whatsappAtivo, temGrupo = false, grupoNome = null } = opcoes;
  const grupo = useMemo(() => (temGrupo ? { nome: grupoNome } : null), [temGrupo, grupoNome]);

  const [view, setView] = useState<EvaView>(defaultView);
  const [dados, setDados] = useState<DadosInicio | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filter, setFilter] = useState<OverdueFilter>('all');
  const [aviso, setAviso] = useState<AvisoEva | null>(null);
  const [cardAberto, setCardAberto] = useState<ITRequest | null>(null);
  // WhatsApp (Fase 3): contagem para todos; fila e quem tem WhatsApp só para gestores (D24).
  const [cobrancasHoje, setCobrancasHoje] = useState<number | null>(null);
  const [fila, setFila] = useState<MensagemFila[] | null>(null);
  const [membrosZap, setMembrosZap] = useState<Map<string, MembroNoWhatsapp> | null>(null);
  /** Cobranças feitas nesta tela, até a fila confirmar (resposta otimista do handoff). */
  const [cobradasAgora, setCobradasAgora] = useState<Record<string, { em: string; texto: string }>>({});
  const [agora, setAgora] = useState(() => Date.now());

  const requestIdRef = useRef(0);
  const pendentesRef = useRef(new Map<string, Pendente>());
  const avisoSeq = useRef(0);

  const avisar = useCallback((texto: string, tom: AvisoEva['tom'], desfazer?: () => void) => {
    avisoSeq.current += 1;
    setAviso({ id: avisoSeq.current, texto, tom, desfazer });
  }, []);

  const carregar = useCallback(async () => {
    if (!usuarioId) return;
    const pedido = ++requestIdRef.current;
    setLoading(true);
    try {
      const novos = await evaService.carregarDadosInicio(hojeSP(), usuarioId);
      if (pedido !== requestIdRef.current) return; // resposta atrasada: descarta
      setDados(novos);
      setErro(null);
    } catch (e) {
      if (pedido !== requestIdRef.current) return;
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o board.');
    } finally {
      if (pedido === requestIdRef.current) setLoading(false);
    }
  }, [usuarioId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Contagem do dia, fila e quem tem WhatsApp. Cada leitura falha sozinha (sem tabelas, fica vazio). */
  const carregarWhatsapp = useCallback(async () => {
    if (!usuarioId) return;
    const desde = new Date(Date.now() - DIAS_FILA * 86_400_000);
    const [n, f, w] = await Promise.all([
      evaService.cobrancasHoje().catch(() => null),
      ehGestor ? evaService.lerFila(desde).catch(() => null) : Promise.resolve(null),
      ehGestor ? evaService.membrosNoWhatsapp().catch(() => null) : Promise.resolve(null),
    ]);
    setCobrancasHoje(n);
    setFila(f);
    setMembrosZap(w ? new Map(w.map((m) => [m.user_id, { whatsapp: m.whatsapp, recebe: m.recebe }])) : null);
    setAgora(Date.now());
  }, [usuarioId, ehGestor]);

  useEffect(() => {
    void carregarWhatsapp();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void carregarWhatsapp(); }, ATUALIZAR_WHATSAPP_MS);
    return () => clearInterval(t);
  }, [carregarWhatsapp]);

  // Ao sair da página, as notificações que esperavam a janela de desfazer saem já.
  useEffect(() => {
    const pendentes = pendentesRef.current;
    return () => {
      pendentes.forEach((p) => {
        clearTimeout(p.timer);
        void p.notificar();
      });
      pendentes.clear();
    };
  }, []);

  // Cobranças desta tela que a contagem do servidor ainda não viu (saem da fila em até 1 min).
  const cobrancasLocais = useMemo(
    () => Object.values(cobradasAgora).filter((c) => !c.texto.startsWith('Cobrança agendada') && new Date(c.em).getTime() > agora).length,
    [cobradasAgora, agora],
  );

  const snapshot = useMemo(
    () =>
      dados && usuarioId
        ? montarSnapshot({
            visao: view, usuarioId, hoje: dados.hoje, cards: dados.cards, projetos: dados.projetos, sprints: dados.sprints, pessoas: dados.pessoas,
            cobrancasHoje: cobrancasHoje === null ? null : cobrancasHoje + cobrancasLocais,
          })
        : null,
    [dados, view, usuarioId, cobrancasHoje, cobrancasLocais],
  );

  const nomes = useMemo(
    () => Object.fromEntries((dados?.pessoas ?? []).map((p) => [p.id, p.name])),
    [dados],
  );

  const overdue: OverdueRow[] = useMemo(() => {
    if (!snapshot || !dados) return [];
    const porId = new Map(dados.cards.map((c) => [c.id, c]));
    const lista = filter === 'critical'
      ? snapshot.overdue.filter((t) => t.priority === 'critical' || t.priority === 'high')
      : snapshot.overdue;
    return lista.map((t) => {
      const donos = porId.get(t.id)?.assigned_to ?? [];
      // D24: o último contato vem da fila, que só gestores leem.
      const contato = fila ? ultimoContato(t.id, donos, fila, agora, dados.hoje, JANELA_COBRANCA_MS) : null;
      const local = cobradasAgora[t.id];
      const charged = !!local || !!contato?.cobradaNaJanela;
      const situacao = membrosZap
        ? situacaoDoCobrar({ doUsuario: t.isMine, donos, usuarioId, membros: membrosZap, grupo, nome: (id) => nomes[id] ?? '' })
        : {};
      return {
        ...t,
        charged,
        memberName: (t.memberId && snapshot.members[t.memberId]?.name) || 'Sem responsável',
        lateLabel: pluralDias(t.daysLate),
        statusText: local ? local.texto : contato?.texto ?? '',
        chargeable: whatsappAtivo && donos.length > 0 && (t.isMine || ehGestor),
        chargeHint: situacao.motivo,
        chargeNote: situacao.nota,
      };
    });
  }, [snapshot, dados, filter, fila, agora, cobradasAgora, membrosZap, grupo, nomes, usuarioId, whatsappAtivo, ehGestor]);

  const mudarCardLocal = useCallback((id: string, mudanca: Partial<CardTI>) => {
    setDados((d) => (d ? { ...d, cards: d.cards.map((c) => (c.id === id ? { ...c, ...mudanca } : c)) } : d));
  }, []);

  /** Aviso ao solicitante, igual ao do Board ao concluir (sino + e-mail com intervalo mínimo). */
  const notificarResolucao = useCallback(
    async (completo: ITRequest) => {
      if (!completo.requested_by) return;
      const ultimoEmail = completo.last_status_email_at ? new Date(completo.last_status_email_at).getTime() : 0;
      const enviarEmail = !!completo.requester_email && Date.now() - ultimoEmail >= INTERVALO_EMAIL_STATUS_MS;
      try {
        await sendNotification({
          userId: completo.requested_by,
          title: 'Chamado de TI resolvido',
          content: `O chamado ${completo.codigo} foi concluído e marcado como resolvido.`,
          module: 'IT',
          type: 'success',
          link: IT_REQUESTS_PATH,
          sendEmail: enviarEmail,
          emailData: enviarEmail
            ? {
                to: completo.requester_email!,
                templateSlug: 'it_ticket_resolved',
                variables: {
                  user_name: completo.requester_name || 'Usuário',
                  ticket_code: completo.codigo,
                  ticket_title: completo.title,
                  status_label: 'Resolvido',
                  action_url: itRequestUrl(completo.id),
                },
              }
            : undefined,
        });
        if (enviarEmail) await evaService.registrarEmailDeStatus(completo.id);
      } catch (e) {
        console.error('[EVA] Falha ao notificar o solicitante:', e);
      }
    },
    [sendNotification],
  );

  /** Marca/desmarca uma task do dia (D23): concluir é de verdade, com desfazer. */
  const toggleTask = useCallback(
    async (id: string) => {
      const card = dados?.cards.find((c) => c.id === id);
      if (!card) return;
      const pendente = pendentesRef.current.get(id);

      if (estaConcluido(card)) {
        // Desmarcar: dentro da janela, volta exatamente ao que era; fora dela, reabre.
        if (pendente) {
          clearTimeout(pendente.timer);
          pendentesRef.current.delete(id);
        }
        const anterior = pendente?.anterior;
        mudarCardLocal(id, { ...(anterior ?? { kanban_status: 'in_progress', status: 'in_progress' }), updated_at: new Date().toISOString() });
        try {
          await evaService.reabrirCard(id, anterior);
          avisar(`${card.codigo} voltou a ficar em aberto.`, 'sucesso');
        } catch (e) {
          mudarCardLocal(id, { kanban_status: card.kanban_status, status: card.status });
          avisar(`Não consegui reabrir ${card.codigo}: ${e instanceof Error ? e.message : 'tente de novo'}`, 'erro');
        }
        return;
      }

      const anterior = { kanban_status: card.kanban_status, status: card.status };
      mudarCardLocal(id, { kanban_status: 'done', status: 'resolved', updated_at: new Date().toISOString() });
      try {
        const [completo] = await Promise.all([evaService.carregarCardCompleto(id, nomes), evaService.concluirCard(id)]);
        const notificar = () => notificarResolucao(completo);
        const timer = setTimeout(() => {
          pendentesRef.current.delete(id);
          void notificar();
        }, JANELA_DESFAZER_MS);
        pendentesRef.current.set(id, { timer, anterior, notificar });
        avisar(`${card.codigo} concluído.`, 'sucesso', () => void toggleTaskRef.current?.(id));
      } catch (e) {
        mudarCardLocal(id, anterior);
        avisar(`Não consegui concluir ${card.codigo}: ${e instanceof Error ? e.message : 'tente de novo'}`, 'erro');
      }
    },
    [dados, nomes, mudarCardLocal, notificarResolucao, avisar],
  );
  // O "Desfazer" do aviso chama a versão mais recente de toggleTask (com o card já concluído).
  const toggleTaskRef = useRef(toggleTask);
  toggleTaskRef.current = toggleTask;

  const abrirCard = useCallback(
    async (id: string) => {
      try {
        setCardAberto(await evaService.carregarCardCompleto(id, nomes));
      } catch {
        avisar('Não consegui abrir o card agora.', 'erro');
      }
    },
    [nomes, avisar],
  );

  /**
   * Cobrar/Lembrar (D22): resposta otimista do handoff. O botão vira "Cobrada" na hora;
   * se o servidor recusar (janela de 4 h, sem WhatsApp), volta e o aviso diz o motivo.
   */
  const cobrarCard = useCallback(
    async (cardId: string): Promise<boolean> => {
      const codigo = dados?.cards.find((c) => c.id === cardId)?.codigo ?? 'card';
      const em = new Date().toISOString();
      setCobradasAgora((c) => ({ ...c, [cardId]: { em, texto: 'Cobrança enviada agora via WhatsApp' } }));
      try {
        const r = await evaService.sendCharge(cardId);
        // Fora do horário de cobrança (dia útil, 7h às 20h), ela foi agendada para a próxima janela.
        const quando = r.agendadaPara ? quandoSera(r.agendadaPara, hojeSP()) : null;
        if (quando) setCobradasAgora((c) => ({ ...c, [cardId]: { em, texto: `Cobrança agendada para ${quando}` } }));
        // D35: quem não recebe pelo WhatsApp foi citado no grupo da equipe.
        const citados = r.citadosNoGrupo ?? [];
        const oQue = r.modo === 'lembrar' ? `Lembrete do ${codigo}`
          : `Cobrança do ${codigo} para ${destinoDaCobranca(r.destinatarios, citados, r.grupoNome ?? null)}${citados.length ? ',' : ''}`;
        const agendado = r.modo === 'lembrar' ? 'agendado' : 'agendada';
        avisar(quando ? `${oQue} ${agendado} para ${quando} (fora do horário de cobrança).` : `${oQue} na fila do WhatsApp.`, 'sucesso');
        void carregarWhatsapp();
        return true;
      } catch (e) {
        setCobradasAgora((c) => {
          const resto = { ...c };
          delete resto[cardId];
          return resto;
        });
        avisar(`Não consegui cobrar o ${codigo}: ${e instanceof Error ? e.message : 'tente de novo'}`, 'erro');
        return false;
      }
    },
    [dados, avisar, carregarWhatsapp],
  );

  /** Card citado no chat, pelo código. Fora do Início (ex.: oculto), avisa. */
  const abrirCardPorCodigo = useCallback(
    (codigo: string) => {
      const card = dados?.cards.find((c) => c.codigo.toUpperCase() === codigo.toUpperCase());
      if (card) void abrirCard(card.id);
      else avisar(`Não achei o ${codigo} no board.`, 'erro');
    },
    [dados, abrirCard, avisar],
  );

  const fecharCard = useCallback(() => {
    setCardAberto(null);
    void carregar();
  }, [carregar]);

  const atualizarCardAberto = useCallback((parcial: Partial<ITRequest> & { id: string }) => {
    setCardAberto((atual) => (atual && atual.id === parcial.id ? { ...atual, ...parcial } : atual));
  }, []);

  return {
    view, setView, loading, erro, recarregar: carregar,
    filter, setFilter,
    snapshot, overdue,
    toggleTask,
    aviso, fecharAviso: () => setAviso(null),
    cardAberto, abrirCard, abrirCardPorCodigo, fecharCard, atualizarCardAberto,
    nomes, avisar,
    /** Os cards crus, para as regras dos comentários (domain/comentarios.ts). */
    cards: dados?.cards ?? SEM_CARDS, hoje: dados?.hoje ?? null, usuarioId,
    /** Projetos e sprints crus, para os blocos do chat (D34). */
    projetos: dados?.projetos ?? SEM_PROJETOS, sprints: dados?.sprints ?? SEM_SPRINTS,
    /** WhatsApp: fila só para gestores (null para os demais), cobrança e momento da última leitura. */
    fila, agora, cobrarCard, cobrar: (row: OverdueRow) => cobrarCard(row.id), recarregarWhatsapp: carregarWhatsapp,
    /** Os ativos da aba Membros com WhatsApp e adesão (só gestores; null para os demais), D35. */
    membrosNoWhatsapp: membrosZap,
  };
}

export type EvaHomeState = ReturnType<typeof useEvaHome>;
