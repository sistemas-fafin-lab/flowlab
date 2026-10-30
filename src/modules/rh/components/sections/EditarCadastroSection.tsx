import React, { useEffect, useState } from 'react';
import Select, { type SelectOption } from '../../../../components/Select';
import type { AtualizarCadastroInput, Colaborador, Departamento } from '../../types';
import { dataDeHojeISO, formatDataBR, validarDataNaoFutura } from '../../utils/colaboradorFormato';
import SecaoFicha, { CampoLeitura, inputClassName, labelClassName } from './SecaoFicha';

interface EditarCadastroSectionProps {
  colaborador: Colaborador;
  departamentos: Departamento[];
  /** canManageColaboradores: sem ela a seção é só leitura. */
  podeEditar: boolean;
  /** canManageDepartamentos: sem ela o departamento aparece, mas não muda. */
  podeMudarDepartamento: boolean;
  editando: boolean;
  bloqueada: boolean;
  onEditandoChange: (editando: boolean) => void;
  onSalvar: (id: string, dados: AtualizarCadastroInput) => Promise<string | null>;
}

// Sentinela para "sem departamento" — nunca colide com um uuid real.
const SEM_DEPARTAMENTO = '';

interface FormState {
  cargo: string;
  dataAdmissao: string;
  matricula: string;
  departamentoId: string;
}

const criarFormState = (colaborador: Colaborador): FormState => ({
  cargo: colaborador.cargo ?? '',
  dataAdmissao: colaborador.dataAdmissao ?? '',
  matricula: colaborador.matricula ?? '',
  departamentoId: colaborador.departamentoId ?? SEM_DEPARTAMENTO,
});

const STATUS_BADGE: Record<Colaborador['status'], { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  desligado: { label: 'Desligado', className: 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400' },
};

const EditarCadastroSection: React.FC<EditarCadastroSectionProps> = ({
  colaborador,
  departamentos,
  podeEditar,
  podeMudarDepartamento,
  editando,
  bloqueada,
  onEditandoChange,
  onSalvar,
}) => {
  const [form, setForm] = useState<FormState>(() => criarFormState(colaborador));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    setForm(criarFormState(colaborador));
    setErro(null);
    setSucesso(null);
    // Reinicializa apenas ao trocar de colaborador, não a cada re-render do pai
    // (para não atrapalhar uma edição em andamento).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaborador.id]);

  const atualizarCampo =
    (campo: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const valor = e.target.value;
      setForm((atual) => ({ ...atual, [campo]: valor }));
    };

  // Inativos ficam fora da escolha, mas o atual continua aparecendo.
  const opcoesDepartamento: SelectOption[] = [
    { value: SEM_DEPARTAMENTO, label: 'Sem departamento' },
    ...departamentos
      .filter((d) => d.ativo || d.id === colaborador.departamentoId)
      .map((d, index) => ({ value: d.id, label: d.ativo ? d.nome : `${d.nome} (inativo)`, separatorBefore: index === 0 })),
  ];

  const editar = () => {
    setForm(criarFormState(colaborador));
    setErro(null);
    setSucesso(null);
    onEditandoChange(true);
  };

  const cancelar = () => {
    setForm(criarFormState(colaborador));
    setErro(null);
    onEditandoChange(false);
  };

  const handleSalvar = async (): Promise<void> => {
    const erroValidacao = validarDataNaoFutura(form.dataAdmissao || null, 'Data de admissão');
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setSalvando(true);
    setErro(null);

    const dados: AtualizarCadastroInput = {
      cargo: form.cargo.trim() || null,
      dataAdmissao: form.dataAdmissao || null,
      matricula: form.matricula.trim() || null,
    };
    const departamentoId = form.departamentoId || null;
    if (podeMudarDepartamento && departamentoId !== colaborador.departamentoId) {
      dados.departamentoId = departamentoId;
    }

    const resultado = await onSalvar(colaborador.id, dados);

    setSalvando(false);
    if (resultado) {
      setErro(resultado);
      return;
    }
    setSucesso(`Dados cadastrais de ${colaborador.nome} atualizados.`);
    onEditandoChange(false);
  };

  const status = STATUS_BADGE[colaborador.status];
  const camposSomenteLeitura = (
    <>
      <CampoLeitura
        rotulo="Status"
        valor={<span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>{status.label}</span>}
      />
      {colaborador.dataDesligamento && (
        <CampoLeitura rotulo="Data de desligamento" valor={formatDataBR(colaborador.dataDesligamento)} />
      )}
      <CampoLeitura rotulo="E-mail" valor={colaborador.email} bloqueado={editando} />
    </>
  );

  return (
    <SecaoFicha
      titulo="Dados cadastrais"
      podeEditar={podeEditar}
      editando={editando}
      bloqueada={bloqueada}
      salvando={salvando}
      erro={erro}
      sucesso={sucesso}
      onEditar={editar}
      onCancelar={cancelar}
      onSalvar={handleSalvar}
    >
      {editando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName} htmlFor="editar-cadastro-matricula">Matrícula</label>
            <input
              id="editar-cadastro-matricula"
              type="text"
              value={form.matricula}
              onChange={atualizarCampo('matricula')}
              placeholder="Ex.: 00123"
              disabled={salvando}
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName} htmlFor="editar-cadastro-cargo">Cargo</label>
            <input
              id="editar-cadastro-cargo"
              type="text"
              value={form.cargo}
              onChange={atualizarCampo('cargo')}
              placeholder="Ex.: Analista de Faturamento"
              disabled={salvando}
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName} htmlFor="editar-cadastro-departamento">Departamento</label>
            <Select
              id="editar-cadastro-departamento"
              value={form.departamentoId}
              onChange={(valor) => setForm((atual) => ({ ...atual, departamentoId: valor }))}
              options={opcoesDepartamento}
              controlClass={inputClassName}
              disabled={!podeMudarDepartamento || salvando}
            />
          </div>
          <div>
            <label className={labelClassName} htmlFor="editar-cadastro-data-admissao">Data de admissão</label>
            <input
              id="editar-cadastro-data-admissao"
              type="date"
              value={form.dataAdmissao}
              onChange={atualizarCampo('dataAdmissao')}
              max={dataDeHojeISO()}
              disabled={salvando}
              className={inputClassName}
            />
          </div>
          {camposSomenteLeitura}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CampoLeitura rotulo="Matrícula" valor={colaborador.matricula} />
          <CampoLeitura rotulo="Cargo" valor={colaborador.cargo} />
          <CampoLeitura rotulo="Departamento" valor={colaborador.departamentoNome} />
          <CampoLeitura rotulo="Data de admissão" valor={formatDataBR(colaborador.dataAdmissao)} />
          {camposSomenteLeitura}
        </div>
      )}
    </SecaoFicha>
  );
};

export default EditarCadastroSection;
