import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Lock, X } from 'lucide-react';
import DatePicker from '../../../components/DatePicker';
import { supabase } from '../../../lib/supabase';
import type { LotePreviaAplis, PreviaAplis } from '../types';
import { formatCurrency, formatData } from '../utils/formato';
import { corteAplisPadrao, PISO_CORTE_APLIS } from '../utils/atualizarAplis';

// Prévia do "Atualizar do apLIS": lotes fechados no apLIS a partir da data de
// corte que ainda não têm título (.scratch/faturamento-titulos-automaticos).
// Por ora só leitura — a seleção e a criação dos títulos vêm na issue 02.
//
// Um GET por data de corte, sem paginação: um mês tem ~200 lotes.

const CAMPO =
  'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

/** timestamptz → DD/MM no fuso da operação. */
function diaMes(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  });
}

const Selo: React.FC<{ cor: 'amber' | 'blue' | 'gray' | 'rose'; children: React.ReactNode }> = ({ cor, children }) => {
  const cores = {
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] ${cores[cor]}`}>{children}</span>;
};

function Selos({ item }: { item: LotePreviaAplis }) {
  const { desvinculado } = item;
  return (
    <div className="flex flex-wrap gap-1">
      {item.jaRecebidoAplis && <Selo cor="blue">já recebido no apLIS</Selo>}
      {item.semNf && <Selo cor="amber">sem NF — a baixa exige o número</Selo>}
      {item.emissaoMesAnterior && <Selo cor="gray">emissão em mês anterior</Selo>}
      {desvinculado && (
        <Selo cor="rose">
          desvinculado do título {desvinculado.numeroNota ?? '(sem número)'} em {diaMes(desvinculado.em)}:{' '}
          {desvinculado.motivo}
        </Selo>
      )}
    </div>
  );
}

const AtualizarAplisModal: React.FC<Props> = ({ aberto, onFechar }) => {
  const [desde, setDesde] = useState(() => corteAplisPadrao());
  const [previa, setPrevia] = useState<PreviaAplis | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O servidor recusa data antes do piso; o campo nem deixa chegar lá.
  const alterarDesde = (valor: string) => {
    if (!valor) return;
    setDesde(valor < PISO_CORTE_APLIS ? PISO_CORTE_APLIS : valor);
  };

  const fechar = useCallback(() => {
    setDesde(corteAplisPadrao());
    setPrevia(null);
    setErro(null);
    onFechar();
  }, [onFechar]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const params = new URLSearchParams({ desde });
      const res = await fetch(`/api/faturamento/titulos-aplis-previa?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as Partial<PreviaAplis> & {
        success?: boolean; error?: string;
      };
      if (!res.ok || !body.success) throw new Error(body.error || 'Não foi possível consultar o apLIS.');
      setPrevia({ desde: body.desde ?? desde, lotes: body.lotes ?? [], nfsAPreencher: body.nfsAPreencher ?? [] });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível consultar o apLIS.');
      setPrevia(null);
    } finally {
      setCarregando(false);
    }
  }, [desde]);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  if (!aberto) return null;

  const lotes = previa?.lotes ?? [];
  const validos = lotes.filter((item) => item.bloqueio === null);
  const totalValidos = validos.reduce((soma, item) => soma + item.lote.valor, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Atualizar do apLIS</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Lotes fechados no apLIS que ainda não têm título · dados do apLIS até ontem
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

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <label className="inline-block text-xs text-gray-500 dark:text-gray-400">
            Fechados a partir de
            <DatePicker value={desde} onChange={alterarDesde} controlClass={CAMPO} />
            <span className="mt-1 block text-[11px] text-gray-400">
              Mínimo {formatData(PISO_CORTE_APLIS)} — os anteriores já foram lançados
            </span>
          </label>

          <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Consultando o apLIS…
              </div>
            ) : erro ? (
              <div className="p-4 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{erro}</span>
              </div>
            ) : lotes.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhum lote novo: todos os lotes fechados desde {formatData(desde)} já têm título.
              </div>
            ) : (
              <div className="max-h-[55vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/40 sticky top-0">
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2">Operadora</th>
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2">Emissão</th>
                      <th className="px-3 py-2">Fechamento</th>
                      <th className="px-3 py-2">NF</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {lotes.map((item) => {
                      const { lote } = item;
                      const bloqueado = item.bloqueio !== null;
                      return (
                        <tr key={lote.idLote} className={bloqueado ? 'opacity-60' : undefined}>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-200 truncate max-w-[220px]">
                            {lote.fontePagadora.nome ?? lote.fontePagadora.razaoSocial ?? '—'}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                            {lote.idLote}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                            {formatCurrency(lote.valor)}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300 tabular-nums">
                            {formatData(lote.dtaCriacao)}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300 tabular-nums">
                            {formatData(lote.dtaFechamento)}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300 tabular-nums">
                            {lote.nfeNumero ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            {bloqueado && (
                              <span className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                <Lock className="w-3.5 h-3.5" /> sem valor a faturar
                              </span>
                            )}
                            <Selos item={item} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!carregando && !erro && lotes.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {validos.length} lote{validos.length === 1 ? '' : 's'} a faturar ·{' '}
              <strong className="tabular-nums">{formatCurrency(totalValidos)}</strong>
              {lotes.length > validos.length && (
                <> · {lotes.length - validos.length} sem valor a faturar</>
              )}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={fechar}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AtualizarAplisModal;
