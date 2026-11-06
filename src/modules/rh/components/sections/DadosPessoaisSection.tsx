import React, { useEffect, useMemo, useState } from 'react';
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
import { calcularAlteracoes } from '../../utils/alteracaoDadosPessoais';
import SecaoFicha, { CampoLeitura, inputClassName, labelClassName } from './SecaoFicha';

interface DadosPessoaisSectionProps {
  colaborador: Colaborador;
  /**
   * 'rh': ficha do colaborador (canManageColaboradores) — grava o registro inteiro.
   * 'colaborador': Meu perfil — grava só os campos alterados do próprio cadastro, sem aprovação do RH.
   */
  modo?: 'rh' | 'colaborador';
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

const MarcaAlterado: React.FC = () => (
  <span className="ml-1.5 px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
    Alterado
  </span>
);

const DadosPessoaisSection: React.FC<DadosPessoaisSectionProps> = ({
  colaborador,
  modo = 'rh',
  podeEditar,
  editando,
  bloqueada,
  onEditandoChange,
}) => {
  const { dados, loading, error, salvar, salvarMeus } = useDadosPessoais(colaborador.id);
  const [form, setForm] = useState<DadosPessoais>(dados);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const ehColaborador = modo === 'colaborador';
  const alteracoes = useMemo(() => calcularAlteracoes(dados, form), [dados, form]);
  const alterados = useMemo(() => new Set(alteracoes.map((a) => a.campo)), [alteracoes]);

  useEffect(() => {
    if (!editando) setForm(dados);
  }, [dados, editando]);

  const campo = <K extends keyof DadosPessoais>(chave: K, valor: DadosPessoais[K]) =>
    setForm((atual) => ({ ...atual, [chave]: valor }));

  const rotuloEdicao = (chave: keyof DadosPessoais) => (
    <label className={`${labelClassName} flex items-center`} htmlFor={`dp-${chave}`}>
      {ROTULO[chave]}
      {ehColaborador && alterados.has(chave) && <MarcaAlterado />}
    </label>
  );

  const selectDe = <K extends 'nacionalidade' | 'ufNascimento' | 'corRaca' | 'genero' | 'estadoCivil'>(
    chave: K,
    options: SelectOption[],
  ) => (
    <div>
      {rotuloEdicao(chave)}
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
      {rotuloEdicao(chave)}
      <input
        id={`dp-${chave}`}
        type="text"
        value={form[chave] ?? ''}
        onChange={(e) => campo(chave, e.target.value)}
        placeholder={placeholder}
        maxLength={200}
        disabled={salvando}
        className={inputClassName}
      />
    </div>
  );

  const leitura = (chave: keyof DadosPessoais, valor: React.ReactNode) => <CampoLeitura rotulo={ROTULO[chave]} valor={valor} />;

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

    if (ehColaborador && alteracoes.length === 0) {
      setSalvando(false);
      return;
    }

    const resultado = ehColaborador ? await salvarMeus(alteracoes) : await salvar(form);
    setSalvando(false);
    if (resultado) {
      setErro(resultado);
      return;
    }
    setSucesso(ehColaborador ? 'Seus dados pessoais foram atualizados.' : `Dados pessoais de ${colaborador.nome} atualizados.`);
    onEditandoChange(false);
  };

  const dicaNomeCpf = ehColaborador ? 'Para corrigir, fale com o RH.' : undefined;
  const nomeCpf = (
    <>
      <CampoLeitura rotulo="Nome completo" valor={colaborador.nome} bloqueado={editando} dica={editando ? dicaNomeCpf : undefined} />
      <CampoLeitura
        rotulo="CPF"
        valor={colaborador.cpf ? formatCPF(colaborador.cpf) : null}
        bloqueado={editando}
        dica={editando ? dicaNomeCpf ?? 'Usado para identificar os holerites enviados em PDF.' : undefined}
      />
    </>
  );

  const qtdAlterados = alteracoes.length;

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
      {...(ehColaborador && {
        subtituloEdicao: 'Altere os campos permitidos e salve.',
        salvarDesabilitado: qtdAlterados === 0,
        infoRodape: qtdAlterados === 0 ? 'Nenhum campo alterado' : `${qtdAlterados} ${qtdAlterados === 1 ? 'campo alterado' : 'campos alterados'}`,
        rodapeFixo: true,
        acaoErro: erro && editando && (
          <button type="button" onClick={handleSalvar} disabled={salvando} className="font-medium underline hover:no-underline">
            Tentar novamente
          </button>
        ),
      })}
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
              {rotuloEdicao('dataNascimento')}
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
            {leitura('nacionalidade', dados.nacionalidade && NACIONALIDADE_LABEL[dados.nacionalidade])}
          </Grupo>
          <Grupo titulo="Naturalidade">
            {leitura('ufNascimento', dados.ufNascimento)}
            {leitura('cidadeNascimento', dados.cidadeNascimento)}
          </Grupo>
          <Grupo titulo="Informações pessoais">
            {leitura('corRaca', dados.corRaca && COR_RACA_LABEL[dados.corRaca])}
            {leitura('genero', dados.genero && GENERO_LABEL[dados.genero])}
            {leitura('estadoCivil', dados.estadoCivil && ESTADO_CIVIL_LABEL[dados.estadoCivil])}
            {leitura('dataNascimento', formatDataBR(dados.dataNascimento))}
          </Grupo>
          <Grupo titulo="Filiação">
            {leitura('nomeMae', dados.nomeMae)}
            {leitura('nomePai', dados.nomePai)}
          </Grupo>
        </div>
      )}
    </SecaoFicha>
  );
};

export default DadosPessoaisSection;
