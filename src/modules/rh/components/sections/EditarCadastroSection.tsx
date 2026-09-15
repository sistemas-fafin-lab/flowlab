import React, { useEffect, useState } from 'react';
import type { AtualizarCadastroInput, Colaborador } from '../../types';

interface EditarCadastroSectionProps {
  colaborador: Colaborador;
  onSalvar: (id: string, dados: AtualizarCadastroInput) => Promise<string | null>;
}

interface FormState {
  cargo: string;
  dataAdmissao: string;
  matricula: string;
  departamento: string;
}

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const criarFormState = (colaborador: Colaborador): FormState => ({
  cargo: colaborador.cargo ?? '',
  dataAdmissao: colaborador.dataAdmissao ?? '',
  matricula: colaborador.matricula ?? '',
  departamento: colaborador.departamento ?? '',
});

const dataDeHoje = (): string => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

const validarDataAdmissao = (valor: string): string | null => {
  if (!valor) return null;
  if (!DATA_REGEX.test(valor)) return 'Data de admissão inválida.';

  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return 'Data de admissão inválida.';

  if (valor > dataDeHoje()) return 'Data de admissão não pode ser uma data futura.';

  return null;
};

const inputClassName =
  'w-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded-xl px-3 py-2';

const labelClassName = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

const EditarCadastroSection: React.FC<EditarCadastroSectionProps> = ({ colaborador, onSalvar }) => {
  const [form, setForm] = useState<FormState>(() => criarFormState(colaborador));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    setForm(criarFormState(colaborador));
    setErro(null);
    setSucesso(false);
    // Reinicializa o formulário apenas ao trocar de colaborador, não a cada
    // re-render do pai (para não atrapalhar uma edição em andamento).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaborador.id]);

  const atualizarCampo =
    (campo: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const valor = e.target.value;
      setForm((atual) => ({ ...atual, [campo]: valor }));
      setSucesso(false);
    };

  const handleSalvar = async (): Promise<void> => {
    const erroValidacao = validarDataAdmissao(form.dataAdmissao);
    if (erroValidacao) {
      setErro(erroValidacao);
      setSucesso(false);
      return;
    }

    setSalvando(true);
    setErro(null);
    setSucesso(false);

    const dados: AtualizarCadastroInput = {
      cargo: form.cargo.trim() || null,
      dataAdmissao: form.dataAdmissao || null,
      matricula: form.matricula.trim() || null,
      departamento: form.departamento.trim() || null,
    };

    const resultado = await onSalvar(colaborador.id, dados);

    setSalvando(false);
    if (resultado) {
      setErro(resultado);
    } else {
      setSucesso(true);
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Dados cadastrais
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClassName} htmlFor="editar-cadastro-cargo">
            Cargo
          </label>
          <input
            id="editar-cadastro-cargo"
            type="text"
            value={form.cargo}
            onChange={atualizarCampo('cargo')}
            placeholder="Ex.: Analista de Faturamento"
            className={inputClassName}
          />
        </div>

        <div>
          <label className={labelClassName} htmlFor="editar-cadastro-data-admissao">
            Data de admissão
          </label>
          <input
            id="editar-cadastro-data-admissao"
            type="date"
            value={form.dataAdmissao}
            onChange={atualizarCampo('dataAdmissao')}
            max={dataDeHoje()}
            className={inputClassName}
          />
        </div>

        <div>
          <label className={labelClassName} htmlFor="editar-cadastro-matricula">
            Matrícula
          </label>
          <input
            id="editar-cadastro-matricula"
            type="text"
            value={form.matricula}
            onChange={atualizarCampo('matricula')}
            placeholder="Ex.: 00123"
            className={inputClassName}
          />
        </div>

        <div>
          <label className={labelClassName} htmlFor="editar-cadastro-departamento">
            Departamento
          </label>
          <input
            id="editar-cadastro-departamento"
            type="text"
            value={form.departamento}
            onChange={atualizarCampo('departamento')}
            placeholder="Ex.: Faturamento"
            className={inputClassName}
          />
        </div>
      </div>

      {erro && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{erro}</p>}
      {sucesso && !erro && (
        <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">Cadastro atualizado com sucesso.</p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSalvar}
          disabled={salvando}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </section>
  );
};

export default EditarCadastroSection;
