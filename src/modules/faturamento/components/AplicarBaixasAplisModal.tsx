import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X, XCircle } from 'lucide-react';
import { chamarApi, rpcLancarGlosasAplis, rpcRegistrarBaixa } from '../hooks/useContasReceber';
import type { PreviaBaixasAplis, StatusGlosaAplis, TituloPreviaBaixasAplis } from '../types';
import { formatCurrency, formatData, plural } from '../utils/formato';
import {
  aplicarTitulo,
  descricaoResultado,
  motivoPuladoBaixa,
  motivoPuladoGlosa,
  resumoAplicacao,
  selecaoPadrao,
  separarPrevia,
  temBaixaAplicavel,
  titulosComBaixaRepetida,
  titulosComGlosaRepetida,
  totalALancar,
} from '../utils/aplicarBaixasAplis';
import type { ResultadoTitulo } from '../utils/aplicarBaixasAplis';

// "Aplicar baixas e glosas do apLIS" (.scratch/faturamento-baixas-automaticas-aplis
// e .scratch/faturamento-glosas-automaticas-aplis): prévia das baixas que faltam
// lançar, uma por data de recebimento no apLIS, e das glosas do apLIS, uma por
// lote + código + status. O operador marca baixas e glosas de cada título em
// separado e confirma. Título a título, em sequência: as baixas pela mesma RPC
// do "Registrar baixa" (`fat_registrar_baixa`, uma por vez — a RPC recalcula o
// título a cada uma) e depois as glosas numa chamada de `fat_lancar_glosas_aplis`,
// só se todas as baixas marcadas entraram.

const MENSAGEM_PADRAO = 'Não foi possível montar a prévia das baixas e glosas do apLIS.';

const ROTULO_STATUS_GLOSA: Record<StatusGlosaAplis, string> = {
  aberta: 'aberta',
  em_recurso: 'em recurso',
  definitiva: 'definitiva',
};

const SELO_PULADO =
  'px-2 py-0.5 text-[11px] rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';

const BOTAO_SECUNDARIO =
  'px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Fechou depois de lançar ao menos uma baixa ou glosa: relê a lista e a conferência. */
  onAlterados: () => void;
}

async function buscarPrevia(): Promise<PreviaBaixasAplis> {
  const body = await chamarApi<{ meta?: { dadoAte?: string | null }; titulos?: TituloPreviaBaixasAplis[] }>(
    '/api/faturamento/titulos-baixas-aplis-previa',
    MENSAGEM_PADRAO,
  );
  return { dadoAte: body.meta?.dadoAte ?? null, titulos: body.titulos ?? [] };
}

function BaixaPulada({ titulo }: { titulo: TituloPreviaBaixasAplis }) {
  const motivo = motivoPuladoBaixa(titulo);
  if (!motivo) return <span className="text-gray-400" title="O recebido já bate com o apLIS.">—</span>;
  return <span className={SELO_PULADO}>pulada — {motivo}</span>;
}

function GlosasDoTitulo({ titulo }: { titulo: TituloPreviaBaixasAplis }) {
  const pulado = motivoPuladoGlosa(titulo);
  if (titulo.glosas.length === 0) {
    return pulado ? <span className={SELO_PULADO}>pulada — {pulado}</span> : <span className="text-gray-400">—</span>;
  }
  return (
    <ul className="space-y-0.5">
      {titulo.glosas.map((glosa) => (
        <li
          key={`${glosa.idLote}|${glosa.codigo ?? glosa.motivo}|${glosa.status}`}
          className="text-gray-700 dark:text-gray-200"
          title={`${glosa.motivo} · ${plural(glosa.procedimentos, 'procedimento', 'procedimentos')}`}
        >
          <span className="tabular-nums">lote {glosa.idLote}</span>
          {' · '}
          {glosa.codigo ?? 'sem código'}
          <span className="ml-1 text-gray-500 dark:text-gray-400 truncate inline-block max-w-[180px] align-bottom">
            {glosa.motivo}
          </span>
          {' · '}
          <span className="text-gray-500 dark:text-gray-400">{ROTULO_STATUS_GLOSA[glosa.status]}</span>
          {' · '}
          <span className="tabular-nums text-gray-500 dark:text-gray-400">{glosa.procedimentos} proc.</span>
          {' · '}
          <span className="font-medium tabular-nums text-rose-700 dark:text-rose-300 whitespace-nowrap">
            {formatCurrency(glosa.valor)}
          </span>
        </li>
      ))}
    </ul>
  );
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
  const [baixasMarcadas, setBaixasMarcadas] = useState<Set<string>>(new Set());
  const [glosasMarcadas, setGlosasMarcadas] = useState<Set<string>>(new Set());
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
      const selecao = selecaoPadrao(resultado.titulos);
      setBaixasMarcadas(new Set(selecao.baixas));
      setGlosasMarcadas(new Set(selecao.glosas));
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
        'As baixas e glosas ainda estão sendo lançadas. Se fechar agora, o que ainda não começou fica para a próxima vez (o que já foi lançado não é desfeito). Fechar mesmo assim?',
      )
    ) {
      return;
    }
    execucaoRef.current += 1;
    setPrevia(null);
    setErro(null);
    setCarregando(false);
    setBaixasMarcadas(new Set());
    setGlosasMarcadas(new Set());
    setResultados(new Map());
    setExecutando(false);
    setResumo(null);
    if (lancouRef.current) {
      lancouRef.current = false;
      onAlterados();
    }
    onFechar();
  };

  const alternar = (setMarcados: typeof setBaixasMarcadas, idNota: string) => {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(idNota)) novo.delete(idNota);
      else novo.add(idNota);
      return novo;
    });
  };

  const confirmar = async () => {
    const alvos = (previa?.titulos ?? [])
      .map((titulo) => ({
        titulo,
        baixas: temBaixaAplicavel(titulo) && baixasMarcadas.has(titulo.idNota),
        glosas: titulo.glosas.length > 0 && glosasMarcadas.has(titulo.idNota),
      }))
      .filter((alvo) => alvo.baixas || alvo.glosas);
    if (alvos.length === 0) return;

    const execucao = ++execucaoRef.current;
    const vigente = () => execucaoRef.current === execucao;
    const estados = new Map<string, ResultadoTitulo>(
      alvos.map(({ titulo }) => [
        titulo.idNota,
        { estado: 'aguardando', baixasLancadas: 0, glosasLancadas: 0, glosasNaoLancadas: false },
      ]),
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
      const { idNota } = alvo.titulo;
      marcar(idNota, { ...(estados.get(idNota) as ResultadoTitulo), estado: 'lancando' });
      // Um erro num título não para os outros: aplicarTitulo devolve o erro no resultado.
      const resultado = await aplicarTitulo(alvo, {
        // Não usa o registrarBaixa do hook: ele relê a lista a cada baixa.
        registrarBaixa: rpcRegistrarBaixa,
        lancarGlosas: rpcLancarGlosasAplis,
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
  const comBaixa = aplicaveis.filter(temBaixaAplicavel);
  // Lote vinculado a mais de um título: a baixa ou a glosa dele começa desmarcada.
  const repetidos = new Set([...titulosComBaixaRepetida(comBaixa), ...titulosComGlosaRepetida(aplicaveis)]);
  const comGlosa = aplicaveis.filter((t) => t.glosas.length > 0);
  const total = totalALancar(aplicaveis, { baixas: baixasMarcadas, glosas: glosasMarcadas });
  // Depois de confirmar, a prévia vira o relatório da execução.
  const travado = executando || resultados.size > 0;
  const todasBaixasMarcadas = comBaixa.length > 0 && comBaixa.every((t) => baixasMarcadas.has(t.idNota));
  const todasGlosasMarcadas = comGlosa.length > 0 && comGlosa.every((t) => glosasMarcadas.has(t.idNota));
  const concluidos = [...resultados.values()].filter(
    (r) => r.estado !== 'aguardando' && r.estado !== 'lancando',
  ).length;
  const dadoAte = previa?.dadoAte ? `até ${formatData(previa.dadoAte)}` : 'até ontem';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Aplicar baixas e glosas do apLIS</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Baixas recebidas no apLIS que faltam lançar aqui, uma por data de recebimento, e glosas do apLIS, uma
              por lote, código e status · as glosas de um título só entram se as baixas marcadas dele entrarem ·
              dados do apLIS {dadoAte}
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
              <Loader2 className="w-4 h-4 animate-spin" /> Calculando as baixas e as glosas a partir do apLIS…
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
                Todas as baixas recebidas no apLIS ({dadoAte}) já estão lançadas aqui, e não há glosa do apLIS a
                lançar.
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
                              checked={todasBaixasMarcadas}
                              disabled={travado || comBaixa.length === 0}
                              onChange={() =>
                                setBaixasMarcadas(
                                  todasBaixasMarcadas ? new Set() : new Set(comBaixa.map((t) => t.idNota)),
                                )
                              }
                              className="rounded border-gray-300 dark:border-gray-600"
                              aria-label="Marcar todas as baixas"
                            />
                            Baixas a lançar
                          </label>
                        </th>
                        <th className="px-3 py-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={todasGlosasMarcadas}
                              disabled={travado || comGlosa.length === 0}
                              onChange={() =>
                                setGlosasMarcadas(
                                  todasGlosasMarcadas ? new Set() : new Set(comGlosa.map((t) => t.idNota)),
                                )
                              }
                              className="rounded border-gray-300 dark:border-gray-600"
                              aria-label="Marcar todas as glosas"
                            />
                            Glosas a lançar
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
                              {titulo.numeroNota}
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
                            {titulo.recebidoAplis === null ? '—' : formatCurrency(titulo.recebidoAplis)}
                          </td>
                          <td className="px-3 py-2">
                            {titulo.baixas.length === 0 && <BaixaPulada titulo={titulo} />}
                            <div className="flex items-start gap-2">
                              {temBaixaAplicavel(titulo) && (
                                <input
                                  type="checkbox"
                                  checked={baixasMarcadas.has(titulo.idNota)}
                                  disabled={travado}
                                  onChange={() => alternar(setBaixasMarcadas, titulo.idNota)}
                                  className="mt-0.5 rounded border-gray-300 dark:border-gray-600"
                                  aria-label={`Lançar as baixas do título ${titulo.numeroNota}`}
                                />
                              )}
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
                          <td className="px-3 py-2 text-xs">
                            <div className="flex items-start gap-2">
                              {titulo.glosas.length > 0 && (
                                <input
                                  type="checkbox"
                                  checked={glosasMarcadas.has(titulo.idNota)}
                                  disabled={travado}
                                  onChange={() => alternar(setGlosasMarcadas, titulo.idNota)}
                                  className="mt-0.5 rounded border-gray-300 dark:border-gray-600"
                                  aria-label={`Lançar as glosas do título ${titulo.numeroNota}`}
                                />
                              )}
                              <GlosasDoTitulo titulo={titulo} />
                            </div>
                          </td>
                          <td className="px-3 py-2 max-w-[280px]">
                            <EstadoTitulo
                              resultado={resultados.get(titulo.idNota)}
                              total={temBaixaAplicavel(titulo) && baixasMarcadas.has(titulo.idNota) ? titulo.baixas.length : 0}
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
                    {pulados.map(({ titulo, motivo, motivoGlosa }) => (
                      <li key={titulo.idNota} className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                          {titulo.numeroNota ?? 'sem número'}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300 truncate max-w-[240px]" title={titulo.operadora}>
                          {titulo.operadora}
                        </span>
                        <span className="tabular-nums text-gray-500 dark:text-gray-400">
                          apLIS {titulo.recebidoAplis === null ? '—' : formatCurrency(titulo.recebidoAplis)}
                          {' · '}aqui {formatCurrency(titulo.recebidoSistema)}
                          {' · '}saldo {formatCurrency(titulo.saldo)}
                        </span>
                        {motivo && <span className={SELO_PULADO}>baixa pulada — {motivo}</span>}
                        {motivoGlosa && <span className={SELO_PULADO}>glosa pulada — {motivoGlosa}</span>}
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
                {' · '}{plural(total.glosas.qtd, 'glosa', 'glosas')}{' '}
                <strong className="text-rose-700 dark:text-rose-300">{formatCurrency(total.glosas.valor)}</strong>
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
                  : `Lançar ${[
                    total.baixas.qtd > 0 ? plural(total.baixas.qtd, 'baixa', 'baixas') : null,
                    total.glosas.qtd > 0 ? plural(total.glosas.qtd, 'glosa', 'glosas') : null,
                  ].filter(Boolean).join(' e ')}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AplicarBaixasAplisModal;
