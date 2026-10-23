import React, { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import Select from '../../../components/Select';
import { useConveniosGlosas } from '../hooks/useGlosasRecursos';
import { useRegrasPrazo } from '../hooks/useRegrasPrazo';
import type { FontePagadoraRegra, RegraPrazoCadastro, RegrasPrazoConvenio } from '../utils/regraPrazo';
import { descreverRegraPrazo, REGRAS_PRAZO } from '../utils/regraPrazo';
import RegraPrazoModal from './RegraPrazoModal';

// Acompanhamento dos recursos → "Regras de prazo": as regras de prazo de cada
// convênio (Pagamento da fatura, Glosa – Recurso, Glosa – Análise e Glosa –
// Pagamento) e as fontes pagadoras do apLIS ligadas a elas. Vem preenchida com
// a planilha da responsável pelas glosas (migration 20261023160000). As fontes
// com glosa ou recurso na foto e sem regra aparecem no topo, para ligar.
//
// Sem canManageBilling a tela é só leitura: sem lápis, sem "Novo convênio" e
// sem "Ligar a". A RLS recusa a escrita de qualquer forma.

const CAMPO = 'px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white';

interface Props {
  /** Muda a cada sincronização concluída: a lista de fontes sem regra muda com a foto. */
  versao: number;
  podeEditar: boolean;
}

const CelulaRegra: React.FC<{ regra: RegraPrazoCadastro }> = ({ regra }) => {
  const semPrazo = regra.tipo === 'sem_prazo';
  return (
    <td className="px-3 py-3 align-top">
      <div className={semPrazo ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}>
        {descreverRegraPrazo(regra)}
      </div>
      {regra.texto && (
        <div className="text-xs text-gray-500 dark:text-gray-400 max-w-[14rem]" title={regra.texto}>
          {regra.texto}
        </div>
      )}
    </td>
  );
};

const RegrasPrazoConvenios: React.FC<Props> = ({ versao, podeEditar }) => {
  const { regras, fontesSemRegra, loading, error, salvar, excluir, ligarFonte } = useRegrasPrazo(versao);
  const operadoras = useConveniosGlosas();
  // undefined: fechado; null: convênio novo.
  const [editando, setEditando] = useState<RegrasPrazoConvenio | null | undefined>(undefined);
  const [gravandoId, setGravandoId] = useState<string | number | null>(null);
  const [erroGravacao, setErroGravacao] = useState<string | null>(null);

  const convenioDaFonte = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const r of regras) for (const f of r.fontes) mapa.set(f.id, r.convenio);
    return mapa;
  }, [regras]);

  // Fontes do apLIS (operadoras sincronizadas) + as da foto, sem repetir.
  const fontesDisponiveis = useMemo(() => {
    const mapa = new Map<number, FontePagadoraRegra>();
    for (const o of operadoras) mapa.set(o.id, { id: o.id, nome: o.nome });
    for (const f of fontesSemRegra) if (!mapa.has(f.id)) mapa.set(f.id, { id: f.id, nome: f.nome });
    for (const r of regras) for (const f of r.fontes) if (!mapa.has(f.id)) mapa.set(f.id, f);
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [operadoras, fontesSemRegra, regras]);

  const opcoesConvenio = useMemo(
    () => regras.map((r) => ({ value: r.id, label: r.convenio })),
    [regras],
  );

  const gravar = async (id: string | number, acao: () => Promise<string | null>) => {
    setGravandoId(id);
    setErroGravacao(null);
    try {
      const falha = await acao();
      if (falha) setErroGravacao(falha);
    } catch (err) {
      setErroGravacao(err instanceof Error ? err.message : 'Não foi possível gravar a alteração.');
    } finally {
      setGravandoId(null);
    }
  };

  const confirmarExclusao = (r: RegrasPrazoConvenio) => {
    if (!window.confirm(`Excluir as regras de prazo de ${r.convenio}? As fontes ligadas ficam sem regra.`)) return;
    void gravar(r.id, () => excluir(r.id));
  };

  const erro = erroGravacao ?? error;

  return (
    <div className="space-y-4">
      {erro && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-red-700 dark:text-red-300">{erro}</p>
          {erroGravacao && (
            <button onClick={() => setErroGravacao(null)} className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">×</button>
          )}
        </div>
      )}

      {fontesSemRegra.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {fontesSemRegra.length === 1
                  ? '1 fonte pagadora com glosa ou recurso sem regra de prazo'
                  : `${fontesSemRegra.length} fontes pagadoras com glosa ou recurso sem regra de prazo`}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Os lotes dessas fontes ficam sem prazo e sem selo de atraso até a fonte ser ligada a um convênio.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-amber-200/70 dark:divide-amber-800/60">
            {fontesSemRegra.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="flex-1 min-w-[12rem] text-gray-900 dark:text-gray-100">
                  {f.nome} <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">#{f.id}</span>
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums">
                  {f.ocorrencias} {f.ocorrencias === 1 ? 'registro' : 'registros'} na foto
                </span>
                {podeEditar && (
                  <Select
                    value=""
                    onChange={(regraId) => void gravar(f.id, () => ligarFonte({ id: f.id, nome: f.nome }, regraId))}
                    options={opcoesConvenio}
                    placeholder={gravandoId === f.id ? 'Ligando…' : 'Ligar a…'}
                    controlClass={CAMPO}
                    wrapperClass="w-48"
                    disabled={gravandoId !== null}
                    searchable
                    ariaLabel={`Ligar ${f.nome} a um convênio`}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Regras de prazo por convênio ({regras.length})</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Dias úteis contam de segunda a sexta, sem feriados</p>
          </div>
          {podeEditar && (
            <button
              onClick={() => setEditando(null)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              <Plus size={16} />
              Novo convênio
            </button>
          )}
        </div>

        {loading && regras.length === 0 ? (
          <LoadingSpinner message="Carregando regras de prazo..." />
        ) : regras.length === 0 ? (
          <div className="text-center py-12">
            <CalendarClock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhuma regra de prazo cadastrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Convênio</th>
                  {REGRAS_PRAZO.map((r) => <th key={r.chave} className="px-3 py-3" title={r.usoNaTela}>{r.label}</th>)}
                  <th className="px-3 py-3">Fontes pagadoras</th>
                  {podeEditar && <th className="px-5 py-3" aria-label="Ações" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {regras.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-5 py-3 align-top font-semibold text-gray-900 dark:text-white whitespace-nowrap">{r.convenio}</td>
                    {REGRAS_PRAZO.map(({ chave }) => <CelulaRegra key={chave} regra={r.regras[chave]} />)}
                    <td className="px-3 py-3 align-top">
                      {r.fontes.length === 0 ? (
                        <span className="text-xs text-amber-600 dark:text-amber-400">Nenhuma fonte ligada</span>
                      ) : (
                        <ul className="space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
                          {r.fontes.map((f) => (
                            <li key={f.id}>{f.nome} <span className="text-gray-400 tabular-nums">#{f.id}</span></li>
                          ))}
                        </ul>
                      )}
                    </td>
                    {podeEditar && (
                      <td className="px-5 py-3 align-top whitespace-nowrap text-right">
                        <button
                          onClick={() => setEditando(r)}
                          disabled={gravandoId !== null}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40"
                          aria-label={`Editar regras de ${r.convenio}`}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => confirmarExclusao(r)}
                          disabled={gravandoId !== null}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
                          aria-label={`Excluir regras de ${r.convenio}`}
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {podeEditar && editando !== undefined && (
        <RegraPrazoModal
          convenio={editando}
          fontesDisponiveis={fontesDisponiveis}
          convenioDaFonte={convenioDaFonte}
          onSalvar={salvar}
          onFechar={() => setEditando(undefined)}
        />
      )}
    </div>
  );
};

export default RegrasPrazoConvenios;
