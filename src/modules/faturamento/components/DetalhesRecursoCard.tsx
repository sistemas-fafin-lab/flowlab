import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  History,
  ImageIcon,
  MessageSquare,
  X,
} from 'lucide-react';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import { useDetalheRequisicaoRecurso, useRequisicoesLoteRecurso } from '../hooks/useGlosasRecursos';
import { useImagensRequisicaoLegado } from '../hooks/useImagensRequisicaoLegado';
import type {
  DetalheRequisicaoRecurso,
  JustificativaRecurso,
  LoteRecursoFoto,
  ObservacaoRecurso,
  RequisicaoRecursoFoto,
} from '../types';
import { corStatusFaturamento } from '../utils/corStatusFaturamento';
import { formatCompetencia, formatCurrency, formatData } from '../utils/formato';
import { rotuloStatusAplis, SELOS_ATRASO, STATUS_LOTE_CORES } from '../utils/recursoGlosaVisual';
import { ImagensRequisicaoLegadoModal } from './ImagensRequisicaoLegadoModal';

// Card lateral "Detalhes do recurso" (.scratch/glosas-recursos-dashboard/,
// issue 05). Aberto pelo olho de um lote: bloco do lote + requisições do lote;
// clicar numa requisição abre as abas. Aberto só com `idRequisicao` (Glosas
// recentes, Recursos fora de lote), vai direto à requisição, sem o lote.
// É um painel ao lado da lista, não um modal.

type AbaRequisicao = 'historico' | 'justificativa' | 'observacoes' | 'documentos';

// Sem ícone: as quatro precisam caber na largura do card.
const ABAS: { id: AbaRequisicao; label: string }[] = [
  { id: 'historico', label: 'Histórico' },
  { id: 'justificativa', label: 'Justificativa' },
  { id: 'observacoes', label: 'Observações' },
  { id: 'documentos', label: 'Documentos' },
];

const CHIP = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';

function valorOuTraco(valor: number | null): string {
  return valor === null ? '—' : formatCurrency(valor);
}

/** 'YYYY-MM-DD HH:MM' do apLIS → 'DD/MM/AAAA HH:MM'. */
function dataHoraAplis(valor: string | null): string {
  if (!valor) return '—';
  const [dia, hora] = valor.split(' ');
  return hora ? `${formatData(dia)} ${hora}` : formatData(dia);
}

const Campo: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
  <div className="min-w-0">
    <dt className="text-xs text-gray-500 dark:text-gray-400">{rotulo}</dt>
    <dd className="text-sm text-gray-900 dark:text-white break-words">{children}</dd>
  </div>
);

const Erro: React.FC<{ mensagem: string }> = ({ mensagem }) => (
  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
    <p className="text-sm text-red-700 dark:text-red-300">{mensagem}</p>
  </div>
);

const Vazio: React.FC<{ icone: React.ElementType; texto: string }> = ({ icone: Icone, texto }) => (
  <div className="text-center py-8">
    <Icone className="h-8 w-8 text-gray-400 mx-auto mb-2" />
    <p className="text-sm text-gray-500 dark:text-gray-400">{texto}</p>
  </div>
);

const BlocoLote: React.FC<{ lote: LoteRecursoFoto }> = ({ lote }) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
    <Campo rotulo="Lote de recurso">
      <span className="font-semibold">{lote.idLoteRecurso}</span>
    </Campo>
    <Campo rotulo="Status">
      <span className={`${CHIP} ${STATUS_LOTE_CORES[lote.statusLabel]}`}>{lote.statusLabel}</span>
    </Campo>
    <Campo rotulo="Protocolo do recurso">{lote.protocolo ?? '—'}</Campo>
    <Campo rotulo="Protocolo de faturamento">
      <span className="font-mono text-xs">{lote.protocoloFaturamento ?? '—'}</span>
    </Campo>
    <div className="col-span-2">
      <Campo rotulo="Convênio">{lote.fontePagadora.nome ?? 'Não identificado'}</Campo>
    </div>
    <Campo rotulo="Criação">{formatData(lote.dataCriacao)}</Campo>
    <Campo rotulo="Envio">{formatData(lote.dataEnvio)}</Campo>
    <Campo rotulo="Retorno previsto">{formatData(lote.dataRetornoPrevista)}</Campo>
    <Campo rotulo="Pagamento previsto">{formatData(lote.dataPagamentoPrevista)}</Campo>
    <Campo rotulo="Atraso">
      {lote.selo === 'sem-regra' || lote.selo === null ? (
        <span className="text-gray-400 dark:text-gray-500">—</span>
      ) : (
        <span className={`${CHIP} ${SELOS_ATRASO[lote.selo].cor}`}>{SELOS_ATRASO[lote.selo].label}</span>
      )}
    </Campo>
  </dl>
);

const ChipStatusAplis: React.FC<{ codigo: number | null }> = ({ codigo }) => {
  const rotulo = rotuloStatusAplis(codigo);
  return <span className={`${CHIP} ${corStatusFaturamento(codigo, rotulo)}`}>{rotulo}</span>;
};

const ListaRequisicoes: React.FC<{
  idLoteRecurso: number;
  onAbrir: (r: RequisicaoRecursoFoto) => void;
}> = ({ idLoteRecurso, onAbrir }) => {
  const { dados: requisicoes, loading, error } = useRequisicoesLoteRecurso(idLoteRecurso);

  if (loading) return <LoadingSpinner message="Carregando requisições..." />;
  if (error) return <Erro mensagem={error} />;
  if (!requisicoes || requisicoes.length === 0) {
    return <Vazio icone={FileText} texto="Nenhuma requisição deste lote na foto" />;
  }

  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700 -mx-5">
      {requisicoes.map((r) => (
        <li key={r.idRequisicao}>
          <button
            onClick={() => onAbrir(r)}
            className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {r.paciente ?? 'Paciente não identificado'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Guia {r.numGuia ?? '—'} · Req. {r.codRequisicao ?? r.idRequisicao} · {formatCompetencia(r.competencia)}
              </div>
              <div className="mt-1">
                <ChipStatusAplis codigo={r.statusAplis} />
              </div>
            </div>
            <div className="text-right shrink-0 text-xs">
              <div className="text-gray-500 dark:text-gray-400">Recursado</div>
              <div className="font-semibold text-gray-900 dark:text-white">{valorOuTraco(r.valorRecursado)}</div>
              <div className="text-gray-500 dark:text-gray-400 mt-1">Recebido de glosa</div>
              <div className="font-semibold text-green-700 dark:text-green-400">{valorOuTraco(r.valorRecebidoGlosa)}</div>
            </div>
            <ChevronRight size={16} className="text-gray-400 shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
};

const ResumoRequisicao: React.FC<{ requisicao: RequisicaoRecursoFoto }> = ({ requisicao: r }) => (
  <div className="space-y-3">
    <div>
      <div className="text-base font-semibold text-gray-900 dark:text-white break-words">
        {r.paciente ?? 'Paciente não identificado'}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <ChipStatusAplis codigo={r.statusAplis} />
        {r.valorInicialEstimado && (
          <span
            className={`${CHIP} bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300`}
            title="A foto foi tirada depois do envio do recurso: a glosa fixada pode não ser a original."
          >
            Valor inicial estimado
          </span>
        )}
      </div>
    </div>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Campo rotulo="Requisição">{r.codRequisicao ?? r.idRequisicao}</Campo>
      <Campo rotulo="Guia">{r.numGuia ?? '—'}</Campo>
      <Campo rotulo="Convênio">{r.fontePagadora.nome ?? 'Não identificado'}</Campo>
      <Campo rotulo="Mês de faturamento">{formatCompetencia(r.competencia)}</Campo>
      <Campo rotulo="Lote de recurso">{r.idLoteRecurso ?? 'Fora de lote'}</Campo>
      <Campo rotulo="Glosa fixada">{valorOuTraco(r.glosaFixada)}</Campo>
      <Campo rotulo="Valor recursado">{valorOuTraco(r.valorRecursado)}</Campo>
      <Campo rotulo="Recebido de glosa">{valorOuTraco(r.valorRecebidoGlosa)}</Campo>
    </dl>
  </div>
);

const AbaJustificativa: React.FC<{ justificativas: JustificativaRecurso[]; foraDeLote: boolean }> = ({
  justificativas,
  foraDeLote,
}) => {
  if (foraDeLote) return <Vazio icone={FileText} texto="Requisição fora de lote de recurso: sem justificativa" />;
  if (justificativas.length === 0) return <Vazio icone={FileText} texto="Nenhum procedimento no lote de recurso" />;
  return (
    <ul className="space-y-3">
      {justificativas.map((j) => (
        <li key={j.idProcedimento} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 break-words">
              {j.procedimento ?? 'Procedimento não identificado'}
            </span>
            <span className="text-xs font-semibold text-gray-900 dark:text-white whitespace-nowrap">
              {formatCurrency(j.valorRecurso)}
            </span>
          </div>
          {j.motivoGlosa && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Motivo: {j.motivoGlosa}</p>
          )}
          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line break-words">
            {j.justificativa ?? <span className="text-gray-400 dark:text-gray-500">Sem justificativa</span>}
          </p>
        </li>
      ))}
    </ul>
  );
};

const AbaObservacoes: React.FC<{ observacoes: ObservacaoRecurso[] }> = ({ observacoes }) => {
  if (observacoes.length === 0) {
    return <Vazio icone={MessageSquare} texto='Nenhuma tarefa para o setor "GLOSA - FATURAMENTO"' />;
  }
  return (
    <ul className="space-y-3">
      {observacoes.map((o) => (
        <li key={o.codTarefa} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{o.tipo ?? 'Tarefa'}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{dataHoraAplis(o.data)}</span>
          </div>
          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line break-words">{o.mensagem ?? '—'}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{o.remetente ?? ''}</span>
            {o.concluida ? (
              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                <CheckCircle2 size={12} /> Concluída
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <Clock size={12} /> Em aberto
              </span>
            )}
          </div>
          {o.obsConclusao && (
            <p className="text-xs text-gray-600 dark:text-gray-300 break-words">Conclusão: {o.obsConclusao}</p>
          )}
        </li>
      ))}
    </ul>
  );
};

const AbaDocumentos: React.FC<{ idRequisicao: number }> = ({ idRequisicao }) => {
  const { imagens, loading, error } = useImagensRequisicaoLegado(idRequisicao);
  const [indiceAberto, setIndiceAberto] = useState<number | null>(null);

  if (loading) return <LoadingSpinner message="Carregando documentos..." />;
  if (error) return <Erro mensagem={error} />;
  if (imagens.length === 0) return <Vazio icone={ImageIcon} texto="Nenhum documento digitalizado" />;

  return (
    <>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
        {imagens.map((img, i) => (
          <li key={img.id}>
            <button
              onClick={() => setIndiceAberto(i)}
              className="w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <ImageIcon size={16} className="text-gray-400 shrink-0" />
              <span className="flex-1 min-w-0 text-sm text-gray-900 dark:text-white truncate">{img.nomeArquivo}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {img.disponivel ? formatData(img.data) : 'Aguardando digitalização'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {indiceAberto !== null && (
        <ImagensRequisicaoLegadoModal
          idRequisicao={idRequisicao}
          indiceInicial={indiceAberto}
          onClose={() => setIndiceAberto(null)}
        />
      )}
    </>
  );
};

/** Justificativa e Observações: as duas vêm da mesma consulta ao apLIS. */
const AbaDoAplis: React.FC<{
  aba: 'justificativa' | 'observacoes';
  dados: DetalheRequisicaoRecurso | null;
  loading: boolean;
  error: string | null;
}> = ({ aba, dados, loading, error }) => {
  if (loading) return <LoadingSpinner message="Consultando o apLIS..." />;
  if (error) return <Erro mensagem={error} />;
  if (!dados) return null;
  if (aba === 'observacoes') return <AbaObservacoes observacoes={dados.observacoes} />;
  return (
    <AbaJustificativa justificativas={dados.justificativas} foraDeLote={dados.requisicao.idLoteRecurso === null} />
  );
};

const DetalheRequisicao: React.FC<{
  idRequisicao: number;
  /** Já lida na lista do lote: mostra o resumo antes do detalhe chegar. */
  previa: RequisicaoRecursoFoto | null;
}> = ({ idRequisicao, previa }) => {
  const { dados, loading, error } = useDetalheRequisicaoRecurso(idRequisicao);
  // O Histórico ainda está vazio (ticket 06): abre na Justificativa.
  const [aba, setAba] = useState<AbaRequisicao>('justificativa');
  const requisicao = dados?.requisicao ?? previa;

  return (
    <div className="space-y-4">
      {requisicao && <ResumoRequisicao requisicao={requisicao} />}

      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto" role="tablist">
        {ABAS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={`flex-1 px-1 py-2 text-xs font-medium text-center border-b-2 -mb-px whitespace-nowrap transition-colors ${
              aba === id
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'historico' && <Vazio icone={History} texto="Histórico da requisição — em breve" />}
      {aba === 'documentos' && <AbaDocumentos idRequisicao={idRequisicao} />}
      {(aba === 'justificativa' || aba === 'observacoes') && (
        <AbaDoAplis aba={aba} dados={dados} loading={loading} error={error} />
      )}
    </div>
  );
};

interface Props {
  /** Aberto pelo olho do lote: bloco do lote e lista de requisições. */
  lote?: LoteRecursoFoto | null;
  /** Requisição aberta direto; sem `lote`, o card mostra só ela. */
  idRequisicao?: number | null;
  onClose: () => void;
}

const DetalhesRecursoCard: React.FC<Props> = ({ lote = null, idRequisicao = null, onClose }) => {
  const [requisicaoAberta, setRequisicaoAberta] = useState<{ id: number; previa: RequisicaoRecursoFoto | null } | null>(
    idRequisicao === null ? null : { id: idRequisicao, previa: null },
  );

  // Outro lote ou outra requisição pedida de fora: recomeça.
  useEffect(() => {
    setRequisicaoAberta(idRequisicao === null ? null : { id: idRequisicao, previa: null });
  }, [lote?.idLoteRecurso, idRequisicao]);

  return (
    <aside
      aria-label="Detalhes do recurso"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden xl:max-h-[calc(100vh-2rem)]"
    >
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {lote && requisicaoAberta && (
            <button
              onClick={() => setRequisicaoAberta(null)}
              className="p-1 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Voltar às requisições do lote"
              title="Voltar às requisições do lote"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">Detalhes do recurso</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Fechar detalhes"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Escondido, não desmontado: voltar do detalhe não recarrega a lista. */}
        {lote && (
          <div className={`space-y-5 ${requisicaoAberta ? 'hidden' : ''}`}>
            <BlocoLote lote={lote} />
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Requisições do lote</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Todos os meses de faturamento</p>
              <ListaRequisicoes idLoteRecurso={lote.idLoteRecurso} onAbrir={(r) => setRequisicaoAberta({ id: r.idRequisicao, previa: r })} />
            </div>
          </div>
        )}
        {requisicaoAberta && (
          <DetalheRequisicao key={requisicaoAberta.id} idRequisicao={requisicaoAberta.id} previa={requisicaoAberta.previa} />
        )}
      </div>
    </aside>
  );
};

export default DetalhesRecursoCard;
