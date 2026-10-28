import React, { useState } from 'react';
import { Check } from 'lucide-react';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { desmarcarEnvio } from '../hooks/useCalendarioEnvios';
import type { FeriadoEnvio } from '../types';
import { formatData, formatDataHora } from '../utils/formato';
import { nomeConvenio, type ItemAgendado } from '../utils/painelEnvios';
import { ESTILO_STATUS } from './estiloStatusEnvio';
import SeloConfirmadoAplis from './SeloConfirmadoAplis';
import SeloForaDaJanela from './SeloForaDaJanela';

// Painel de um dia (Hoje ou Amanhã) do Calendário de envios e a confirmação de
// desmarcar o envio. Usados pela página do Calendário e, compactos, no topo do
// Dashboard de Contas a Receber. Quem tem canManageCalendarioEnvios (gate no pai)
// marca e desmarca pela caixa; o nome do convênio abre o detalhe.

const CARD = 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700';
const NOME_DIA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' });

/** O que o painel pede ao pai: abrir o detalhe, marcar ou desmarcar. */
export type AcaoPainel = { tipo: 'detalhe' | 'marcar' | 'desmarcar'; item: ItemAgendado };

const LinhaPainel: React.FC<{
  item: ItemAgendado;
  podeGerenciar: boolean;
  compacto: boolean;
  onAcao: (acao: AcaoPainel) => void;
}> = ({ item, podeGerenciar, compacto, onAcao }) => {
  const { agendamento, regra } = item;
  const enviado = agendamento.dataEnvio !== null;
  const estilo = ESTILO_STATUS[agendamento.status];
  // Pendente e enviado já se leem pela caixa; o atraso ganha a pílula.
  const atraso = agendamento.status === 'atrasado' || agendamento.status === 'fora_do_prazo';
  return (
    <li className={`flex items-start gap-3 ${compacto ? 'py-1.5' : 'py-2.5'}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={enviado}
        aria-label={enviado ? `Desmarcar ${nomeConvenio(item)}` : `Marcar ${nomeConvenio(item)} como enviado`}
        disabled={!podeGerenciar}
        onClick={() => onAcao({ tipo: enviado ? 'desmarcar' : 'marcar', item })}
        className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center ${
          enviado
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400'
        } ${podeGerenciar ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {enviado && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>
      <div className="min-w-0">
        <span className={`inline-block w-2.5 h-2.5 mr-1.5 rounded-sm align-middle ${estilo.amostra}`} title={estilo.nome} aria-hidden="true" />
        <button
          type="button"
          onClick={() => onAcao({ tipo: 'detalhe', item })}
          className={`text-sm font-medium text-left hover:underline ${enviado ? 'text-gray-500 dark:text-gray-400 line-through decoration-gray-400/60' : 'text-gray-900 dark:text-gray-100'}`}
        >
          {nomeConvenio(item)}
        </button>
        {(atraso || agendamento.foraDaJanela || agendamento.loteAplisConfirmado !== null) && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {atraso && <span className={`px-1.5 py-px text-[10px] font-semibold rounded-full ${estilo.pilula}`}>{estilo.nome}</span>}
            {agendamento.loteAplisConfirmado !== null && <SeloConfirmadoAplis lote={agendamento.loteAplisConfirmado} />}
            {agendamento.foraDaJanela && <SeloForaDaJanela />}
          </div>
        )}
        {!compacto && regra?.observacao && <p className="text-xs text-gray-500 dark:text-gray-400">{regra.observacao}</p>}
        {enviado && (
          <p className="text-xs text-green-700 dark:text-green-400">
            Enviado em {formatData(agendamento.dataEnvio)}
            {!compacto && agendamento.marcadoPorNome && <> · marcado por {agendamento.marcadoPorNome}</>}
            {!compacto && agendamento.marcadoEm && <> em {formatDataHora(agendamento.marcadoEm)}</>}
          </p>
        )}
      </div>
    </li>
  );
};

/** Compacto (Dashboard de Contas a Receber): menos espaço, sem observação e sem quem marcou (ficam no detalhe). */
export const PainelDia: React.FC<{
  titulo: string;
  data: string;
  itens: ItemAgendado[];
  feriado: FeriadoEnvio | undefined;
  podeGerenciar: boolean;
  compacto?: boolean;
  onAcao: (acao: AcaoPainel) => void;
}> = ({ titulo, data, itens, feriado, podeGerenciar, compacto = false, onAcao }) => {
  const enviados = itens.filter((i) => i.agendamento.dataEnvio !== null).length;
  const semana = new Date(`${data}T00:00:00Z`).getUTCDay();
  const naoUtil = feriado ? `Feriado: ${feriado.descricao}` : semana === 0 || semana === 6 ? 'Fim de semana' : null;
  return (
    <section className={`${CARD} ${compacto ? 'p-4' : 'p-5'}`} aria-label={titulo}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`${compacto ? 'text-base' : 'text-lg'} font-semibold text-gray-800 dark:text-gray-100`}>{titulo}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{NOME_DIA.format(new Date(`${data}T00:00:00Z`))}</p>
        </div>
        {itens.length > 0 && (
          <span
            className={`px-2.5 py-1 text-xs font-medium rounded-full ${
              enviados === itens.length
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
            }`}
          >
            {enviados}/{itens.length} enviados
          </span>
        )}
      </div>
      {naoUtil && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{naoUtil}</p>}
      {itens.length === 0 ? (
        <p className={`${compacto ? 'mt-3' : 'mt-4'} text-sm text-gray-400 dark:text-gray-500`}>Nenhum convênio agendado.</p>
      ) : (
        <ul className={`mt-2 divide-y divide-gray-100 dark:divide-gray-700 ${compacto ? 'max-h-60 overflow-y-auto -mr-2 pr-2' : ''}`}>
          {itens.map((item) => (
            <LinhaPainel key={item.agendamento.id} item={item} podeGerenciar={podeGerenciar} compacto={compacto} onAcao={onAcao} />
          ))}
        </ul>
      )}
    </section>
  );
};

/** Confirma e desmarca o envio de `item` (aberto enquanto `item` não é nulo). */
export const DesmarcarEnvioDialog: React.FC<{
  item: ItemAgendado | null;
  onFechar: () => void;
  onDesmarcado: () => void;
  onErro: (mensagem: string) => void;
}> = ({ item, onFechar, onDesmarcado, onErro }) => {
  const [desmarcando, setDesmarcando] = useState(false);

  const confirmar = async (alvo: ItemAgendado) => {
    setDesmarcando(true);
    try {
      await desmarcarEnvio(alvo.agendamento.id);
      onDesmarcado();
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Não foi possível desmarcar o envio.');
      onFechar();
    } finally {
      setDesmarcando(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={item !== null}
      title="Desmarcar envio"
      message={
        item && (
          <>
            {nomeConvenio(item)} volta a ficar pendente. A marcação de {formatData(item.agendamento.dataEnvio)} fica no histórico.
          </>
        )
      }
      confirmText={desmarcando ? 'Desmarcando…' : 'Desmarcar'}
      onConfirm={() => { if (item && !desmarcando) void confirmar(item); }}
      onCancel={onFechar}
      type="warning"
    />
  );
};
