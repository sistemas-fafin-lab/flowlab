import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useConferenciaAplis } from '../hooks/useConferenciaAplis';
import { foraDoSaldoPendente, recebidosSemBaixaNoSaldo } from '../utils/conferenciaAplis';
import { formatCurrency, formatData } from '../utils/formato';

// Card flutuante do "Saldo pendente" no Dashboard: ao passar o mouse, lista os lotes
// recebidos no apLIS que ainda não têm a baixa no FlowLab (selo amarelo da aba
// Títulos). O saldo deles já entrou no caixa; falta o "Atualizar do apLIS → Baixas".
//
// A conferência é pesada (lê o apLIS lote a lote): só é buscada no primeiro hover.
// O card fica num portal com posição fixa porque o widget dos KPIs tem overflow e
// cortaria qualquer coisa que saísse dele.

const LARGURA = 420;
const MARGEM = 8;
/** Tempo para o mouse sair do card e entrar no flutuante sem ele fechar. */
const ATRASO_FECHAR_MS = 150;

interface Props {
  desde: string;
  ate: string;
  /** Nomes das operadoras no recorte do card (consideradas na meta + filtro da tela). */
  operadoras: ReadonlySet<string>;
  children: React.ReactNode;
}

const RecebidosSemBaixaFlutuante: React.FC<Props> = ({ desde, ate, operadoras, children }) => {
  const [aberto, setAberto] = useState(false);
  // Liga a leitura no primeiro hover e não desliga mais (o hook relê quando liga).
  const [ativo, setAtivo] = useState(false);
  const { titulos, carregando, erro } = useConferenciaAplis(ativo, 0);

  const ancoraRef = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<number | undefined>(undefined);
  // Acima do card, ancora pela borda de baixo (`bottom`): a altura real do
  // conteúdo não é conhecida antes de renderizar, e ancorar pelo topo com a
  // altura máxima deixava o flutuante solto, longe do card.
  const [posicao, setPosicao] = useState<
    { left: number; maxHeight: number } & ({ top: number } | { bottom: number })
  | null>(null);

  const abrir = useCallback(() => {
    window.clearTimeout(fecharRef.current);
    setAtivo(true);
    setAberto(true);
  }, []);
  const fecharDepois = useCallback(() => {
    window.clearTimeout(fecharRef.current);
    fecharRef.current = window.setTimeout(() => setAberto(false), ATRASO_FECHAR_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(fecharRef.current), []);

  // Abaixo do card; acima se não couber. Fecha ao rolar (a posição é fixa).
  useLayoutEffect(() => {
    if (!aberto || !ancoraRef.current) return;
    const r = ancoraRef.current.getBoundingClientRect();
    const largura = Math.min(LARGURA, window.innerWidth - 2 * MARGEM);
    const left = Math.max(MARGEM, Math.min(r.right - largura, window.innerWidth - largura - MARGEM));
    const espacoAbaixo = window.innerHeight - r.bottom - 2 * MARGEM;
    const espacoAcima = r.top - 2 * MARGEM;
    if (espacoAbaixo >= 240 || espacoAbaixo >= espacoAcima) {
      setPosicao({ top: r.bottom + MARGEM, left, maxHeight: espacoAbaixo });
    } else {
      setPosicao({ bottom: window.innerHeight - r.top + MARGEM, left, maxHeight: Math.min(espacoAcima, 420) });
    }
    const fechar = () => setAberto(false);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [aberto]);

  const lista = useMemo(
    () => (titulos ? recebidosSemBaixaNoSaldo(titulos, { desde, ate, operadoras }) : null),
    [titulos, desde, ate, operadoras],
  );
  const fora = useMemo(
    () => (titulos ? foraDoSaldoPendente(titulos, { desde, ate, operadoras }) : null),
    [titulos, desde, ate, operadoras],
  );
  const total = lista ? lista.reduce((soma, r) => soma + Math.round(r.faltaLancar * 100), 0) / 100 : 0;
  const qtdLotes = lista ? new Set(lista.flatMap((r) => r.divergencia.lotes.map((l) => l.aplisId))).size : 0;

  let conteudo: React.ReactNode;
  if (lista === null && erro) {
    conteudo = <p className="text-xs text-rose-600 dark:text-rose-400">{erro}</p>;
  } else if (lista === null || (carregando && lista.length === 0)) {
    conteudo = (
      <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Conferindo com o apLIS…
      </p>
    );
  } else if (lista.length === 0) {
    conteudo = (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Nenhum título emitido de {formatData(desde)} a {formatData(ate)} recebido no apLIS sem baixa no FlowLab.
      </p>
    );
  } else {
    conteudo = (
      <>
        <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
          <span className="font-semibold tabular-nums">{qtdLotes} lote{qtdLotes === 1 ? '' : 's'}</span>
          {' · '}
          <span className="font-semibold tabular-nums">{formatCurrency(total)}</span> já recebidos no apLIS
          e ainda no saldo
        </p>
        <ul className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
          {lista.map(({ divergencia: d, faltaLancar }) => (
            <li key={d.idNota} className="py-1.5 flex items-start justify-between gap-3 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                  Lote {d.lotes.map((l) => l.aplisId).join(', ')}
                  <span className="font-normal text-slate-500 dark:text-slate-400"> · {d.operadora}</span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  NF {d.numeroNota ?? '—'}
                  {d.ultimoRecebimentoAplis && ` · recebido em ${formatData(d.ultimoRecebimentoAplis)}`}
                  {d.tipo === 'aplis-maior' && ' · baixa parcial no FlowLab'}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {formatCurrency(faltaLancar)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Para lançar: Contas a Receber → Atualizar do apLIS → Baixas.
        </p>
      </>
    );
  }

  // Explica o que não entrou: outro período (o card segue o filtro de emissão) e
  // lote que o apLIS não achou (banco do apLIS vazio ou desatualizado).
  const avisos = lista !== null && fora && (fora.foraDoPeriodo.quantidade > 0 || fora.loteAusente > 0) && (
    <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
      {fora.foraDoPeriodo.quantidade > 0 && (
        <p>
          Fora do período: {fora.foraDoPeriodo.quantidade} título{fora.foraDoPeriodo.quantidade === 1 ? '' : 's'}
          {' '}({formatCurrency(fora.foraDoPeriodo.valor)}) recebido{fora.foraDoPeriodo.quantidade === 1 ? '' : 's'} no
          apLIS sem baixa. Amplie o período para vê-los.
        </p>
      )}
      {fora.loteAusente > 0 && (
        <p className="text-amber-700 dark:text-amber-400">
          {fora.loteAusente} título{fora.loteAusente === 1 ? '' : 's'} do período com lote não encontrado no apLIS:
          a lista pode estar incompleta se o banco do apLIS estiver sendo atualizado.
        </p>
      )}
    </div>
  );

  return (
    <div
      ref={ancoraRef}
      className="h-full"
      onMouseEnter={abrir}
      onMouseLeave={fecharDepois}
      onFocus={abrir}
      onBlur={fecharDepois}
    >
      {children}
      {aberto && posicao && createPortal(
        <div
          role="tooltip"
          onMouseEnter={abrir}
          onMouseLeave={fecharDepois}
          style={{ position: 'fixed', ...('top' in posicao ? { top: posicao.top } : { bottom: posicao.bottom }), left: posicao.left, width: Math.min(LARGURA, window.innerWidth - 2 * MARGEM), maxHeight: posicao.maxHeight }}
          className="z-[60] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3 animate-fade-in-up"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Recebidos no apLIS sem baixa
          </p>
          {conteudo}
          {avisos}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default RecebidosSemBaixaFlutuante;
