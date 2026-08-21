import type { OcorrenciaDTO } from '../types';
import { useState } from 'react';
import { CuradoriaDrawer } from './ocorrencias/CuradoriaDrawer.js';
import { BadgeRevisaoPendente } from './ui/BadgeRevisaoPendente.js';
import { PaginaWorklist } from './ui/PaginaWorklist.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import type { CorFiltro } from './ui/FiltroSelecaoAgrupada.js';
import { buscarOcorrencias, sincronizarOcorrencias } from '../ocorrencias.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';

/** Chave visual do badge de Status — concluída ganha uma cor, cada tipo de pendência ganha a sua. */
type ChaveStatusVisual = 'concluida' | 'pendente_responsaveis' | 'pendente_motivo' | 'pendente';

const CORES_STATUS: Record<ChaveStatusVisual, { cor: CorFiltro; badge: string }> = {
  concluida: { cor: 'green', badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  pendente_responsaveis: { cor: 'amber', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  pendente_motivo: { cor: 'purple', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  pendente: { cor: 'gray', badge: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
};

/**
 * "Pendente" aqui sempre significa curadoria incompleta — colaborador/setor
 * (responsáveis pelo erro) e/ou motivo ainda não definidos no drawer de
 * curadoria (ver `CuradoriaDrawer`). Mesma leitura que a equipe já faz fora
 * do sistema: toda ocorrência pendente é, na prática, uma pendência de
 * "definição de responsáveis" e/ou "definição de motivo".
 */
type TipoPendencia = 'responsaveis' | 'motivo';

const ROTULO_TIPO_PENDENCIA: Record<TipoPendencia, string> = {
  responsaveis: 'Definição de responsáveis',
  motivo: 'Definição de motivo',
};

function tipoPendencia(item: OcorrenciaDTO): TipoPendencia | null {
  if (item.statusCuradoria !== 'pendente') return null;
  if (!item.colaboradorId || !item.setorErroId) return 'responsaveis';
  if (!item.motivoId) return 'motivo';
  return null;
}

/** Valor composto usado pela coluna Status: casa com o filtro "pendente" (grupo) e com o subtipo (item do grupo) via `includes`. */
function valorFiltroStatus(item: OcorrenciaDTO): string {
  const tipo = tipoPendencia(item);
  return tipo ? `${item.statusCuradoria}:${tipo}` : item.statusCuradoria;
}

function descricaoPendencia(item: OcorrenciaDTO): string {
  if (item.statusCuradoria !== 'pendente') return '—';
  const tipo = tipoPendencia(item);
  return tipo ? ROTULO_TIPO_PENDENCIA[tipo] : 'Pendente';
}

function chaveStatusVisual(item: OcorrenciaDTO): ChaveStatusVisual {
  if (item.statusCuradoria === 'concluida') return 'concluida';
  const tipo = tipoPendencia(item);
  return tipo === 'responsaveis' ? 'pendente_responsaveis' : tipo === 'motivo' ? 'pendente_motivo' : 'pendente';
}

const OPCOES_FILTRO_STATUS = [
  { valor: 'concluida', rotulo: 'Concluída', cor: 'green' as CorFiltro },
  { valor: 'pendente', rotulo: 'Pendente (todas)', grupo: 'Pendente', cor: 'gray' as CorFiltro },
  { valor: 'pendente:responsaveis', rotulo: ROTULO_TIPO_PENDENCIA.responsaveis, grupo: 'Pendente', cor: 'amber' as CorFiltro },
  { valor: 'pendente:motivo', rotulo: ROTULO_TIPO_PENDENCIA.motivo, grupo: 'Pendente', cor: 'purple' as CorFiltro },
];

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

const colunas: ColunaTabela<OcorrenciaDTO>[] = [
  {
    chave: 'data',
    titulo: 'Data',
    valor: (item) => item.dtaOcorrencia,
    render: (item) => formatarData(item.dtaOcorrencia),
    larguraMin: 'min-w-[8rem]',
  },
  {
    chave: 'colaborador',
    // R2: nunca `ocorrencia.CriadoPor` — é curadoria, extraída do texto (Descricao/CauDescricao).
    titulo: 'Colaborador',
    valor: (item) => item.colaboradorNome ?? '',
    filtravel: true,
    larguraMin: 'min-w-[10rem]',
  },
  {
    chave: 'setor',
    // R1: nunca `ocorrencia.IdSetor` (sempre Qualidade) — é curadoria, setor onde o erro aconteceu.
    titulo: 'Setor',
    valor: (item) => item.setorErroNome ?? '',
    filtravel: true,
    larguraMin: 'min-w-[9rem]',
  },
  {
    chave: 'motivo',
    // R3/R4: vocabulário controlado — categoria do LIS é sugestão fraca (66% "Outros").
    titulo: 'Motivo',
    valor: (item) => item.motivoNome ?? '',
    filtravel: true,
    larguraMin: 'min-w-[10rem]',
  },
  {
    chave: 'resumo',
    titulo: 'Resumo da ocorrência',
    valor: (item) => item.resumoCurado ?? item.descricaoLis ?? '',
    quebrarLinha: true,
    larguraMin: 'min-w-[20rem]',
  },
  {
    chave: 'acaoRealizada',
    titulo: 'Ação realizada',
    valor: (item) => item.acaoCurada ?? item.acaoImediataLis ?? '',
    quebrarLinha: true,
    larguraMin: 'min-w-[20rem]',
  },
  {
    chave: 'mesAno',
    titulo: 'Mês/Ano',
    valor: (item) => item.dtaOcorrencia.slice(0, 7),
    render: (item) => formatarMesAno(item.dtaOcorrencia),
    larguraMin: 'min-w-[7rem]',
  },
  {
    chave: 'requisicao',
    titulo: 'Requisição',
    valor: (item) => item.codRequisicao ?? '',
    filtravel: true,
    larguraMin: 'min-w-[8rem]',
  },
  {
    chave: 'descricaoPendencia',
    titulo: 'Descrição da pendência',
    valor: (item) => descricaoPendencia(item),
    quebrarLinha: true,
    larguraMin: 'min-w-[14rem]',
  },
  {
    chave: 'status',
    titulo: 'Status',
    valor: valorFiltroStatus,
    filtravel: true,
    tipoFiltro: 'select',
    opcoesFiltro: OPCOES_FILTRO_STATUS,
    render: (item) => (
      <>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${CORES_STATUS[chaveStatusVisual(item)].badge}`}>
          {item.statusCuradoria === 'concluida' ? 'Concluída' : descricaoPendencia(item)}
        </span>
        <BadgeRevisaoPendente revisaoPendente={item.revisaoPendente} />
      </>
    ),
    larguraMin: 'min-w-[12rem]',
  },
];

export function Ocorrencias() {
  const canManage = useCanManageQualidade();
  const { periodo, definirPeriodo } = usePeriodoCompartilhado();
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);

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
      mensagemVazio={() => 'Nenhuma ocorrência registrada neste período. Verifique o período ou sincronize com o LIS.'}
      linhas={(dados) => dados}
      colunas={colunas}
      tituloTabela="Ocorrências"
      cor="blue"
      chaveLinha={(item) => item.id}
      onClickLinha={(item) => setIdSelecionado(item.id)}
      drawer={() =>
        idSelecionado && <CuradoriaDrawer id={idSelecionado} canManage={canManage} onFechar={() => setIdSelecionado(null)} />
      }
    />
  );
}
