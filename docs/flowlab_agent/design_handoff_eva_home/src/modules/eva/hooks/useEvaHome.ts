import { useCallback, useEffect, useMemo, useState } from 'react';
import { evaService } from '../services/evaService';
import { MEMBERS, MY_TASKS, SNAPSHOT_TEAM } from '../mocks';
import { nowHHmm, pluralDias } from '../domain/chatReplies';
import type {
  DailyTask, EvaHomeSnapshot, EvaView, InsightSlot, OverdueFilter, OverdueTask, StatCardData, WaMessage,
} from '../types';

export interface OverdueRow extends OverdueTask {
  charged: boolean;
  memberName: string;
  lateLabel: string;
  statusText: string;
}

export function useEvaHome(defaultView: EvaView = 'team') {
  const [view, setView] = useState<EvaView>(defaultView);
  const [snapshot, setSnapshot] = useState<EvaHomeSnapshot>(SNAPSHOT_TEAM);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OverdueFilter>('all');
  const [charged, setCharged] = useState<Record<string, boolean>>({});
  const [pendingWa, setPendingWa] = useState<WaMessage[]>([]);
  const [acceptedInsights, setAcceptedInsights] = useState<Record<string, boolean>>({});
  const [taskDone, setTaskDone] = useState<Record<string, boolean>>(
    () => Object.fromEntries(MY_TASKS.filter((t) => t.done).map((t) => [t.id, true])),
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    evaService.getSnapshot(view).then((s) => {
      if (!alive) return;
      setSnapshot(s);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [view]);

  const myTasks: DailyTask[] = useMemo(
    () => MY_TASKS.map((t) => ({ ...t, done: !!taskDone[t.id], late: !!t.late && !taskDone[t.id] })),
    [taskDone],
  );
  const myDoneCount = myTasks.filter((t) => t.done).length;
  const myLateCount = myTasks.filter((t) => t.late).length;

  const totalCards = snapshot.columns.reduce((a, c) => a + c.count, 0);
  const openCards = snapshot.columns.filter((c) => c.key !== 'done').reduce((a, c) => a + c.count, 0);

  const overdue: OverdueRow[] = useMemo(() => {
    const list = filter === 'critical'
      ? snapshot.overdue.filter((t) => t.priority === 'critical' || t.priority === 'high')
      : snapshot.overdue;
    return list.map((t) => ({
      ...t,
      charged: !!charged[t.id],
      memberName: MEMBERS[t.memberId]?.name ?? '',
      lateLabel: pluralDias(t.daysLate),
      statusText: charged[t.id] ? 'Cobrança enviada agora via WhatsApp' : t.lastChargeText,
    }));
  }, [snapshot.overdue, filter, charged]);

  // Mensagens geradas na sessão entram depois das agendadas
  const waQueue: WaMessage[] = useMemo(() => {
    if (view === 'me') return snapshot.waQueue;
    const scheduled = snapshot.waQueue.filter((m) => m.status === 'scheduled');
    const rest = snapshot.waQueue.filter((m) => m.status !== 'scheduled');
    return [...scheduled, ...pendingWa, ...rest];
  }, [view, snapshot.waQueue, pendingWa]);

  const chargesCount = Object.keys(charged).length;

  const stats: StatCardData[] = view === 'me'
    ? [
        { key: 'open', label: 'Em aberto', value: snapshot.stats.myOpen, hint: 'Cards atribuídos a você' },
        { key: 'overdue', label: 'Atrasadas', value: snapshot.overdue.length, hint: snapshot.stats.overdueHint },
        { key: 'today', label: 'Hoje', value: `${myDoneCount}/${myTasks.length}`, hint: 'Tasks do dia concluídas' },
        { key: 'projects', label: 'Projetos', value: snapshot.stats.myProjects, hint: snapshot.stats.myProjectsHint },
      ]
    : [
        { key: 'open', label: 'Em aberto', value: openCards, hint: 'Backlog a Revisão' },
        { key: 'overdue', label: 'Atrasadas', value: snapshot.overdue.length, hint: snapshot.stats.overdueHint },
        { key: 'done', label: 'Concluídas', value: snapshot.stats.doneThisWeek, hint: 'Nesta semana' },
        { key: 'charges', label: 'Cobranças', value: snapshot.stats.chargesToday + chargesCount, hint: 'Enviadas hoje pela EVA' },
      ];

  const charge = useCallback(async (task: OverdueTask) => {
    if (charged[task.id]) return;
    const member = MEMBERS[task.memberId];
    const tempId = `pending-${task.id}`;
    setCharged((c) => ({ ...c, [task.id]: true }));
    setPendingWa((q) => [{ id: tempId, time: nowHHmm(), to: member.name, text: `${member.name.split(' ')[0]}, a task “${task.title}” está atrasada há ${pluralDias(task.daysLate)}. Consegue atualizar o status?`, status: 'sending' }, ...q]);
    const sent = await evaService.sendCharge(task, member);
    setPendingWa((q) => q.map((m) => (m.id === tempId ? { ...sent, id: tempId } : m)));
  }, [charged]);

  const toggleTask = useCallback((id: string) => setTaskDone((d) => ({ ...d, [id]: !d[id] })), []);

  const isInsightAccepted = useCallback((slot: InsightSlot) => !!acceptedInsights[snapshot.insights[slot].id], [acceptedInsights, snapshot.insights]);
  const acceptInsight = useCallback((slot: InsightSlot) => {
    const id = snapshot.insights[slot].id;
    setAcceptedInsights((a) => ({ ...a, [id]: true }));
    void evaService.acceptInsight(id);
  }, [snapshot.insights]);

  const briefing = snapshot.briefing.replace('{late}', String(myLateCount));

  return {
    view, setView, loading,
    filter, setFilter,
    briefing,
    stats,
    columns: snapshot.columns, totalCards,
    overdue, charge,
    waQueue,
    projects: snapshot.projects,
    myTasks, myDoneCount, toggleTask,
    insights: snapshot.insights, isInsightAccepted, acceptInsight,
  };
}

export type EvaHomeState = ReturnType<typeof useEvaHome>;
