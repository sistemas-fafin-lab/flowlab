import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Loader2, X } from 'lucide-react';
import DatePicker from '../../../components/DatePicker';
import Select from '../../../components/Select';
import { criarAgendamentoAvulso } from '../hooks/useCalendarioEnvios';
import type { RegraEnvio } from '../types';

// Agendamento avulso no Calendário de envios (ex.: "Bradesco hoje também"): um
// convênio ativo num dia útil. Fora da janela da regra é permitido; o servidor
// recusa dia que não é útil. Gate canManageCalendarioEnvios no pai.

const CAMPO =
  'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white/70 text-slate-800 dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-100';

interface Props {
  regras: RegraEnvio[];
  /** Dia sugerido: o dia da grade em que a faturista clicou. */
  dataInicial: string;
  onFechar: () => void;
  onCriado: () => void;
}

const AgendamentoAvulsoModal: React.FC<Props> = ({ regras, dataInicial, onFechar, onCriado }) => {
  const [regraId, setRegraId] = useState('');
  const [data, setData] = useState(dataInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = useMemo(
    () => regras.filter((r) => r.ativo).map((r) => ({ value: r.id, label: r.convenio, description: r.observacao ?? undefined })),
    [regras],
  );

  useEffect(() => {
    const fecharNoEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onFechar(); };
    window.addEventListener('keydown', fecharNoEsc);
    return () => window.removeEventListener('keydown', fecharNoEsc);
  }, [onFechar, salvando]);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await criarAgendamentoAvulso(regraId, data);
      onCriado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar o agendamento.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="avulso-titulo">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 id="avulso-titulo" className="text-lg font-semibold text-gray-800 dark:text-gray-100">Novo agendamento</h2>
          <button
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-full transition-all duration-200 hover:rotate-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
            Convênio
            <Select
              value={regraId}
              onChange={setRegraId}
              options={opcoes}
              placeholder="Escolha o convênio"
              controlClass={`mt-1 ${CAMPO}`}
              searchable
              searchPlaceholder="Buscar convênio"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
            Data prevista
            <DatePicker value={data} onChange={(v) => v && setData(v)} controlClass={`mt-1 ${CAMPO}`} />
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">Pode ficar fora da janela da regra do convênio.</p>
          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onFechar}
            disabled={salvando}
            className="px-5 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 font-medium dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => void salvar()}
            disabled={salvando || !regraId || !data}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
            Agendar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgendamentoAvulsoModal;
