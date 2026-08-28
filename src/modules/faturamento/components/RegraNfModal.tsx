import React, { useMemo, useState } from 'react';
import { AlertTriangle, Building2, Loader2, Search, X } from 'lucide-react';
import type { OperadoraResumo } from '../types';

// Modal de gerenciamento da regra "NF só após pagamento" (issue 31): pra
// algumas operadoras o convênio paga primeiro e a NF só pode ser emitida
// depois; pra outras (o padrão assumido pelo resto do módulo) é o inverso, a
// NF é o que libera o pagamento. O apLIS não tem essa distinção — é o
// financeiro que sabe, operadora por operadora. Mesmo esqueleto de
// ClinicasParceirasModal (issue 16): a lista vem de `operadoras`, já
// carregada pela tela de Títulos.

interface Props {
  aberto: boolean;
  onFechar: () => void;
  operadoras: OperadoraResumo[];
  onAlternar: (operadoraId: string, valor: boolean) => Promise<string | null>;
}

const RegraNfModal: React.FC<Props> = ({ aberto, onFechar, operadoras, onAlternar }) => {
  const [busca, setBusca] = useState('');
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = termo ? operadoras.filter((o) => o.nome.toLowerCase().includes(termo)) : operadoras;
    // Marcadas primeiro — é o que o financeiro quer conferir de cara ao reabrir.
    return [...lista].sort((a, b) => {
      if (a.nfAposPagamento !== b.nfAposPagamento) return a.nfAposPagamento ? -1 : 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [operadoras, busca]);

  const alternar = async (operadora: OperadoraResumo) => {
    setErro(null);
    setSalvandoId(operadora.id);
    const erroRetornado = await onAlternar(operadora.id, !operadora.nfAposPagamento);
    setSalvandoId(null);
    if (erroRetornado) setErro(erroRetornado);
  };

  const fechar = () => {
    setBusca('');
    setErro(null);
    onFechar();
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Regra de NF por operadora</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Marque as operadoras cuja NF só pode ser emitida depois do pagamento
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 flex-1 overflow-y-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar operadora…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>

          {erro && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {operadoras.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma operadora carregada. Use &quot;Sincronizar operadoras&quot; antes de gerenciar a regra.
            </p>
          ) : filtradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma operadora encontrada.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtradas.map((operadora) => (
                <li key={operadora.id} className="flex items-center gap-3 py-2">
                  <label className="flex items-center gap-3 flex-1 cursor-pointer text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={operadora.nfAposPagamento}
                      disabled={salvandoId === operadora.id}
                      onChange={() => void alternar(operadora)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="truncate">{operadora.nome}</span>
                  </label>
                  {salvandoId === operadora.id && (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={fechar}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegraNfModal;
