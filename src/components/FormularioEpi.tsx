import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { CamposEpi, TIPOS_IDENTIFICACAO_EPI, TipoIdentificacaoEpi } from '../utils/epi';

interface FormularioEpiProps {
  value: CamposEpi;
  onChange: (patch: Partial<CamposEpi>) => void;
  /** Permissão "Gerir EPI" (canManageEpi). Sem ela, os campos aparecem só para leitura. */
  podeEditar: boolean;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 disabled:opacity-60 disabled:cursor-not-allowed';

/** Marcação de EPI e Identificação do EPI (tipo, número e validade, todos opcionais). */
const FormularioEpi: React.FC<FormularioEpiProps> = ({ value, onChange, podeEditar }) => (
  <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        id="isEpi"
        checked={value.isEpi}
        disabled={!podeEditar}
        onChange={(e) => onChange({ isEpi: e.target.checked })}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded disabled:cursor-not-allowed"
      />
      <label htmlFor="isEpi" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
        <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        É EPI (Equipamento de Proteção Individual)
      </label>
    </div>

    {!podeEditar && (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Só quem tem a permissão "Gerir EPI" altera a marcação e a identificação.
      </p>
    )}

    {value.isEpi && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="epiTipo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tipo da identificação
          </label>
          <select
            id="epiTipo"
            value={value.epiTipo}
            disabled={!podeEditar}
            onChange={(e) => onChange({ epiTipo: e.target.value as TipoIdentificacaoEpi | '' })}
            className={inputClass}
          >
            <option value="">Não informado</option>
            {TIPOS_IDENTIFICACAO_EPI.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="epiNumero" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Número
          </label>
          <input
            type="text"
            id="epiNumero"
            value={value.epiNumero}
            disabled={!podeEditar}
            onChange={(e) => onChange({ epiNumero: e.target.value })}
            placeholder="Ex.: 12345"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="epiValidade" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Validade
          </label>
          <input
            type="date"
            id="epiValidade"
            value={value.epiValidade}
            disabled={!podeEditar}
            onChange={(e) => onChange({ epiValidade: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>
    )}
  </div>
);

export default FormularioEpi;
