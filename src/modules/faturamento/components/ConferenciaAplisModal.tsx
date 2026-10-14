import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Loader2, RefreshCw, Wallet, X } from 'lucide-react';
import { chamarApi } from '../hooks/useContasReceber';
import type { ConferenciaAplis, DivergenciaAplis, TipoDivergenciaAplis } from '../types';
import { formatCurrency, formatData, hojeIso } from '../utils/formato';
import { csvConferencia, diferencaAplis, secoesConferencia, statusLoteAplis } from '../utils/conferenciaAplis';
import type { AcaoTituloConferencia } from '../utils/conferenciaAplis';

// "Conferir baixas com o apLIS" (.scratch/faturamento-conferencia-baixas-aplis):
// títulos cujo recebido no sistema diverge do recebido no apLIS dos seus lotes,
// por tipo. Só aponta — a baixa continua sendo lançada pelo operador, que daqui
// abre o "Lançar baixa" (falta lançar) ou o "Editar título" (corrigir o que já
// foi lançado). Uma leitura por abertura, sem cache: o operador quer ver o
// efeito da baixa que acabou de lançar (a página troca `versao` depois de salvar).

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Muda depois que um título aberto daqui foi salvo: refaz a conferência. */
  versao: number;
  /** Sem canManageBilling a linha não tem ações (os dois modais escrevem). */
  podeAbrirTitulo: boolean;
  /** Abre o título no "Lançar baixa" ou no "Editar título"; devolve a mensagem
   *  de erro, ou null. */
  onAbrirTitulo: (idNota: string, acao: AcaoTituloConferencia) => Promise<string | null>;
}

const DESCRICAO_TIPO: Record<TipoDivergenciaAplis, string> = {
  'so-no-aplis': 'aberto aqui, já recebido no apLIS — falta lançar a baixa',
  'aplis-maior': 'o apLIS recebeu mais do que o lançado aqui',
  'sistema-maior': 'lançado aqui a mais que o apLIS — confira a glosa ou a baixa',
  'lote-ausente': 'lote vinculado que não existe no apLIS — sem valor para comparar',
};

const COR_TIPO: Record<TipoDivergenciaAplis, string> = {
  'so-no-aplis': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  'aplis-maior': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  'sistema-maior': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  'lote-ausente': 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

const BOTAO_SECUNDARIO =
  'px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

function baixarCsv(titulos: DivergenciaAplis[]) {
  const blob = new Blob([csvConferencia(titulos)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `conferencia-baixas-aplis-${hojeIso()}.csv`;
  link.click();
  // Revogar na hora cancela o download no Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Diferenca({ titulo }: { titulo: DivergenciaAplis }) {
  const valor = diferencaAplis(titulo);
  if (valor === null) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  return (
    <span className={valor > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-600 dark:text-red-400'}>
      {valor > 0 ? '+' : ''}{formatCurrency(valor)}
    </span>
  );
}

function AcaoLinha({ rotulo, icone: Icone, carregando, desabilitado, onClick }: {
  rotulo: string;
  icone: React.ComponentType<{ className?: string }>;
  carregando: boolean;
  desabilitado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      className="px-3 py-1.5 rounded-xl text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 inline-flex items-center gap-1 disabled:opacity-50"
    >
      {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icone className="w-3.5 h-3.5" />}
      {rotulo}
    </button>
  );
}

const ConferenciaAplisModal: React.FC<Props> = ({ aberto, onFechar, versao, podeAbrirTitulo, onAbrirTitulo }) => {
  const [conferencia, setConferencia] = useState<ConferenciaAplis | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<{ idNota: string; acao: AcaoTituloConferencia } | null>(null);
  const [erroAbrir, setErroAbrir] = useState<string | null>(null);
  // Descarta a resposta de uma leitura que já foi substituída (fechar e
  // reabrir, ou salvar um título enquanto a anterior ainda estava no ar).
  const leituraRef = useRef(0);

  const carregar = useCallback(async () => {
    const leitura = ++leituraRef.current;
    setCarregando(true);
    setErro(null);
    try {
      const body = await chamarApi<{ meta?: { dadoAte?: string | null }; titulos?: DivergenciaAplis[] }>(
        '/api/faturamento/titulos-conferencia-aplis',
        'Não foi possível conferir as baixas com o apLIS.',
      );
      if (leitura !== leituraRef.current) return;
      setConferencia({ dadoAte: body.meta?.dadoAte ?? null, titulos: body.titulos ?? [] });
    } catch (err) {
      if (leitura !== leituraRef.current) return;
      // Nunca uma lista velha ou vazia no lugar do erro: seria lida como "tudo certo".
      setConferencia(null);
      setErro(err instanceof Error ? err.message : 'Não foi possível conferir as baixas com o apLIS.');
    } finally {
      if (leitura === leituraRef.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, versao, carregar]);

  const fechar = () => {
    leituraRef.current += 1;
    setConferencia(null);
    setErro(null);
    setErroAbrir(null);
    setCarregando(false);
    onFechar();
  };

  const abrir = async (idNota: string, acao: AcaoTituloConferencia) => {
    setAbrindo({ idNota, acao });
    setErroAbrir(null);
    const falha = await onAbrirTitulo(idNota, acao);
    setAbrindo(null);
    if (falha) setErroAbrir(falha);
  };

  if (!aberto) return null;

  const titulos = conferencia?.titulos ?? [];
  const secoes = secoesConferencia(titulos);
  const dadoAte = conferencia?.dadoAte ? `até ${formatData(conferencia.dadoAte)}` : 'até ontem';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Conferir baixas com o apLIS</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Títulos cujo recebido aqui diverge do recebido no apLIS (diferenças abaixo de R$ 1,00 ficam de fora)
              {' · '}dados do apLIS {dadoAte}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:rotate-90"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {erroAbrir && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erroAbrir}</span>
            </div>
          )}

          {/* Sem conferência e sem erro = ainda não respondeu (inclusive no
              render antes do efeito disparar): nunca cai no estado vazio. */}
          {!conferencia && !erro ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Conferindo os títulos com o apLIS…
            </div>
          ) : erro ? (
            <div className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {erro} A conferência não foi feita — isto <strong>não</strong> quer dizer que está tudo certo.
                </span>
              </div>
              <button type="button" onClick={() => void carregar()} className={BOTAO_SECUNDARIO}>
                <RefreshCw className="w-4 h-4" /> Tentar de novo
              </button>
            </div>
          ) : secoes.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <CheckCircle2 className="w-8 h-8 text-green-500 dark:text-green-400" />
              <span className="font-medium text-gray-700 dark:text-gray-200">Nenhuma divergência</span>
              <span>O recebido de todos os títulos bate com o apLIS ({dadoAte}).</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {secoes.map((secao) => (
                  <button
                    key={secao.tipo}
                    type="button"
                    onClick={() => document.getElementById(`conferencia-${secao.tipo}`)?.scrollIntoView({ behavior: 'smooth' })}
                    className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm card-interactive text-left"
                  >
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${COR_TIPO[secao.tipo]}`}>
                      {secao.rotulo}
                    </span>
                    <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                      {secao.titulos.length}
                      <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                        título{secao.titulos.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    {secao.totalDiferenca !== null && (
                      <div className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">
                        diferença {formatCurrency(Math.abs(secao.totalDiferenca))}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {secoes.map((secao) => (
                <section key={secao.tipo} id={`conferencia-${secao.tipo}`} className="space-y-2 scroll-mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${COR_TIPO[secao.tipo]}`}>
                      {secao.rotulo}
                    </span>
                    <span className="tabular-nums">
                      {secao.titulos.length} título{secao.titulos.length === 1 ? '' : 's'}
                      {secao.totalDiferenca !== null && <> · {formatCurrency(Math.abs(secao.totalDiferenca))}</>}
                    </span>
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                      {DESCRICAO_TIPO[secao.tipo]}
                    </span>
                  </h3>
                  <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-x-auto">
                    <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900/50">
                        <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          <th className="px-3 py-2">Título</th>
                          <th className="px-3 py-2">Operadora</th>
                          <th className="px-3 py-2">Emissão</th>
                          <th className="px-3 py-2">Lotes (status no apLIS)</th>
                          <th className="px-3 py-2 text-right">Recebido no sistema</th>
                          <th className="px-3 py-2 text-right">Glosado</th>
                          <th className="px-3 py-2 text-right">Recebido no apLIS</th>
                          <th className="px-3 py-2 text-right">Diferença</th>
                          <th className="px-3 py-2">Último receb. no apLIS</th>
                          {podeAbrirTitulo && <th className="px-3 py-2" />}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {secao.titulos.map((titulo) => (
                          <tr key={titulo.idNota} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                                {titulo.numeroNota ?? 'sem número'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{titulo.status}</div>
                            </td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-200 truncate max-w-[200px]" title={titulo.operadora}>
                              {titulo.operadora}
                            </td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
                              {formatData(titulo.dataEmissao)}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {titulo.lotes.map((lote) => (
                                  <span
                                    key={lote.aplisId}
                                    className="px-2 py-0.5 text-[11px] rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap"
                                  >
                                    <span className="tabular-nums font-medium">{lote.aplisId}</span>
                                    {' · '}
                                    {statusLoteAplis(lote.statusAplis)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">
                              {formatCurrency(titulo.recebidoSistema)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              {titulo.glosadoSistema > 0 ? formatCurrency(titulo.glosadoSistema) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">
                              {titulo.recebidoAplis === null ? '—' : formatCurrency(titulo.recebidoAplis)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                              <Diferenca titulo={titulo} />
                            </td>
                            <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              {formatData(titulo.ultimoRecebimentoAplis)}
                              {titulo.primeiroRecebimentoAplis
                                && titulo.primeiroRecebimentoAplis !== titulo.ultimoRecebimentoAplis && (
                                <div className="text-[11px] text-gray-400 dark:text-gray-500">
                                  desde {formatData(titulo.primeiroRecebimentoAplis)}
                                </div>
                              )}
                            </td>
                            {podeAbrirTitulo && (
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                <AcaoLinha
                                  rotulo="Lançar baixa"
                                  icone={Wallet}
                                  carregando={abrindo?.idNota === titulo.idNota && abrindo.acao === 'baixa'}
                                  desabilitado={abrindo !== null}
                                  onClick={() => void abrir(titulo.idNota, 'baixa')}
                                />
                                <AcaoLinha
                                  rotulo="Abrir título"
                                  icone={ExternalLink}
                                  carregando={abrindo?.idNota === titulo.idNota && abrindo.acao === 'editar'}
                                  desabilitado={abrindo !== null}
                                  onClick={() => void abrir(titulo.idNota, 'editar')}
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {carregando && conferencia ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> refazendo a conferência…
              </span>
            ) : conferencia && titulos.length > 0 ? (
              `${titulos.length} título${titulos.length === 1 ? '' : 's'} divergente${titulos.length === 1 ? '' : 's'}`
            ) : null}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={carregando}
              className={BOTAO_SECUNDARIO}
            >
              <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} /> Refazer
            </button>
            <button
              type="button"
              onClick={() => baixarCsv(titulos)}
              disabled={carregando || titulos.length === 0}
              className={BOTAO_SECUNDARIO}
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
            <button
              type="button"
              onClick={fechar}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConferenciaAplisModal;
