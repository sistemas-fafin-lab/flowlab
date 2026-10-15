import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardPaste, DownloadCloud, ExternalLink, RefreshCw } from 'lucide-react';
import EvaAdminShell from './EvaAdminShell';
import EvaModal from './EvaModal';
import DatePicker from '../../../../components/DatePicker';
import { GlassCard, StatusBadge } from '../ui';
import { EvaToast } from '../EvaToast';
import { usePapeisEva, useReunioes } from '../../hooks/useAgenteAdmin';
import { agenteAdmin, type Reuniao } from '../../services/agenteAdmin';
import { hojeSP } from '../../domain/datas';
import type { AvisoEva } from '../../hooks/useEvaHome';
import type { BadgeTone } from '../../types';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, LINHA, ROTULO } from './estilos';

const STATUS: Record<Reuniao['status'], { rotulo: string; tom: BadgeTone }> = {
  pendente: { rotulo: 'Na fila', tom: 'neutral' },
  analisando: { rotulo: 'Analisando', tom: 'info' },
  analisada: { rotulo: 'Analisada', tom: 'success' },
  erro: { rotulo: 'Erro', tom: 'danger' },
};

const MAX_RESUMO = 60_000;

/** /it/eva/reunioes — reuniões lidas pela EVA, colar à mão e buscar no Granola (issues 09 e 10). */
const ReunioesPage: React.FC = () => {
  const { aprova: podeAprovar } = usePapeisEva();
  const { dados, erro, carregando, recarregar } = useReunioes();
  const [colando, setColando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState(hojeSP());
  const [resumo, setResumo] = useState('');
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoEva | null>(null);
  const avisar = (texto: string, tom: AvisoEva['tom']) => setAviso({ id: Date.now(), texto, tom });

  const colar = async () => {
    setTrabalhando('colar');
    try {
      // Meio-dia de Brasília: a data escolhida vira um instante sem risco de mudar de dia.
      const r = await agenteAdmin.colarReuniao(titulo.trim(), resumo.trim(), `${data}T15:00:00Z`);
      avisar(`Reunião lida: ${r.sugestoes.length} ${r.sugestoes.length === 1 ? 'sugestão' : 'sugestões'} para aprovar.`, 'sucesso');
      setColando(false);
      setTitulo('');
      setResumo('');
      await recarregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'A EVA não conseguiu ler a reunião.', 'erro');
    } finally {
      setTrabalhando(null);
    }
  };

  const buscar = async () => {
    setTrabalhando('buscar');
    try {
      const r = await agenteAdmin.buscarAgora();
      const partes = [`${r.novas} ${r.novas === 1 ? 'nova' : 'novas'}`, `${r.atualizadas} ${r.atualizadas === 1 ? 'atualizada' : 'atualizadas'}`];
      if (r.analisadas.length) partes.push(`${r.analisadas.length} analisada${r.analisadas.length > 1 ? 's' : ''}`);
      if (r.pendentesRestantes) partes.push(`${r.pendentesRestantes} ainda na fila`);
      avisar(`Granola: ${partes.join(', ')}.`, 'sucesso');
      await recarregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui falar com o Granola.', 'erro');
    } finally {
      setTrabalhando(null);
    }
  };

  const reanalisar = async (r: Reuniao) => {
    setTrabalhando(r.id);
    try {
      const res = await agenteAdmin.reanalisar(r.id);
      avisar(`Reanalisada: ${res.sugestoes.length} sugestões (as pendentes antigas foram substituídas).`, 'sucesso');
      await recarregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui reanalisar.', 'erro');
    } finally {
      setTrabalhando(null);
    }
  };

  const lista = dados ?? [];

  return (
    <EvaAdminShell
      subtitulo="Reuniões que a EVA leu"
      acoes={
        <>
          <button type="button" className={BOTAO_SECUNDARIO} onClick={() => void buscar()} disabled={trabalhando !== null}>
            <DownloadCloud className={`w-4 h-4 ${trabalhando === 'buscar' ? 'animate-pulse' : ''}`} />
            {trabalhando === 'buscar' ? 'Buscando…' : 'Buscar reuniões agora'}
          </button>
          <button type="button" className={BOTAO_PRIMARIO} onClick={() => setColando(true)} disabled={trabalhando !== null}>
            <ClipboardPaste className="w-4 h-4" /> Colar reunião
          </button>
        </>
      }
    >
      <GlassCard className="gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A EVA busca as reuniões da pasta do Granola uma vez por dia útil. As sugestões de cada uma vão para a fila de aprovação.
          </p>
          <button type="button" onClick={() => void recarregar()} aria-label="Atualizar" className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {erro && <p className="text-sm text-red-600 dark:text-red-400">Não consegui carregar as reuniões: {erro}</p>}
        {!erro && !carregando && lista.length === 0 && (
          <div className="py-10 text-center">
            <CalendarClock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nenhuma reunião ainda. Busque no Granola ou cole um resumo.</p>
          </div>
        )}
        {lista.map((r) => {
          const st = STATUS[r.status];
          const nSugestoes = r.sugestoes?.[0]?.count ?? 0;
          const desatualizada = !!(r.fonte_atualizada_em && r.analisada_em && r.fonte_atualizada_em > r.analisada_em);
          return (
            <div key={r.id} className={`${LINHA} flex flex-wrap items-start justify-between gap-3`}>
              <div className="min-w-0 flex-[1_1_320px]">
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{r.titulo}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {r.origem === 'granola' ? 'Granola' : 'Colada à mão'}
                  {r.realizada_em && <> · {new Date(r.realizada_em).toLocaleDateString('pt-BR')}</>}
                  {r.status === 'analisada' && <> · <Link to="/it/eva" className="text-blue-600 dark:text-blue-400 hover:underline">{nSugestoes} {nSugestoes === 1 ? 'sugestão' : 'sugestões'}</Link></>}
                </p>
                {r.observacoes && <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 [text-wrap:pretty]">{r.observacoes}</p>}
                {r.status === 'erro' && r.erro && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 [overflow-wrap:anywhere]">{r.erro}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {desatualizada && <StatusBadge tone="warning">Atualizada desde a análise</StatusBadge>}
                {r.provedor === 'gemini' && <span title={r.motivo_reserva ?? undefined}><StatusBadge tone="neutral">Analisada pelo Gemini</StatusBadge></span>}
                <StatusBadge tone={st.tom}>{st.rotulo}</StatusBadge>
                {r.web_url && (
                  <a href={r.web_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Abrir no Granola">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {podeAprovar && (r.status === 'analisada' || r.status === 'erro') && (
                  <button type="button" className={BOTAO_SECUNDARIO} onClick={() => void reanalisar(r)} disabled={trabalhando !== null}>
                    {trabalhando === r.id ? 'Reanalisando…' : 'Reanalisar'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </GlassCard>

      <EvaModal
        aberto={colando}
        titulo="Colar reunião"
        subtitulo="A EVA lê o resumo e propõe cards, mudanças e comentários. Nada muda no Kanban sem aprovação."
        onFechar={() => trabalhando === null && setColando(false)}
        largura="max-w-2xl"
        rodape={
          <>
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setColando(false)} disabled={trabalhando !== null}>Cancelar</button>
            <button
              type="button"
              className={BOTAO_PRIMARIO}
              onClick={() => void colar()}
              disabled={trabalhando !== null || !titulo.trim() || !resumo.trim() || resumo.length > MAX_RESUMO}
            >
              {trabalhando === 'colar' ? 'A EVA está lendo a reunião…' : 'Enviar para a EVA'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <div>
              <label className={ROTULO} htmlFor="eva-reuniao-titulo">Título</label>
              <input id="eva-reuniao-titulo" className={CAMPO} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Sprint review 13/10" />
            </div>
            <div>
              <span className={ROTULO}>Data da reunião</span>
              <DatePicker tone="vidro" value={data} onChange={(v) => setData(v || hojeSP())} controlClass={CAMPO} ariaLabel="Data da reunião" />
            </div>
          </div>
          <div>
            <label className={ROTULO} htmlFor="eva-reuniao-resumo">Resumo (texto ou markdown)</label>
            <textarea id="eva-reuniao-resumo" rows={12} className={`${CAMPO} font-mono text-xs`} value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="Cole aqui o resumo da reunião" />
            <p className={`mt-1 text-[11px] ${resumo.length > MAX_RESUMO ? 'text-red-600' : 'text-slate-400'}`}>
              {resumo.length.toLocaleString('pt-BR')} de {MAX_RESUMO.toLocaleString('pt-BR')} caracteres
            </p>
          </div>
          {trabalhando === 'colar' && <p className="text-xs text-slate-500 dark:text-slate-400">Isso leva de alguns segundos a dois minutos.</p>}
        </div>
      </EvaModal>

      <EvaToast aviso={aviso} onClose={() => setAviso(null)} />
    </EvaAdminShell>
  );
};

export default ReunioesPage;
