import type { IhqDTO, NivelConfianca, StatusCuradoriaIhq } from '../types';
import { useState } from 'react';
import { VinculoDrawer } from './ihq/VinculoDrawer.js';
import { PaginaWorklist } from './ui/PaginaWorklist.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import type { Tom } from './ui/tons.js';
import { Etiqueta, Pilula, TOM, TEXTO_FORTE, TEXTO_FRACO } from './ui/tons.js';
import { buscarIhqLista, sincronizarIhq } from '../ihq.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';

/** Leitura do vínculo — motivos espelham `nivelConfiancaVinculo` (api/_lib/qualidade/ihqRegras.ts). */
const VISUAL_VINCULO: Record<NivelConfianca | 'manual', { rotulo: string; motivo: string; barras: number; tom: Tom }> = {
  manual: { rotulo: 'Confirmado', motivo: 'Vínculo confirmado manualmente', barras: 3, tom: 'emerald' },
  alta: { rotulo: 'Alta', motivo: 'Única biópsia candidata na janela', barras: 3, tom: 'emerald' },
  media: { rotulo: 'Média', motivo: 'Várias candidatas; só uma tem peça', barras: 2, tom: 'blue' },
  baixa: { rotulo: 'Baixa', motivo: 'Várias candidatas, nenhuma decisiva', barras: 1, tom: 'amber' },
  nenhuma: { rotulo: 'Sem vínculo', motivo: 'Nenhuma biópsia encontrada na janela', barras: 0, tom: 'red' },
};

const ROTULO_STATUS: Record<StatusCuradoriaIhq, string> = {
  pendente: 'Curadoria pendente',
  em_analise: 'Em análise',
  concluida: 'Concluída',
  descartada: 'Descartada',
};

const TOM_STATUS: Record<StatusCuradoriaIhq, Tom> = {
  pendente: 'slate',
  em_analise: 'blue',
  concluida: 'emerald',
  descartada: 'apagado',
};

const TOM_STATUS_LIS: Record<NonNullable<IhqDTO['statusLis']>, Tom> = {
  concluido: 'emerald',
  cancelado: 'red',
  em_andamento: 'blue',
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

function formatarDiaMes(data: string | null): string {
  if (!data) return '—';
  const [, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}`;
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

function chaveVinculo(item: IhqDTO): NivelConfianca | 'manual' {
  return item.vinculoProveniencia === 'manual' ? 'manual' : (item.vinculoConfianca ?? 'nenhuma');
}

/** Heurística fraca ainda não revisada — material/patologista da biópsia candidata não são mostrados como fato. */
function precisaConfirmarVinculo(item: IhqDTO): boolean {
  return item.vinculoProveniencia === 'heuristica' && (item.vinculoConfianca === 'baixa' || item.vinculoConfianca === 'nenhuma' || item.vinculoConfianca === null);
}

function CelulaVinculo({ item }: { item: IhqDTO }) {
  const visual = VISUAL_VINCULO[chaveVinculo(item)];
  const confirmar = precisaConfirmarVinculo(item);
  return (
    <div className="flex flex-col items-start gap-[3px]">
      <div className="flex items-center gap-2">
        {/* Confiança sempre visível, mesmo quando "alta" (nunca omitida) */}
        <span aria-hidden className="flex h-3 items-end gap-0.5">
          {[6, 9, 12].map((altura, k) => (
            <span
              key={altura}
              style={{ height: altura }}
              className={`w-1 rounded-[1px] ${k < visual.barras ? TOM[visual.tom].solido : 'bg-slate-400/35'}`}
            />
          ))}
        </span>
        <span className={`text-[13px] font-semibold leading-[18px] ${TOM[visual.tom].texto}`}>{visual.rotulo}</span>
        {item.codRequisicaoOriginal && !confirmar && (
          <span className="text-[13px] leading-[18px] tabular-nums">
            <span className="text-gray-500 dark:text-slate-400">Biópsia </span>
            {item.codRequisicaoOriginal}
          </span>
        )}
      </div>
      <span className={TEXTO_FRACO}>{visual.motivo}</span>
      {confirmar && (
        // Sem handler próprio: o clique sobe para a linha, que abre o VinculoDrawer (onde o vínculo é confirmado).
        <span className="mt-0.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
          Confirmar vínculo
        </span>
      )}
    </div>
  );
}

type EstiloMarco = 'solido' | 'tracejado' | 'vazio';

interface Marco {
  rotulo: string;
  data: string;
  estilo: EstiloMarco;
  qualificador: string;
  titulo: string;
}

function marcosDoTrajeto(item: IhqDTO): Marco[] {
  const envio: Marco = !item.dtaEnvioBloco
    ? { rotulo: 'Enviado', data: '—', estilo: 'vazio', qualificador: 'não detectado', titulo: 'Envio não detectado no LIS' }
    : item.dtaEnvioProveniencia === 'curadoria'
      ? { rotulo: 'Enviado', data: formatarDiaMes(item.dtaEnvioBloco), estilo: 'solido', qualificador: 'corrigida', titulo: 'Data corrigida na curadoria' }
      : {
          rotulo: 'Enviado',
          data: formatarDiaMes(item.dtaEnvioBloco),
          estilo: 'tracejado',
          qualificador: 'estimada',
          titulo: item.dtaEnvioTextoOriginal ? `Lida do texto livre do LIS: “${item.dtaEnvioTextoOriginal}”` : 'Data estimada a partir do texto livre do LIS',
        };
  // R4 — padrão de detecção não validado contra dado real; nunca apresentar como fato confirmado.
  const retorno: Marco =
    item.blocoRetornou === true
      ? {
          rotulo: 'Retorno',
          data: formatarDiaMes(item.dtaRetornoBloco),
          estilo: 'tracejado',
          qualificador: 'não validado',
          titulo: 'Detecção automática, ainda não validada contra dado real (R4)',
        }
      : {
          rotulo: 'Retorno',
          data: '—',
          estilo: 'vazio',
          qualificador: item.blocoRetornou === false ? 'sem retorno' : '',
          titulo: 'Sem retorno registrado',
        };
  return [
    {
      rotulo: 'Solicitado',
      data: formatarDiaMes(item.dtaSolicitacaoBloco),
      estilo: item.dtaSolicitacaoBloco ? 'solido' : 'vazio',
      qualificador: '',
      titulo: 'Data da solicitação do bloco (LIS)',
    },
    envio,
    retorno,
  ];
}

const PONTO_MARCO: Record<EstiloMarco, string> = {
  solido: 'border-2 border-solid border-purple-500 bg-purple-500',
  tracejado: 'border-2 border-dashed border-purple-500',
  vazio: 'border-2 border-solid border-slate-400/55',
};

const LINHA_ATE_MARCO: Record<EstiloMarco, string> = {
  solido: 'border-t-2 border-solid border-purple-500',
  tracejado: 'border-t-2 border-dashed border-purple-500',
  vazio: 'border-t-2 border-dotted border-slate-400/55',
};

function TrajetoBloco({ item }: { item: IhqDTO }) {
  const marcos = marcosDoTrajeto(item);
  return (
    <>
      <div className="grid grid-cols-3">
        {marcos.map((marco, k) => {
          const proximo = marcos[k + 1];
          return (
            <div key={marco.rotulo} title={marco.titulo} className="flex min-w-0 cursor-help flex-col gap-0.5">
              <div className="mb-1 flex h-3 items-center">
                <span className={`h-3 w-3 shrink-0 rounded-full ${PONTO_MARCO[marco.estilo]}`} />
                {proximo && <span className={`mx-1.5 h-0 flex-1 ${LINHA_ATE_MARCO[proximo.estilo]}`} />}
              </div>
              <span className="text-[11px] font-semibold uppercase leading-[14px] tracking-[.04em] text-gray-500 dark:text-slate-400">
                {marco.rotulo}
              </span>
              <span
                className={`text-[13px] leading-[18px] tabular-nums ${marco.estilo === 'vazio' ? 'text-gray-500 dark:text-slate-400' : TEXTO_FORTE}`}
              >
                {marco.data}
              </span>
              {marco.qualificador && (
                <span className="text-[11px] leading-[14px] text-gray-500 dark:text-slate-400">{marco.qualificador}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className={`mt-2 ${TEXTO_FRACO}`}>
        Lâmina enviada:{' '}
        <span className={`font-medium ${item.laminaEnviada === null ? '' : TEXTO_FORTE}`}>
          {item.laminaEnviada === null ? 'não informado' : item.laminaEnviada ? 'Sim' : 'Não'}
        </span>
      </div>
    </>
  );
}

const colunas: ColunaTabela<LinhaAgrupadaIhq>[] = [
  {
    chave: 'requisicao',
    titulo: 'Requisição IHQ',
    valor: (grupo) => `${grupo.principal.nomePacienteLis ?? ''} ${grupo.codRequisicaoIhq}`.trim(),
    render: (grupo) => (
      <>
        {grupo.principal.nomePacienteLis && <div className={`font-medium ${TEXTO_FORTE}`}>{grupo.principal.nomePacienteLis}</div>}
        <div className={grupo.principal.nomePacienteLis ? `${TEXTO_FRACO} tabular-nums` : `font-medium tabular-nums ${TEXTO_FORTE}`}>
          Req. {grupo.codRequisicaoIhq}
        </div>
        <div className={`mt-0.5 flex flex-wrap items-center gap-1.5 ${TEXTO_FRACO}`}>
          Admissão {formatarData(grupo.principal.dtaAdmissao)}
          {grupo.blocos.length > 1 && (
            <span className="rounded-full bg-purple-500/10 px-[7px] font-semibold text-purple-700 dark:text-purple-300">
              {grupo.blocos.length} blocos
            </span>
          )}
        </div>
      </>
    ),
    quebrarLinha: true,
    filtravel: true,
    larguraMin: 'min-w-[11rem]',
  },
  {
    chave: 'confianca',
    titulo: 'Vínculo com a biópsia',
    valor: (grupo) => VISUAL_VINCULO[chaveVinculo(grupo.principal)].rotulo,
    filtravel: true,
    tipoFiltro: 'select',
    render: (grupo) => <CelulaVinculo item={grupo.principal} />,
    quebrarLinha: true,
    larguraMin: 'min-w-[12.5rem]',
  },
  {
    chave: 'material',
    titulo: 'Material e médicos',
    valor: (grupo) =>
      `${grupo.principal.materialLis ?? ''} ${grupo.principal.medicoSolicitante ?? ''} ${grupo.principal.patologistaLis ?? ''}`.trim(),
    render: (grupo) => {
      const item = grupo.principal;
      const confirmar = precisaConfirmarVinculo(item);
      return (
        <>
          {item.materialLis && !confirmar ? (
            <div className={TEXTO_FORTE}>{item.materialLis}</div>
          ) : (
            <div className="text-[13px] text-gray-500 dark:text-slate-400">Material após confirmar o vínculo</div>
          )}
          <div className={`mt-0.5 ${TEXTO_FRACO}`}>Solicitante: {item.medicoSolicitante ?? '—'}</div>
          {item.patologistaLis && !confirmar && <div className={TEXTO_FRACO}>Patologista: {item.patologistaLis}</div>}
        </>
      );
    },
    quebrarLinha: true,
    filtravel: true,
    larguraMin: 'min-w-[12rem]',
  },
  {
    chave: 'trajeto',
    titulo: 'Trajeto do bloco',
    valor: (grupo) => grupo.principal.dtaSolicitacaoBloco ?? '',
    render: (grupo) => <TrajetoBloco item={grupo.principal} />,
    quebrarLinha: true,
    larguraMin: 'min-w-[18rem]',
  },
  {
    chave: 'statusLis',
    titulo: 'Status',
    valor: (grupo) => (grupo.principal.statusLis ? ROTULO_STATUS_LIS[grupo.principal.statusLis] : ''),
    filtravel: true,
    tipoFiltro: 'select',
    render: (grupo) =>
      grupo.principal.statusLis ? (
        <Pilula tom={TOM_STATUS_LIS[grupo.principal.statusLis]}>{ROTULO_STATUS_LIS[grupo.principal.statusLis]}</Pilula>
      ) : (
        '—'
      ),
    larguraMin: 'min-w-[8rem]',
  },
  {
    chave: 'observacoes',
    titulo: 'Observações',
    valor: (grupo) => grupo.principal.observacoes ?? '',
    ordenavel: false,
    render: (grupo) => (
      <div className="line-clamp-3 text-[13px] leading-[18px]" title={grupo.principal.observacoes ?? undefined}>
        {grupo.principal.observacoes ?? '—'}
      </div>
    ),
    quebrarLinha: true,
    larguraMin: 'min-w-[10rem]',
  },
  {
    chave: 'status',
    titulo: 'Curadoria',
    valor: (grupo) => ROTULO_STATUS[grupo.principal.statusCuradoria],
    filtravel: true,
    tipoFiltro: 'select',
    render: (grupo) => (
      <div className="flex flex-col items-start gap-[5px]">
        <Pilula tom={TOM_STATUS[grupo.principal.statusCuradoria]}>{ROTULO_STATUS[grupo.principal.statusCuradoria]}</Pilula>
        {grupo.principal.revisaoPendente && <Etiqueta tom="purple">revisão pendente</Etiqueta>}
      </div>
    ),
    larguraMin: 'min-w-[9.5rem]',
  },
];

/** Legenda do trajeto — no cabeçalho da tabela, porque o tracejado só faz sentido explicado. */
function LegendaTrajeto() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-purple-500" aria-hidden />
        Data do LIS ou corrigida
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-purple-500" aria-hidden />
        Estimada ou não validada (passe o mouse para ver a origem)
      </span>
    </div>
  );
}

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
      extraCabecalhoTabela={() => <LegendaTrajeto />}
      drawer={() =>
        idSelecionado && <VinculoDrawer id={idSelecionado} canManage={canManage} onFechar={() => setIdSelecionado(null)} />
      }
    />
  );
}
