import React, { useMemo, useState } from 'react';
import { UserCog, Pencil, X, Check, Loader2 } from 'lucide-react';
import Select, { type SelectOption } from '../../../../components/Select';
import type { Colaborador } from '../../types';

interface GestorSectionProps {
  colaborador: Colaborador;
  colaboradores: Colaborador[];
  onDefinirGestor: (colaboradorId: string, gestorId: string | null) => Promise<string | null>;
}

// Sentinela para "sem gestor" — nunca colide com um uuid real.
const SEM_GESTOR = '';

const GestorSection: React.FC<GestorSectionProps> = ({ colaborador, colaboradores, onDefinirGestor }) => {
  const [editando, setEditando] = useState(false);
  const [selecionado, setSelecionado] = useState<string>(colaborador.gestorId ?? SEM_GESTOR);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Candidatos a gestor: qualquer colaborador, exceto o próprio (auto-referência)
  // e quem já é seu subordinado direto ou indireto (evitaria um ciclo na cadeia).
  // Isto é só uma pré-filtragem de UX — o gatilho no banco é a guarda definitiva,
  // então o erro retornado por onDefinirGestor ainda é tratado normalmente abaixo.
  const candidatos = useMemo(() => {
    const criariCiclo = (candidato: Colaborador): boolean => {
      let atual: Colaborador | undefined = candidato;
      let passos = 0;
      while (atual?.gestorId && passos < colaboradores.length) {
        if (atual.gestorId === colaborador.id) return true;
        atual = colaboradores.find((c) => c.id === atual!.gestorId);
        passos += 1;
      }
      return false;
    };

    return colaboradores
      .filter((c) => c.id !== colaborador.id && !criariCiclo(c))
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [colaboradores, colaborador.id]);

  const options: SelectOption[] = [
    { value: SEM_GESTOR, label: 'Sem gestor' },
    ...candidatos.map((c, index) => ({
      value: c.id,
      label: c.nome,
      separatorBefore: index === 0,
    })),
  ];

  const abrirEdicao = () => {
    setSelecionado(colaborador.gestorId ?? SEM_GESTOR);
    setErro(null);
    setEditando(true);
  };

  const cancelar = () => {
    setEditando(false);
    setErro(null);
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    const novoGestorId = selecionado === SEM_GESTOR ? null : selecionado;
    const resultado = await onDefinirGestor(colaborador.id, novoGestorId);
    setSalvando(false);
    if (resultado) {
      setErro(resultado);
      return;
    }
    setEditando(false);
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Gestor</h3>

      {!editando ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <UserCog className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {colaborador.gestor ? (
              <span className="font-medium text-gray-700 dark:text-gray-200">{colaborador.gestor.nome}</span>
            ) : (
              <span className="text-gray-400 dark:text-gray-500">Sem gestor definido</span>
            )}
          </div>
          <button
            type="button"
            onClick={abrirEdicao}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Alterar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <Select
            value={selecionado}
            onChange={setSelecionado}
            options={options}
            placeholder="Selecione um gestor..."
            controlClass="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            ariaLabel="Gestor do colaborador"
            disabled={salvando}
          />

          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Salvar
            </button>
            <button
              type="button"
              onClick={cancelar}
              disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default GestorSection;
