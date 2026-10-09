import React, { useRef, useState } from 'react';
import { ExternalLink, FileText, ImageIcon, Paperclip, Upload } from 'lucide-react';
import { ACCEPT_ANEXOS, formatarTamanho } from '../../domain/anexos';
import { urlAssinadaAnexo } from '../../storage';
import type { Anexo } from '../../types';

interface AnexosSecaoProps {
  anexos: Anexo[];
  podeGerenciar: boolean;
  /** Mensagem do que não subiu, ou null. */
  onAdicionar: (arquivos: File[]) => Promise<string | null>;
  onRemover: (path: string) => Promise<string | null>;
  /** Texto do vazio, ex.: "Contrato, proposta ou e-mail de autorização". */
  dicaVazio: string;
}

const formatarData = (iso: string): string =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

/** Lista de anexos de um registro (despesa; na issue 06, lançamento) com abrir, enviar e remover. */
const AnexosSecao: React.FC<AnexosSecaoProps> = ({ anexos, podeGerenciar, onAdicionar, onRemover, dicaVazio }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    setEnviando(true);
    setErro(null);
    setErro(await onAdicionar(Array.from(lista)));
    setEnviando(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const abrir = async (path: string) => {
    setErro(null);
    // Abre a aba já no clique (antes do await): aberta depois, o navegador bloqueia como pop-up.
    const janela = window.open('', '_blank');
    const url = await urlAssinadaAnexo(path);
    if (!url) {
      janela?.close();
      setErro('Não foi possível abrir o arquivo. Tente de novo.');
      return;
    }
    if (janela) {
      janela.opener = null;
      janela.location.href = url;
    } else {
      window.location.href = url;
    }
  };

  const remover = async (path: string) => {
    if (confirmando !== path) {
      setConfirmando(path);
      return;
    }
    setRemovendo(path);
    setErro(await onRemover(path));
    setRemovendo(null);
    setConfirmando(null);
  };

  return (
    <div>
      {anexos.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum anexo. {podeGerenciar && dicaVazio}</p>
      ) : (
        <ul className="space-y-2">
          {anexos.map((a) => {
            const Icone = a.tipo === 'application/pdf' ? FileText : ImageIcon;
            return (
              <li
                key={a.path}
                className="flex items-center gap-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60 px-3 py-2"
              >
                <Icone className="w-5 h-5 flex-shrink-0 text-violet-500 dark:text-violet-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-100 truncate" title={a.nome}>
                    {a.nome}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatarTamanho(a.tamanho)} · enviado em {formatarData(a.enviadoEm)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => abrir(a.path)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir
                </button>
                {podeGerenciar && (
                  <button
                    type="button"
                    onClick={() => remover(a.path)}
                    onBlur={() => setConfirmando(null)}
                    disabled={removendo === a.path}
                    className={`text-xs font-medium disabled:opacity-50 ${confirmando === a.path ? 'text-red-600 dark:text-red-400' : 'text-slate-400 hover:text-red-600 dark:hover:text-red-400'}`}
                  >
                    {removendo === a.path ? 'Removendo...' : confirmando === a.path ? 'Confirmar' : 'Remover'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {podeGerenciar && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ANEXOS}
            onChange={(e) => enviar(e.target.files)}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-dashed border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 disabled:opacity-60 transition-colors"
          >
            {enviando ? <Upload className="w-4 h-4 animate-pulse" /> : <Paperclip className="w-4 h-4" />}
            {enviando ? 'Enviando...' : 'Anexar arquivos'}
          </button>
          <p className="mt-1 text-xs text-slate-400">PDF, PNG ou JPEG, até 10 MB cada.</p>
        </>
      )}

      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
    </div>
  );
};

export default AnexosSecao;
