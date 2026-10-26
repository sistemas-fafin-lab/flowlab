import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X, XCircle } from 'lucide-react';
import { chamarApi, rpcRegistrarBaixa } from '../hooks/useContasReceber';
import type { PreviaBaixasAplis, TituloPreviaBaixasAplis } from '../types';
import { formatCurrency, formatData, plural } from '../utils/formato';
import {
  aplicarTitulo,
  descricaoResultado,
  resumoAplicacao,
  selecaoPadrao,
  separarPrevia,
  titulosComBaixaRepetida,
  totalALancar,
} from '../utils/aplicarBaixasAplis';
import type { ResultadoTitulo } from '../utils/aplicarBaixasAplis';

// "Aplicar baixas do apLIS" (.scratch/faturamento-baixas-automaticas-aplis):
// prévia das baixas que faltam lançar, uma por data de recebimento no apLIS. O
// operador marca os títulos e confirma. Título a título, em sequência, pela
// mesma RPC do "Registrar baixa" (`fat_registrar_baixa`, uma por vez — a RPC
// recalcula o título a cada uma). A parte de glosas saiu
// (.scratch/glosas-recursos-dashboard, issue 13): a glosa do título vem da foto
// de Glosas e Recursos.

const MENSAGEM_PADRAO = 'Não foi possível montar a prévia das baixas do apLIS.';

const SELO_PULADO =
  'px-2 py-0.5 text-[11px] rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';

const BOTAO_SECUNDARIO =
  'px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Fechou depois de lançar ao menos uma baixa: relê a lista e a conferência. */
  onAlterados: () => void;
}

async function buscarPrevia(): Promise<PreviaBaixasAplis> {
  const body = await chamarApi<{ meta?: { dadoAte?: string | null }; titulos?: TituloPreviaBaixasAplis[] }>(
    '/api/faturamento/titulos-baixas-aplis-previa',
    MENSAGEM_PADRAO,
  );
  return { dadoAte: body.meta?.dadoAte ?? null, titulos: body.titulos ?? [] };
}

function EstadoTitulo({ resultado, total }: { resultado: ResultadoTitulo | undefined; total: number }) {
  if (!resultado) return null;
  const { estado, baixasLancadas } = resultado;
  if (estado === 'aguardando') return <span className="text-xs text-gray-400">na fila</span>;
  if (estado === 'lancando') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> lançando
        {total > 1 && baixasLancadas < total ? ` baixa ${baixasLancadas + 1} de ${total}` : ''}…
      </span>
    );
  }
  if (estado === 'lancado') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" /> {descricaoResultado(resultado)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
      <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      {descricaoResultado(resultado)}
    </span>
  );
}

const AplicarBaixasAplisModal: React.FC<Props> = ({ aberto, onFechar, onAlterados }) => {
  const [previa, setPrevia] = useState<PreviaBaixasAplis | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [resultados, setResultados] = useState<Map<string, ResultadoTitulo>>(new Map());
  const [executando, setExecutando] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  // Leitura e execução em curso. Fechar troca o id: a leitura velha é
  // descartada e a execução para de iniciar lançamentos (o que está no ar
  // termina no servidor; reabrir mostra o que falta).
  const execucaoRef = useRef(0);
  // Ao menos um lançamento desde que abriu: fechar relê lista e conferência.
  const lancouRef = useRef(false);

  const carregar = useCallback(async () => {
    const leitura = ++execucaoRef.current;
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await buscarPrevia();
      if (leitura !== execucaoRef.current) return;
      setPrevia(resultado);
      setMarcadas(selecaoPadrao(resultado.titulos));
      setResultados(new Map());
      setResumo(null);
    } catch (err) {
      if (leitura !== execucaoRef.current) return;
      // Nunca uma prévia velha ou vazia no lugar do erro: seria lida como "nada a lançar".
      setPrevia(null);
      setErro(err instanceof Error ? err.message : MENSAGEM_PADRAO);
    } finally {
      if (leitura === execucaoRef.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  // Sair da página também encerra a execução.
  useEffect(() => () => {
    execucaoRef.current += 1;
  }, []);

  useEffect(() => {
    if (!executando) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [executando]);

  const fechar = () => {
    if (
      executando &&
      !window.confirm(
        'As baixas ainda estão sendo lançadas. Se fechar agora, o que ainda não começou fica para a próxima vez (o que já foi lançado não é desfeito). Fechar mesmo assim?',
      )
    ) {
      return;
    }
    execucaoRef.current += 1;
    setPrevia(null);
    setErro(null);
    setCarregando(false);
    setMarcadas(new Set());
    setResultados(new Map());
    setExecutando(false);
    setResumo(null);
    if (lancouRef.current) {
      lancouRef.current = false;
      onAlterados();
    }
    onFechar();
  };

  const alternar = (idNota: string) => {
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(idNota)) novo.delete(idNota);
      else novo.add(idNota);
      return novo;
    });
  };

  const confirmar = async () => {
    const alvos = separarPrevia(previa?.titulos ?? []).aplicaveis.filter((t) => marcadas.has(t.idNota));
    if (alvos.length === 0) return;

    const execucao = ++execucaoRef.current;
    const vigente = () => execucaoRef.current === execucao;
    const estados = new Map<string, ResultadoTitulo>(
      alvos.map((titulo) => [titulo.idNota, { estado: 'aguardando', baixasLancadas: 0 }]),
    );
    const marcar = (idNota: string, resultado: ResultadoTitulo) => {
      estados.set(idNota, resultado);
      if (vigente()) setResultados(new Map(estados));
    };

    setResultados(new Map(estados));
    setResumo(null);
    setExecutando(true);

    // Lançou algo nesta execução — se o modal fechar no meio, o lançamento que
    // estava no ar só entra depois do fechar, e a releitura fica para o fim.
    let lancou = false;
    for (const alvo of alvos) {
      if (!vigente()) break;
      const { idNota } = alvo;
      marcar(idNota, { ...(estados.get(idNota) as ResultadoTitulo), estado: 'lancando' });
      // Um erro num título não para os outros: aplicarTitulo devolve o erro no resultado.
      const resultado = await aplicarTitulo(alvo, {
        // Não usa o registrarBaixa do hook: ele relê a lista a cada baixa.
        registrarBaixa: rpcRegistrarBaixa,
        continuar: vigente,
        onProgresso: (parcial) => {
          lancou = true;
          if (vigente()) lancouRef.current = true;
          marcar(idNota, parcial);
        },
      });
      marcar(idNota, resultado);
    }

    if (!vigente()) {
      if (lancou) onAlterados();
      return;
    }
    setExecutando(false);
    setResumo(resumoAplicacao(estados.values()).texto);
  };

  if (!aberto) return null;

  const { aplicaveis, pulados } = separarPrevia(previa?.titulos ?? []);
  // Lote vinculado a mais de um título: a baixa dele começa desmarcada.
  const repetidos = titulosComBaixaRepetida(aplicaveis);
  const total = totalALancar(aplicaveis, marcadas);
  // Depois de confirmar, a prévia vira o relatório da execução.
  const travado = executando || resultados.size > 0;
  const todasMarcadas = aplicaveis.length > 0 && aplicaveis.every((t) => marcadas.has(t.idNota));
  const concluidos = [...resultados.values()].filter(
    (r) => r.estado !== 'aguardando' && r.estado !== 'lancando',
  ).length;
  const dadoAte = previa?.dadoAte ? `até ${formatData(previa.dadoAte)}` : 'até ontem';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Aplicar baixas do apLIS</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Baixas recebidas no apLIS que faltam lançar aqui, uma por data de recebimento · dados do apLIS {dadoAte}
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
          {/* Sem prévia e sem erro = ainda não respondeu: nunca cai no "nada a lançar". */}
          {!previa && !erro ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Calculando as baixas a partir do apLIS…
            </div>
          ) : erro ? (
            <div className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {erro} A prévia não foi montada — isto <strong>não</strong> quer dizer que não há nada a lançar.
                </span>
              </div>
              <button type="button" onClick={() => void carregar()} className={BOTAO_SECUNDARIO}>
                <RefreshCw className="w-4 h-4" /> Tentar de novo
              </button>
            </div>
          ) : aplicaveis.length === 0 && pulados.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <CheckCircle2 className="w-8 h-8 text-green-500 dark:text-green-400" />
              <span className="font-medium text-gray-700 dark:text-gray-200">Nada a lançar</span>
              <span>
                Todas as baixas recebidas no apLIS ({dadoAte}) já estão lançadas aqui.
              </span>
            </div>
          ) : (
            <>
              {aplicaveis.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Nada a lançar — os títulos abaixo ficaram de fora.
                </div>
              ) : (
                <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-x-auto">
                  <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        <th className="px-3 py-2">Título</th>
                        <th className="px-3 py-2">Operadora</th>
                        <th className="px-3 py-2 text-right">Recebido no sistema</th>
                        <th className="px-3 py-2 text-right">Recebido no apLIS</th>
                        <th className="px-3 py-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={todasMarcadas}
                              disabled={travado}
                              onChange={() =>
                                setMarcadas(todasMarcadas ? new Set() : new Set(aplicaveis.map((t) => t.idNota)))
                              }
                              className="rounded border-gray-300 dark:border-gray-600"
                              aria-label="Marcar todas as baixas"
                            />
                            Baixas a lançar
                          </label>
                        </th>
                        <th className="px-3 py-2">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {aplicaveis.map((titulo) => (
                        <tr key={titulo.idNota} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors align-top">
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                              {titulo.numeroNota ?? 'sem número'}
                            </div>
                            {repetidos.has(titulo.idNota) && (
                              <span
                                className="mt-1 inline-block px-2 py-0.5 text-[11px] rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                                title="O mesmo lote está vinculado a outro título desta lista: marque só um dos dois."
                              >
                                lote em outro título
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-200 truncate max-w-[200px]" title={titulo.operadora}>
                            {titulo.operadora}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {formatCurrency(titulo.recebidoSistema)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {formatCurrency(titulo.recebidoAplis)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={marcadas.has(titulo.idNota)}
                                disabled={travado}
                                onChange={() => alternar(titulo.idNota)}
                                className="mt-0.5 rounded border-gray-300 dark:border-gray-600"
                                aria-label={`Lançar as baixas do título ${titulo.numeroNota ?? 'sem número'}`}
                              />
                              <ul className="space-y-0.5">
                                {titulo.baixas.map((baixa) => (
                                  <li
                                    key={baixa.data}
                                    className="tabular-nums whitespace-nowrap text-gray-700 dark:text-gray-200"
                                    title={baixa.observacoes}
                                  >
                                    {formatData(baixa.data)}
                                    {' · '}
                                    <span className="font-medium text-blue-700 dark:text-blue-300">
                                      {formatCurrency(baixa.valor)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </td>
                          <td className="px-3 py-2 max-w-[280px]">
                            <EstadoTitulo
                              resultado={resultados.get(titulo.idNota)}
                              total={marcadas.has(titulo.idNota) ? titulo.baixas.length : 0}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {pulados.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Pulados ({pulados.length})
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      não são lançados — acerte no título e refaça a prévia
                    </span>
                  </h3>
                  <ul className="border border-gray-100 dark:border-gray-700 rounded-2xl divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                    {pulados.map(({ titulo, motivo }) => (
                      <li key={titulo.idNota} className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                          {titulo.numeroNota ?? 'sem número'}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300 truncate max-w-[240px]" title={titulo.operadora}>
                          {titulo.operadora}
                        </span>
                        <span className="tabular-nums text-gray-500 dark:text-gray-400">
                          apLIS {formatCurrency(titulo.recebidoAplis)}
                          {' · '}aqui {formatCurrency(titulo.recebidoSistema)}
                          {' · '}saldo {formatCurrency(titulo.saldo)}
                        </span>
                        <span className={SELO_PULADO}>baixa pulada — {motivo}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {executando ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {concluidos} de {plural(resultados.size, 'título', 'títulos')}
              </span>
            ) : resumo ? (
              resumo
            ) : previa && aplicaveis.length > 0 ? (
              <>
                {plural(total.titulos, 'título', 'títulos')}
                {' · '}{plural(total.baixas.qtd, 'baixa', 'baixas')}{' '}
                <strong className="text-blue-700 dark:text-blue-300">{formatCurrency(total.baixas.valor)}</strong>
                {' '}a lançar
              </>
            ) : null}
          </span>
          <div className="flex gap-2">
            {!travado && (
              <button
                type="button"
                onClick={() => void carregar()}
                disabled={carregando}
                className={BOTAO_SECUNDARIO}
              >
                <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} /> Refazer
              </button>
            )}
            {travado ? (
              <button
                type="button"
                onClick={fechar}
                disabled={executando}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
              >
                Fechar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void confirmar()}
                disabled={carregando || total.titulos === 0}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {total.titulos === 0
                  ? 'Nada marcado'
                  : `Lançar ${plural(total.baixas.qtd, 'baixa', 'baixas')}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AplicarBaixasAplisModal;
