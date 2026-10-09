import React, { useMemo, useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { DEPARTMENTS } from '../../../../utils/permissions';
import { dayKey } from '../../../../utils/datas';
import { FORMAS_PAGAMENTO, NATUREZAS, RECORRENCIAS, TIPOS_VALOR } from '../../constants';
import { competenciaDaData, paraCampoMes } from '../../domain/competencia';
import type { DespesaRecorrente } from '../../domain/recorrencia';
import { normalizarDespesa, validarDespesa, type ErrosDespesa } from '../../domain/validacaoDespesa';
import { formatarValorCampo, parseValorBR } from '../../domain/valores';
import type { UseCategoriasTIResult } from '../../hooks/useCategoriasTI';
import type { FornecedorOpcao, ResultadoCriarFornecedor } from '../../hooks/useFornecedoresTI';
import type { ResponsavelOpcao } from '../../hooks/useResponsaveisTI';
import type { Despesa, DespesaInput, FormaPagamento, NaturezaGasto, Recorrencia, TipoValor } from '../../types';
import CategoriaForm from '../categorias/CategoriaForm';
import CampoArquivos from '../ui/CampoArquivos';
import ModalFormulario from '../ui/ModalFormulario';
import { campo, classeRotulo } from '../ui/campos';
import CampoFornecedor from './CampoFornecedor';
import PreviaOcorrencias from './PreviaOcorrencias';

interface DespesaFormModalProps {
  /** null = nova despesa. */
  despesa: Despesa | null;
  categoriasTI: UseCategoriasTIResult;
  fornecedores: FornecedorOpcao[];
  criarFornecedorRapido: (nome: string, documento: string) => Promise<ResultadoCriarFornecedor>;
  responsaveis: ResponsavelOpcao[];
  /** Nomes já usados em "autorizado por" (D3: texto livre, só sugestão). */
  sugestoesAutorizador: string[];
  /** Os arquivos sobem depois de gravar a despesa (uma despesa nova ainda não tem id). */
  onSalvar: (input: DespesaInput, arquivos: File[]) => Promise<string | null>;
  onFechar: () => void;
}

/** Estado do formulário: tudo texto, como os campos entregam; convertido em DespesaInput só ao salvar. */
interface FormDespesa {
  descricao: string;
  categoriaId: string;
  natureza: NaturezaGasto;
  quantidade: string;
  unidade: string;
  fornecedorId: string | null;
  fornecedorNome: string;
  setor: string;
  responsavelId: string;
  tipoValor: TipoValor;
  valor: string;
  recorrencia: Recorrencia;
  inicio: string;
  fim: string;
  diaVencimento: string;
  formaPagamento: FormaPagamento;
  meioPagamentoDetalhe: string;
  moedaOriginal: string;
  valorOriginal: string;
  numeroContrato: string;
  renovacaoAutomatica: boolean;
  avisoRenovacaoDias: string;
  autorizadoPor: string;
  autorizadoEm: string;
  observacoes: string;
}

const textoDeNumero = (n: number | null): string => (n === null ? '' : String(n));

const formInicial = (d: Despesa | null, hoje: string): FormDespesa => ({
  descricao: d?.descricao ?? '',
  categoriaId: d?.categoriaId ?? '',
  natureza: d?.natureza ?? 'opex',
  quantidade: textoDeNumero(d?.quantidade ?? null),
  unidade: d?.unidade ?? '',
  fornecedorId: d?.fornecedorId ?? null,
  fornecedorNome: d?.fornecedorNome ?? '',
  setor: d?.setor ?? '',
  responsavelId: d?.responsavelId ?? '',
  tipoValor: d?.tipoValor ?? 'fixo',
  valor: d ? formatarValorCampo(d.valorBase) : '',
  recorrencia: d?.recorrencia ?? 'mensal',
  inicio: d ? paraCampoMes(d.competenciaInicio) : hoje.slice(0, 7),
  fim: paraCampoMes(d?.competenciaFim),
  diaVencimento: d ? String(d.diaVencimento) : '',
  formaPagamento: d?.formaPagamento ?? 'cartao_corporativo',
  meioPagamentoDetalhe: d?.meioPagamentoDetalhe ?? '',
  moedaOriginal: d?.moedaOriginal ?? '',
  valorOriginal: d?.valorOriginal ? formatarValorCampo(d.valorOriginal) : '',
  numeroContrato: d?.numeroContrato ?? '',
  renovacaoAutomatica: d?.renovacaoAutomatica ?? false,
  avisoRenovacaoDias: d ? String(d.avisoRenovacaoDias) : '30',
  autorizadoPor: d?.autorizadoPor ?? '',
  autorizadoEm: d?.autorizadoEm ?? '',
  observacoes: d?.observacoes ?? '',
});

const inteiroOuNull = (texto: string): number | null => (texto.trim() ? Number(texto) : null);

const paraInput = (f: FormDespesa): DespesaInput =>
  normalizarDespesa({
    descricao: f.descricao,
    categoriaId: f.categoriaId,
    natureza: f.natureza,
    quantidade: inteiroOuNull(f.quantidade),
    unidade: f.unidade,
    fornecedorId: f.fornecedorId,
    fornecedorNome: f.fornecedorNome,
    setor: f.setor,
    responsavelId: f.responsavelId || null,
    tipoValor: f.tipoValor,
    valorBase: parseValorBR(f.valor),
    recorrencia: f.recorrencia,
    competenciaInicio: competenciaDaData(f.inicio),
    competenciaFim: f.fim ? competenciaDaData(f.fim) : null,
    diaVencimento: inteiroOuNull(f.diaVencimento),
    formaPagamento: f.formaPagamento,
    meioPagamentoDetalhe: f.meioPagamentoDetalhe,
    moedaOriginal: f.moedaOriginal,
    valorOriginal: f.valorOriginal.trim() ? parseValorBR(f.valorOriginal) : null,
    numeroContrato: f.numeroContrato,
    renovacaoAutomatica: f.renovacaoAutomatica,
    avisoRenovacaoDias: inteiroOuNull(f.avisoRenovacaoDias),
    autorizadoPor: f.autorizadoPor,
    autorizadoEm: f.autorizadoEm || null,
    observacoes: f.observacoes,
  });

/** Texto que não virou número/mês: o validador só veria "vazio" e daria a mensagem errada. */
const errosDeFormato = (f: FormDespesa): ErrosDespesa => {
  const erros: ErrosDespesa = {};
  if (f.valor.trim() && parseValorBR(f.valor) === null) erros.valorBase = 'Valor inválido. Use o formato 2.480,00.';
  if (f.valorOriginal.trim() && parseValorBR(f.valorOriginal) === null) erros.valorOriginal = 'Valor inválido.';
  if (f.fim.trim() && !competenciaDaData(f.fim)) erros.competenciaFim = 'Mês final inválido.';
  return erros;
};

const Secao: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <section>
    <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-3">{titulo}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </section>
);

const Campo: React.FC<{
  rotulo: string;
  htmlFor: string;
  erro?: string;
  dica?: string;
  opcional?: boolean;
  largo?: boolean;
  children: React.ReactNode;
}> = ({ rotulo, htmlFor, erro, dica, opcional, largo, children }) => (
  <div className={largo ? 'sm:col-span-2' : undefined}>
    <label className={classeRotulo} htmlFor={htmlFor}>
      {rotulo}
      {opcional && <span className="font-normal text-gray-400 dark:text-gray-500"> (opcional)</span>}
    </label>
    {children}
    {erro ? (
      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erro}</p>
    ) : (
      dica && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{dica}</p>
    )}
  </div>
);

const DespesaFormModal: React.FC<DespesaFormModalProps> = ({
  despesa,
  categoriasTI,
  fornecedores,
  criarFornecedorRapido,
  responsaveis,
  sugestoesAutorizador,
  onSalvar,
  onFechar,
}) => {
  const hoje = useMemo(() => dayKey(new Date()), []);
  const [form, setForm] = useState<FormDespesa>(() => formInicial(despesa, hoje));
  const [erros, setErros] = useState<ErrosDespesa>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const editando = despesa !== null;

  const definir = <K extends keyof FormDespesa>(campoForm: K, valor: FormDespesa[K]) =>
    setForm((atual) => ({ ...atual, [campoForm]: valor }));

  const texto = (campoForm: keyof FormDespesa) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    definir(campoForm, e.target.value as never);

  // Categoria inativa só aparece se for a da própria despesa (editar não pode "sumir" com ela).
  const opcoesCategoria = categoriasTI.categorias.filter((c) => c.ativo || c.id === form.categoriaId);
  const categoriaEscolhida = categoriasTI.categorias.find((c) => c.id === form.categoriaId) ?? null;

  const escolherCategoria = (id: string) => {
    const categoria = categoriasTI.categorias.find((c) => c.id === id);
    setForm((atual) => ({ ...atual, categoriaId: id, natureza: categoria?.naturezaPadrao ?? atual.natureza }));
  };

  const despesaDaPrevia = useMemo((): DespesaRecorrente | null => {
    const input = paraInput(form);
    if (input.valorBase === null || input.valorBase <= 0 || !input.competenciaInicio) return null;
    if (input.diaVencimento === null || input.diaVencimento < 1 || input.diaVencimento > 31) return null;
    if (input.competenciaFim && input.competenciaFim < input.competenciaInicio) return null;
    return {
      id: despesa?.id ?? 'previa',
      valorBase: input.valorBase,
      recorrencia: input.recorrencia,
      competenciaInicio: input.competenciaInicio,
      competenciaFim: input.competenciaFim,
      diaVencimento: input.diaVencimento,
      reajustes: despesa?.reajustes ?? [],
    };
  }, [form, despesa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = paraInput(form);
    const errosCampo = { ...validarDespesa(input, hoje), ...errosDeFormato(form) };
    setErros(errosCampo);
    if (Object.keys(errosCampo).length > 0) {
      setErroGeral('Confira os campos destacados.');
      return;
    }
    setSalvando(true);
    setErroGeral(null);
    const erro = await onSalvar(input, arquivos);
    setSalvando(false);
    if (erro) setErroGeral(erro);
    else onFechar();
  };

  const unica = form.recorrencia === 'unica';

  return (
    <ModalFormulario
      titulo={editando ? 'Editar despesa' : 'Nova despesa'}
      subtitulo={editando ? despesa.descricao : 'Cadastro com recorrência, fornecedor e quem autorizou'}
      icone={Receipt}
      onFechar={onFechar}
      onSubmit={handleSubmit}
      ocupado={salvando}
      rotuloSalvar={editando ? 'Salvar alterações' : 'Cadastrar despesa'}
      erro={erroGeral}
      largura="xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6">
        <div className="space-y-6 min-w-0">
          <Secao titulo="O quê">
            <Campo rotulo="Descrição" htmlFor="despesa-descricao" erro={erros.descricao} largo>
              <input
                id="despesa-descricao"
                type="text"
                value={form.descricao}
                onChange={texto('descricao')}
                maxLength={200}
                placeholder="Ex.: Microsoft 365 Business Standard"
                className={campo(erros.descricao)}
                autoFocus={!editando}
              />
            </Campo>

            <div className="sm:col-span-2">
              <div className="flex items-end justify-between gap-2 mb-1">
                <label className={`${classeRotulo} mb-0`} htmlFor="despesa-categoria">
                  Categoria
                </label>
                {!criandoCategoria && (
                  <button
                    type="button"
                    onClick={() => setCriandoCategoria(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Nova categoria
                  </button>
                )}
              </div>
              {criandoCategoria ? (
                <CategoriaForm
                  idBase="despesa-nova-categoria"
                  rotuloSalvar="Criar e usar"
                  onSalvar={async (input) => {
                    const resultado = await categoriasTI.criarCategoria(input);
                    if (resultado.ok === false) return resultado.erro;
                    setForm((atual) => ({ ...atual, categoriaId: resultado.id, natureza: input.naturezaPadrao }));
                    setCriandoCategoria(false);
                    return null;
                  }}
                  onCancelar={() => setCriandoCategoria(false)}
                />
              ) : (
                <>
                  <select
                    id="despesa-categoria"
                    value={form.categoriaId}
                    onChange={(e) => escolherCategoria(e.target.value)}
                    className={campo(erros.categoriaId)}
                  >
                    <option value="">Escolha a categoria</option>
                    {opcoesCategoria.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {c.ativo ? '' : ' (inativa)'}
                      </option>
                    ))}
                  </select>
                  {erros.categoriaId ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erros.categoriaId}</p>
                  ) : (
                    categoriaEscolhida?.descricao && (
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{categoriaEscolhida.descricao}</p>
                    )
                  )}
                </>
              )}
            </div>

            <Campo rotulo="Natureza" htmlFor="despesa-natureza" dica="Sugerida pela categoria; pode trocar.">
              <select id="despesa-natureza" value={form.natureza} onChange={texto('natureza')} className={campo()}>
                {NATUREZAS.map((n) => (
                  <option key={n.valor} value={n.valor}>
                    {n.rotulo} — {n.dica}
                  </option>
                ))}
              </select>
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Quantidade" htmlFor="despesa-quantidade" erro={erros.quantidade} opcional>
                <input
                  id="despesa-quantidade"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={form.quantidade}
                  onChange={texto('quantidade')}
                  placeholder="40"
                  className={campo(erros.quantidade)}
                />
              </Campo>
              <Campo rotulo="Unidade" htmlFor="despesa-unidade" opcional>
                <input
                  id="despesa-unidade"
                  type="text"
                  value={form.unidade}
                  onChange={texto('unidade')}
                  placeholder="licenças"
                  className={campo()}
                />
              </Campo>
            </div>
          </Secao>

          <Secao titulo="Quem">
            <Campo rotulo="Fornecedor" htmlFor="despesa-fornecedor" largo>
              <CampoFornecedor
                id="despesa-fornecedor"
                fornecedores={fornecedores}
                fornecedorId={form.fornecedorId}
                fornecedorNome={form.fornecedorNome}
                onMudar={({ id, nome }) => setForm((atual) => ({ ...atual, fornecedorId: id, fornecedorNome: nome }))}
                onCriarRapido={criarFornecedorRapido}
                erro={erros.fornecedorNome}
              />
            </Campo>
            <Campo rotulo="Setor beneficiado" htmlFor="despesa-setor" opcional>
              <select id="despesa-setor" value={form.setor} onChange={texto('setor')} className={campo()}>
                <option value="">Toda a empresa / não se aplica</option>
                {(DEPARTMENTS as string[]).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                {form.setor && !(DEPARTMENTS as string[]).includes(form.setor) && <option value={form.setor}>{form.setor}</option>}
              </select>
            </Campo>
            <Campo rotulo="Responsável técnico" htmlFor="despesa-responsavel" opcional>
              <select id="despesa-responsavel" value={form.responsavelId} onChange={texto('responsavelId')} className={campo()}>
                <option value="">Ninguém definido</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
                {despesa?.responsavelId && !responsaveis.some((r) => r.id === despesa.responsavelId) && (
                  <option value={despesa.responsavelId}>{despesa.responsavelNome ?? 'Usuário inativo'}</option>
                )}
              </select>
            </Campo>
          </Secao>

          <Secao titulo="Quanto e quando">
            <Campo
              rotulo={form.tipoValor === 'variavel' ? 'Valor estimado por cobrança (R$)' : 'Valor por cobrança (R$)'}
              htmlFor="despesa-valor"
              erro={erros.valorBase}
              dica={editando ? 'Mudar o valor aqui corrige todas as cobranças desde o início.' : undefined}
            >
              <input
                id="despesa-valor"
                type="text"
                inputMode="decimal"
                value={form.valor}
                onChange={texto('valor')}
                onBlur={() => {
                  const valor = parseValorBR(form.valor);
                  if (valor !== null) definir('valor', formatarValorCampo(valor));
                }}
                placeholder="2.480,00"
                className={`${campo(erros.valorBase)} tabular-nums`}
              />
            </Campo>

            <div>
              <span className={classeRotulo} id="despesa-tipo-valor">
                Tipo de valor
              </span>
              <div role="radiogroup" aria-labelledby="despesa-tipo-valor" className="grid grid-cols-2 gap-2">
                {TIPOS_VALOR.map((t) => {
                  const ativo = form.tipoValor === t.valor;
                  return (
                    <button
                      key={t.valor}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      title={t.dica}
                      onClick={() => definir('tipoValor', t.valor)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        ativo
                          ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                          : 'border-gray-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:border-violet-300'
                      }`}
                    >
                      {t.rotulo}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {TIPOS_VALOR.find((t) => t.valor === form.tipoValor)?.dica}
              </p>
            </div>

            <Campo rotulo="Recorrência" htmlFor="despesa-recorrencia" dica={unica ? 'Uma cobrança só. Para parcelado, use Mensal com mês final.' : undefined}>
              <select id="despesa-recorrencia" value={form.recorrencia} onChange={texto('recorrencia')} className={campo()}>
                {RECORRENCIAS.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.rotulo}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Dia do vencimento" htmlFor="despesa-dia" erro={erros.diaVencimento} dica="29 a 31 caem no último dia dos meses mais curtos.">
              <input
                id="despesa-dia"
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                value={form.diaVencimento}
                onChange={texto('diaVencimento')}
                placeholder="10"
                className={campo(erros.diaVencimento)}
              />
            </Campo>

            <Campo rotulo={unica ? 'Mês da cobrança' : 'Mês da primeira cobrança'} htmlFor="despesa-inicio" erro={erros.competenciaInicio}>
              <input
                id="despesa-inicio"
                type="month"
                value={form.inicio}
                onChange={texto('inicio')}
                className={campo(erros.competenciaInicio)}
              />
            </Campo>

            {!unica && (
              <Campo
                rotulo="Mês da última cobrança"
                htmlFor="despesa-fim"
                erro={erros.competenciaFim}
                opcional
                dica="Fim do contrato, encerramento ou última parcela. Vazio = sem prazo."
              >
                <input id="despesa-fim" type="month" value={form.fim} onChange={texto('fim')} className={campo(erros.competenciaFim)} />
              </Campo>
            )}

            <Campo rotulo="Forma de pagamento" htmlFor="despesa-forma">
              <select id="despesa-forma" value={form.formaPagamento} onChange={texto('formaPagamento')} className={campo()}>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Identificação do meio" htmlFor="despesa-meio" opcional>
              <input
                id="despesa-meio"
                type="text"
                value={form.meioPagamentoDetalhe}
                onChange={texto('meioPagamentoDetalhe')}
                placeholder="Ex.: cartão final 1234"
                className={campo()}
              />
            </Campo>

            <Campo rotulo="Número do contrato" htmlFor="despesa-contrato" opcional>
              <input
                id="despesa-contrato"
                type="text"
                value={form.numeroContrato}
                onChange={texto('numeroContrato')}
                className={campo()}
              />
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Moeda original" htmlFor="despesa-moeda" erro={erros.moedaOriginal} opcional>
                <input
                  id="despesa-moeda"
                  type="text"
                  value={form.moedaOriginal}
                  onChange={(e) => definir('moedaOriginal', e.target.value.toUpperCase().slice(0, 3))}
                  placeholder="USD"
                  className={campo(erros.moedaOriginal)}
                />
              </Campo>
              <Campo rotulo="Valor original" htmlFor="despesa-valor-original" erro={erros.valorOriginal} opcional>
                <input
                  id="despesa-valor-original"
                  type="text"
                  inputMode="decimal"
                  value={form.valorOriginal}
                  onChange={texto('valorOriginal')}
                  placeholder="30,00"
                  className={`${campo(erros.valorOriginal)} tabular-nums`}
                />
              </Campo>
            </div>

            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <label className="flex items-start gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.renovacaoAutomatica}
                  onChange={(e) => definir('renovacaoAutomatica', e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Renova automaticamente</span>
                  <span className="block text-xs text-slate-400 dark:text-slate-500">
                    O contrato se renova sozinho se ninguém cancelar.
                  </span>
                </span>
              </label>
              <Campo
                rotulo="Avisar da renovação com antecedência de (dias)"
                htmlFor="despesa-aviso"
                erro={erros.avisoRenovacaoDias}
              >
                <input
                  id="despesa-aviso"
                  type="number"
                  min={0}
                  max={365}
                  inputMode="numeric"
                  value={form.avisoRenovacaoDias}
                  onChange={texto('avisoRenovacaoDias')}
                  className={campo(erros.avisoRenovacaoDias)}
                />
              </Campo>
            </div>
          </Secao>

          <Secao titulo="Autorização">
            <Campo rotulo="Autorizado por" htmlFor="despesa-autorizado-por" erro={erros.autorizadoPor} dica="Nome de quem autorizou o gasto.">
              <input
                id="despesa-autorizado-por"
                type="text"
                list="despesa-autorizadores"
                value={form.autorizadoPor}
                onChange={texto('autorizadoPor')}
                placeholder="Ex.: Diretoria"
                className={campo(erros.autorizadoPor)}
              />
              <datalist id="despesa-autorizadores">
                {sugestoesAutorizador.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
            </Campo>
            <Campo rotulo="Data da autorização" htmlFor="despesa-autorizado-em" erro={erros.autorizadoEm} opcional>
              <input
                id="despesa-autorizado-em"
                type="date"
                value={form.autorizadoEm}
                max={hoje}
                onChange={texto('autorizadoEm')}
                className={campo(erros.autorizadoEm)}
              />
            </Campo>
            <Campo
              rotulo={editando ? 'Novos anexos' : 'Anexos'}
              htmlFor="despesa-anexos"
              opcional
              largo
              dica={
                editando
                  ? 'Os anexos já enviados ficam no painel da despesa.'
                  : 'Contrato, proposta ou o e-mail de autorização. Sobem assim que a despesa for cadastrada.'
              }
            >
              <CampoArquivos id="despesa-anexos" arquivos={arquivos} onMudar={setArquivos} />
            </Campo>
            <Campo rotulo="Observações" htmlFor="despesa-observacoes" opcional largo>
              <textarea
                id="despesa-observacoes"
                rows={3}
                value={form.observacoes}
                onChange={texto('observacoes')}
                className={`${campo()} resize-y`}
              />
            </Campo>
          </Secao>
        </div>

        <aside className="lg:sticky lg:top-0 self-start">
          <PreviaOcorrencias despesa={despesaDaPrevia} hoje={hoje} />
        </aside>
      </div>
    </ModalFormulario>
  );
};

export default DespesaFormModal;
