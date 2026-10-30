import React, { useEffect, useMemo, useState } from 'react';
import Select, { type SelectOption } from '../../../../components/Select';
import Notification from '../../../../components/Notification';
import { useNotification } from '../../../../hooks/useNotification';
import { formatCPF } from '../../../../utils/cpf';
import type { Colaborador, DadosPessoais } from '../../types';
import { useDadosPessoais } from '../../hooks/useDadosPessoais';
import type { UseSolicitacaoAlteracaoResult } from '../../hooks/useSolicitacaoAlteracao';
import { dataDeHojeISO, formatDataBR, validarDataNaoFutura } from '../../utils/colaboradorFormato';
import {
  CAMPO_DADOS_PESSOAIS_LABEL as ROTULO,
  COR_RACA_LABEL,
  ESTADO_CIVIL_LABEL,
  GENERO_LABEL,
  NACIONALIDADE_LABEL,
  UFS,
} from '../../utils/rotulosDadosPessoais';
import { calcularAlteracoes, formatarValorCampo } from '../../utils/solicitacaoAlteracao';
import { SolicitacaoEmAnalise, SolicitacaoPendenteRH, SolicitacaoResultado } from '../solicitacao/SolicitacaoBanners';
import SecaoFicha, { CampoLeitura, inputClassName, labelClassName } from './SecaoFicha';

interface DadosPessoaisSectionProps {
  colaborador: Colaborador;
  /**
   * 'rh': edição direta (canManageColaboradores) e decisão de solicitações.
   * 'colaborador': Meu perfil — a edição vira uma solicitação para o RH aprovar.
   */
  modo?: 'rh' | 'colaborador';
  podeEditar: boolean;
  editando: boolean;
  bloqueada: boolean;
  onEditandoChange: (editando: boolean) => void;
  /** Solicitação de alteração do colaborador (hook no pai, que também mostra o indicador na aba). */
  solicitacao?: UseSolicitacaoAlteracaoResult;
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
  solicitacao,
}) => {
  const { dados, loading, error, salvar, refetch } = useDadosPessoais(colaborador.id);
  const [form, setForm] = useState<DadosPessoais>(dados);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const { notification, hideNotification, showSuccess, showError } = useNotification();
  const ehColaborador = modo === 'colaborador';
  const pendente = solicitacao?.pendente ?? null;
  const alteracoes = useMemo(() => calcularAlteracoes(dados, form), [dados, form]);
  const alterados = useMemo(() => new Set(alteracoes.map((a) => a.campo)), [alteracoes]);
  const emAnalise = useMemo(
    () => new Map((ehColaborador ? pendente?.alteracoes ?? [] : []).map((a) => [a.campo, a])),
    [ehColaborador, pendente],
  );

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

  /** Campo em leitura; no Meu perfil, mostra o valor proposto que está em análise. */
  const leitura = (chave: keyof DadosPessoais, valor: React.ReactNode) => {
    const proposto = emAnalise.get(chave);
    return (
      <CampoLeitura
        rotulo={ROTULO[chave]}
        valor={valor}
        rodape={
          proposto && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
              Em análise: {formatarValorCampo(chave, proposto.para)}
            </p>
          )
        }
      />
    );
  };

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

    if (ehColaborador) {
      if (!solicitacao || alteracoes.length === 0) {
        setSalvando(false);
        return;
      }
      const resultado = await solicitacao.solicitar(alteracoes);
      setSalvando(false);
      if (resultado) {
        setErro(resultado);
        return;
      }
      showSuccess('Solicitação enviada com sucesso!', 'O RH vai analisar as alterações.');
      onEditandoChange(false);
      return;
    }

    const resultado = await salvar(form);
    setSalvando(false);
    if (resultado) {
      setErro(resultado);
      return;
    }
    setSucesso(`Dados pessoais de ${colaborador.nome} atualizados.`);
    onEditandoChange(false);
  };

  const decidir = async (aprovar: boolean, motivo?: string) => {
    if (!solicitacao || !pendente) return;
    const resultado = await solicitacao.decidir(pendente.id, aprovar, motivo);
    if (resultado) {
      showError('Não foi possível registrar a decisão', resultado);
      await refetch();
      return;
    }
    if (aprovar) {
      await refetch();
      showSuccess('Alteração aprovada com sucesso!');
    } else {
      showSuccess('Alteração recusada', 'O colaborador será notificado da recusa.');
    }
  };

  const cancelarSolicitacao = async () => {
    if (!solicitacao || !pendente) return;
    const resultado = await solicitacao.cancelar(pendente.id);
    if (resultado) showError('Não foi possível cancelar a solicitação', resultado);
    else showSuccess('Solicitação cancelada', 'Seus dados continuam como estavam.');
  };

  const dispensarResultado = async () => {
    if (!solicitacao?.resultado) return;
    const resultado = await solicitacao.dispensarResultado(solicitacao.resultado.id);
    if (resultado) showError('Não foi possível dispensar o aviso', resultado);
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

  const banners = ehColaborador ? (
    <>
      {solicitacao?.resultado && !pendente && !editando && (
        <SolicitacaoResultado solicitacao={solicitacao.resultado} onDispensar={dispensarResultado} />
      )}
      {pendente && <SolicitacaoEmAnalise solicitacao={pendente} onCancelar={cancelarSolicitacao} />}
    </>
  ) : (
    pendente &&
    !loading && (
      <SolicitacaoPendenteRH
        solicitacao={pendente}
        colaboradorNome={colaborador.nome}
        atuais={dados}
        podeDecidir={podeEditar}
        bloqueado={editando || bloqueada}
        onDecidir={decidir}
      />
    )
  );

  const qtdAlterados = alteracoes.length;

  return (
    <>
      <SecaoFicha
        titulo="Dados pessoais"
        podeEditar={podeEditar && !loading && !error}
        editando={editando}
        bloqueada={bloqueada || (ehColaborador && pendente !== null)}
        dicaBloqueio={ehColaborador && pendente ? 'Aguarde a análise da solicitação em andamento' : undefined}
        salvando={salvando}
        erro={erro ?? error}
        sucesso={sucesso}
        onEditar={editar}
        onCancelar={cancelar}
        onSalvar={handleSalvar}
        {...(ehColaborador && {
          subtituloEdicao: 'Altere os campos permitidos e envie para aprovação do RH.',
          rotuloSalvar: 'Enviar para aprovação',
          rotuloSalvando: 'Enviando...',
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
        {banners}
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
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />
    </>
  );
};

export default DadosPessoaisSection;
