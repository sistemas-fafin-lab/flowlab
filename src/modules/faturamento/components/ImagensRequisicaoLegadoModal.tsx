import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Maximize,
  RefreshCw,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useImagensRequisicaoLegado } from '../hooks/useImagensRequisicaoLegado';
import type { ImagemRequisicaoLegado } from '../types';
import { formatData } from '../utils/formato';

// Visualizador das imagens/documentos digitalizados de uma requisição no legado
// (requisicaoimagem), aberto pela aba Documentos do card "Detalhes do recurso"
// (Glosas e Recursos). Vai num portal por consistência com DocumentoLightbox (analises-clinicas),
// mesmo padrão de overlay fullscreen + navegação por teclado. Imagens têm zoom
// (botões, roda do mouse, +/-), rotação (botões, R) e arrasto quando ampliadas;
// PDF fica com os controles do próprio leitor do navegador.

const EXTENSOES_IMAGEM = new Set(['JPG', 'JPE', 'JFI', 'JPEG', 'PNG', 'GIF', 'BMP', 'TIF', 'TIFF']);

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 5;
const PASSO_ZOOM = 1.25;

const VISTA_INICIAL = { zoom: 1, rotacao: 0, x: 0, y: 0 };

const BOTAO_FERRAMENTA =
  'p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors';

function limitarZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

export const ImagensRequisicaoLegadoModal: React.FC<{
  idRequisicao: number;
  /** Posição na lista de imagens em que o visualizador abre. */
  indiceInicial?: number;
  onClose: () => void;
}> = ({ idRequisicao, indiceInicial = 0, onClose }) => {
  const { imagens, loading, error, carregarArquivo } = useImagensRequisicaoLegado(idRequisicao);
  const [indice, setIndice] = useState(indiceInicial);
  const [url, setUrl] = useState<string | null>(null);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [vista, setVista] = useState(VISTA_INICIAL);
  const arrasto = useRef<{ x: number; y: number } | null>(null);

  const ampliar = useCallback(() => setVista((v) => ({ ...v, zoom: limitarZoom(v.zoom * PASSO_ZOOM) })), []);
  // Voltando a 100% ou menos, a imagem recentraliza: não há o que arrastar.
  const reduzir = useCallback(
    () =>
      setVista((v) => {
        const zoom = limitarZoom(v.zoom / PASSO_ZOOM);
        return zoom <= 1 ? { ...v, zoom, x: 0, y: 0 } : { ...v, zoom };
      }),
    [],
  );
  // Proporcional ao deslocamento: no trackpad um gesto dispara dezenas de eventos.
  const zoomPelaRoda = (deltaY: number) =>
    setVista((v) => {
      const zoom = limitarZoom(v.zoom * Math.exp(-deltaY * 0.002));
      return zoom <= 1 ? { ...v, zoom, x: 0, y: 0 } : { ...v, zoom };
    });
  const girar = useCallback((graus: number) => setVista((v) => ({ ...v, rotacao: v.rotacao + graus })), []);
  const restaurar = useCallback(() => setVista(VISTA_INICIAL), []);

  useEffect(() => {
    setIndice(indiceInicial);
  }, [idRequisicao, indiceInicial]);

  const total = imagens.length;
  const atual: ImagemRequisicaoLegado | undefined = imagens[indice];

  const extensao = (atual?.extensao ?? '').toUpperCase();
  const ehImagem = EXTENSOES_IMAGEM.has(extensao);
  const ehPdf = extensao === 'PDF';
  const ajustavel = Boolean(url) && ehImagem;

  const anterior = useCallback(() => setIndice((i) => (i - 1 + total) % total), [total]);
  const proximo = useCallback(() => setIndice((i) => (i + 1) % total), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Fecha só o visualizador, não o modal de detalhes que está por baixo.
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft' && total > 1) anterior();
      else if (e.key === 'ArrowRight' && total > 1) proximo();
      else if (!ajustavel) return;
      else if (e.key === '+' || e.key === '=') ampliar();
      else if (e.key === '-') reduzir();
      else if (e.key === 'r') girar(90);
      else if (e.key === 'R') girar(-90);
      else if (e.key === '0') restaurar();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, anterior, proximo, total, ajustavel, ampliar, reduzir, girar, restaurar]);

  useEffect(() => {
    setUrl(null);
    setErroArquivo(null);
    setVista(VISTA_INICIAL);
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

  const onArrastoInicio = (e: React.PointerEvent<HTMLImageElement>) => {
    if (vista.zoom <= 1) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX - vista.x, y: e.clientY - vista.y };
  };
  const onArrastoMove = (e: React.PointerEvent<HTMLImageElement>) => {
    const inicio = arrasto.current;
    if (!inicio) return;
    setVista((v) => ({ ...v, x: e.clientX - inicio.x, y: e.clientY - inicio.y }));
  };
  const onArrastoFim = () => {
    arrasto.current = null;
  };

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
              Este arquivo não está no banco de backup e o acesso ao S3 do apLIS não está
              configurado.
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
            <div
              className="w-full h-full flex items-center justify-center overflow-hidden"
              onWheel={(e) => zoomPelaRoda(e.deltaY)}
            >
              <img
                src={url}
                alt={atual.nomeArquivo}
                draggable={false}
                onPointerDown={onArrastoInicio}
                onPointerMove={onArrastoMove}
                onPointerUp={onArrastoFim}
                onPointerCancel={onArrastoFim}
                onDoubleClick={() => (vista.zoom === 1 ? setVista((v) => ({ ...v, zoom: 2 })) : restaurar())}
                style={{
                  transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.zoom}) rotate(${vista.rotacao}deg)`,
                }}
                className={`max-h-full max-w-full object-contain rounded-xl shadow-2xl select-none ${
                  arrasto.current ? '' : 'transition-transform duration-150'
                } ${vista.zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
              />
            </div>
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

      {(ajustavel || total > 1) && (
        <div className="mt-3 flex items-center gap-4 shrink-0" onClick={(e) => e.stopPropagation()}>
          {ajustavel && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/10" role="toolbar" aria-label="Visualização da imagem">
              <button onClick={reduzir} disabled={vista.zoom <= ZOOM_MIN} className={BOTAO_FERRAMENTA} title="Diminuir zoom (-)" aria-label="Diminuir zoom">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="w-12 text-center text-xs font-medium text-white/80 tabular-nums">
                {Math.round(vista.zoom * 100)}%
              </span>
              <button onClick={ampliar} disabled={vista.zoom >= ZOOM_MAX} className={BOTAO_FERRAMENTA} title="Aumentar zoom (+)" aria-label="Aumentar zoom">
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="w-px h-4 mx-1 bg-white/20" />
              <button onClick={() => girar(-90)} className={BOTAO_FERRAMENTA} title="Girar à esquerda (Shift+R)" aria-label="Girar à esquerda">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={() => girar(90)} className={BOTAO_FERRAMENTA} title="Girar à direita (R)" aria-label="Girar à direita">
                <RotateCw className="w-4 h-4" />
              </button>
              <span className="w-px h-4 mx-1 bg-white/20" />
              <button
                onClick={restaurar}
                disabled={vista.zoom === 1 && vista.rotacao === 0 && vista.x === 0 && vista.y === 0}
                className={BOTAO_FERRAMENTA}
                title="Tamanho original (0)"
                aria-label="Tamanho original"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          )}
          {total > 1 && (
            <span className="text-xs font-medium text-white/60">
              {indice + 1} / {total}
            </span>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
};

export default ImagensRequisicaoLegadoModal;
