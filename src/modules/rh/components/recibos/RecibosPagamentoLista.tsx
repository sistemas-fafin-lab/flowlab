import React, { useMemo, useState } from 'react';
import { AlertCircle, Download, Eye, FileText, Search } from 'lucide-react';
import { formatCompetenciaExtenso } from '../../utils/holeritesFormato';
import { formatDataBR } from '../../utils/colaboradorFormato';
import { agruparPorAno, anosDisponiveis, filtrarRecibos } from '../../utils/recibosFiltro';

export interface ReciboListavel {
  id: string;
  /** "YYYY-MM-DD", sempre dia 1. */
  competencia: string;
  arquivoPath: string;
  disponibilizadoEm?: string | null;
  indisponivel?: boolean;
}

interface RecibosPagamentoListaProps {
  recibos: ReciboListavel[];
  /** Muda os textos de estado vazio e de arquivo indisponível. */
  visao: 'rh' | 'colaborador';
  /** Signed URL do arquivo; `download` força o download. */
  gerarLink: (arquivoPath: string, download?: boolean) => Promise<string | null>;
  /** Sem busca e filtro de ano (resumo dos mais recentes no Meu perfil). */
  semFiltros?: boolean;
}

const TEXTOS = {
  rh: {
    vazio: 'Nenhum holerite foi enviado para este colaborador. Os recibos aparecem aqui após o envio pela tela Holerites.',
    indisponivel: 'Arquivo não encontrado. Reenvie este holerite pela tela Holerites.',
  },
  colaborador: {
    vazio: 'Seus holerites aparecem aqui assim que o RH os disponibilizar.',
    indisponivel: 'Arquivo indisponível no momento. Fale com o RH.',
  },
} as const;

const controlClass =
  'px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

/** Recibos de pagamento agrupados por ano, com busca por mês/ano e filtro de ano. */
const RecibosPagamentoLista: React.FC<RecibosPagamentoListaProps> = ({ recibos, visao, gerarLink, semFiltros = false }) => {
  const [busca, setBusca] = useState('');
  const [ano, setAno] = useState<number | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erroLink, setErroLink] = useState<string | null>(null);

  const anos = useMemo(() => anosDisponiveis(recibos), [recibos]);
  const grupos = useMemo(() => agruparPorAno(filtrarRecibos(recibos, busca, ano)), [recibos, busca, ano]);
  const maisRecenteId = useMemo(
    () => [...recibos].sort((a, b) => b.competencia.localeCompare(a.competencia))[0]?.id ?? null,
    [recibos],
  );

  const abrir = async (recibo: ReciboListavel, download: boolean) => {
    const chave = `${recibo.id}:${download ? 'd' : 'v'}`;
    setAbrindo(chave);
    setErroLink(null);
    const url = await gerarLink(recibo.arquivoPath, download);
    setAbrindo(null);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setErroLink('Não foi possível abrir o arquivo. Tente novamente.');
  };

  if (recibos.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        {TEXTOS[visao].vazio}
      </div>
    );
  }

  const limparFiltros = () => {
    setBusca('');
    setAno(null);
  };

  return (
    <div className="space-y-4">
      {!semFiltros && (
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar mês ou ano"
            aria-label="Buscar mês ou ano"
            className={`w-full pl-9 ${controlClass}`}
          />
        </div>
        <select
          value={ano ?? ''}
          onChange={(e) => setAno(e.target.value ? Number(e.target.value) : null)}
          aria-label="Filtrar por ano"
          className={controlClass}
        >
          <option value="">Todos os anos</option>
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      )}

      {erroLink && <p className="text-sm text-red-600 dark:text-red-400">{erroLink}</p>}

      {grupos.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
          Nenhum recibo encontrado para os filtros aplicados.{' '}
          <button type="button" onClick={limparFiltros} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Limpar filtros
          </button>
        </div>
      ) : (
        grupos.map((grupo) => (
          <div key={grupo.ano}>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{grupo.ano}</h4>
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {grupo.recibos.map((recibo) => (
                <div key={recibo.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {recibo.indisponivel ? (
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        {formatCompetenciaExtenso(recibo.competencia)}
                        {recibo.id === maisRecenteId && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            Mais recente
                          </span>
                        )}
                      </div>
                      <div className={`text-xs ${recibo.indisponivel ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {recibo.indisponivel
                          ? TEXTOS[visao].indisponivel
                          : recibo.disponibilizadoEm
                            ? `Disponibilizado em ${formatDataBR(recibo.disponibilizadoEm)}`
                            : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => abrir(recibo, false)}
                      disabled={recibo.indisponivel || abrindo !== null}
                      title="Visualizar"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Visualizar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => abrir(recibo, true)}
                      disabled={recibo.indisponivel || abrindo !== null}
                      title="Baixar"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{abrindo === `${recibo.id}:d` ? 'Gerando...' : 'Baixar'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default RecibosPagamentoLista;
