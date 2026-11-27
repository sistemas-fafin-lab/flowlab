import React, { useEffect, useMemo, useState } from 'react';
import { Bot, CalendarClock, MessageCircle } from 'lucide-react';
import EvaAdminShell from './EvaAdminShell';
import Switch from '../../../../components/Switch';
import Select from '../../../../components/Select';
import { GlassCard, SectionHeader, StatusBadge } from '../ui';
import { EvaToast } from '../EvaToast';
import { useConfigEva, useSituacaoEva, useUsoIA } from '../../hooks/useAgenteAdmin';
import { agenteAdmin } from '../../services/agenteAdmin';
import type { AvisoEva } from '../../hooks/useEvaHome';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, LINHA, ROTULO } from './estilos';
import GrupoEquipeCard from './GrupoEquipeCard';

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca');
const FINALIDADE: Record<string, string> = {
  analise_reuniao: 'Reuniões',
  chat: 'Chat',
  resposta_whatsapp: 'WhatsApp',
  analise_chamado: 'Chamados do LAB-BRAIN',
  transcricao_audio: 'Áudios do WhatsApp',
  rascunho_resolucao: 'Rascunhos de resolução',
};

/** D48: a reunião da equipe, de segunda a sexta, das 8h às 18h (a pauta sai 1 h antes). */
const DIAS_REUNIAO = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].map((label, i) => ({ value: String(i + 1), label }));
const HORAS_REUNIAO = Array.from({ length: 21 }, (_, i) => {
  const minutos = 8 * 60 + i * 30;
  const hora = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
  return { value: hora, label: hora };
});

/** /it/eva/configuracoes — liga/desliga, pasta do Granola e a saúde das integrações (issue 07). */
const ConfiguracoesPage: React.FC = () => {
  const config = useConfigEva();
  const uso = useUsoIA();
  const situacao = useSituacaoEva();
  const [pasta, setPasta] = useState('');
  const [diasParado, setDiasParado] = useState(5);
  const [reuniaoDia, setReuniaoDia] = useState(1);
  const [reuniaoHora, setReuniaoHora] = useState('10:00');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<AvisoEva | null>(null);

  useEffect(() => {
    if (config.dados) {
      setPasta(config.dados.granola_folder_id ?? '');
      setDiasParado(config.dados.dias_parado);
      setReuniaoDia(config.dados.reuniao_dia ?? 1);
      setReuniaoHora(config.dados.reuniao_hora ?? '10:00');
    }
  }, [config.dados]);

  const salvar = async (mudanca: Parameters<typeof agenteAdmin.salvarConfig>[0], ok: string) => {
    setSalvando(true);
    try {
      await agenteAdmin.salvarConfig(mudanca);
      setAviso({ id: Date.now(), texto: ok, tom: 'sucesso' });
      await config.recarregar();
    } catch (e) {
      setAviso({ id: Date.now(), texto: e instanceof Error ? e.message : 'Não consegui salvar.', tom: 'erro' });
    } finally {
      setSalvando(false);
    }
  };

  // RN14: uso da semana por provedor e finalidade; reservas; último erro do Claude.
  const resumo = useMemo(() => {
    const linhas = uso.dados ?? [];
    const porGrupo = new Map<string, { chamadas: number; entrada: number; saida: number }>();
    for (const l of linhas) {
      const chave = `${l.provedor}|${l.finalidade}`;
      const g = porGrupo.get(chave) ?? { chamadas: 0, entrada: 0, saida: 0 };
      g.chamadas += 1;
      g.entrada += l.tokens_entrada ?? 0;
      g.saida += l.tokens_saida ?? 0;
      porGrupo.set(chave, g);
    }
    const reservas = linhas.filter((l) => l.provedor === 'gemini' && l.resultado === 'ok').length;
    const ultimoErroClaude = linhas.find((l) => l.provedor === 'claude' && l.resultado !== 'ok') ?? null;
    return { grupos: [...porGrupo.entries()], reservas, ultimoErroClaude };
  }, [uso.dados]);

  const c = config.dados;
  const wahaRecente = c?.waha_verificado_em && Date.now() - new Date(c.waha_verificado_em).getTime() < 5 * 60_000;

  return (
    <EvaAdminShell subtitulo="Como a EVA funciona">
      {config.erro && <GlassCard><p className="text-sm text-red-600 dark:text-red-400">Não consegui carregar a configuração: {config.erro}</p></GlassCard>}

      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
        <GlassCard className="gap-4">
          <SectionHeader icon={CalendarClock} tone="from-indigo-500 to-violet-600 shadow-indigo-500/25" title="Reuniões" subtitle="Granola e acompanhamento do Kanban" />
          <div>
            <label className={ROTULO} htmlFor="eva-pasta">Pasta do Granola (id)</label>
            <input id="eva-pasta" className={CAMPO} value={pasta} onChange={(e) => setPasta(e.target.value)} placeholder="fol_…" />
            <p className="mt-1 text-[11px] text-slate-400">Última sincronização: {quando(c?.granola_verificado_em ?? null)}</p>
            {c?.granola_ultimo_erro && (
              <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-400 [overflow-wrap:anywhere]">Erro na última sincronização: {c.granola_ultimo_erro}</p>
            )}
            <p className="mt-0.5 text-[11px] text-slate-400 [overflow-wrap:anywhere]">
              Última análise com erro:{' '}
              {situacao.dados?.ultimoErroAnalise
                ? `${situacao.dados.ultimoErroAnalise.titulo} · ${quando(situacao.dados.ultimoErroAnalise.created_at)}${situacao.dados.ultimoErroAnalise.erro ? ` · ${situacao.dados.ultimoErroAnalise.erro}` : ''}`
                : 'nenhuma'}
            </p>
          </div>
          <div>
            <label className={ROTULO} htmlFor="eva-parado">Dias sem mudança para um card contar como parado</label>
            <input id="eva-parado" type="number" min={1} max={60} className={CAMPO} value={diasParado} onChange={(e) => setDiasParado(Number(e.target.value))} />
          </div>
          <div>
            <button
              type="button"
              className={BOTAO_PRIMARIO}
              disabled={salvando || !c || diasParado < 1 || diasParado > 60}
              onClick={() => void salvar({ granola_folder_id: pasta.trim() || null, dias_parado: diasParado }, 'Configuração salva.')}
            >
              Salvar
            </button>
          </div>
          <div className={`${LINHA} flex flex-col gap-3`}>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span>
                <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">Pauta da reunião da equipe</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Uma hora antes, a EVA manda a pauta no WhatsApp dos gestores que recebem o relatório de gestão: o que a última reunião combinou e não andou, os atrasados, os bloqueios do check-in e a carga de cada um.
                </span>
              </span>
              <Switch
                checked={!!c?.pauta_ativa}
                disabled={salvando || !c}
                onChange={(v) => void salvar({ pauta_ativa: v }, `Pauta da reunião ${v ? 'ligada' : 'desligada'}.`)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={ROTULO} htmlFor="eva-reuniao-dia">Dia da reunião</label>
                <Select id="eva-reuniao-dia" value={String(reuniaoDia)} onChange={(v) => setReuniaoDia(Number(v))} options={DIAS_REUNIAO} controlClass={CAMPO} disabled={salvando || !c} />
              </div>
              <div>
                <label className={ROTULO} htmlFor="eva-reuniao-hora">Hora</label>
                <Select id="eva-reuniao-hora" value={reuniaoHora} onChange={setReuniaoHora} options={HORAS_REUNIAO} controlClass={CAMPO} disabled={salvando || !c} />
              </div>
            </div>
            <div>
              <button
                type="button"
                className={BOTAO_SECUNDARIO}
                disabled={salvando || !c || (reuniaoDia === c.reuniao_dia && reuniaoHora === c.reuniao_hora)}
                onClick={() => void salvar({ reuniao_dia: reuniaoDia, reuniao_hora: reuniaoHora }, 'Dia e hora da reunião salvos.')}
              >
                Salvar dia e hora
              </button>
            </div>
            <p className="text-[11px] text-slate-400">A qualquer hora, também dá para pedir "pauta da reunião" no chat do Início ou pelo WhatsApp.</p>
          </div>
        </GlassCard>

        <GlassCard className="gap-4">
          <SectionHeader icon={MessageCircle} tone="from-emerald-500 to-green-600 shadow-emerald-500/25" title="WhatsApp" subtitle="Envio pela fila e pelo WAHA da VPS" />
          <div className={`${LINHA} flex items-center justify-between gap-3`}>
            <div>
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Sessão do WAHA</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Último aviso da VPS: {quando(c?.waha_verificado_em ?? null)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Última mensagem enviada: {quando(situacao.dados?.ultimaMensagem?.enviada_em ?? null)}</p>
            </div>
            {!c?.waha_verificado_em ? (
              <StatusBadge tone="neutral">Ainda não configurado</StatusBadge>
            ) : wahaRecente && c.waha_status === 'WORKING' ? (
              <StatusBadge tone="success">Conectado</StatusBadge>
            ) : (
              <StatusBadge tone="danger">{wahaRecente ? c.waha_status ?? 'Desconhecido' : 'Sem sinal'}</StatusBadge>
            )}
          </div>
          {[
            { campo: 'whatsapp_ativo' as const, titulo: 'Envio de WhatsApp', texto: 'Liga/desliga geral. Desligado, nada sai da fila.' },
            { campo: 'cobranca_ativa' as const, titulo: 'Cobrança diária', texto: 'Mensagem da manhã com as pendências de cada pessoa.' },
            {
              campo: 'checkin_ativo' as const,
              titulo: 'Check-in diário',
              texto: 'Às 9h, a EVA pergunta a cada membro com WhatsApp o que entra no dia e se há bloqueio. Às 10h, os gestores que recebem o relatório de gestão ganham o resumo.',
            },
          ].map((t) => (
            <label key={t.campo} className={`${LINHA} flex items-center justify-between gap-3 cursor-pointer`}>
              <span>
                <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">{t.titulo}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{t.texto}</span>
              </span>
              <Switch
                checked={!!c?.[t.campo]}
                disabled={salvando || !c}
                onChange={(v) => void salvar({ [t.campo]: v }, `${t.titulo} ${v ? 'ligado' : 'desligado'}.`)}
              />
            </label>
          ))}
          <div className={`${LINHA} text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-0.5`}>
            <p>Última cobrança diária: {quando(situacao.dados?.ultimaCobranca ?? null)}</p>
            <p>
              Últimos 7 dias: {situacao.dados?.semana.enviadas ?? 0} enviadas · {situacao.dados?.semana.falhas ?? 0} falharam
              {situacao.dados?.semana.pendentes ? ` · ${situacao.dados.semana.pendentes} na fila` : ''}
            </p>
          </div>
          <p className="text-[11px] text-slate-400">
            As mensagens saem pelo script da VPS (tools/agente-ti-whatsapp), a cada minuto. Cobranças, lembretes e mensagens do grupo só saem em dia útil,
            das 7h às 20h; fora disso, esperam a próxima janela. A cobrança diária é montada às 08h, nos dias úteis.
          </p>
        </GlassCard>

        <GrupoEquipeCard config={c ?? null} salvando={salvando} salvar={salvar} recarregar={config.recarregar} avisar={setAviso} />
      </div>

      <GlassCard className="gap-4">
        <SectionHeader icon={Bot} tone="from-blue-500 to-violet-600 shadow-blue-500/25" title="Inteligência artificial" subtitle="Últimos 7 dias · Claude Sonnet 5.5, com o Gemini 3.8 Flash de reserva" />
        {uso.erro && <p className="text-sm text-red-600 dark:text-red-400">Não consegui carregar o uso: {uso.erro}</p>}
        {resumo.ultimoErroClaude && (
          <div className={`${LINHA} ${resumo.ultimoErroClaude.resultado === 'configuracao' ? 'border border-red-500/30' : ''}`}>
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              Último erro do Claude {resumo.ultimoErroClaude.resultado === 'configuracao' && <StatusBadge tone="danger">Configuração</StatusBadge>}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 [overflow-wrap:anywhere]">
              {quando(resumo.ultimoErroClaude.created_at)} · {resumo.ultimoErroClaude.erro ?? resumo.ultimoErroClaude.resultado}
            </p>
            {resumo.ultimoErroClaude.resultado === 'configuracao' && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">Confira CLAUDE_API_KEY e CLAUDE_WORKSPACE_ID na Vercel.</p>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">O Gemini assumiu {resumo.reservas} {resumo.reservas === 1 ? 'vez' : 'vezes'} na semana.</p>
        {resumo.grupos.length === 0 && !uso.carregando && <p className="text-sm text-slate-400">Nenhuma chamada de IA na semana.</p>}
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {resumo.grupos.map(([chave, g]) => {
            const [provedor, finalidade] = chave.split('|');
            return (
              <div key={chave} className={LINHA}>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{provedor === 'claude' ? 'Claude' : 'Gemini'} · {FINALIDADE[finalidade] ?? finalidade}</p>
                <p className="mt-1 text-[22px] font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">{g.chamadas}</p>
                <p className="mt-1 text-[11px] text-slate-400 tabular-nums">{g.entrada.toLocaleString('pt-BR')} tokens de entrada · {g.saida.toLocaleString('pt-BR')} de saída</p>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <EvaToast aviso={aviso} onClose={() => setAviso(null)} />
    </EvaAdminShell>
  );
};

export default ConfiguracoesPage;
