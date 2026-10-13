import React, { useState } from 'react';
import { CheckCheck, ClipboardCheck, RefreshCw } from 'lucide-react';
import EvaAdminShell from './EvaAdminShell';
import SugestaoCard from './SugestaoCard';
import EditarPropostaModal from './EditarPropostaModal';
import EvaModal from './EvaModal';
import { GlassCard, Segmented } from '../ui';
import { EvaToast } from '../EvaToast';
import { useEhGestor, usePessoas, useProjetosESprints, useResponsaveis, useSugestoes } from '../../hooks/useAgenteAdmin';
import { agenteAdmin, type StatusSugestao, type Sugestao } from '../../services/agenteAdmin';
import type { AvisoEva } from '../../hooks/useEvaHome';
import { BOTAO_PERIGO, BOTAO_SECUNDARIO, CAMPO, ROTULO } from './estilos';

type Filtro = StatusSugestao | 'todas';

/** /it/eva — fila de sugestões (issue 11). Gestor aprova (a EVA executa), edita ou rejeita. */
const SugestoesPage: React.FC = () => {
  const ehGestor = useEhGestor();
  const pessoas = usePessoas();
  const responsaveis = useResponsaveis();
  const estrutura = useProjetosESprints();
  const [filtro, setFiltro] = useState<Filtro>('pendente');
  const { dados, erro, carregando, recarregar } = useSugestoes(filtro);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<Sugestao | null>(null);
  const [rejeitando, setRejeitando] = useState<Sugestao | null>(null);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState<AvisoEva | null>(null);

  const avisar = (texto: string, tom: AvisoEva['tom']) => setAviso({ id: Date.now(), texto, tom });

  const executar = async (s: Sugestao, acao: () => Promise<unknown>, ok: string) => {
    setOcupado(s.id);
    try {
      await acao();
      avisar(ok, 'sucesso');
      setEditando(null);
      setRejeitando(null);
      setMotivo('');
      await recarregar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não deu certo.', 'erro');
    } finally {
      setOcupado(null);
    }
  };

  const aprovarAltas = async () => {
    const altas = (dados ?? []).filter((s) => s.status === 'pendente' && s.confianca === 'alta' && (s.card || s.tipo === 'criar_card'));
    let feitas = 0;
    setOcupado('lote');
    for (const s of altas) {
      try { await agenteAdmin.aprovar(s.id); feitas += 1; } catch { /* segue com as outras; a que falhou continua pendente */ }
    }
    setOcupado(null);
    avisar(`${feitas} de ${altas.length} sugestões de confiança alta aprovadas e executadas.`, feitas === altas.length ? 'sucesso' : 'erro');
    await recarregar();
  };

  const lista = dados ?? [];
  const altasPendentes = lista.filter((s) => s.status === 'pendente' && s.confianca === 'alta').length;

  return (
    <EvaAdminShell
      subtitulo="O que a EVA propõe e espera aprovação"
      acoes={
        <button type="button" className={BOTAO_SECUNDARIO} onClick={() => void recarregar()} disabled={carregando}>
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      }
    >
      <GlassCard className="gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Segmented<Filtro>
            size="sm"
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: 'pendente', label: 'Pendentes' },
              { value: 'aprovada', label: 'Aprovadas' },
              { value: 'rejeitada', label: 'Rejeitadas' },
              { value: 'todas', label: 'Todas' },
            ]}
          />
          {ehGestor && filtro === 'pendente' && altasPendentes > 0 && (
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => void aprovarAltas()} disabled={ocupado !== null}>
              <CheckCheck className="w-4 h-4" /> Aprovar as {altasPendentes} de confiança alta
            </button>
          )}
        </div>

        {erro && <p className="text-sm text-red-600 dark:text-red-400">Não consegui carregar as sugestões: {erro}</p>}
        {!erro && !carregando && lista.length === 0 && (
          <div className="py-10 text-center">
            <ClipboardCheck className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {filtro === 'pendente' ? 'Nenhuma sugestão esperando aprovação.' : 'Nada por aqui.'}
            </p>
          </div>
        )}
        <div className={`flex flex-col gap-3 transition-opacity ${carregando && dados ? 'opacity-60' : ''}`}>
          {lista.map((s) => (
            <SugestaoCard
              key={s.id}
              s={s}
              nome={pessoas.nome}
              ehGestor={ehGestor}
              ocupado={ocupado !== null}
              onAprovar={() => void executar(s, () => agenteAdmin.aprovar(s.id), 'Aprovada. A EVA executou a mudança.')}
              onEditar={() => setEditando(s)}
              onRejeitar={() => { setRejeitando(s); setMotivo(''); }}
            />
          ))}
        </div>
      </GlassCard>

      {editando && (
        <EditarPropostaModal
          aberto
          tipo={editando.tipo}
          proposta={editando.proposta}
          pessoas={responsaveis}
          projetos={estrutura.dados?.projetos}
          sprints={estrutura.dados?.sprints}
          salvando={ocupado === editando.id}
          onCancelar={() => setEditando(null)}
          onAprovar={(p) => void executar(editando, () => agenteAdmin.aprovar(editando.id, p), 'Aprovada com ajustes. A EVA executou.')}
        />
      )}

      <EvaModal
        aberto={!!rejeitando}
        titulo="Rejeitar sugestão"
        subtitulo="O motivo fica registrado e ajuda a calibrar a EVA."
        onFechar={() => setRejeitando(null)}
        rodape={
          <>
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setRejeitando(null)}>Cancelar</button>
            <button
              type="button"
              className={BOTAO_PERIGO}
              disabled={!motivo.trim() || ocupado !== null}
              onClick={() => rejeitando && void executar(rejeitando, () => agenteAdmin.rejeitar(rejeitando.id, motivo), 'Sugestão rejeitada.')}
            >
              Rejeitar
            </button>
          </>
        }
      >
        <label className={ROTULO} htmlFor="eva-motivo">Motivo</label>
        <textarea id="eva-motivo" rows={3} className={CAMPO} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: já existe um card para isso (IT-050)" />
      </EvaModal>

      <EvaToast aviso={aviso} onClose={() => setAviso(null)} />
    </EvaAdminShell>
  );
};

export default SugestoesPage;
