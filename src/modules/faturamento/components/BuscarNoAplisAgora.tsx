import React, { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { chamarApi } from '../hooks/useContasReceber';

// "Buscar no apLIS agora" (.scratch/faturamento-recebidos-aplis-site): lê no site
// do apLIS o recebido dos lotes com saldo em aberto e grava o retrato — a mesma
// leitura da rotina das 07h/12h/17h. Leva de 1 a 3 minutos.

const BOTAO =
  'px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed';

interface ResumoCaptura {
  previstos: number;
  lidos: number;
  recusados: number;
  pendentes: number;
  erro: string | null;
}

interface Props {
  /** Releitura da tela depois da captura. */
  onConcluido: () => void;
  desabilitado?: boolean;
}

function textoResumo(r: ResumoCaptura): string {
  const partes = [`${r.lidos} de ${r.previstos} lotes lidos no site`];
  if (r.pendentes > 0) partes.push(`${r.pendentes} ficaram para a próxima leitura`);
  if (r.recusados > 0) partes.push(`${r.recusados} recusados pelo apLIS`);
  if (r.erro) partes.push(`parou com erro: ${r.erro}`);
  return partes.join(' · ');
}

const BuscarNoAplisAgora: React.FC<Props> = ({ onConcluido, desabilitado }) => {
  const [buscando, setBuscando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);

  const buscar = async () => {
    setBuscando(true);
    setMensagem(null);
    try {
      const r = await chamarApi<ResumoCaptura>(
        '/api/faturamento/recebidos-aplis-site-capturar',
        'Não foi possível ler o site do apLIS agora.',
        { method: 'POST', body: {} },
      );
      setMensagem({ texto: textoResumo(r), erro: Boolean(r.erro) });
      onConcluido();
    } catch (err) {
      setMensagem({ texto: err instanceof Error ? err.message : 'Não foi possível ler o site do apLIS agora.', erro: true });
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className={BOTAO} onClick={() => void buscar()} disabled={buscando || desabilitado}>
        {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {buscando ? 'Lendo o site do apLIS (1 a 3 min)…' : 'Buscar no apLIS agora'}
      </button>
      {mensagem && (
        <span className={`text-[11px] ${mensagem.erro ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {mensagem.texto}
        </span>
      )}
    </div>
  );
};

export default BuscarNoAplisAgora;
