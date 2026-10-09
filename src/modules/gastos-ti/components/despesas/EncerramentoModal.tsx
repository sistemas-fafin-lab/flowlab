import React, { useMemo, useState } from 'react';
import { CalendarX } from 'lucide-react';
import { dayKey } from '../../../../utils/datas';
import { competenciaDaData, formatarCompetencia, paraCampoMes } from '../../domain/competencia';
import type { Despesa } from '../../types';
import ModalFormulario from '../ui/ModalFormulario';
import { campo, classeRotulo } from '../ui/campos';

interface EncerramentoModalProps {
  despesa: Despesa;
  onSalvar: (competenciaFim: string | null) => Promise<string | null>;
  onFechar: () => void;
}

/**
 * Encerrar = informar a última cobrança (RN08); a despesa não tem campo de
 * status. Também serve para mudar o fim do contrato ou tirar o prazo.
 */
const EncerramentoModal: React.FC<EncerramentoModalProps> = ({ despesa, onSalvar, onFechar }) => {
  const hoje = useMemo(() => dayKey(new Date()), []);
  const [semPrazo, setSemPrazo] = useState(false);
  const [mes, setMes] = useState(() => paraCampoMes(despesa.competenciaFim ?? competenciaDaData(hoje)));
  const [erro, setErro] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fim = semPrazo ? null : competenciaDaData(mes);
    if (!semPrazo) {
      if (!fim) return setErro('Informe o mês da última cobrança.');
      if (fim < despesa.competenciaInicio) {
        return setErro(`A última cobrança não pode ser antes da primeira (${formatarCompetencia(despesa.competenciaInicio)}).`);
      }
    }
    setErro(null);
    setSalvando(true);
    const resultado = await onSalvar(fim);
    setSalvando(false);
    if (resultado) setErroGeral(resultado);
    else onFechar();
  };

  return (
    <ModalFormulario
      titulo={despesa.competenciaFim ? 'Alterar encerramento' : 'Encerrar despesa'}
      subtitulo={despesa.descricao}
      icone={CalendarX}
      onFechar={onFechar}
      onSubmit={handleSubmit}
      ocupado={salvando}
      rotuloSalvar="Salvar"
      erro={erroGeral}
      largura="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Depois da última cobrança, a despesa sai da previsão e passa a aparecer como encerrada. Nada do histórico é
          apagado.
        </p>
        <div>
          <label className={classeRotulo} htmlFor="encerramento-mes">
            Mês da última cobrança
          </label>
          <input
            id="encerramento-mes"
            type="month"
            value={mes}
            disabled={semPrazo}
            onChange={(e) => setMes(e.target.value)}
            className={campo(erro)}
            autoFocus
          />
          {erro && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erro}</p>}
        </div>
        {despesa.competenciaFim && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={semPrazo}
              onChange={(e) => setSemPrazo(e.target.checked)}
              className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
            Tirar o prazo (a despesa volta a ser sem fim)
          </label>
        )}
      </div>
    </ModalFormulario>
  );
};

export default EncerramentoModal;
