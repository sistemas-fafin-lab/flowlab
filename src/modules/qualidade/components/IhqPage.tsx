import type { IhqDTO, NivelConfianca, StatusCuradoriaIhq } from '../types';
import { useState } from 'react';
import { VinculoDrawer } from './ihq/VinculoDrawer.js';
import { BadgeRevisaoPendente } from './ui/BadgeRevisaoPendente.js';
import { PaginaWorklist } from './ui/PaginaWorklist.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import { buscarIhqLista, sincronizarIhq } from '../ihq.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';

const BADGE_CONFIANCA: Record<NivelConfianca, string> = {
  alta: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  media: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  baixa: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  nenhuma: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const BADGE_STATUS: Record<StatusCuradoriaIhq, string> = {
  pendente: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  em_analise: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  concluida: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  descartada: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const BADGE_STATUS_LIS: Record<NonNullable<IhqDTO['statusLis']>, string> = {
  concluido: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cancelado: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  em_andamento: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

const ROTULO_STATUS_LIS: Record<NonNullable<IhqDTO['statusLis']>, string> = {
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  em_andamento: 'Em andamento',
};

// Split manual (sem `new Date`) para não sofrer deslocamento de fuso horário
// ao formatar uma data `YYYY-MM-DD` vinda do banco.
function formatarData(data: string | null): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

interface LinhaAgrupadaIhq {
  codRequisicaoIhq: string;
  /** Bloco escolhido para representar a requisição — o mais recente por data de solicitação. */
  principal: IhqDTO;
  /** Todos os blocos desta requisição na aba atual, incluindo o principal — cada um mantém sua própria curadoria em `qa_ihq_solicitacoes`. */
  blocos: IhqDTO[];
}

/**
 * A unidade de acompanhamento é a REQUISIÇÃO, nunca o bloco — mesmo
 * comportamento da planilha que este módulo substitui
 * (`Acompanhamento_Exames_Imunohistoquimicos.csv`: 1 linha por requisição,
 * mesmo quando o LIS registra mais de uma tarefa de bloco para ela). Uma
 * requisição pode gerar mais de uma tarefa de envio de bloco no LIS — cada
 * uma vira sua própria linha em `qa_ihq_solicitacoes` — mas a worklist
 * mostra e abre sempre a requisição como um todo, usando o bloco mais
 * recente como representante. Pedido explícito do usuário (2026-08-18).
 */
function agruparPorRequisicao(itens: IhqDTO[]): LinhaAgrupadaIhq[] {
  const porRequisicao = new Map<string, IhqDTO[]>();
  for (const item of itens) {
    const grupo = porRequisicao.get(item.codRequisicaoIhq) ?? [];
    grupo.push(item);
    porRequisicao.set(item.codRequisicaoIhq, grupo);
  }
  return [...porRequisicao.entries()].map(([codRequisicaoIhq, blocosDoGrupo]) => {
    const ordenados = [...blocosDoGrupo].sort((a, b) =>
      (b.dtaSolicitacaoBloco ?? '').localeCompare(a.dtaSolicitacaoBloco ?? ''),
    );
    return { codRequisicaoIhq, principal: ordenados[0]!, blocos: ordenados };
  });
}

function TriEstado({ valor }: { valor: boolean | null }) {
  if (valor === null) return <span className="text-gray-400 dark:text-slate-500">—</span>;
  return valor ? (
    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
      Sim
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      Não
    </span>
  );
}

const colunas: ColunaTabela<LinhaAgrupadaIhq>[] = [
  {
    chave: 'admissao',
    titulo: 'Data de admissão',
    valor: (grupo) => grupo.principal.dtaAdmissao ?? '',
    render: (grupo) => formatarData(grupo.principal.dtaAdmissao),
    larguraMin: 'min-w-[8rem]',
  },
  {
    chave: 'requisicao',
    titulo: 'Nº da requisição',
    valor: (grupo) => grupo.codRequisicaoIhq,
    filtravel: true,
    larguraMin: 'min-w-[9rem]',
  },
  {
    chave: 'paciente',
    titulo: 'Nome do paciente',
    valor: (grupo) => grupo.principal.nomePacienteLis ?? '',
    quebrarLinha: true,
    filtravel: true,
    larguraMin: 'min-w-[14rem]',
  },
  {
    chave: 'material',
    titulo: 'Material',
    valor: (grupo) => grupo.principal.materialLis ?? '',
    quebrarLinha: true,
    larguraMin: 'min-w-[12rem]',
  },
  {
    chave: 'medicoSolicitante',
    titulo: 'Médico solicitante',
    valor: (grupo) => grupo.principal.medicoSolicitante ?? '',
    quebrarLinha: true,
    filtravel: true,
    larguraMin: 'min-w-[14rem]',
  },
  {
    chave: 'dtaSolicitacaoBloco',
    titulo: 'Data da solicitação do bloco',
    valor: (grupo) => grupo.principal.dtaSolicitacaoBloco ?? '',
    render: (grupo) => formatarData(grupo.principal.dtaSolicitacaoBloco),
    larguraMin: 'min-w-[10rem]',
  },
  {
    chave: 'patologista',
    titulo: 'Patologista (laudo)',
    valor: (grupo) => grupo.principal.patologistaLis ?? '',
    larguraMin: 'min-w-[12rem]',
  },
  {
    chave: 'confianca',
    titulo: 'Confiança do vínculo',
    valor: (grupo) => grupo.principal.vinculoConfianca ?? 'nenhuma',
    filtravel: true,
    tipoFiltro: 'select',
    render: (grupo) => (
      // Confiança sempre visível, mesmo quando "alta" (nunca omitida)
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${
          grupo.principal.vinculoConfianca ? BADGE_CONFIANCA[grupo.principal.vinculoConfianca] : BADGE_CONFIANCA.nenhuma
        }`}
      >
        {grupo.principal.vinculoConfianca ?? 'nenhuma'}
      </span>
    ),
    larguraMin: 'min-w-[10rem]',
  },
  {
    chave: 'envio',
    titulo: 'Data de envio',
    valor: (grupo) => grupo.principal.dtaEnvioBloco ?? '',
    render: (grupo) =>
      grupo.principal.dtaEnvioBloco
        ? `${formatarData(grupo.principal.dtaEnvioBloco)}${grupo.principal.dtaEnvioProveniencia === 'curadoria' ? '' : ' (aprox.)'}`
        : '—',
    larguraMin: 'min-w-[10rem]',
  },
  {
    chave: 'statusLis',
    titulo: 'Status',
    valor: (grupo) => grupo.principal.statusLis ?? '',
    filtravel: true,
    tipoFiltro: 'select',
    render: (grupo) =>
      grupo.principal.statusLis ? (
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_STATUS_LIS[grupo.principal.statusLis]}`}>
          {ROTULO_STATUS_LIS[grupo.principal.statusLis]}
        </span>
      ) : (
        '—'
      ),
    larguraMin: 'min-w-[9rem]',
  },
  {
    chave: 'blocoRetornou',
    titulo: 'Bloco retornou ao lab?',
    valor: (grupo) => (grupo.principal.blocoRetornou === null ? '' : grupo.principal.blocoRetornou ? 'sim' : 'nao'),
    render: (grupo) => (
      <span className="inline-flex items-center gap-1">
        <TriEstado valor={grupo.principal.blocoRetornou} />
        {/* R4 — padrão de detecção não validado contra dado real; nunca apresentar como fato confirmado. */}
        {grupo.principal.blocoRetornou !== null && (
          <span className="text-[0.65rem] text-amber-600 dark:text-amber-400" title="Detecção não validada contra dado real (R4).">
            não confirmado
          </span>
        )}
      </span>
    ),
    larguraMin: 'min-w-[10rem]',
  },
  {
    chave: 'dtaRetornoBloco',
    titulo: 'Quando (retorno)',
    valor: (grupo) => grupo.principal.dtaRetornoBloco ?? '',
    render: (grupo) => formatarData(grupo.principal.dtaRetornoBloco),
    larguraMin: 'min-w-[8rem]',
  },
  {
    chave: 'laminaEnviada',
    titulo: 'Lâmina enviada?',
    valor: (grupo) => (grupo.principal.laminaEnviada === null ? '' : grupo.principal.laminaEnviada ? 'sim' : 'nao'),
    render: (grupo) => <TriEstado valor={grupo.principal.laminaEnviada} />,
    larguraMin: 'min-w-[8rem]',
  },
  {
    chave: 'observacoes',
    titulo: 'Observações',
    valor: (grupo) => grupo.principal.observacoes ?? '',
    quebrarLinha: true,
    larguraMin: 'min-w-[14rem]',
  },
  {
    chave: 'status',
    titulo: 'Status (curadoria)',
    valor: (grupo) => grupo.principal.statusCuradoria,
    filtravel: true,
    tipoFiltro: 'select',
    render: (grupo) => (
      <>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_STATUS[grupo.principal.statusCuradoria]}`}>
          {grupo.principal.statusCuradoria}
        </span>
        <BadgeRevisaoPendente revisaoPendente={grupo.principal.revisaoPendente} />
      </>
    ),
    larguraMin: 'min-w-[12rem]',
  },
];

export function Ihq() {
  const canManage = useCanManageQualidade();
  const { periodo, definirPeriodo } = usePeriodoCompartilhado();
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);

  return (
    <PaginaWorklist<IhqDTO[], LinhaAgrupadaIhq>
      titulo="IHQ"
      descricao="Blocos enviados ao laboratório parceiro externo. Metade dos dados é heurística ou texto livre — a confiança do vínculo fica sempre visível, nunca escondida."
      dominio="ihq"
      periodo={periodo}
      onMudarPeriodo={definirPeriodo}
      canManage={canManage}
      queryFn={buscarIhqLista}
      syncFn={sincronizarIhq}
      errorTitulo="Não foi possível carregar IHQ"
      mensagemVazio={() => 'Nenhuma solicitação registrada neste período. Verifique o período ou sincronize com o LIS.'}
      linhas={agruparPorRequisicao}
      colunas={colunas}
      tituloTabela="IHQ"
      cor="purple"
      chaveLinha={(grupo) => grupo.codRequisicaoIhq}
      onClickLinha={(grupo) => setIdSelecionado(grupo.principal.id)}
      drawer={() =>
        idSelecionado && <VinculoDrawer id={idSelecionado} canManage={canManage} onFechar={() => setIdSelecionado(null)} />
      }
    />
  );
}
