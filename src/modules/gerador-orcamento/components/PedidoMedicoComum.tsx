// Peças comuns das janelas de leitura do pedido médico por IA (modo particular,
// LeituraPedidoMedicoModal, e modo colaborador, LeituraPedidoColaboradorModal): a
// moldura da janela, a escolha dos arquivos e o aviso dos exames não encontrados.

import React, { useRef, useState } from 'react';
import { AlertTriangle, FileText, Image as ImageIcon, Loader2, Sparkles, Upload, X } from 'lucide-react';
import {
  MAX_ARQUIVOS_PEDIDO,
  MAX_MB_POR_ARQUIVO,
  fraseDoNaoEncontrado,
  type ExameNaoEncontrado,
} from '../domain/pedidoMedico';
import type { ArquivosDoPedido } from '../hooks/useArquivosDoPedido';

export const BOTAO_PRIMARIO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none';
export const BOTAO_SECUNDARIO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

const formatarTamanho = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Relacionados visíveis antes do "ver mais". */
const RELACIONADOS_VISIVEIS = 3;

/** Aviso de um exame não encontrado: só texto, nada daqui vai ao carrinho. */
export const AvisoNaoEncontrado: React.FC<{ exame: ExameNaoEncontrado }> = ({ exame }) => {
  const [expandido, setExpandido] = useState(false);
  const { relacionados } = exame;
  const ocultos = relacionados.length - RELACIONADOS_VISIVEIS;
  const visiveis = expandido || ocultos <= 0 ? relacionados : relacionados.slice(0, RELACIONADOS_VISIVEIS);

  return (
    <li className="px-3 py-2.5">
      <p className="text-sm text-gray-800 dark:text-gray-100">{fraseDoNaoEncontrado(exame)}</p>
      {relacionados.length > 0 && (
        <>
          <ul className="mt-1.5 space-y-0.5 pl-4 list-disc marker:text-amber-500">
            {visiveis.map((nome) => (
              <li key={nome} className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {nome}
              </li>
            ))}
          </ul>
          {ocultos > 0 && (
            <button
              type="button"
              onClick={() => setExpandido((atual) => !atual)}
              className="mt-1 text-xs font-medium text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
            >
              {expandido ? 'ver menos' : `ver mais (+${ocultos})`}
            </button>
          )}
        </>
      )}
    </li>
  );
};

/** Os não encontrados na tabela, com os relacionados de cada um, para buscar à mão. */
export const SecaoNaoEncontrados: React.FC<{ exames: readonly ExameNaoEncontrado[] }> = ({ exames }) =>
  exames.length === 0 ? null : (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-900/10">
      <div className="flex items-start gap-2 px-3 pt-3">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Não encontrados na tabela ({exames.length})
          </h3>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
            Estes exames do pedido não foram identificados na tabela. Confira o pedido e busque manualmente antes de
            enviar o orçamento.
          </p>
        </div>
      </div>
      <ul className="mt-2 divide-y divide-amber-200/70 border-t border-amber-200/70 dark:divide-amber-800/40 dark:border-amber-800/40">
        {exames.map((exame, i) => (
          <AvisoNaoEncontrado key={`${exame.nomeNoPedido}-${i}`} exame={exame} />
        ))}
      </ul>
    </section>
  );

/** Área de escolha dos arquivos (clique ou arrastar), a lista deles, o erro e o "lendo…". */
export const AreaArquivosDoPedido: React.FC<{ estado: ArquivosDoPedido }> = ({ estado }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const { arquivos, problema, erro, analisando, incluir, remover } = estado;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          incluir(Array.from(e.target.files ?? []));
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
          incluir(Array.from(e.dataTransfer.files));
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
                onClick={() => remover(i)}
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
  );
};

/** Botões do rodapé antes da leitura: cancelar e analisar. */
export const AcoesDoEnvio: React.FC<{ estado: ArquivosDoPedido; onFechar: () => void }> = ({ estado, onFechar }) => (
  <>
    <button type="button" onClick={onFechar} disabled={estado.analisando} className={BOTAO_SECUNDARIO}>
      Cancelar
    </button>
    <button
      type="button"
      onClick={() => void estado.analisar()}
      disabled={estado.arquivos.length === 0 || !!estado.problema || estado.analisando}
      className={BOTAO_PRIMARIO}
    >
      {estado.analisando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analisar
      pedido
    </button>
  </>
);

/** A janela: fundo, cabeçalho com o fechar, corpo rolável e rodapé. */
export const MolduraLeituraPedido: React.FC<{
  subtitulo: string;
  analisando: boolean;
  onFechar: () => void;
  classeCorpo?: string;
  rodape: React.ReactNode;
  children: React.ReactNode;
}> = ({ subtitulo, analisando, onFechar, classeCorpo = '', rodape, children }) => (
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
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitulo}</p>
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
      <div className={`px-6 py-5 overflow-y-auto flex-1 space-y-4 ${classeCorpo}`}>{children}</div>
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 rounded-b-2xl flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        {rodape}
      </div>
    </div>
  </div>
);
