import React from 'react';
import EvaModal from './admin/EvaModal';
import MudancasProposta from './admin/MudancasProposta';
import { descreverProposta } from './admin/propostas';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, LINHA } from './admin/estilos';
import type { PropostaDeComentario } from '../types';

interface Props {
  aberto: boolean;
  titulo: string;
  propostas: PropostaDeComentario[];
  podeAprovar: boolean;
  nome: (id: string) => string;
  enviando: boolean;
  erro: string | null;
  onConfirmar: () => void;
  onFechar: () => void;
}

/**
 * Diálogo de confirmação das ações da EVA (D28): cada card com antes → depois. O gestor
 * aprova e a EVA executa na hora; os demais mandam a proposta para a fila de aprovação.
 */
export const ConfirmarPropostaModal: React.FC<Props> = ({ aberto, titulo, propostas, podeAprovar, nome, enviando, erro, onConfirmar, onFechar }) => (
  <EvaModal
    aberto={aberto}
    titulo={titulo}
    subtitulo={podeAprovar ? 'Nada mudou ainda. Ao aprovar, a EVA aplica no board.' : 'Nada mudou ainda. Quem aprova sugestões revisa antes de a EVA aplicar.'}
    onFechar={enviando ? () => undefined : onFechar}
    rodape={
      <>
        <button type="button" className={BOTAO_SECUNDARIO} onClick={onFechar} disabled={enviando}>Cancelar</button>
        <button type="button" className={BOTAO_PRIMARIO} onClick={onConfirmar} disabled={enviando || propostas.length === 0}>
          {enviando ? 'Enviando…' : podeAprovar ? 'Aprovar e executar' : 'Enviar para aprovação'}
        </button>
      </>
    }
  >
    <div className="flex flex-col gap-3">
      {propostas.map((p) => (
        <div key={p.card_id} className={`${LINHA} flex flex-col gap-2`}>
          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{p.card.codigo} · {p.card.title}</p>
          <MudancasProposta linhas={descreverProposta(p.tipo, p.proposta, p.card, nome)} />
        </div>
      ))}
      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
    </div>
  </EvaModal>
);
