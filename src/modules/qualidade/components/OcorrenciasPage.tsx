import type { OcorrenciaDTO } from '../types';
import { CheckCircle, Clock, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { CuradoriaDrawer } from './ocorrencias/CuradoriaDrawer.js';
import { FiltroSegmentado } from './ui/FiltroSegmentado.js';
import { PaginaWorklist } from './ui/PaginaWorklist.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import type { CorFiltro } from './ui/FiltroSelecaoAgrupada.js';
import type { Tom } from './ui/tons.js';
import { ChipAClassificar, Etiqueta, Pilula, TOM, TEXTO_FRACO } from './ui/tons.js';
import { buscarOcorrencias, sincronizarOcorrencias } from '../ocorrencias.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';

/** Nome do código 1 no apLIS (ver bdLabQualidade.ts) — vira a sub-linha do status "Pendente". */
const ROTULO_DECISAO_RNC = 'Decidir sobre abertura de RNC';

/** Chave visual do Status — só os 2 status com leitura confirmada (ver bdLabQualidade.ts) chegam aqui (buscarOcorrencias já exclui o resto). */
type ChaveStatusVisual = 'concluida' | 'pendente' | 'outro';

const VISUAL_STATUS: Record<ChaveStatusVisual, { rotulo: string; sub: string | null; tom: Tom; icone: LucideIcon }> = {
  pendente: { rotulo: 'Pendente', sub: ROTULO_DECISAO_RNC, tom: 'amber', icone: Clock },
  concluida: { rotulo: 'Concluída', sub: null, tom: 'emerald', icone: CheckCircle },
  outro: { rotulo: 'Outro status', sub: 'Sem leitura confirmada no apLIS', tom: 'slate', icone: HelpCircle },
};

function chaveStatusVisual(item: OcorrenciaDTO): ChaveStatusVisual {
  return item.statusCuradoria ?? 'outro';
}

const OPCOES_FILTRO_STATUS = [
  { valor: 'concluida', rotulo: 'Concluída', cor: 'green' as CorFiltro },
  { valor: 'pendente', rotulo: `Pendente · ${ROTULO_DECISAO_RNC}`, cor: 'gray' as CorFiltro },
];

type FiltroStatus = 'todas' | 'pendente' | 'concluida';

// Split manual (sem `new Date`) para não sofrer deslocamento de fuso horário
// ao formatar uma data `YYYY-MM-DD` vinda do banco.
function formatarData(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarMesAno(data: string): string {
  const [ano, mes] = data.slice(0, 7).split('-');
  return `${mes}/${ano}`;
}

/** Texto longo limitado a 3 linhas na worklist — o completo fica no drawer de curadoria. */
function TextoResumido({ texto }: { texto: string }) {
  if (!texto) return <span className="text-gray-400 dark:text-slate-500">—</span>;
  return (
    <div className="line-clamp-3" title={texto}>
      {texto}
    </div>
  );
}

const colunas: ColunaTabela<OcorrenciaDTO>[] = [
  {
    chave: 'status',
    titulo: 'Status',
    valor: (item) => item.statusCuradoria ?? 'outro',
    filtravel: true,
    tipoFiltro: 'select',
    opcoesFiltro: OPCOES_FILTRO_STATUS,
    fixa: true,
    render: (item) => {
      const visual = VISUAL_STATUS[chaveStatusVisual(item)];
      return (
        <div className="flex flex-col items-start gap-[5px]">
          <Pilula tom={visual.tom} icone={visual.icone}>
            {visual.rotulo}
          </Pilula>
          {visual.sub && <span className={TEXTO_FRACO}>{visual.sub}</span>}
          {item.revisaoPendente && <Etiqueta tom="purple">revisão pendente</Etiqueta>}
        </div>
      );
    },
    larguraMin: 'min-w-[13rem] w-[13rem] pl-[19px]',
  },
  {
    chave: 'data',
    titulo: 'Data',
    valor: (item) => item.dtaOcorrencia,
    render: (item) => formatarData(item.dtaOcorrencia),
    larguraMin: 'min-w-[7.25rem]',
  },
  {
    chave: 'colaborador',
    // R2: nunca `ocorrencia.CriadoPor` — é curadoria, extraída do texto (Descricao/CauDescricao).
    titulo: 'Colaborador',
    valor: (item) => item.colaboradorNome ?? '',
    render: (item) => item.colaboradorNome ?? <ChipAClassificar />,
    filtravel: true,
    quebrarLinha: true,
    larguraMin: 'min-w-[9.5rem]',
  },
  {
    chave: 'setor',
    // R1: nunca `ocorrencia.IdSetor` (sempre Qualidade) — é curadoria, setor onde o erro aconteceu.
    titulo: 'Setor',
    valor: (item) => item.setorErroNome ?? '',
    render: (item) => item.setorErroNome ?? <ChipAClassificar />,
    filtravel: true,
    quebrarLinha: true,
    larguraMin: 'min-w-[8rem]',
  },
  {
    chave: 'motivo',
    // R3/R4: vocabulário controlado — categoria do LIS é sugestão fraca (66% "Outros").
    titulo: 'Motivo',
    valor: (item) => item.motivoNome ?? '',
    render: (item) => item.motivoNome ?? <ChipAClassificar />,
    filtravel: true,
    quebrarLinha: true,
    larguraMin: 'min-w-[11rem]',
  },
  {
    chave: 'resumo',
    titulo: 'Resumo da ocorrência',
    valor: (item) => item.resumoCurado ?? item.descricaoLis ?? '',
    render: (item) => <TextoResumido texto={item.resumoCurado ?? item.descricaoLis ?? ''} />,
    quebrarLinha: true,
    larguraMin: 'min-w-[21rem]',
  },
  {
    chave: 'acaoRealizada',
    titulo: 'Ação realizada',
    valor: (item) => item.acaoCurada ?? item.acaoImediataLis ?? '',
    render: (item) => <TextoResumido texto={item.acaoCurada ?? item.acaoImediataLis ?? ''} />,
    quebrarLinha: true,
    larguraMin: 'min-w-[21rem]',
  },
  {
    chave: 'mesAno',
    titulo: 'Mês/Ano',
    valor: (item) => item.dtaOcorrencia.slice(0, 7),
    render: (item) => formatarMesAno(item.dtaOcorrencia),
    larguraMin: 'min-w-[6rem]',
  },
  {
    chave: 'requisicao',
    titulo: 'Requisição',
    valor: (item) => item.codRequisicao ?? '',
    filtravel: true,
    larguraMin: 'min-w-[7.5rem]',
    className: 'tabular-nums',
  },
];

export function Ocorrencias() {
  const canManage = useCanManageQualidade();
  const { periodo, definirPeriodo } = usePeriodoCompartilhado();
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');

  return (
    <PaginaWorklist<OcorrenciaDTO[], OcorrenciaDTO>
      titulo="Ocorrências"
      descricao="Não conformidades sincronizadas do LIS, com curadoria de colaborador, setor e motivo."
      dominio="ocorrencias"
      periodo={periodo}
      onMudarPeriodo={definirPeriodo}
      canManage={canManage}
      queryFn={buscarOcorrencias}
      syncFn={sincronizarOcorrencias}
      errorTitulo="Não foi possível carregar ocorrências"
      mensagemVazio={(dados) =>
        dados.length === 0
          ? 'Nenhuma ocorrência registrada neste período. Verifique o período ou sincronize com o LIS.'
          : filtroStatus === 'pendente'
            ? 'Nenhuma ocorrência pendente neste período.'
            : 'Nenhuma ocorrência concluída neste período.'
      }
      linhas={(dados) => (filtroStatus === 'todas' ? dados : dados.filter((item) => item.statusCuradoria === filtroStatus))}
      colunas={colunas}
      tituloTabela="Ocorrências"
      cor="blue"
      chaveLinha={(item) => item.id}
      onClickLinha={(item) => setIdSelecionado(item.id)}
      classeCelulaFixa={(item) => TOM[VISUAL_STATUS[chaveStatusVisual(item)].tom].faixa}
      extraCabecalhoTabela={(dados) => (
        <FiltroSegmentado<FiltroStatus>
          rotuloAcessivel="Filtrar por status"
          valor={filtroStatus}
          onMudar={setFiltroStatus}
          opcoes={[
            { chave: 'todas', rotulo: 'Todas', quantidade: dados.length },
            { chave: 'pendente', rotulo: 'Pendentes', quantidade: dados.filter((item) => item.statusCuradoria === 'pendente').length, tom: 'amber' },
            { chave: 'concluida', rotulo: 'Concluídas', quantidade: dados.filter((item) => item.statusCuradoria === 'concluida').length, tom: 'emerald' },
          ]}
        />
      )}
      drawer={() =>
        idSelecionado && <CuradoriaDrawer id={idSelecionado} canManage={canManage} onFechar={() => setIdSelecionado(null)} />
      }
    />
  );
}
