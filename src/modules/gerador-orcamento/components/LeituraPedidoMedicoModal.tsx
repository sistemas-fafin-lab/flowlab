import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileText, Image as ImageIcon, Loader2, Plus, Sparkles, Upload, X } from 'lucide-react';
import { analisarPedidoMedico } from '../api';
import { chaveExame } from '../domain/carrinho';
import {
  MAX_ARQUIVOS_PEDIDO,
  MAX_MB_POR_ARQUIVO,
  problemaNosArquivosDoPedido,
  resolverLeituraDoPedido,
  type LeituraDoPedido,
} from '../domain/pedidoMedico';
import type { ItemGeradorOrcamento } from '../types';
import { formatCurrency } from '../../../utils/paymentUtils';

const formatarTamanho = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const BOTAO_PRIMARIO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none';
const BOTAO_SECUNDARIO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Leitura do pedido médico por IA: o atendente escolhe as fotos/PDFs, a IA lê os
 * exames e a janela mostra os reconhecidos (marcados para entrar no carrinho) e os
 * sem correspondência (para buscar à mão). Nada entra no carrinho sem a revisão.
 * Montada só enquanto aberta: fechar descarta arquivos e resultado.
 */
const LeituraPedidoMedicoModal: React.FC<{
  exames: readonly ItemGeradorOrcamento[];
  onFechar: () => void;
  onAdicionar: (exames: ItemGeradorOrcamento[]) => void;
}> = ({ exames, onFechar, onAdicionar }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<LeituraDoPedido | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const problema = arquivos.length > 0 ? problemaNosArquivosDoPedido(arquivos) : null;

  const incluirArquivos = (novos: File[]) => {
    setErro(null);
    setArquivos((atuais) => [
      ...atuais,
      ...novos.filter((n) => !atuais.some((a) => a.name === n.name && a.size === n.size)),
    ]);
  };

  const analisar = async () => {
    const motivo = problemaNosArquivosDoPedido(arquivos);
    if (motivo) {
      setErro(motivo);
      return;
    }
    setAnalisando(true);
    setErro(null);
    try {
      const resultado = resolverLeituraDoPedido(await analisarPedidoMedico(arquivos), exames);
      setLeitura(resultado);
      setMarcados(new Set(resultado.reconhecidos.map((r) => chaveExame(r.exame))));
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : 'Não foi possível analisar o pedido médico.');
    } finally {
      setAnalisando(false);
    }
  };

  const alternarMarcado = (chave: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const selecionados = useMemo(
    () => (leitura?.reconhecidos ?? []).filter((r) => marcados.has(chaveExame(r.exame))).map((r) => r.exame),
    [leitura, marcados],
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-leitura-pedido"
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-scale-in"
      >
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="titulo-leitura-pedido" className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Ler pedido médico
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A IA identifica os exames; você revisa antes de ir ao carrinho.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            disabled={analisando}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-full transition-all duration-200 hover:rotate-90 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {!leitura ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  incluirArquivos(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={analisando}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastando(true);
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastando(false);
                  incluirArquivos(Array.from(e.dataTransfer.files));
                }}
                className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
                  arrastando
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40 dark:border-gray-600 dark:bg-gray-900/30'
                }`}
              >
                <Upload className={`w-8 h-8 ${arrastando ? 'text-blue-500' : 'text-gray-400'}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Arraste as fotos ou PDFs aqui <span className="text-blue-600 dark:text-blue-400">ou clique para escolher</span>
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Até {MAX_ARQUIVOS_PEDIDO} arquivos, {MAX_MB_POR_ARQUIVO}MB cada
                </span>
              </button>

              {arquivos.length > 0 && (
                <ul className="space-y-1.5">
                  {arquivos.map((arquivo, i) => (
                    <li
                      key={`${arquivo.name}-${arquivo.size}`}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2"
                    >
                      {arquivo.type.startsWith('image/') ? (
                        <ImageIcon className="w-4 h-4 text-gray-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-200">{arquivo.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{formatarTamanho(arquivo.size)}</span>
                      <button
                        type="button"
                        aria-label={`Remover ${arquivo.name}`}
                        disabled={analisando}
                        onClick={() => {
                          setErro(null);
                          setArquivos((atuais) => atuais.filter((_, j) => j !== i));
                        }}
                        className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {(problema || erro) && (
                <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {problema ?? erro}
                </p>
              )}

              {analisando && (
                <p className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Lendo o pedido… pode levar até um minuto.
                </p>
              )}
            </>
          ) : (
            <>
              <section>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  Reconhecidos ({leitura.reconhecidos.length})
                </h3>
                {leitura.reconhecidos.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum exame do pedido foi achado na lista.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700">
                    {leitura.reconhecidos.map(({ nomeNoPedido, exame }) => {
                      const chave = chaveExame(exame);
                      return (
                        <li key={chave}>
                          <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                            <input
                              type="checkbox"
                              checked={marcados.has(chave)}
                              onChange={() => alternarMarcado(chave)}
                              className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{exame.nome}</span>
                              <span className="block text-xs text-gray-500 dark:text-gray-400">
                                No pedido: “{nomeNoPedido}” · TUSS {exame.tuss || '—'}
                              </span>
                            </span>
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
                              {formatCurrency(exame.preco)}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {leitura.semCorrespondencia.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-1">
                    Sem correspondência ({leitura.semCorrespondencia.length})
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Lidos no pedido, mas sem exame na lista. Busque à mão se precisar.
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {leitura.semCorrespondencia.map((nome, i) => (
                      <li
                        key={`${nome}-${i}`}
                        className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800/60"
                      >
                        {nome}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 rounded-b-2xl flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {!leitura ? (
            <>
              <button type="button" onClick={onFechar} disabled={analisando} className={BOTAO_SECUNDARIO}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={analisar}
                disabled={arquivos.length === 0 || !!problema || analisando}
                className={BOTAO_PRIMARIO}
              >
                {analisando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analisar
                pedido
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setLeitura(null);
                  setArquivos([]);
                }}
                className={BOTAO_SECUNDARIO}
              >
                Ler outro pedido
              </button>
              <button
                type="button"
                onClick={() => {
                  onAdicionar(selecionados);
                  onFechar();
                }}
                disabled={selecionados.length === 0}
                className={BOTAO_PRIMARIO}
              >
                <Plus className="w-4 h-4" /> Adicionar {selecionados.length} ao carrinho
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeituraPedidoMedicoModal;
