import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import type { LocalOrigemBusca } from '../types';
import { buscarLocaisOrigem, useClinicasSemNf } from '../hooks/useClinicasSemNf';

// Modal "Clínicas sem NF" da aba Pendências → Particulares: os locais de origem
// do apLIS para os quais o laboratório não emite NF (tabela clinicas_sem_nf).
// As requisições desses locais saem da lista de Particulares e do total. Mesmo
// esqueleto de ConsideradaMetaModal, mas a lista de candidatos não está
// carregada na tela: são centenas de locais no apLIS, então vem de uma busca por
// nome (/api/faturamento/locais-origem).
//
// Sem canManageBilling o modal é só leitura, para o operador entender por que
// uma requisição não aparece. A RLS recusa a escrita de qualquer forma.

/** Mesmo mínimo do servidor: com um caractere, a busca casaria quase tudo. */
const MIN_BUSCA = 2;
const ESPERA_BUSCA_MS = 300;

interface Props {
  aberto: boolean;
  /** `alterou`: a lista mudou nesta abertura, a aba precisa recarregar. */
  onFechar: (alterou: boolean) => void;
  podeEditar: boolean;
}

const ClinicasSemNfModal: React.FC<Props> = ({ aberto, onFechar, podeEditar }) => {
  const { clinicas, loading, error, adicionar, remover } = useClinicasSemNf(aberto);
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<LocalOrigemBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [erroGravacao, setErroGravacao] = useState<string | null>(null);
  const [alterou, setAlterou] = useState(false);

  const termo = busca.trim();
  const marcadas = useMemo(() => new Set(clinicas.map((c) => c.aplisId)), [clinicas]);

  // Busca com espera curta, descartando a resposta de um termo que já mudou.
  useEffect(() => {
    if (!aberto || termo.length < MIN_BUSCA) {
      setResultados([]);
      setErroBusca(null);
      setBuscando(false);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const timer = setTimeout(() => {
      buscarLocaisOrigem(termo)
        .then((locais) => {
          if (cancelado) return;
          setResultados(locais);
          setErroBusca(null);
        })
        .catch((err: unknown) => {
          if (cancelado) return;
          setResultados([]);
          setErroBusca(err instanceof Error ? err.message : 'Não foi possível buscar os locais de origem.');
        })
        .finally(() => {
          if (!cancelado) setBuscando(false);
        });
    }, ESPERA_BUSCA_MS);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [termo, aberto]);

  const gravar = async (aplisId: number, acao: () => Promise<string | null>) => {
    setSalvandoId(aplisId);
    setErroGravacao(null);
    try {
      const erro = await acao();
      if (erro) setErroGravacao(erro);
      else setAlterou(true);
    } catch (err) {
      setErroGravacao(err instanceof Error ? err.message : 'Não foi possível gravar a alteração.');
    } finally {
      setSalvandoId(null);
    }
  };

  const fechar = () => {
    const mudou = alterou;
    setBusca('');
    setErroGravacao(null);
    setAlterou(false);
    onFechar(mudou);
  };

  if (!aberto) return null;

  const erro = erroGravacao ?? error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Clínicas sem NF</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Locais de origem para os quais o laboratório não emite nota: suas requisições ficam fora de Particulares
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

        <div className="px-6 py-4 space-y-4 flex-1 overflow-y-auto">
          {!podeEditar && (
            <p className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 text-xs text-gray-600 dark:text-gray-300">
              Somente leitura: para alterar a lista é preciso permissão de gestão do faturamento.
            </p>
          )}

          {erro && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* ── Marcadas ─────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Marcadas</h3>
            {loading && clinicas.length === 0 ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : clinicas.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhuma clínica marcada: todas as requisições particulares contam como pendência.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {clinicas.map((clinica) => (
                  <li key={clinica.aplisId} className="flex items-center gap-3 py-2 text-sm text-gray-700 dark:text-gray-200">
                    <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="truncate flex-1">{clinica.nome}</span>
                    <span className="text-xs text-gray-400 tabular-nums">#{clinica.aplisId}</span>
                    {podeEditar && (
                      salvandoId === clinica.aplisId ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => void gravar(clinica.aplisId, () => remover(clinica.aplisId))}
                          disabled={salvandoId !== null}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
                          aria-label={`Remover ${clinica.nome}`}
                          title="Remover da lista"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Busca no apLIS ───────────────────────────────────────────── */}
          {podeEditar && (
            <section className="space-y-2">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Adicionar local de origem</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar pelo nome no apLIS…"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                />
                {buscando && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                )}
              </div>

              {erroBusca ? (
                <p className="text-sm text-red-600 dark:text-red-400">{erroBusca}</p>
              ) : termo.length > 0 && termo.length < MIN_BUSCA ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">Digite ao menos {MIN_BUSCA} letras.</p>
              ) : termo.length >= MIN_BUSCA && !buscando && resultados.length === 0 ? (
                <p className="py-2 text-sm text-gray-500 dark:text-gray-400">Nenhum local de origem encontrado.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {resultados.map((local) => {
                    const jaMarcada = marcadas.has(local.id);
                    const nome = local.nome ?? local.razaoSocial ?? `Local ${local.id}`;
                    return (
                      <li key={local.id} className="flex items-center gap-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                            {nome}
                            {local.inativo && <span className="ml-2 text-xs text-gray-400">(inativo)</span>}
                          </p>
                          {local.razaoSocial && local.razaoSocial !== local.nome && (
                            <p className="text-xs text-gray-400 truncate">{local.razaoSocial}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums">#{local.id}</span>
                        {jaMarcada ? (
                          <span className="text-xs text-gray-400 whitespace-nowrap">Já marcada</span>
                        ) : salvandoId === local.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => void gravar(local.id, () => adicionar({ id: local.id, nome }))}
                            disabled={salvandoId !== null}
                            className="px-2 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-1 disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" /> Adicionar
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
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

export default ClinicasSemNfModal;
