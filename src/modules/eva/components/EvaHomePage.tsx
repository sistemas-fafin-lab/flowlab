import React, { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import './eva.css';
import { useAuth } from '../../../hooks/useAuth';
import ITTaskDrawer from '../../../components/IT/ITTaskDrawer';
import { useEvaHome } from '../hooks/useEvaHome';
import { useEvaChat } from '../hooks/useEvaChat';
import { useEvaNoInicio, usePapeisEva } from '../hooks/useAgenteAdmin';
import { useEvaComentarios } from '../hooks/useEvaComentarios';
import { useScrolledPast } from '../hooks/useScrolledPast';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { formatTodayLabel, greetingFor } from '../domain/chatReplies';
import { montarComentarios, type ComentariosInicio } from '../domain/comentarios';
import { montarIntegracoes } from '../domain/integracoes';
import { primeiroNome } from '../domain/pessoas';
import { cardPorCodigo, type ContextoVisual } from '../domain/respostaVisual';
import { ehChatDeGrupo } from '../domain/whatsapp';
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
import { ConfirmarPropostaModal } from './ConfirmarPropostaModal';
import { mensagensDaFila } from './fila';
import { GlassCard } from './ui';
import type { EvaInsightData, EvaView } from '../types';

export interface EvaHomePageProps {
  animatedGlow?: boolean;
  defaultView?: EvaView;
}

/** /it/inicio — homepage do módulo de TI com a EVA. Renderizada dentro do <Layout>. */
const EvaHomePage: React.FC<EvaHomePageProps> = ({ animatedGlow = true, defaultView = 'team' }) => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const nome = primeiroNome(userProfile?.name ?? '');
  // D31: o gestor vê a fila e cobra os outros; quem aprova aprova na hora e vê as pendentes.
  const papeis = usePapeisEva();
  const ehGestor = papeis.gestor;
  const podeAprovar = papeis.aprova;

  const eva = useEvaNoInicio(podeAprovar);
  const whatsappAtivo = eva.dados?.config?.whatsapp_ativo === true;
  // D35: quem não recebe pelo WhatsApp é cobrado (ou avisado) no grupo da equipe, se houver um.
  const temGrupo = ehChatDeGrupo(eva.dados?.config?.whatsapp_grupo_id);
  const grupoNome = eva.dados?.config?.whatsapp_grupo_nome ?? null;
  const home = useEvaHome(defaultView, { ehGestor, whatsappAtivo, temGrupo, grupoNome });
  const chat = useEvaChat({
    primeiroNome: nome,
    view: home.view,
    podeAprovar,
    ultimaReuniaoEm: eva.dados?.ultimaReuniao?.analisada_em ?? null,
    onExecutada: () => {
      void home.recarregar();
      void eva.recarregar();
    },
  });
  const voice = useVoiceInput(chat.ask);
  const s = home.snapshot;

  const integracoes = useMemo(
    () => montarIntegracoes(eva.dados?.config ?? null, eva.dados?.pendentes ?? null, podeAprovar),
    [eva.dados, podeAprovar],
  );
  const nomePessoa = (id: string) => chat.nomes[id] ?? home.nomes[id] ?? 'alguém';
  const abrirCitado = (codigo: string) => {
    chat.close();
    home.abrirCardPorCodigo(codigo);
  };

  // D34: os cartões e blocos do chat usam o que o Início já leu (nada vem escrito pela IA).
  const visual = useMemo<ContextoVisual | null>(
    () => (s && home.hoje
      ? {
          hoje: home.hoje,
          visao: home.view,
          usuarioId: home.usuarioId,
          cards: home.cards,
          projetos: home.projetos,
          sprints: home.sprints,
          membros: s.members,
          nomes: { ...home.nomes, ...chat.nomes },
          stats: s.stats,
          reuniao: eva.dados?.ultimaReuniao
            ? { id: eva.dados.ultimaReuniao.id, titulo: eva.dados.ultimaReuniao.titulo, realizada_em: eva.dados.ultimaReuniao.realizada_em, observacoes: eva.dados.ultimaReuniao.observacoes }
            : null,
          pendentesDaReuniao: eva.dados?.pendentesDaReuniao ?? null,
        }
      : null),
    [s, home.hoje, home.view, home.usuarioId, home.cards, home.projetos, home.sprints, home.nomes, chat.nomes, eva.dados],
  );
  const cobrarCitado = async (codigo: string) => {
    const card = visual ? cardPorCodigo(visual, codigo) : undefined;
    return card ? home.cobrarCard(card.id) : false;
  };
  const navegarDoChat = (para: string) => {
    chat.close();
    navigate(para);
  };
  // Aviso para quem está na aba Membros sem WhatsApp: vai para o grupo (D35). O servidor confere de novo.
  const grupoDoAviso = (pessoaId: string) => {
    const m = home.membrosNoWhatsapp?.get(pessoaId);
    return m && !m.whatsapp && temGrupo ? { nome: grupoNome } : null;
  };

  // Comentários da EVA (issue 17): regras fixas sobre os dados que o Início já leu.
  const comentarios = useMemo<ComentariosInicio>(
    () => (s && home.hoje
      ? montarComentarios({
          visao: home.view,
          usuarioId: home.usuarioId,
          hoje: home.hoje,
          cards: home.cards,
          nomes: home.nomes,
          projetos: s.projects,
          ehGestor,
          config: eva.dados?.config ?? null,
          ultimaReuniao: eva.dados?.ultimaReuniao ?? null,
          pendentesDaReuniao: eva.dados?.pendentesDaReuniao ?? null,
          fila: home.fila,
          agora: home.agora,
        })
      : {}),
    [s, home.hoje, home.view, home.usuarioId, home.cards, home.nomes, ehGestor, eva.dados, home.fila, home.agora],
  );
  const acoes = useEvaComentarios({
    podeAprovar,
    navegar: navigate,
    abrirCard: (id) => void home.abrirCard(id),
    perguntar: (texto) => void chat.ask(texto),
    cobrar: home.cobrarCard,
    onExecutada: () => {
      void home.recarregar();
      void eva.recarregar();
    },
    onFeito: (texto) => home.avisar(texto, 'sucesso'),
  });

  const heroInputRef = useRef<HTMLDivElement>(null);
  const pastHero = useScrolledPast(heroInputRef);

  const greeting = home.view === 'me' || !nome
    ? `${greetingFor()}${nome ? `, ${nome}` : ''}`
    : `${greetingFor()}, equipe de TI`;

  const insight = (dado?: EvaInsightData) => {
    const feito = dado ? acoes.feitos[dado.id] : undefined;
    return (
      <EvaInsight
        insight={dado && feito !== undefined ? { ...dado, doneText: feito } : dado}
        accepted={feito !== undefined}
        onAccept={() => dado && acoes.aceitar(dado)}
        onAsk={chat.ask}
      />
    );
  };

  const doneCount = useMemo(() => s?.myTasks.filter((t) => t.done).length ?? 0, [s]);

  return (
    <MotionConfig reducedMotion="user">
      <EvaUIProvider showInsights animatedGlow={animatedGlow}>
        <div className="flex flex-col gap-7 pb-10 max-w-[1440px] mx-auto">
          <EvaHero
            ref={heroInputRef}
            eyebrow={`EVA · Agente de TI · ${formatTodayLabel()}`}
            greeting={greeting}
            briefing={s?.briefing ?? (home.erro ? 'Não consegui ler o board agora.' : 'Lendo o board…')}
            thinking={chat.thinking}
            listening={voice.isActive('hero')}
            transcript={voice.transcript}
            voiceNotice={!pastHero && !chat.open ? voice.notice : ''}
            onAsk={chat.ask}
            onMic={() => voice.toggle('hero')}
          />

          <EvaControls
            view={home.view}
            onViewChange={home.setView}
            integrations={integracoes}
            loading={home.loading}
            onRefresh={() => {
              void home.recarregar();
              void eva.recarregar();
            }}
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
                footer={insight(comentarios.kanban)}
              />

              <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
                <OverdueCard
                  rows={home.overdue}
                  filter={home.filter}
                  onFilterChange={home.setFilter}
                  onCharge={whatsappAtivo ? (row) => void home.cobrar(row) : undefined}
                  onOpenCard={(id) => void home.abrirCard(id)}
                  footer={insight(comentarios.overdue)}
                />
                {/* D24: a fila do WhatsApp é só para gestores. Para os demais, as atrasadas ocupam a linha. */}
                {ehGestor && (
                  <WhatsAppQueueCard
                    messages={home.fila && home.hoje ? mensagensDaFila(home.fila, home.hoje, home.view === 'me' ? home.usuarioId : null) : []}
                    ativa={whatsappAtivo}
                    footer={insight(comentarios.whatsapp)}
                  />
                )}
              </div>

              <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
                <ProjectsCard projects={s.projects} footer={insight(comentarios.projects)} />
                <MyTasksCard tasks={s.myTasks} doneCount={doneCount} onToggle={(id) => void home.toggleTask(id)} footer={insight(comentarios.myTasks)} />
              </div>
            </div>
          )}
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
          podeAprovar={podeAprovar}
          nome={nomePessoa}
          onConfirmar={(p) => void chat.confirmar(p)}
          onDescartar={chat.descartar}
          onEnviarAviso={(a, texto) => void chat.enviarAviso(a, texto)}
          onDescartarAviso={chat.descartarAviso}
          grupoDoAviso={grupoDoAviso}
          onOpenCard={abrirCitado}
          visual={visual}
          podeCobrar={ehGestor && whatsappAtivo}
          onCobrar={cobrarCitado}
          onNavegar={navegarDoChat}
        />
        <EvaToast aviso={home.aviso} onClose={home.fecharAviso} />
        <ConfirmarPropostaModal
          aberto={!!acoes.dialogo}
          titulo={acoes.dialogo?.acao.titulo ?? ''}
          propostas={acoes.dialogo?.acao.propostas ?? []}
          podeAprovar={podeAprovar}
          nome={nomePessoa}
          enviando={acoes.enviando}
          erro={acoes.erro}
          onConfirmar={() => void acoes.confirmar()}
          onFechar={acoes.fechar}
        />

        {home.cardAberto && (
          <ITTaskDrawer task={home.cardAberto} onClose={home.fecharCard} onUpdate={home.atualizarCardAberto} />
        )}
      </EvaUIProvider>
    </MotionConfig>
  );
};

export default EvaHomePage;
