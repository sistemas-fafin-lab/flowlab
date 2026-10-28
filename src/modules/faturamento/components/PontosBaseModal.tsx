import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info, Loader2, RotateCcw, X } from 'lucide-react';
import { alterarPontosBase, listarPontosBase } from '../hooks/usePontuacaoSetor';
import type { FrentePontuacao, PontoBasePontuacao } from '../types';
import { formatDataHora } from '../utils/formato';

// Modal "Pontos base" da Pontuação do setor (.scratch/faturamento-pontuacao/):
// os pontos base de todos os critérios, manuais e automáticos, por Frente. O
// valor vale para a prévia de todo mês aberto; meses fechados guardam o que
// valia ao fechar. Salvar manda só o que mudou. Gate canManageBilling no pai,
// que recarrega a prévia depois de salvar.

interface Props {
  frentes: { frente: FrentePontuacao; rotulo: string }[];
  onFechar: () => void;
  /** Depois de salvar: o pai recarrega a pontuação. */
  onAlterado: () => void;
}

const chaveDe = (p: { frente: string; chave: string }): string => `${p.frente}:${p.chave}`;

const formatPontos = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Texto do campo → número, ou null quando não é um ponto base válido (≥ 0, uma casa). */
const lerValor = (texto: string): number | null => {
  const numero = Number(texto.replace(',', '.'));
  if (texto.trim() === '' || !Number.isFinite(numero) || numero < 0) return null;
  if (Math.round(numero * 10) / 10 !== numero) return null;
  return numero;
};

const PontosBaseModal: React.FC<Props> = ({ frentes, onFechar, onAlterado }) => {
  const [criterios, setCriterios] = useState<PontoBasePontuacao[] | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    listarPontosBase()
      .then((lista) => {
        if (cancelado) return;
        setCriterios(lista);
        setValores(Object.fromEntries(lista.map((c) => [chaveDe(c), String(c.pontosBase)])));
      })
      .catch((err) => { if (!cancelado) setErro(err instanceof Error ? err.message : 'Não foi possível carregar os pontos base.'); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    const fecharNoEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onFechar(); };
    window.addEventListener('keydown', fecharNoEsc);
    return () => window.removeEventListener('keydown', fecharNoEsc);
  }, [onFechar, salvando]);

  const alterados = useMemo(
    () => (criterios ?? []).filter((c) => valores[chaveDe(c)] !== String(c.pontosBase)),
    [criterios, valores],
  );

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const invalido = alterados.find((c) => lerValor(valores[chaveDe(c)]) === null);
    if (invalido) {
      setErro(`Pontos base de "${invalido.rotulo}": informe um número a partir de 0, com no máximo uma casa decimal.`);
      return;
    }
    if (alterados.length === 0) {
      onFechar();
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await alterarPontosBase(alterados.map((c) => ({
        frente: c.frente,
        chave: c.chave,
        pontosBase: lerValor(valores[chaveDe(c)]) as number,
      })));
      onAlterado();
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gravar os pontos base.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pontos base</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Valem para os meses abertos</p>
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

        <form onSubmit={salvar} className="flex flex-col min-h-0">
          <div className="px-6 py-4 space-y-5 overflow-y-auto">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                A prévia de todo mês aberto passa a usar o valor novo. Meses fechados não mudam: para recalcular um
                deles, reabra o mês e feche de novo.
              </span>
            </div>

            {carregando && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando…
              </div>
            )}

            {criterios && frentes.map(({ frente, rotulo }) => (
              <div key={frente}>
                <h3 className="pb-2 text-sm font-semibold text-gray-900 dark:text-white">Frente {rotulo}</h3>
                <div className="divide-y divide-gray-100 dark:divide-gray-700/60 rounded-xl border border-gray-200 dark:border-gray-700">
                  {criterios.filter((c) => c.frente === frente).map((c) => {
                    const chave = chaveDe(c);
                    const valor = valores[chave] ?? '';
                    const foraDoPadrao = lerValor(valor) !== c.padrao;
                    return (
                      <div key={chave} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {c.rotulo}
                            <span className="ml-2 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                              {c.tipo === 'manual' ? 'manual' : 'automático'}
                            </span>
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Padrão {formatPontos(c.padrao)}
                            {c.alteradoEm && ` · alterado${c.alteradoPor ? ` por ${c.alteradoPor}` : ''} em ${formatDataHora(c.alteradoEm)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            aria-label={`Pontos base de ${c.rotulo}`}
                            value={valor}
                            onChange={(e) => setValores((v) => ({ ...v, [chave]: e.target.value }))}
                            className="w-24 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-right text-gray-900 dark:text-gray-100 tabular-nums"
                          />
                          <span className="w-24 text-xs text-gray-500 dark:text-gray-400">{c.porConvenio ? 'por convênio' : ''}</span>
                          <button
                            type="button"
                            onClick={() => setValores((v) => ({ ...v, [chave]: String(c.padrao) }))}
                            disabled={!foraDoPadrao}
                            title="Voltar ao padrão"
                            aria-label={`Voltar ${c.rotulo} ao padrão`}
                            className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:invisible"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {erro && (
              <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{erro}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={onFechar}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || carregando || !criterios}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar{alterados.length > 0 ? ` (${alterados.length})` : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PontosBaseModal;
