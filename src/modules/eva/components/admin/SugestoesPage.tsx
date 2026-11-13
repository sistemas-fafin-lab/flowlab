import React, { useState } from 'react';
import { CheckCheck, ClipboardCheck, RefreshCw, Send } from 'lucide-react';
import EvaAdminShell from './EvaAdminShell';
import SugestaoCard from './SugestaoCard';
import EditarPropostaModal from './EditarPropostaModal';
import EvaModal from './EvaModal';
import { GlassCard, Segmented } from '../ui';
import { EvaToast } from '../EvaToast';
import { usePapeisEva, usePessoas, useProjetosESprints, useResponsaveis, useSugestoes } from '../../hooks/useAgenteAdmin';
import { agenteAdmin, type StatusSugestao, type Sugestao } from '../../services/agenteAdmin';
import type { AvisoEva } from '../../hooks/useEvaHome';
import { BOTAO_PERIGO, BOTAO_SECUNDARIO, CAMPO, ROTULO } from './estilos';

type Filtro = StatusSugestao | 'todas';

interface TextosRejeicao { titulo: string; subtitulo: string; rotulo: string; aviso: string | null; exemplo: string; botao: string }

const TEXTOS_REJEITAR: TextosRejeicao = {
  titulo: 'Rejeitar sugestão',
  subtitulo: 'O motivo fica registrado e ajuda a calibrar a EVA.',
  rotulo: 'Motivo',
  aviso: null,
  exemplo: 'Ex.: já existe um card para isso (IT-050)',
  botao: 'Rejeitar',
};

/** Rejeitar promover_card cancela o chamado do LAB-BRAIN (se ainda aberto), e o motivo vai para quem pediu. */
function textosRejeitarChamado(s: Sugestao): TextosRejeicao {
  return {
    titulo: 'Rejeitar chamado do LAB-BRAIN',
    subtitulo: `O chamado ${s.card?.codigo ?? 'do LAB-BRAIN'} é cancelado, se ainda estiver aberto.`,
    rotulo: 'Motivo para o solicitante',
    aviso: 'Este texto vai para o solicitante pelo LAB-BRAIN. Escreva como explicaria a ele por que o pedido não seguiu.',
    exemplo: 'Ex.: esse acesso é liberado pelo RH. Peça por lá.',
    botao: 'Rejeitar e cancelar',
  };
}

/** /it/eva — fila de sugestões (issue 11). Gestor aprova (a EVA executa), edita ou rejeita. */
const SugestoesPage: React.FC = () => {
  const { aprova: podeAprovar } = usePapeisEva();
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

  const textosRejeicao = rejeitando?.tipo === 'promover_card' ? textosRejeitarChamado(rejeitando) : TEXTOS_REJEITAR;

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
          {podeAprovar && filtro === 'pendente' && altasPendentes > 0 && (
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
              podeAprovar={podeAprovar}
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
        titulo={textosRejeicao.titulo}
        subtitulo={textosRejeicao.subtitulo}
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
              {textosRejeicao.botao}
            </button>
          </>
        }
      >
        <label className={ROTULO} htmlFor="eva-motivo">{textosRejeicao.rotulo}</label>
        {textosRejeicao.aviso && (
          <p id="eva-motivo-aviso" className="mb-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <Send className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
            {textosRejeicao.aviso}
          </p>
        )}
        <textarea
          id="eva-motivo"
          rows={3}
          className={CAMPO}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          aria-describedby={textosRejeicao.aviso ? 'eva-motivo-aviso' : undefined}
          placeholder={textosRejeicao.exemplo}
        />
      </EvaModal>

      <EvaToast aviso={aviso} onClose={() => setAviso(null)} />
    </EvaAdminShell>
  );
};

export default SugestoesPage;
