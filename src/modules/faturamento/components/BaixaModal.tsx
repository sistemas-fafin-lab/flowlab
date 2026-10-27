import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';
import type { BaixaInput, TituloReceber } from '../types';
import { formatCurrency, hojeIso } from '../utils/formato';

// Registro de uma baixa sobre um título. A glosa não é mais lançada aqui
// (.scratch/glosas-recursos-dashboard, issue 13): vem da foto de Glosas e
// Recursos, e o saldo do título já desconta a glosa acatada.

const FORMAS = ['TED', 'PIX', 'Boleto', 'Depósito', 'Cheque', 'Outro'];
const FORMAS_OPCOES = [
  { value: '', label: '—' },
  ...FORMAS.map((forma) => ({ value: forma, label: forma })),
];
const CAMPO =
  'mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

interface Props {
  titulo: TituloReceber | null;
  onFechar: () => void;
  onRegistrar: (dados: BaixaInput) => Promise<string | null>;
}

const BaixaModal: React.FC<Props> = ({ titulo, onFechar, onRegistrar }) => {
  const [valorRecebido, setValorRecebido] = useState('');
  const [dataRecebimento, setDataRecebimento] = useState(hojeIso);
  const [bancoNome, setBancoNome] = useState('');
  const [formaRecebimento, setFormaRecebimento] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [confirmaExcedente, setConfirmaExcedente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const saldo = titulo?.valorSaldo ?? 0;

  // Reabrir o modal em outro título não pode herdar os valores do anterior.
  useEffect(() => {
    if (!titulo) return;
    setValorRecebido(saldo > 0 ? saldo.toFixed(2) : '');
    setDataRecebimento(hojeIso());
    setBancoNome('');
    setFormaRecebimento('');
    setObservacoes('');
    setConfirmaExcedente(false);
    setErro(null);
  }, [titulo, saldo]);

  const recebido = Number(valorRecebido.replace(',', '.')) || 0;
  // O que sobra depois desta baixa. Negativo significa que o operador lançou
  // mais do que o título deve.
  const restante = useMemo(() => Math.round((saldo - recebido) * 100) / 100, [saldo, recebido]);

  // Cada novo valor de restante negativo precisa de uma confirmação própria — uma
  // baixa de 250,00 digitada como 2500,00 não pode herdar o "sim" de uma edição
  // anterior (achado 4.4: hoje o saldo negativo é aceito sem aviso nenhum).
  useEffect(() => {
    setConfirmaExcedente(false);
  }, [restante]);

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!titulo) return;
    setErro(null);

    if (recebido < 0) {
      setErro('Valor recebido não pode ser negativo.');
      return;
    }
    if (recebido === 0) {
      setErro('Informe o valor recebido.');
      return;
    }
    if (restante < 0 && !confirmaExcedente) {
      setErro('O recebido excede o saldo do título. Confirme abaixo para registrar mesmo assim.');
      return;
    }

    setSalvando(true);
    const falha = await onRegistrar({
      notaId: titulo.id,
      valorRecebido: recebido,
      dataRecebimento,
      bancoNome: bancoNome.trim() || null,
      formaRecebimento: formaRecebimento || null,
      observacoes: observacoes.trim() || null,
      glosas: [],
    });
    setSalvando(false);

    if (falha) setErro(falha);
    else onFechar();
  };

  // Esc fecha o modal — e só ele, quando aberto por cima do painel de detalhes
  // do título. O Esc de um Select/DatePicker aberto (defaultPrevented) é deles.
  useEffect(() => {
    if (!titulo) return;
    const fecharNoEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !salvando) onFechar();
    };
    document.addEventListener('keydown', fecharNoEsc);
    return () => document.removeEventListener('keydown', fecharNoEsc);
  }, [titulo, salvando, onFechar]);

  if (!titulo) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Registrar baixa — {titulo.numeroNota || 'sem número de nota'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {titulo.operadoraNome ?? 'Operadora'} · saldo{' '}
              <strong className="tabular-nums">{formatCurrency(saldo)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submeter} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Valor recebido *
              <input
                type="number"
                step="0.01"
                min="0"
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 tabular-nums"
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Data
              <DatePicker
                value={dataRecebimento}
                onChange={setDataRecebimento}
                controlClass={CAMPO}
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Banco
              <input
                type="text"
                value={bancoNome}
                onChange={(e) => setBancoNome(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Forma
              <Select
                value={formaRecebimento}
                onChange={setFormaRecebimento}
                options={FORMAS_OPCOES}
                placeholder="—"
                controlClass={CAMPO}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Recebido <strong className="tabular-nums text-gray-800 dark:text-gray-100">{formatCurrency(recebido)}</strong>
            </span>
            <span className={restante < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}>
              Restante <strong className="tabular-nums">{formatCurrency(restante)}</strong>
            </span>
          </div>

          {/* Saldo negativo é aceito pelo banco (pagamento a maior existe de
              verdade), mas não pode passar de um clique distraído — exige
              confirmação explícita mostrando quanto excede (achado 4.4). */}
          {restante < 0 && (
            <label className="flex items-start gap-2 px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20 text-sm text-rose-700 dark:text-rose-300">
              <input
                type="checkbox"
                checked={confirmaExcedente}
                onChange={(e) => setConfirmaExcedente(e.target.checked)}
                className="mt-0.5 rounded border-rose-300 dark:border-rose-700"
              />
              <span>
                O recebido excede o saldo do título em{' '}
                <strong className="tabular-nums">{formatCurrency(Math.abs(restante))}</strong>.
                Confirmo que quero registrar mesmo assim.
              </span>
            </label>
          )}

          <label className="block text-xs text-gray-500 dark:text-gray-400">
            Observações
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>

          {erro && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}
        </form>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submeter}
            disabled={salvando || (restante < 0 && !confirmaExcedente)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar baixa
          </button>
        </div>
      </div>
    </div>
  );
};

export default BaixaModal;
