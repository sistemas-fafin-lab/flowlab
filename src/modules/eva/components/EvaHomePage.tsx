import React, { useMemo, useRef } from 'react';
import { MotionConfig } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import './eva.css';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import ITTaskDrawer from '../../../components/IT/ITTaskDrawer';
import { useEvaHome } from '../hooks/useEvaHome';
import { useEvaChat } from '../hooks/useEvaChat';
import { useScrolledPast } from '../hooks/useScrolledPast';
import { formatTodayLabel, greetingFor } from '../domain/chatReplies';
import { primeiroNome } from '../domain/pessoas';
import { EvaUIProvider } from './EvaUIContext';
import { EvaHero } from './EvaHero';
import { EvaControls } from './EvaControls';
import { EvaStatCards } from './EvaStatCards';
import { EvaInsight } from './EvaInsight';
import { KanbanSummaryCard } from './KanbanSummaryCard';
import { OverdueCard } from './OverdueCard';
import { WhatsAppQueueCard } from './WhatsAppQueueCard';
import { ProjectsCard } from './ProjectsCard';
import { MyTasksCard } from './MyTasksCard';
import { EvaChatDrawer, EvaEdgeGlow } from './EvaChatDrawer';
import { EvaFloatingChat } from './EvaFloatingChat';
import { EvaToast } from './EvaToast';
import { GlassCard } from './ui';
import type { EvaInsightData, EvaView, IntegrationStatus } from '../types';

export interface EvaHomePageProps {
  animatedGlow?: boolean;
  defaultView?: EvaView;
}

// Fase 1: Granola e WhatsApp ainda não existem. Os chips dizem isso em vez de fingir
// que estão conectados (§12.1). As fases 2 e 3 trocam por ti_agente_config.
const INTEGRACOES_FASE1: IntegrationStatus[] = [
  { id: 'granola', name: 'Granola', detail: 'ainda não configurado', state: 'pending' },
  { id: 'waha', name: 'Wa-ha', detail: 'ainda não configurado', state: 'pending' },
];

/** /it/inicio — homepage do módulo de TI com a EVA. Renderizada dentro do <Layout>. */
const EvaHomePage: React.FC<EvaHomePageProps> = ({ animatedGlow = true, defaultView = 'team' }) => {
  const { userProfile } = useAuth();
  const nome = primeiroNome(userProfile?.name ?? '');
  const ehGestor = hasPermission(userProfile?.permissions || [], 'canApproveAgenteTI');

  const home = useEvaHome(defaultView);
  const chat = useEvaChat(nome);
  const s = home.snapshot;

  const heroInputRef = useRef<HTMLDivElement>(null);
  const pastHero = useScrolledPast(heroInputRef);

  const greeting = home.view === 'me' || !nome
    ? `${greetingFor()}${nome ? `, ${nome}` : ''}`
    : `${greetingFor()}, equipe de TI`;

  // Comentários da EVA entram na issue 17; até lá nenhum bloco tem rodapé.
  const insight = (dado?: EvaInsightData) => (
    <EvaInsight insight={dado} accepted={false} onAccept={() => undefined} onAsk={chat.ask} />
  );

  const doneCount = useMemo(() => s?.myTasks.filter((t) => t.done).length ?? 0, [s]);

  return (
    <MotionConfig reducedMotion="user">
      <EvaUIProvider showInsights={false} animatedGlow={animatedGlow}>
        <div className="flex flex-col gap-7 pb-10 max-w-[1440px] mx-auto">
          <EvaHero
            ref={heroInputRef}
            eyebrow={`EVA · Agente de TI · ${formatTodayLabel()}`}
            greeting={greeting}
            briefing={s?.briefing ?? (home.erro ? 'Não consegui ler o board agora.' : 'Lendo o board…')}
            thinking={chat.thinking}
            listening={false}
            transcript=""
            voiceNotice=""
            onAsk={chat.ask}
          />

          <EvaControls
            view={home.view}
            onViewChange={home.setView}
            integrations={INTEGRACOES_FASE1}
            loading={home.loading}
            onRefresh={() => void home.recarregar()}
          />

          {!s && home.erro && (
            <GlassCard className="items-center text-center py-10">
              <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Não consegui carregar o Início.</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md">{home.erro}</p>
              <button
                type="button"
                onClick={() => void home.recarregar()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-500/25"
              >
                <RefreshCw className="w-4 h-4" /> Tentar de novo
              </button>
            </GlassCard>
          )}

          {!s && !home.erro && (
            <GlassCard className="items-center py-12">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Carregando cards, projetos e sprints…</p>
            </GlassCard>
          )}

          {s && (
            <div className={`flex flex-col gap-7 transition-opacity duration-300 ${home.loading ? 'opacity-60' : 'opacity-100'}`}>
              <EvaStatCards stats={s.stats} />

              <KanbanSummaryCard
                view={home.view}
                columns={s.columns}
                total={s.totalCards}
                members={s.members}
                onOpenCard={(id) => void home.abrirCard(id)}
                footer={insight()}
              />

              <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
                <OverdueCard
                  rows={home.overdue}
                  filter={home.filter}
                  onFilterChange={home.setFilter}
                  onOpenCard={(id) => void home.abrirCard(id)}
                  footer={insight()}
                />
                {/* D24: a fila do WhatsApp é só para gestores. Para os demais, as atrasadas ocupam a linha. */}
                {ehGestor && <WhatsAppQueueCard messages={[]} ativa={false} footer={insight()} />}
              </div>

              <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
                <ProjectsCard projects={s.projects} footer={insight()} />
                <MyTasksCard tasks={s.myTasks} doneCount={doneCount} onToggle={(id) => void home.toggleTask(id)} footer={insight()} />
              </div>
            </div>
          )}
        </div>

        <EvaFloatingChat
          visible={pastHero && !chat.open}
          thinking={chat.thinking}
          listening={false}
          transcript=""
          notice=""
          onOpen={() => chat.ask()}
          onAsk={chat.ask}
        />
        <EvaEdgeGlow active={chat.thinking} />
        <EvaChatDrawer
          open={chat.open}
          thinking={chat.thinking}
          messages={chat.messages}
          onClose={chat.close}
          onSend={chat.ask}
          listening={false}
          transcript=""
          voiceNotice=""
        />
        <EvaToast aviso={home.aviso} onClose={home.fecharAviso} />

        {home.cardAberto && (
          <ITTaskDrawer task={home.cardAberto} onClose={home.fecharCard} onUpdate={home.atualizarCardAberto} />
        )}
      </EvaUIProvider>
    </MotionConfig>
  );
};

export default EvaHomePage;
