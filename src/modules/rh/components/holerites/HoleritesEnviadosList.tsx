import React, { useMemo, useState } from 'react';
import { Download, FileText, Search, Trash2 } from 'lucide-react';
import AutocompleteInput from '../../../../components/CostControl/AutocompleteInput';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import DatePicker from '../../../../components/DatePicker';
import { useDialog } from '../../../../hooks/useDialog';
import { useColaboradores } from '../../hooks/useColaboradores';
import { useHoleritesEnviados } from '../../hooks/useHoleritesEnviados';
import { formatCompetenciaExtenso } from '../../utils/holeritesFormato';

export interface HoleritesEnviadosListRef {
  refetch: () => Promise<void>;
}

interface HoleritesEnviadosListProps {
  /** Sem `canManageHolerites`, quem só tem `canViewAllHolerites` vê e baixa, mas não remove. */
  podeRemover: boolean;
}

const CAMPO = 'px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

const HoleritesEnviadosList = React.forwardRef<HoleritesEnviadosListRef, HoleritesEnviadosListProps>(({ podeRemover }, ref) => {
  const { holerites, loading, error, refetch, baixar, remover } = useHoleritesEnviados();
  const { colaboradores } = useColaboradores();
  const [busca, setBusca] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [baixando, setBaixando] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erroRemocao, setErroRemocao] = useState<string | null>(null);
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();

  React.useImperativeHandle(ref, () => ({ refetch }), [refetch]);

  // Lista completa do cadastro (não só quem já tem holerite enviado) — a RLS
  // de colaboradores libera SELECT pra quem tem canManageHolerites mesmo sem
  // canViewColaboradores (colaboradores_select_holerites_manage, issue 05).
  const nomesColaboradores = useMemo(() => colaboradores.map((c) => c.nome), [colaboradores]);

  const sugestoesColaborador = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo ? nomesColaboradores.filter((nome) => nome.toLowerCase().includes(termo)) : nomesColaboradores;
    return base.slice(0, 20);
  }, [nomesColaboradores, busca]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    // DatePicker entrega data completa; comparamos só o mês, já que
    // competência é sempre dia 1 e o usuário pode escolher qualquer dia.
    const inicioMes = periodoInicio.slice(0, 7);
    const fimMes = periodoFim.slice(0, 7);
    return holerites
      .filter((h) => {
        const competenciaMes = h.competencia.slice(0, 7);
        const combinaNome = !termo || h.colaboradorNome.toLowerCase().includes(termo);
        const combinaInicio = !inicioMes || competenciaMes >= inicioMes;
        const combinaFim = !fimMes || competenciaMes <= fimMes;
        return combinaNome && combinaInicio && combinaFim;
      })
      .sort((a, b) => a.colaboradorNome.localeCompare(b.colaboradorNome, 'pt-BR'));
  }, [holerites, busca, periodoInicio, periodoFim]);

  const filtroAtivo = busca.trim() !== '' || periodoInicio !== '' || periodoFim !== '';

  const handleBaixar = async (id: string, path: string) => {
    setBaixando(id);
    const url = await baixar(path);
    setBaixando(null);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRemover = (id: string, path: string, colaboradorNome: string, competencia: string) => {
    showConfirmDialog(
      'Remover holerite',
      `Remover o holerite de ${colaboradorNome} (${formatCompetenciaExtenso(competencia)})? Essa ação não pode ser desfeita.`,
      async () => {
        setErroRemocao(null);
        setRemovendo(id);
        const erro = await remover(id, path);
        setRemovendo(null);
        if (erro) setErroRemocao(erro);
      },
      { type: 'danger', confirmText: 'Remover' },
    );
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col flex-1 min-h-0">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Holerites enviados</h3>
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {filtrados.length} {filtrados.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
            <AutocompleteInput
              value={busca}
              onValueChange={setBusca}
              onSelect={(nome) => setBusca(nome)}
              suggestions={sugestoesColaborador}
              renderSuggestion={(nome) => <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{nome}</span>}
              keyOf={(nome) => nome}
              emptyLabel="Nenhum colaborador encontrado."
              placeholder="Buscar por colaborador..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              showAllWhenEmpty
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <DatePicker
              value={periodoInicio}
              onChange={setPeriodoInicio}
              controlClass={CAMPO}
              placeholder="Competência de"
              ariaLabel="Competência inicial"
              granularity="month"
              allowClear
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">até</span>
            <DatePicker
              value={periodoFim}
              onChange={setPeriodoFim}
              controlClass={CAMPO}
              placeholder="Data final"
              ariaLabel="Competência final"
              granularity="month"
              allowClear
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 text-sm text-red-600 dark:text-red-300">{error}</div>
      )}
      {erroRemocao && (
        <div className="p-4 text-sm text-red-600 dark:text-red-300">Erro ao remover: {erroRemocao}</div>
      )}

      <div className="divide-y divide-gray-100 dark:divide-gray-700 flex-1 min-h-0 overflow-y-auto">
        {loading && <div className="p-6 text-sm text-gray-400 dark:text-gray-500 text-center">Carregando...</div>}

        {!loading && filtrados.length === 0 && (
          <div className="p-8 text-center text-gray-400 dark:text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {holerites.length === 0
              ? 'Nenhum holerite enviado ainda.'
              : filtroAtivo
                ? 'Nenhum holerite encontrado para esse filtro.'
                : 'Nenhum holerite encontrado.'}
          </div>
        )}

        {!loading &&
          filtrados.map((holerite) => (
            <div key={holerite.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-blue-500 dark:text-blue-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{holerite.colaboradorNome}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">{formatCompetenciaExtenso(holerite.competencia)}</div>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBaixar(holerite.id, holerite.arquivoPath)}
                  disabled={baixando === holerite.id || removendo === holerite.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-60 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {baixando === holerite.id ? 'Gerando link...' : 'Baixar'}
                </button>
                {podeRemover && (
                  <button
                    type="button"
                    onClick={() => handleRemover(holerite.id, holerite.arquivoPath, holerite.colaboradorNome, holerite.competencia)}
                    disabled={removendo === holerite.id || baixando === holerite.id}
                    aria-label={`Remover holerite de ${holerite.colaboradorNome}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {removendo === holerite.id ? 'Removendo...' : 'Remover'}
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={hideConfirmDialog}
      />
    </section>
  );
});

HoleritesEnviadosList.displayName = 'HoleritesEnviadosList';

export default HoleritesEnviadosList;
