import React, { useEffect, useState } from 'react';
import Select, { type SelectOption } from '../../../../components/Select';
import { formatCPF } from '../../../../utils/cpf';
import type { Colaborador, DadosPessoais } from '../../types';
import { useDadosPessoais } from '../../hooks/useDadosPessoais';
import { dataDeHojeISO, formatDataBR, validarDataNaoFutura } from '../../utils/colaboradorFormato';
import {
  CAMPO_DADOS_PESSOAIS_LABEL as ROTULO,
  COR_RACA_LABEL,
  ESTADO_CIVIL_LABEL,
  GENERO_LABEL,
  NACIONALIDADE_LABEL,
  UFS,
} from '../../utils/rotulosDadosPessoais';
import SecaoFicha, { CampoLeitura, inputClassName, labelClassName } from './SecaoFicha';

interface DadosPessoaisSectionProps {
  colaborador: Colaborador;
  podeEditar: boolean;
  editando: boolean;
  bloqueada: boolean;
  onEditandoChange: (editando: boolean) => void;
}

// Sentinela de "não informado" nos selects — nunca colide com um valor do domínio.
const NAO_INFORMADO = '';

const opcoes = (labels: Record<string, string>): SelectOption[] => [
  { value: NAO_INFORMADO, label: 'Não informado' },
  ...Object.entries(labels).map(([value, label], i) => ({ value, label, separatorBefore: i === 0 })),
];

const OPCOES_UF: SelectOption[] = [
  { value: NAO_INFORMADO, label: 'Não informado' },
  ...UFS.map((uf, i) => ({ value: uf, label: uf, separatorBefore: i === 0 })),
];

const Grupo: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div>
    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{titulo}</h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </div>
);

const DadosPessoaisSection: React.FC<DadosPessoaisSectionProps> = ({
  colaborador,
  podeEditar,
  editando,
  bloqueada,
  onEditandoChange,
}) => {
  const { dados, loading, error, salvar } = useDadosPessoais(colaborador.id);
  const [form, setForm] = useState<DadosPessoais>(dados);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (!editando) setForm(dados);
  }, [dados, editando]);

  const campo = <K extends keyof DadosPessoais>(chave: K, valor: DadosPessoais[K]) =>
    setForm((atual) => ({ ...atual, [chave]: valor }));

  const selectDe = <K extends 'nacionalidade' | 'ufNascimento' | 'corRaca' | 'genero' | 'estadoCivil'>(
    chave: K,
    options: SelectOption[],
  ) => (
    <div>
      <label className={labelClassName} htmlFor={`dp-${chave}`}>{ROTULO[chave]}</label>
      <Select
        id={`dp-${chave}`}
        value={form[chave] ?? NAO_INFORMADO}
        onChange={(v) => campo(chave, (v || null) as DadosPessoais[K])}
        options={options}
        controlClass={inputClassName}
        disabled={salvando}
      />
    </div>
  );

  const textoDe = (chave: 'cidadeNascimento' | 'nomeMae' | 'nomePai', placeholder: string) => (
    <div>
      <label className={labelClassName} htmlFor={`dp-${chave}`}>{ROTULO[chave]}</label>
      <input
        id={`dp-${chave}`}
        type="text"
        value={form[chave] ?? ''}
        onChange={(e) => campo(chave, e.target.value)}
        placeholder={placeholder}
        disabled={salvando}
        className={inputClassName}
      />
    </div>
  );

  const editar = () => {
    setForm(dados);
    setErro(null);
    setSucesso(null);
    onEditandoChange(true);
  };

  const cancelar = () => {
    setForm(dados);
    setErro(null);
    onEditandoChange(false);
  };

  const handleSalvar = async () => {
    const erroData = validarDataNaoFutura(form.dataNascimento, 'Data de nascimento');
    if (erroData) {
      setErro(erroData);
      return;
    }
    setSalvando(true);
    setErro(null);
    const resultado = await salvar(form);
    setSalvando(false);
    if (resultado) {
      setErro(resultado);
      return;
    }
    setSucesso(`Dados pessoais de ${colaborador.nome} atualizados.`);
    onEditandoChange(false);
  };

  const nomeCpf = (
    <>
      <CampoLeitura rotulo="Nome completo" valor={colaborador.nome} bloqueado={editando} />
      <CampoLeitura
        rotulo="CPF"
        valor={colaborador.cpf ? formatCPF(colaborador.cpf) : null}
        bloqueado={editando}
        dica={editando ? 'Usado para identificar os holerites enviados em PDF.' : undefined}
      />
    </>
  );

  return (
    <SecaoFicha
      titulo="Dados pessoais"
      podeEditar={podeEditar && !loading && !error}
      editando={editando}
      bloqueada={bloqueada}
      salvando={salvando}
      erro={erro ?? error}
      sucesso={sucesso}
      onEditar={editar}
      onCancelar={cancelar}
      onSalvar={handleSalvar}
    >
      {loading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Carregando dados pessoais...</p>
      ) : editando ? (
        <div className="space-y-5">
          <Grupo titulo="Identificação pessoal">
            {nomeCpf}
            {selectDe('nacionalidade', opcoes(NACIONALIDADE_LABEL))}
          </Grupo>
          <Grupo titulo="Naturalidade">
            {selectDe('ufNascimento', OPCOES_UF)}
            {textoDe('cidadeNascimento', 'Ex.: Juiz de Fora')}
          </Grupo>
          <Grupo titulo="Informações pessoais">
            {selectDe('corRaca', opcoes(COR_RACA_LABEL))}
            {selectDe('genero', opcoes(GENERO_LABEL))}
            {selectDe('estadoCivil', opcoes(ESTADO_CIVIL_LABEL))}
            <div>
              <label className={labelClassName} htmlFor="dp-dataNascimento">{ROTULO.dataNascimento}</label>
              <input
                id="dp-dataNascimento"
                type="date"
                value={form.dataNascimento ?? ''}
                onChange={(e) => campo('dataNascimento', e.target.value || null)}
                max={dataDeHojeISO()}
                disabled={salvando}
                className={inputClassName}
              />
            </div>
          </Grupo>
          <Grupo titulo="Filiação">
            {textoDe('nomeMae', 'Nome completo da mãe')}
            {textoDe('nomePai', 'Nome completo do pai')}
          </Grupo>
        </div>
      ) : (
        <div className="space-y-5">
          <Grupo titulo="Identificação pessoal">
            {nomeCpf}
            <CampoLeitura rotulo={ROTULO.nacionalidade} valor={dados.nacionalidade && NACIONALIDADE_LABEL[dados.nacionalidade]} />
          </Grupo>
          <Grupo titulo="Naturalidade">
            <CampoLeitura rotulo={ROTULO.ufNascimento} valor={dados.ufNascimento} />
            <CampoLeitura rotulo={ROTULO.cidadeNascimento} valor={dados.cidadeNascimento} />
          </Grupo>
          <Grupo titulo="Informações pessoais">
            <CampoLeitura rotulo={ROTULO.corRaca} valor={dados.corRaca && COR_RACA_LABEL[dados.corRaca]} />
            <CampoLeitura rotulo={ROTULO.genero} valor={dados.genero && GENERO_LABEL[dados.genero]} />
            <CampoLeitura rotulo={ROTULO.estadoCivil} valor={dados.estadoCivil && ESTADO_CIVIL_LABEL[dados.estadoCivil]} />
            <CampoLeitura rotulo={ROTULO.dataNascimento} valor={formatDataBR(dados.dataNascimento)} />
          </Grupo>
          <Grupo titulo="Filiação">
            <CampoLeitura rotulo={ROTULO.nomeMae} valor={dados.nomeMae} />
            <CampoLeitura rotulo={ROTULO.nomePai} valor={dados.nomePai} />
          </Grupo>
        </div>
      )}
    </SecaoFicha>
  );
};

export default DadosPessoaisSection;
