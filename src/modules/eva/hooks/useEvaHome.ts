import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useNotificationCenter } from '../../../hooks/useNotificationCenter';
import { IT_REQUESTS_PATH, itRequestUrl } from '../../../utils/itRequestLink';
import type { ITRequest } from '../../../components/IT/ITKanbanBoard';
import { evaService, type DadosInicio } from '../services/evaService';
import { hojeSP, pluralDias } from '../domain/datas';
import { estaConcluido, type CardTI, type ColunaKanban, type StatusChamado } from '../domain/demandas';
import { montarSnapshot } from '../domain/inicio';
import type { EvaView, OverdueFilter, OverdueTask } from '../types';

export interface OverdueRow extends OverdueTask {
  charged: boolean;
  memberName: string;
  lateLabel: string;
  statusText: string;
}

export interface AvisoEva {
  id: number;
  texto: string;
  tom: 'sucesso' | 'erro';
  desfazer?: () => void;
}

/** Janela para desfazer a conclusão de uma task do dia. */
export const JANELA_DESFAZER_MS = 5000;
/** Mesmo intervalo mínimo entre e-mails de status do Board (ITKanbanBoard). */
const INTERVALO_EMAIL_STATUS_MS = 5 * 60 * 1000;

interface Pendente {
  timer: ReturnType<typeof setTimeout>;
  anterior: { kanban_status: ColunaKanban; status: StatusChamado };
  notificar: () => Promise<void>;
}

export function useEvaHome(defaultView: EvaView = 'team') {
  const { userProfile } = useAuth();
  const usuarioId = userProfile?.id ?? '';
  const { sendNotification } = useNotificationCenter();

  const [view, setView] = useState<EvaView>(defaultView);
  const [dados, setDados] = useState<DadosInicio | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filter, setFilter] = useState<OverdueFilter>('all');
  const [aviso, setAviso] = useState<AvisoEva | null>(null);
  const [cardAberto, setCardAberto] = useState<ITRequest | null>(null);

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

  const snapshot = useMemo(
    () =>
      dados && usuarioId
        ? montarSnapshot({ visao: view, usuarioId, hoje: dados.hoje, cards: dados.cards, projetos: dados.projetos, sprints: dados.sprints, pessoas: dados.pessoas, cobrancasHoje: null })
        : null,
    [dados, view, usuarioId],
  );

  const overdue: OverdueRow[] = useMemo(() => {
    if (!snapshot) return [];
    const lista = filter === 'critical'
      ? snapshot.overdue.filter((t) => t.priority === 'critical' || t.priority === 'high')
      : snapshot.overdue;
    return lista.map((t) => ({
      ...t,
      charged: false,
      memberName: (t.memberId && snapshot.members[t.memberId]?.name) || 'Sem responsável',
      lateLabel: pluralDias(t.daysLate),
      statusText: t.lastChargeText,
    }));
  }, [snapshot, filter]);

  const nomes = useMemo(
    () => Object.fromEntries((dados?.pessoas ?? []).map((p) => [p.id, p.name])),
    [dados],
  );

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
    cardAberto, abrirCard, fecharCard, atualizarCardAberto,
  };
}

export type EvaHomeState = ReturnType<typeof useEvaHome>;
