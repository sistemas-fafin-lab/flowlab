import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CalendarX, CheckCircle2, Eye, X } from 'lucide-react';
import { useCalendarioRecursos } from '../hooks/useGlosasRecursos';
import type {
  ItemCalendarioRecursos,
  ItemSemPrazoRecurso,
  LoteCalendarioRecursos,
  MotivoSemPrazoRecurso,
} from '../types';
import { formatCurrency, formatData, hojeIso, plural } from '../utils/formato';
import DetalhesRecursoCard from './DetalhesRecursoCard';
import ListaResumida from './ListaResumida';

// Aba "Calendário de recursos" (.scratch/glosas-recursos-calendario-pendencias,
// issue 03): os lotes de faturamento com glosas ainda não recorridas, nos
// painéis Hoje, Amanhã e Atrasados, e a lista "Sem prazo cadastrado". O prazo,
// a data de exibição (fim de semana → sexta anterior) e os selos vêm do
// servidor. O item sai sozinho quando as requisições entram num lote de recurso
// enviado; clicar nele abre as requisições, com o card "Detalhes do recurso".
// O período do cabeçalho não vale aqui; o convênio, sim.

const CARD = 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700';
const NOME_DIA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const PILULA = 'px-1.5 py-px text-[10px] font-semibold rounded-full whitespace-nowrap';

const VENCE_EM = { sab: 'vence sáb', dom: 'vence dom' } as const;

const MOTIVO_SEM_PRAZO: Record<MotivoSemPrazoRecurso, string> = {
  'sem-regra': 'Convênio sem regra de prazo',
  'regra-sem-prazo': 'Regra de recurso "sem prazo"',
  'sem-recebimento': 'Sem data de recebimento',
};

type Selecionado =
  | { tipo: 'prazo'; item: ItemCalendarioRecursos }
  | { tipo: 'sem-prazo'; item: ItemSemPrazoRecurso };

function chave(s: Selecionado): string {
  const { item } = s;
  const fim = s.tipo === 'prazo' ? s.item.prazo : s.item.motivoSemPrazo;
  return `${item.idLoteFaturamento}|${item.fontePagadora.id}|${fim}`;
}

/** Convênio, lote, protocolo, quantidade, valor e motivos: o que todo item mostra. */
const ResumoLote: React.FC<{
  item: LoteCalendarioRecursos;
  selos?: React.ReactNode;
  ativo: boolean;
  onAbrir: () => void;
}> = ({ item, selos, ativo, onAbrir }) => (
  <li>
    <button
      type="button"
      onClick={onAbrir}
      aria-pressed={ativo}
      className={`w-full text-left py-2.5 px-2 -mx-2 rounded-lg transition-colors ${
        ativo ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
          {item.fontePagadora.nome ?? 'Convênio não identificado'}
        </span>
        <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
          {formatCurrency(item.valor)}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 break-words">
        Lote {item.idLoteFaturamento}
        {item.protocolo && <> · Prot. {item.protocolo}</>}
        {' · '}
        {plural(item.quantidade, 'requisição', 'requisições')}
      </p>
      {selos && <div className="mt-1 flex flex-wrap items-center gap-1.5">{selos}</div>}
      {item.motivos.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {item.motivos.map((m) => (
            <li key={m.motivo} className="text-xs text-gray-600 dark:text-gray-300 flex gap-1 min-w-0">
              <span className="truncate" title={m.motivo}>{m.motivo}</span>
              {item.quantidade > 1 && <span className="shrink-0 text-gray-400 dark:text-gray-500">({m.quantidade})</span>}
            </li>
          ))}
          {item.qtdOutrosMotivos > 0 && (
            <li className="text-xs text-gray-400 dark:text-gray-500">
              +{plural(item.qtdOutrosMotivos, 'motivo', 'motivos')}
            </li>
          )}
        </ul>
      )}
    </button>
  </li>
);

const SeloFimDeSemana: React.FC<{ item: ItemCalendarioRecursos }> = ({ item }) =>
  item.venceEm ? (
    <span
      className={`${PILULA} bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`}
      title={`O prazo é ${formatData(item.prazo)}`}
    >
      {VENCE_EM[item.venceEm]}
    </span>
  ) : null;

const ListaItens: React.FC<{
  itens: ItemCalendarioRecursos[];
  selecionado: string | null;
  comPrazo?: boolean;
  onAbrir: (item: ItemCalendarioRecursos) => void;
}> = ({ itens, selecionado, comPrazo = false, onAbrir }) => (
  <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700 max-h-[28rem] overflow-y-auto -mr-2 pr-2">
    {itens.map((item) => (
      <ResumoLote
        key={chave({ tipo: 'prazo', item })}
        item={item}
        ativo={selecionado === chave({ tipo: 'prazo', item })}
        onAbrir={() => onAbrir(item)}
        selos={(comPrazo || item.venceEm) && (
          <>
            {comPrazo && (
              <span className="text-xs text-red-700 dark:text-red-400">venceu em {formatData(item.prazo)}</span>
            )}
            <SeloFimDeSemana item={item} />
          </>
        )}
      />
    ))}
  </ul>
);

function totalDe(itens: LoteCalendarioRecursos[]): number {
  return itens.reduce((soma, i) => soma + i.valor, 0);
}

const ContagemPainel: React.FC<{ itens: LoteCalendarioRecursos[]; cor: string }> = ({ itens, cor }) =>
  itens.length > 0 ? (
    <span className={`mt-2 inline-block px-2.5 py-1 text-xs font-medium rounded-full ${cor}`}>
      {plural(itens.length, 'lote', 'lotes')} · {formatCurrency(totalDe(itens))}
    </span>
  ) : null;

const PainelDiaRecursos: React.FC<{
  titulo: string;
  data: string;
  itens: ItemCalendarioRecursos[];
  selecionado: string | null;
  onAbrir: (item: ItemCalendarioRecursos) => void;
}> = ({ titulo, data, itens, selecionado, onAbrir }) => (
  <section className={`${CARD} p-5 min-w-0`} aria-label={titulo}>
    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{titulo}</h2>
    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{NOME_DIA.format(new Date(`${data}T00:00:00Z`))}</p>
    <ContagemPainel itens={itens} cor="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" />
    {itens.length === 0 ? (
      <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Nenhum prazo de recurso.</p>
    ) : (
      <ListaItens itens={itens} selecionado={selecionado} onAbrir={onAbrir} />
    )}
  </section>
);

const PainelAtrasadosRecursos: React.FC<{
  itens: ItemCalendarioRecursos[];
  selecionado: string | null;
  onAbrir: (item: ItemCalendarioRecursos) => void;
}> = ({ itens, selecionado, onAbrir }) => (
  <section className={`${CARD} p-5 min-w-0 md:col-span-2 xl:col-span-1`} aria-label="Atrasados">
    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
      <AlertTriangle className="h-5 w-5 text-yellow-500" />
      Atrasados
    </h2>
    <p className="text-sm text-gray-500 dark:text-gray-400">Prazo vencido e ainda sem recurso enviado</p>
    <ContagemPainel itens={itens} cor="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" />
    {itens.length === 0 ? (
      <p className="mt-4 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" />
        Nenhum prazo de recurso vencido.
      </p>
    ) : (
      <ListaItens itens={itens} selecionado={selecionado} comPrazo onAbrir={onAbrir} />
    )}
  </section>
);

const ListaSemPrazo: React.FC<{
  itens: ItemSemPrazoRecurso[];
  selecionado: string | null;
  onAbrir: (item: ItemSemPrazoRecurso) => void;
  onAbrirRegras: () => void;
}> = ({ itens, selecionado, onAbrir, onAbrirRegras }) => (
  <section className={`${CARD} p-5 min-w-0`} aria-label="Sem prazo cadastrado">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <CalendarX className="h-5 w-5 text-gray-400" />
          Sem prazo cadastrado
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Lotes sem prazo para recorrer (convênio sem regra de recurso, regra "sem prazo" ou requisição sem data de recebimento): não aparecem no calendário até isso ser completado.
        </p>
      </div>
      <button
        type="button"
        onClick={onAbrirRegras}
        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        Abrir regras de prazo
      </button>
    </div>
    {itens.length === 0 ? (
      <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Todos os convênios com glosa têm prazo de recurso.</p>
    ) : (
      <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 divide-y md:divide-y-0 divide-gray-100 dark:divide-gray-700">
        {itens.map((item) => (
          <ResumoLote
            key={chave({ tipo: 'sem-prazo', item })}
            item={item}
            ativo={selecionado === chave({ tipo: 'sem-prazo', item })}
            onAbrir={() => onAbrir(item)}
            selos={
              <span className={`${PILULA} bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300`}>
                {MOTIVO_SEM_PRAZO[item.motivoSemPrazo]}
              </span>
            }
          />
        ))}
      </ul>
    )}
  </section>
);

/** As requisições do item aberto; o olho abre o card "Detalhes do recurso". */
const RequisicoesDoItem: React.FC<{
  selecionado: Selecionado;
  idAberto: number | null;
  onAbrirRequisicao: (id: number | null) => void;
  onFechar: () => void;
}> = ({ selecionado, idAberto, onAbrirRequisicao, onFechar }) => {
  const { item } = selecionado;
  return (
    <section className={`${CARD} min-w-0 overflow-hidden`} aria-label="Requisições do lote">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white break-words">
            {item.fontePagadora.nome ?? 'Convênio não identificado'} · Lote {item.idLoteFaturamento}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 break-words">
            {item.protocolo && <>Prot. {item.protocolo} · </>}
            {selecionado.tipo === 'prazo'
              ? <>Prazo para recorrer: {formatData(selecionado.item.prazo)}</>
              : MOTIVO_SEM_PRAZO[selecionado.item.motivoSemPrazo]}
            {' · '}
            {plural(item.quantidade, 'requisição', 'requisições')} · {formatCurrency(item.valor)}
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Fechar requisições do lote"
        >
          <X size={18} />
        </button>
      </div>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {item.requisicoes.map((r) => (
          <li
            key={r.idRequisicao}
            className={`px-5 py-3 flex items-start gap-3 ${idAberto === r.idRequisicao ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
          >
            <button
              type="button"
              onClick={() => onAbrirRequisicao(idAberto === r.idRequisicao ? null : r.idRequisicao)}
              className="shrink-0 p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={`Ver detalhes da requisição ${r.codRequisicao ?? r.idRequisicao}`}
              title="Ver detalhes do recurso"
            >
              <Eye size={16} />
            </button>
            <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-gray-900 dark:text-white break-words">{r.numGuia ?? '—'}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 break-words">
                  Req. {r.codRequisicao ?? r.idRequisicao} · {r.paciente ?? '—'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Recebida em {formatData(r.dataGlosa)}</div>
              </div>
              <div className="min-w-0 text-gray-700 dark:text-gray-300 break-words">
                <ListaResumida itens={r.motivos} />
              </div>
              <div className="sm:text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                {r.valorGlosado === null ? '—' : formatCurrency(r.valorGlosado)}
                {r.valorInicialEstimado && (
                  <div className="text-[10px] font-normal uppercase tracking-wide text-amber-600 dark:text-amber-400" title="A foto foi tirada depois do envio do recurso: a glosa fixada pode não ser a original">
                    estimado
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

interface Props {
  fontePagadoraId: number | null;
  /** Muda a cada sincronização ou edição concluída: recarrega. */
  versao: number;
  podeEditar: boolean;
  onEditado: () => void;
  /** Leva à sub-aba "Regras de prazo". */
  onAbrirRegras: () => void;
}

const CalendarioRecursos: React.FC<Props> = ({ fontePagadoraId, versao, podeEditar, onEditado, onAbrirRegras }) => {
  // A grade do mês (issue 04) navega este mês; os painéis valem para qualquer mês.
  const [mes] = useState(() => hojeIso().slice(0, 7));
  const { calendario, loading, error, refetch } = useCalendarioRecursos(mes, fontePagadoraId);
  const [selecionado, setSelecionado] = useState<Selecionado | null>(null);
  const [idAberto, setIdAberto] = useState<number | null>(null);
  const detalheRef = useRef<HTMLDivElement>(null);

  const versaoVista = useRef(versao);
  useEffect(() => {
    if (versaoVista.current === versao) return;
    versaoVista.current = versao;
    void refetch();
  }, [versao, refetch]);

  useEffect(() => {
    setSelecionado(null);
    setIdAberto(null);
  }, [fontePagadoraId]);

  // Depois de uma releitura, o item aberto é o da resposta nova (ou some, se saiu do calendário).
  useEffect(() => {
    if (!calendario) return;
    setSelecionado((atual) => {
      if (!atual) return null;
      const alvo = chave(atual);
      if (atual.tipo === 'sem-prazo') {
        const item = calendario.semPrazo.find((i) => chave({ tipo: 'sem-prazo', item: i }) === alvo);
        return item ? { tipo: 'sem-prazo', item } : null;
      }
      const todos = [...calendario.paineis.hoje, ...calendario.paineis.amanha, ...calendario.paineis.atrasados, ...calendario.itens];
      const item = todos.find((i) => chave({ tipo: 'prazo', item: i }) === alvo);
      return item ? { tipo: 'prazo', item } : null;
    });
  }, [calendario]);

  useEffect(() => {
    if (selecionado) detalheRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selecionado]);

  const abrir = (s: Selecionado) => {
    setIdAberto(null);
    setSelecionado((atual) => (atual && chave(atual) === chave(s) ? null : s));
  };
  const chaveSelecionada = selecionado ? chave(selecionado) : null;

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-red-700 dark:text-red-300">O calendário de recursos não foi carregado.</p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!calendario) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <div key={i} className={`${CARD} h-48 animate-pulse ${i === 2 ? 'md:col-span-2 xl:col-span-1' : ''}`} />)}
      </div>
    );
  }

  return (
    <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Lotes de faturamento com glosas ainda sem recurso, no dia do prazo para recorrer (data de recebimento + regra
        "Glosa – Recurso" do convênio). Prazo no sábado ou no domingo aparece na sexta anterior. O período do
        cabeçalho não filtra esta aba; o convênio, sim.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <PainelDiaRecursos
          titulo="Hoje"
          data={calendario.hoje}
          itens={calendario.paineis.hoje}
          selecionado={chaveSelecionada}
          onAbrir={(item) => abrir({ tipo: 'prazo', item })}
        />
        <PainelDiaRecursos
          titulo="Amanhã"
          data={calendario.amanha}
          itens={calendario.paineis.amanha}
          selecionado={chaveSelecionada}
          onAbrir={(item) => abrir({ tipo: 'prazo', item })}
        />
        <PainelAtrasadosRecursos
          itens={calendario.paineis.atrasados}
          selecionado={chaveSelecionada}
          onAbrir={(item) => abrir({ tipo: 'prazo', item })}
        />
      </div>

      {selecionado && (
        <div ref={detalheRef} className="flex flex-col xl:flex-row xl:items-start gap-4 scroll-mt-4">
          <div className="flex-1 min-w-0">
            <RequisicoesDoItem
              selecionado={selecionado}
              idAberto={idAberto}
              onAbrirRequisicao={setIdAberto}
              onFechar={() => { setSelecionado(null); setIdAberto(null); }}
            />
          </div>
          {idAberto !== null && (
            <div className="w-full xl:w-[420px] shrink-0 xl:sticky xl:top-4">
              <DetalhesRecursoCard
                idRequisicao={idAberto}
                podeEditar={podeEditar}
                versao={versao}
                onEditado={onEditado}
                onClose={() => setIdAberto(null)}
              />
            </div>
          )}
        </div>
      )}

      <ListaSemPrazo
        itens={calendario.semPrazo}
        selecionado={chaveSelecionada}
        onAbrir={(item) => abrir({ tipo: 'sem-prazo', item })}
        onAbrirRegras={onAbrirRegras}
      />
    </div>
  );
};

export default CalendarioRecursos;
