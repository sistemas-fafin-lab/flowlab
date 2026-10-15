import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, MessageSquare, Sparkles, Users } from 'lucide-react';
import { IT_REQUESTS_PATH } from '../../../../utils/itRequestLink';
import { StatusBadge } from '../ui';
import type { BadgeTone } from '../../types';
import type { Sugestao } from '../../services/agenteAdmin';
import { descreverProposta, ROTULO_TIPO } from './propostas';
import MudancasProposta from './MudancasProposta';
import { BOTAO_PERIGO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, LINHA } from './estilos';

interface Props {
  s: Sugestao;
  nome: (id: string) => string;
  podeAprovar: boolean;
  ocupado: boolean;
  onAprovar: () => void;
  onEditar: () => void;
  onRejeitar: () => void;
}

const TOM_CONFIANCA: Record<Sugestao['confianca'], BadgeTone> = { alta: 'success', media: 'info', baixa: 'warning' };
const TOM_STATUS: Record<Sugestao['status'], BadgeTone> = { pendente: 'warning', aprovada: 'success', rejeitada: 'danger', substituida: 'neutral' };
const ROTULO_STATUS: Record<Sugestao['status'], string> = { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada', substituida: 'Substituída' };
const ORIGEM: Record<Sugestao['origem'], { rotulo: string; Icon: React.ComponentType<{ className?: string }> }> = {
  reuniao: { rotulo: 'Reunião', Icon: Users },
  chat: { rotulo: 'Chat', Icon: MessageSquare },
  comentario: { rotulo: 'Comentário da EVA', Icon: Sparkles },
  whatsapp: { rotulo: 'WhatsApp', Icon: Bot },
};

const SugestaoCard: React.FC<Props> = ({ s, nome, podeAprovar, ocupado, onAprovar, onEditar, onRejeitar }) => {
  const origem = ORIGEM[s.origem];
  const linhas = descreverProposta(s.tipo, s.proposta, s.card, nome);
  const pendente = s.status === 'pendente';
  const cardFinal = s.card_resultante_id ?? s.card_id;

  return (
    <div className={`${LINHA} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge tone="info">{ROTULO_TIPO[s.tipo]}</StatusBadge>
            {s.card && <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{s.card.codigo} · {s.card.title}</span>}
            {!s.card && s.tipo !== 'criar_card' && <span className="text-[13px] text-red-600 dark:text-red-400">O card não existe mais</span>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <origem.Icon className="w-3.5 h-3.5" />
            {origem.rotulo}
            {s.reuniao && <> · {s.reuniao.titulo}</>}
            {s.proposta_por && <> · proposta por {nome(s.proposta_por)}</>}
            {' · '}{new Date(s.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {s.reuniao?.provedor === 'gemini' && (
            <span title={s.reuniao.motivo_reserva ?? undefined}><StatusBadge tone="neutral">Analisada pelo Gemini</StatusBadge></span>
          )}
          <StatusBadge tone={TOM_CONFIANCA[s.confianca]}>Confiança {s.confianca === 'media' ? 'média' : s.confianca}</StatusBadge>
          <StatusBadge tone={TOM_STATUS[s.status]}>{ROTULO_STATUS[s.status]}</StatusBadge>
        </div>
      </div>

      <MudancasProposta linhas={linhas} />

      <blockquote className="pl-3 border-l-2 border-indigo-300 dark:border-indigo-600 text-xs italic text-slate-500 dark:text-slate-400 [overflow-wrap:anywhere]">
        “{s.trecho}”
      </blockquote>

      {s.avisos.length > 0 && (
        <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-5">
          {s.avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
      {s.status === 'rejeitada' && s.motivo_rejeicao && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Motivo da rejeição: {s.motivo_rejeicao}</p>
      )}
      {s.status === 'aprovada' && s.decidido_por && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Aprovada por {nome(s.decidido_por)}{s.decidido_em ? ` em ${new Date(s.decidido_em).toLocaleString('pt-BR')}` : ''} — a EVA executou.
          {cardFinal && (
            <> <Link to={`${IT_REQUESTS_PATH}?open=${cardFinal}`} className="font-semibold underline underline-offset-2">Ver card</Link></>
          )}
        </p>
      )}

      {pendente && podeAprovar && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BOTAO_PRIMARIO} onClick={onAprovar} disabled={ocupado || (!s.card && s.tipo !== 'criar_card')}>Aprovar e executar</button>
          <button type="button" className={BOTAO_SECUNDARIO} onClick={onEditar} disabled={ocupado || (!s.card && s.tipo !== 'criar_card')}>Editar</button>
          <button type="button" className={BOTAO_PERIGO} onClick={onRejeitar} disabled={ocupado}>Rejeitar</button>
        </div>
      )}
      {pendente && !podeAprovar && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Aguardando um gestor aprovar.</p>
      )}
    </div>
  );
};

export default SugestaoCard;
