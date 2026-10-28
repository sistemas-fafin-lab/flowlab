import React, { useEffect, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import DatePicker from '../../../components/DatePicker';
import { marcarEnvio } from '../hooks/useCalendarioEnvios';
import { formatData } from '../utils/formato';

// Marca um Agendamento de envio como enviado (Calendário de envios). A data do
// envio vem com hoje e pode ser trocada por um dia anterior: a faturista pode
// registrar um envio feito em outro dia. Gate canManageCalendarioEnvios no pai.

const CAMPO =
  'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white/70 text-slate-800 dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-100';

interface Props {
  agendamentoId: string;
  convenio: string;
  dataPrevista: string;
  /** 'YYYY-MM-DD' do servidor (America/Sao_Paulo). */
  hoje: string;
  onFechar: () => void;
  onMarcado: () => void;
}

const MarcarEnvioModal: React.FC<Props> = ({ agendamentoId, convenio, dataPrevista, hoje, onFechar, onMarcado }) => {
  const [dataEnvio, setDataEnvio] = useState(hoje);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const fecharNoEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onFechar(); };
    window.addEventListener('keydown', fecharNoEsc);
    return () => window.removeEventListener('keydown', fecharNoEsc);
  }, [onFechar, salvando]);

  const noFuturo = dataEnvio > hoje;

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await marcarEnvio(agendamentoId, dataEnvio);
      onMarcado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível marcar o envio.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="marcar-envio-titulo">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 id="marcar-envio-titulo" className="text-lg font-semibold text-gray-800 dark:text-gray-100">Marcar como enviado</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{convenio} · previsto para {formatData(dataPrevista)}</p>
          </div>
          <button
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-full transition-all duration-200 hover:rotate-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
            Data do envio
            <DatePicker value={dataEnvio} onChange={(v) => v && setDataEnvio(v)} controlClass={`mt-1 ${CAMPO}`} />
          </label>
          {noFuturo && <p className="text-sm text-red-600 dark:text-red-400">A data do envio não pode ser no futuro.</p>}
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
            disabled={salvando || noFuturo || !dataEnvio}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Marcar enviado
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarcarEnvioModal;
