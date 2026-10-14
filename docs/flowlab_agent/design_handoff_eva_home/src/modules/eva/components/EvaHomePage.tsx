import React, { useRef } from 'react';
import './eva.css';
import { useAuth } from '../../../hooks/useAuth';
import { useEvaHome } from '../hooks/useEvaHome';
import { useEvaChat } from '../hooks/useEvaChat';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useScrolledPast } from '../hooks/useScrolledPast';
import { formatTodayLabel, greetingFor } from '../domain/chatReplies';
import { INTEGRATIONS } from '../mocks';
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
import type { EvaView, InsightSlot } from '../types';

export interface EvaHomePageProps {
  showInsights?: boolean;
  animatedGlow?: boolean;
  defaultView?: EvaView;
}

/** /it/inicio — homepage do módulo de TI com a EVA. Renderizada dentro do <Layout>. */
const EvaHomePage: React.FC<EvaHomePageProps> = ({ showInsights = true, animatedGlow = true, defaultView = 'team' }) => {
  const { userProfile } = useAuth();
  const home = useEvaHome(defaultView);
  const chat = useEvaChat();
  const voice = useVoiceInput(chat.ask);

  const heroInputRef = useRef<HTMLDivElement>(null);
  const pastHero = useScrolledPast(heroInputRef);

  const firstName = (userProfile?.name ?? '').split(' ')[0];
  const greeting = home.view === 'me' || !firstName
    ? `${greetingFor()}${firstName ? `, ${firstName}` : ''}`
    : `${greetingFor()}, equipe de TI`;

  const insight = (slot: InsightSlot, onAccept?: () => void) => (
    <EvaInsight
      insight={home.insights[slot]}
      accepted={home.isInsightAccepted(slot)}
      onAccept={() => { home.acceptInsight(slot); onAccept?.(); }}
      onAsk={chat.ask}
    />
  );

  return (
    <EvaUIProvider showInsights={showInsights} animatedGlow={animatedGlow}>
      <div className="flex flex-col gap-7 pb-10 max-w-[1440px] mx-auto">
        <EvaHero
          ref={heroInputRef}
          eyebrow={`EVA · Agente de TI · ${formatTodayLabel()}`}
          greeting={greeting}
          briefing={home.briefing}
          thinking={chat.thinking}
          listening={voice.isActive('hero')}
          transcript={voice.transcript}
          voiceNotice={!pastHero && !chat.open ? voice.notice : ''}
          onAsk={chat.ask}
          onMic={() => voice.toggle('hero')}
        />

        <EvaControls view={home.view} onViewChange={home.setView} integrations={INTEGRATIONS} loading={home.loading} />

        <EvaStatCards stats={home.stats} />

        <KanbanSummaryCard view={home.view} columns={home.columns} total={home.totalCards} footer={insight('kanban')} />

        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
          <OverdueCard rows={home.overdue} filter={home.filter} onFilterChange={home.setFilter} onCharge={home.charge} footer={insight('overdue')} />
          <WhatsAppQueueCard messages={home.waQueue} footer={insight('whatsapp')} />
        </div>

        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
          <ProjectsCard projects={home.projects} footer={insight('projects', () => chat.ask(home.insights.projects.askPrompt))} />
          <MyTasksCard tasks={home.myTasks} doneCount={home.myDoneCount} onToggle={home.toggleTask} footer={insight('myTasks')} />
        </div>
      </div>

      <EvaFloatingChat
        visible={pastHero && !chat.open}
        thinking={chat.thinking}
        listening={voice.isActive('float')}
        transcript={voice.transcript}
        notice={pastHero && !chat.open ? voice.notice : ''}
        onOpen={() => chat.ask()}
        onAsk={chat.ask}
        onMic={() => voice.toggle('float')}
      />
      <EvaEdgeGlow active={chat.thinking || voice.listening} />
      <EvaChatDrawer
        open={chat.open}
        thinking={chat.thinking}
        messages={chat.messages}
        onClose={chat.close}
        onSend={chat.ask}
        listening={voice.isActive('chat')}
        transcript={voice.transcript}
        voiceNotice={chat.open ? voice.notice : ''}
        onMic={() => voice.toggle('chat')}
      />
    </EvaUIProvider>
  );
};

export default EvaHomePage;
