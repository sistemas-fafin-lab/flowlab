import React, { useEffect, useRef, useState } from 'react';
import { Download, FileText, Paperclip, UploadCloud, X } from 'lucide-react';
import { ANEXO_ACCEPT, ehImagem, formatarTamanho, type AnexoIT } from '../../utils/itAnexos';

// Peças de anexo da conversa e da resolução dos chamados de TI: escolher arquivos
// (clipe ou zona de soltar), ver os escolhidos antes de enviar e mostrar os já
// enviados dentro de uma mensagem. A validação fica em utils/itAnexos.

// ── Botão de clipe ──────────────────────────────────────────────────────────

export const BotaoAnexar: React.FC<{
  onArquivos: (arquivos: File[]) => void;
  disabled?: boolean;
  className?: string;
}> = ({ onArquivos, disabled, className = '' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ANEXO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          onArquivos(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title="Anexar arquivos (imagem, PDF, Office, TXT, CSV ou ZIP · até 10 MB)"
        aria-label="Anexar arquivos"
        className={`p-2 rounded-xl text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 ${className}`}
      >
        <Paperclip className="w-4 h-4" />
      </button>
    </>
  );
};

// ── Zona de soltar ──────────────────────────────────────────────────────────

export const ZonaAnexos: React.FC<{
  onArquivos: (arquivos: File[]) => void;
  disabled?: boolean;
}> = ({ onArquivos, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        if (!disabled) onArquivos(Array.from(e.dataTransfer.files));
      }}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/15 ${
        arrastando
          ? 'border-violet-500 bg-violet-50/80 dark:bg-violet-500/10'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/30 hover:border-violet-400/70 hover:bg-violet-50/40 dark:hover:bg-violet-500/5'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ANEXO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          onArquivos(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700 flex items-center justify-center flex-shrink-0">
        <UploadCloud className="w-4 h-4 text-violet-500" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {arrastando ? 'Solte para anexar' : 'Arraste arquivos ou clique para anexar'}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Imagem, PDF, Office, TXT, CSV ou ZIP · até 10 MB cada</p>
      </div>
    </div>
  );
};

// ── Escolhidos, antes de enviar ─────────────────────────────────────────────

const MiniaturaLocal: React.FC<{ arquivo: File }> = ({ arquivo }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!ehImagem(arquivo.name)) return;
    const objeto = URL.createObjectURL(arquivo);
    setUrl(objeto);
    return () => URL.revokeObjectURL(objeto);
  }, [arquivo]);
  return url ? (
    <img src={url} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
  ) : (
    <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/15 flex items-center justify-center flex-shrink-0">
      <FileText className="w-3.5 h-3.5 text-violet-500" />
    </div>
  );
};

export const AnexosPendentes: React.FC<{
  arquivos: File[];
  onRemover: (indice: number) => void;
  disabled?: boolean;
}> = ({ arquivos, onRemover, disabled }) => {
  if (!arquivos.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {arquivos.map((arquivo, i) => (
        <li
          key={`${arquivo.name}-${arquivo.size}`}
          className="flex items-center gap-2 pl-1.5 pr-1 py-1 max-w-[16rem] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs shadow-sm"
        >
          <MiniaturaLocal arquivo={arquivo} />
          <span className="truncate text-slate-700 dark:text-slate-200">{arquivo.name}</span>
          <span className="text-slate-400 whitespace-nowrap">{formatarTamanho(arquivo.size)}</span>
          <button
            type="button"
            onClick={() => onRemover(i)}
            disabled={disabled}
            aria-label={`Remover ${arquivo.name}`}
            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </li>
      ))}
    </ul>
  );
};

// ── Enviados, dentro de uma mensagem ────────────────────────────────────────

type TomLista = 'padrao' | 'invertido';

export const ListaAnexos: React.FC<{ anexos: AnexoIT[]; tom?: TomLista; className?: string }> = ({
  anexos,
  tom = 'padrao',
  className = '',
}) => {
  if (!anexos.length) return null;
  const imagens = anexos.filter((a) => ehImagem(a.name));
  const arquivos = anexos.filter((a) => !ehImagem(a.name));
  const chip =
    tom === 'invertido'
      ? 'bg-white/15 hover:bg-white/25 text-white border-white/20'
      : 'bg-slate-50 hover:bg-violet-50 dark:bg-slate-900/40 dark:hover:bg-violet-500/10 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700';
  return (
    <div className={`space-y-2 ${className}`}>
      {imagens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imagens.map((a) => (
            <a
              key={a.url}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              title={a.name}
              className="block w-24 h-24 rounded-xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10 hover:ring-2 hover:ring-violet-400 transition-all"
            >
              <img src={a.url} alt={a.name} loading="lazy" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {arquivos.map((a) => (
        <a
          key={a.url}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs transition-colors ${chip}`}
        >
          <FileText className="w-4 h-4 flex-shrink-0 opacity-80" />
          <span className="flex-1 min-w-0 truncate font-medium">{a.name}</span>
          {a.size > 0 && <span className="opacity-70 whitespace-nowrap">{formatarTamanho(a.size)}</span>}
          <Download className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
        </a>
      ))}
    </div>
  );
};
