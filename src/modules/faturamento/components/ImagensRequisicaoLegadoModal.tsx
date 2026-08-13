import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  RefreshCw,
  X,
} from 'lucide-react';
import { useImagensRequisicaoLegado } from '../hooks/useImagensRequisicaoLegado';
import type { ImagemRequisicaoLegado } from '../types';
import { formatData } from '../utils/formato';

// Visualizador das imagens/documentos digitalizados de uma requisição no legado
// (requisicaoimagem), aberto pelo botão "Ver imagens" dos históricos de Glosas e
// Recursos. Vai num portal por consistência com DocumentoLightbox (analises-clinicas),
// mesmo padrão de overlay fullscreen + navegação por teclado.

const EXTENSOES_IMAGEM = new Set(['JPG', 'JPE', 'JFI', 'JPEG', 'PNG', 'GIF', 'BMP', 'TIF', 'TIFF']);

export const ImagensRequisicaoLegadoModal: React.FC<{
  idRequisicao: number;
  onClose: () => void;
}> = ({ idRequisicao, onClose }) => {
  const { imagens, loading, error, carregarArquivo } = useImagensRequisicaoLegado(idRequisicao);
  const [indice, setIndice] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);

  useEffect(() => {
    setIndice(0);
  }, [idRequisicao]);

  const total = imagens.length;
  const atual: ImagemRequisicaoLegado | undefined = imagens[indice];

  const anterior = useCallback(() => setIndice((i) => (i - 1 + total) % total), [total]);
  const proximo = useCallback(() => setIndice((i) => (i + 1) % total), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && total > 1) anterior();
      else if (e.key === 'ArrowRight' && total > 1) proximo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, anterior, proximo, total]);

  useEffect(() => {
    setUrl(null);
    setErroArquivo(null);
    if (!atual || !atual.disponivel) return;

    let cancelado = false;
    setCarregandoArquivo(true);
    carregarArquivo(atual.id)
      .then((u) => { if (!cancelado) setUrl(u); })
      .catch((err) => {
        if (!cancelado) {
          setErroArquivo(err instanceof Error ? err.message : 'Não foi possível carregar a imagem.');
        }
      })
      .finally(() => { if (!cancelado) setCarregandoArquivo(false); });

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual?.id, atual?.disponivel]);

  const extensao = (atual?.extensao ?? '').toUpperCase();
  const ehImagem = EXTENSOES_IMAGEM.has(extensao);
  const ehPdf = extensao === 'PDF';

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-[60] animate-fade-in"
      onClick={onClose}
    >
      {/* Barra superior */}
      <div
        className="w-full max-w-4xl flex items-center justify-between gap-3 mb-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium text-white/90 truncate">
          Requisição #{idRequisicao}
          {atual && ` · ${atual.nomeArquivo}${atual.extensao ? `.${atual.extensao}` : ''}`}
          {atual?.data && ` · digitalizada em ${formatData(atual.data)}`}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Conteúdo + navegação */}
      <div
        className="relative flex items-center justify-center gap-3 min-h-0 flex-1 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {total > 1 && (
          <button
            onClick={anterior}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div className="flex-1 h-full flex items-center justify-center min-w-0">
          {loading ? (
            <p className="text-white/70 text-sm flex items-center gap-2">
              <RefreshCw size={16} className="animate-spin" />
              Consultando imagens da requisição...
            </p>
          ) : error ? (
            <p className="text-red-300 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </p>
          ) : total === 0 ? (
            <p className="text-white/70 text-sm">Nenhuma imagem encontrada para esta requisição.</p>
          ) : !atual?.disponivel ? (
            <p className="text-white/70 text-sm flex items-center gap-2 text-center max-w-sm">
              <Clock size={16} className="shrink-0" />
              Esta imagem ainda não foi digitalizada no sistema do laboratório — pode levar
              alguns dias após a requisição.
            </p>
          ) : carregandoArquivo ? (
            <p className="text-white/70 text-sm flex items-center gap-2">
              <RefreshCw size={16} className="animate-spin" />
              Carregando imagem...
            </p>
          ) : erroArquivo ? (
            <p className="text-red-300 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {erroArquivo}
            </p>
          ) : url && ehImagem ? (
            <img
              src={url}
              alt={atual.nomeArquivo}
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
            />
          ) : url && ehPdf ? (
            <iframe
              src={url}
              title={atual.nomeArquivo}
              className="w-full h-full min-h-[60vh] bg-white rounded-xl shadow-2xl"
            />
          ) : url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <FileText size={16} />
              Formato não suportado para pré-visualização — abrir em nova aba
            </a>
          ) : null}
        </div>

        {total > 1 && (
          <button
            onClick={proximo}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {total > 1 && (
        <div className="mt-3 text-xs font-medium text-white/60 shrink-0">
          {indice + 1} / {total}
        </div>
      )}
    </div>,
    document.body,
  );
};

export default ImagensRequisicaoLegadoModal;
