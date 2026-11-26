import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarX, Hourglass, Wallet } from 'lucide-react';
import { usePendenciasGlosa } from '../hooks/useGlosasRecursos';
import type { FiltroPendenciaGlosa } from '../types';
import { formatCompetencia, formatCurrency, plural } from '../utils/formato';
import { Kpi, VIDRO } from './KpiVidro';

// Dashboard de glosa → "Pendências de glosa"
// (.scratch/glosas-recursos-calendario-pendencias/issues/06), no layout das
// Pendências de faturamento do Contas a Receber: seletor de mês próprio (o mês
// em que o prazo venceu; vazio = todo o período) e três cards que abrem a lista
// filtrada. Os números vêm prontos do servidor (recursoGlosa.ts →
// pendenciasDeGlosa), de todos os meses de faturamento: o período do cabeçalho
// não filtra, o convênio sim.

// O mês fica salvo para não voltar ao padrão a cada visita. '' = todo o período.
const MES_STORAGE_KEY = 'flowLab_glosas_mes_pendencias';

function mesSalvo(): string {
  try {
    const salvo = localStorage.getItem(MES_STORAGE_KEY) ?? '';
    return /^\d{4}-\d{2}$/.test(salvo) ? salvo : '';
  } catch {
    return '';
  }
}

interface Props {
  fontePagadoraId: number | null;
  /** Muda a cada sincronização ou edição concluída: recarrega os cards. */
  versao: number;
  /** Abre a lista filtrada do card. */
  onAbrir: (filtro: FiltroPendenciaGlosa) => void;
}

const PendenciasGlosaBloco: React.FC<Props> = ({ fontePagadoraId, versao, onAbrir }) => {
  const [mes, setMesState] = useState(mesSalvo);
  const setMes = useCallback((novo: string) => {
    setMesState(novo);
    try {
      if (novo) localStorage.setItem(MES_STORAGE_KEY, novo);
      else localStorage.removeItem(MES_STORAGE_KEY);
    } catch {
      /* storage indisponível: o mês vale só nesta visita */
    }
  }, []);

  const { pendencias, loading, error, refetch } = usePendenciasGlosa(mes || null, fontePagadoraId);

  const versaoVista = useRef(versao);
  useEffect(() => {
    if (versaoVista.current === versao) return;
    versaoVista.current = versao;
    void refetch();
  }, [versao, refetch]);

  const indisponivel = loading || error !== null || pendencias === null;
  const valor = (v: number | undefined) => (indisponivel || v === undefined ? '—' : formatCurrency(v));
  const sub = (texto: (p: NonNullable<typeof pendencias>) => string) =>
    loading ? 'carregando…' : error || !pendencias ? 'indisponível' : texto(pendencias);
  const abrir = (tipo: FiltroPendenciaGlosa['tipo']) => () => onAbrir({ tipo, mes: mes || null });

  return (
    <div className={`${VIDRO} rounded-3xl p-3 sm:p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Pendências de glosa — {mes ? `vencidas em ${formatCompetencia(mes)}` : 'todo o período'}
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            aria-label="Mês em que o prazo venceu"
            className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100"
          />
          {mes && (
            <button
              type="button"
              onClick={() => setMes('')}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Todo o período
            </button>
          )}
        </div>
      </div>

      {error && !loading && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-2">
          {error}{' '}
          <button type="button" onClick={() => void refetch()} className="underline font-medium">
            Tentar novamente
          </button>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 [grid-auto-rows:1fr]">
        <Kpi
          icon={<CalendarX className="w-4 h-4 sm:w-5 sm:h-5" />}
          label="Glosas sem recurso com prazo vencido"
          sub={sub((p) => plural(p.prazoVencido.quantidade, 'requisição', 'requisições'))}
          dica={
            'Glosado sem recurso (6), fora de lote de recurso, com o prazo para recorrer (recebimento + regra '
            + 'Glosa – Recurso do convênio) antes de hoje. Valor pela glosa fixada.'
          }
          valor={valor(pendencias?.prazoVencido.valor)}
          cor="from-red-500 to-red-600"
          atraso={0}
          onClick={abrir('vencidos')}
        />
        <Kpi
          icon={<Hourglass className="w-4 h-4 sm:w-5 sm:h-5" />}
          label="Recursos com retorno atrasado"
          sub={sub((p) => plural(p.retornoAtrasado.quantidade, 'lote', 'lotes'))}
          dica={
            'Lote de recurso enviado, sem data real de retorno e com requisição ainda em análise, com o retorno '
            + 'previsto (envio + regra Glosa – Análise) antes de hoje: o selo "Atrasado" da lista. Valor pelo recursado.'
          }
          valor={valor(pendencias?.retornoAtrasado.valor)}
          cor="from-orange-500 to-orange-600"
          atraso={1}
          onClick={abrir('retorno-atrasado')}
        />
        <Kpi
          icon={<Wallet className="w-4 h-4 sm:w-5 sm:h-5" />}
          label="Recursos com pagamento atrasado"
          sub={sub((p) => `${plural(p.pagamentoAtrasado.quantidade, 'requisição', 'requisições')} em ${plural(p.pagamentoAtrasado.qtdLotes, 'lote', 'lotes')}`)}
          dica={
            'Requisição de lote de recurso enviado, sem resultado final (nem deferido total, nem indeferido, nem '
            + 'acatada), com o pagamento previsto (retorno real ou previsto + regra Glosa – Pagamento) antes de '
            + 'hoje. Valor: recursado − recebido de glosa.'
          }
          valor={valor(pendencias?.pagamentoAtrasado.valor)}
          cor="from-amber-500 to-amber-600"
          atraso={2}
          onClick={abrir('pagamento-atrasado')}
        />
      </div>
    </div>
  );
};

export default PendenciasGlosaBloco;
