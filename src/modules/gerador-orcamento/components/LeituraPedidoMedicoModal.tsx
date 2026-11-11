import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, FileText, Image as ImageIcon, Loader2, Plus, Sparkles, Upload, X } from 'lucide-react';
import { analisarPedidoMedico } from '../api';
import { chaveExame } from '../domain/carrinho';
import { conferirCobertura, type ExameNaoCoberto, type ResumoCobertura } from '../domain/cobertura';
import SeletorConvenio from './SeletorConvenio';
import ListaConvenios from './ListaConvenios';
import SeloCobertura from './SeloCobertura';
import {
  MAX_ARQUIVOS_PEDIDO,
  MAX_MB_POR_ARQUIVO,
  problemaNosArquivosDoPedido,
  fraseDoNaoEncontrado,
  resolverLeituraDoPedido,
  type ExameNaoEncontrado,
  type LeituraDoPedido,
} from '../domain/pedidoMedico';
import type { ItemGeradorOrcamento } from '../types';
import { formatCurrency } from '../../../utils/paymentUtils';

const formatarTamanho = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Relacionados visíveis antes do "ver mais". */
const RELACIONADOS_VISIVEIS = 3;

/** Aviso de um exame não encontrado: só texto, nada daqui vai ao carrinho. */
const AvisoNaoEncontrado: React.FC<{ exame: ExameNaoEncontrado }> = ({ exame }) => {
  const [expandido, setExpandido] = useState(false);
  const { relacionados } = exame;
  const ocultos = relacionados.length - RELACIONADOS_VISIVEIS;
  const visiveis = expandido || ocultos <= 0 ? relacionados : relacionados.slice(0, RELACIONADOS_VISIVEIS);

  return (
    <li className="px-3 py-2.5">
      <p className="text-sm text-gray-800 dark:text-gray-100">{fraseDoNaoEncontrado(exame)}</p>
      {relacionados.length > 0 && (
        <>
          <ul className="mt-1.5 space-y-0.5 pl-4 list-disc marker:text-amber-500">
            {visiveis.map((nome) => (
              <li key={nome} className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {nome}
              </li>
            ))}
          </ul>
          {ocultos > 0 && (
            <button
              type="button"
              onClick={() => setExpandido((atual) => !atual)}
              className="mt-1 text-xs font-medium text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
            >
              {expandido ? 'ver menos' : `ver mais (+${ocultos})`}
            </button>
          )}
        </>
      )}
    </li>
  );
};

/**
 * Aviso fixo do não encontrado na aba de cobertura: fora da tabela o Gerador não sabe
 * nada do exame — nem se o convênio cobre, nem se o laboratório deixa de realizá-lo.
 */
const FRASE_FORA_DA_TABELA = 'Não está na tabela do Gerador — confira a cobertura à mão';

type Aba = 'particular' | 'cobertura';
const ABAS: { id: Aba; label: string }[] = [
  { id: 'particular', label: 'Orçamento particular' },
  { id: 'cobertura', label: 'Cobertura do convênio' },
];

/** Resumo da Conferência de cobertura dos reconhecidos (só com total > 0). */
const ResumoCoberturaDoPedido: React.FC<{ resumo: ResumoCobertura; convenio: string }> = ({ resumo, convenio }) =>
  resumo.todosCobertos ? (
    <p className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/60">
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      {resumo.total === 1 ? `O exame é coberto pela ${convenio}` : `Todos os ${resumo.total} exames são cobertos pela ${convenio}`}
    </p>
  ) : (
    <p className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/60">
      <AlertCircle className="w-4 h-4 shrink-0" /> {resumo.cobertos} de {resumo.total} cobertos pela {convenio}
    </p>
  );

/** Um reconhecido com a marcação para o carrinho — a mesma nas duas abas. */
const LinhaReconhecido: React.FC<{
  nomeNoPedido: string;
  exame: ItemGeradorOrcamento;
  marcado: boolean;
  onAlternar: () => void;
  /** só na aba de cobertura, com convênio escolhido: selo no lugar do preço */
  coberto?: { valor: boolean; convenio: string };
}> = ({ nomeNoPedido, exame, marcado, onAlternar, coberto }) => (
  <li>
    <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
      <input
        type="checkbox"
        checked={marcado}
        onChange={onAlternar}
        className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{exame.nome}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          No pedido: “{nomeNoPedido}” · TUSS {exame.tuss || '—'}
        </span>
      </span>
      {coberto === undefined ? (
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
          {formatCurrency(exame.preco)}
        </span>
      ) : (
        <SeloCobertura coberto={coberto.valor} convenio={coberto.convenio} />
      )}
    </label>
  </li>
);

/**
 * Um não coberto na aba de cobertura: a caixa marca para o carrinho e o resto da linha
 * expande/recolhe os outros convênios que atendem o exame — para orientar o paciente
 * ou checar se ele tem outro plano.
 */
const LinhaNaoCoberto: React.FC<{
  nomeNoPedido: string;
  naoCoberto: ExameNaoCoberto;
  convenio: string;
  marcado: boolean;
  onAlternar: () => void;
}> = ({ nomeNoPedido, naoCoberto: { exame, outrosConvenios }, convenio, marcado, onAlternar }) => {
  const [expandido, setExpandido] = useState(false);
  return (
    <li className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40">
      <input
        type="checkbox"
        aria-label={`Marcar ${exame.nome} para o carrinho`}
        checked={marcado}
        onChange={onAlternar}
        className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={expandido}
          onClick={() => setExpandido((atual) => !atual)}
          className="w-full flex items-start gap-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{exame.nome}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              No pedido: “{nomeNoPedido}” · TUSS {exame.tuss || '—'}
            </span>
            <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Outros convênios ({outrosConvenios.length})
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandido ? 'rotate-180' : ''}`} />
            </span>
          </span>
          <SeloCobertura coberto={false} convenio={convenio} />
        </button>
        {expandido &&
          (outrosConvenios.length > 0 ? (
            <ListaConvenios convenios={outrosConvenios} />
          ) : (
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Nenhum convênio cadastrado atende este exame.
            </p>
          ))}
      </div>
    </li>
  );
};

const TITULO_GRUPO_TEXTO = 'text-sm font-semibold text-gray-800 dark:text-gray-100';
const TITULO_GRUPO = `${TITULO_GRUPO_TEXTO} mb-2`;
const LISTA_GRUPO = 'divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700';

const BOTAO_PRIMARIO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none';
const BOTAO_SECUNDARIO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Leitura do pedido médico por IA: o atendente escolhe as fotos/PDFs, a IA lê os
 * exames e a janela mostra primeiro os não encontrados na tabela (aviso só de texto,
 * com os exames relacionados que o laboratório realiza, para buscar à mão) e depois
 * os reconhecidos (marcados para entrar no carrinho). Nada entra no carrinho sem a revisão.
 * Montada só enquanto aberta: fechar descarta arquivos e resultado.
 *
 * O resultado tem duas abas sobre a mesma leitura: "Orçamento particular" e a
 * Conferência de cobertura do convênio — trocar de aba ou de convênio não chama a IA.
 * O convênio é o da página (o mesmo do carrinho), por isso sobrevive ao fechar.
 */
const LeituraPedidoMedicoModal: React.FC<{
  exames: readonly ItemGeradorOrcamento[];
  /** convênios para o seletor, já em ordem (conveniosDaLista) */
  convenios: readonly string[];
  convenio: string | null;
  onEscolherConvenio: (convenio: string | null) => void;
  onFechar: () => void;
  onAdicionar: (exames: ItemGeradorOrcamento[]) => void;
}> = ({ exames, convenios, convenio, onEscolherConvenio, onFechar, onAdicionar }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<LeituraDoPedido | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const problema = arquivos.length > 0 ? problemaNosArquivosDoPedido(arquivos) : null;

  const incluirArquivos = (novos: File[]) => {
    setErro(null);
    setArquivos((atuais) => [
      ...atuais,
      ...novos.filter((n) => !atuais.some((a) => a.name === n.name && a.size === n.size)),
    ]);
  };

  const analisar = async () => {
    const motivo = problemaNosArquivosDoPedido(arquivos);
    if (motivo) {
      setErro(motivo);
      return;
    }
    setAnalisando(true);
    setErro(null);
    try {
      const resultado = resolverLeituraDoPedido(await analisarPedidoMedico(arquivos), exames);
      setLeitura(resultado);
      setMarcados(new Set(resultado.reconhecidos.map((r) => chaveExame(r.exame))));
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : 'Não foi possível analisar o pedido médico.');
    } finally {
      setAnalisando(false);
    }
  };

  const alternarMarcado = (chave: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const marcarSoNaoCobertos = (naoCobertos: readonly ExameNaoCoberto[]) =>
    setMarcados(new Set(naoCobertos.map(({ exame }) => chaveExame(exame))));

  const selecionados = useMemo(
    () => (leitura?.reconhecidos ?? []).filter((r) => marcados.has(chaveExame(r.exame))).map((r) => r.exame),
    [leitura, marcados],
  );

  const [aba, setAba] = useState<Aba>('particular');
  const conferencia = useMemo(
    () => (leitura && convenio ? conferirCobertura(leitura.reconhecidos.map((r) => r.exame), convenio) : null),
    [leitura, convenio],
  );
  const nomeNoPedidoPorChave = useMemo(
    () => new Map((leitura?.reconhecidos ?? []).map((r) => [chaveExame(r.exame), r.nomeNoPedido])),
    [leitura],
  );

  const linhaReconhecido = (exame: ItemGeradorOrcamento, coberto?: boolean) => {
    const chave = chaveExame(exame);
    return (
      <LinhaReconhecido
        key={chave}
        nomeNoPedido={nomeNoPedidoPorChave.get(chave) ?? exame.nome}
        exame={exame}
        marcado={marcados.has(chave)}
        onAlternar={() => alternarMarcado(chave)}
        coberto={coberto === undefined || !convenio ? undefined : { valor: coberto, convenio }}
      />
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-leitura-pedido"
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-scale-in"
      >
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="titulo-leitura-pedido" className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Ler pedido médico
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                A IA identifica os exames; você revisa antes de ir ao carrinho.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            disabled={analisando}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-full transition-all duration-200 hover:rotate-90 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Na aba de cobertura, altura mínima para a lista do seletor de convênio
            abrir inteira, sem ficar cortada pelo rodapé. */}
        <div
          className={`px-6 py-5 overflow-y-auto flex-1 space-y-4 ${
            leitura && aba === 'cobertura' && leitura.reconhecidos.length > 0 ? 'min-h-[27rem]' : ''
          }`}
        >
          {!leitura ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  incluirArquivos(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={analisando}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastando(true);
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastando(false);
                  incluirArquivos(Array.from(e.dataTransfer.files));
                }}
                className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
                  arrastando
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40 dark:border-gray-600 dark:bg-gray-900/30'
                }`}
              >
                <Upload className={`w-8 h-8 ${arrastando ? 'text-blue-500' : 'text-gray-400'}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Arraste as fotos ou PDFs aqui <span className="text-blue-600 dark:text-blue-400">ou clique para escolher</span>
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Até {MAX_ARQUIVOS_PEDIDO} arquivos, {MAX_MB_POR_ARQUIVO}MB cada
                </span>
              </button>

              {arquivos.length > 0 && (
                <ul className="space-y-1.5">
                  {arquivos.map((arquivo, i) => (
                    <li
                      key={`${arquivo.name}-${arquivo.size}`}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2"
                    >
                      {arquivo.type.startsWith('image/') ? (
                        <ImageIcon className="w-4 h-4 text-gray-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-200">{arquivo.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{formatarTamanho(arquivo.size)}</span>
                      <button
                        type="button"
                        aria-label={`Remover ${arquivo.name}`}
                        disabled={analisando}
                        onClick={() => {
                          setErro(null);
                          setArquivos((atuais) => atuais.filter((_, j) => j !== i));
                        }}
                        className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {(problema || erro) && (
                <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {problema ?? erro}
                </p>
              )}

              {analisando && (
                <p className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Lendo o pedido… pode levar até um minuto.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-slate-800" role="tablist">
                {ABAS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    aria-selected={aba === a.id}
                    onClick={() => setAba(a.id)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      aba === a.id
                        ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {aba === 'particular' ? (
            <>
              {leitura.semCorrespondencia.length > 0 && (
                <section className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-900/10">
                  <div className="flex items-start gap-2 px-3 pt-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        Não encontrados na tabela ({leitura.semCorrespondencia.length})
                      </h3>
                      <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                        Estes exames do pedido não foram identificados na tabela. Confira o pedido e busque
                        manualmente antes de enviar o orçamento.
                      </p>
                    </div>
                  </div>
                  <ul className="mt-2 divide-y divide-amber-200/70 border-t border-amber-200/70 dark:divide-amber-800/40 dark:border-amber-800/40">
                    {leitura.semCorrespondencia.map((exame, i) => (
                      <AvisoNaoEncontrado key={`${exame.nomeNoPedido}-${i}`} exame={exame} />
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  Reconhecidos ({leitura.reconhecidos.length})
                </h3>
                {leitura.reconhecidos.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum exame do pedido foi achado na lista.</p>
                ) : (
                  <ul className={LISTA_GRUPO}>{leitura.reconhecidos.map(({ exame }) => linhaReconhecido(exame))}</ul>
                )}
              </section>
            </>
              ) : (
            <>
              {leitura.reconhecidos.length > 0 && (
                <SeletorConvenio convenios={convenios} convenio={convenio} onEscolher={onEscolherConvenio} />
              )}

              {leitura.reconhecidos.length > 0 && !conferencia ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Escolha o convênio do paciente para conferir quais exames do pedido ele cobre.
                </p>
              ) : (
                <>
                  {conferencia && convenio && conferencia.resumo.total > 0 && (
                    <>
                      <ResumoCoberturaDoPedido resumo={conferencia.resumo} convenio={convenio} />
                      {conferencia.naoCobertos.length > 0 && (
                        <section>
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <h3 className={TITULO_GRUPO_TEXTO}>Não cobertos ({conferencia.naoCobertos.length})</h3>
                            <button
                              type="button"
                              onClick={() => marcarSoNaoCobertos(conferencia.naoCobertos)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Marcar só os não cobertos
                            </button>
                          </div>
                          <ul className={LISTA_GRUPO}>
                            {conferencia.naoCobertos.map((naoCoberto) => {
                              const chave = chaveExame(naoCoberto.exame);
                              return (
                                <LinhaNaoCoberto
                                  key={chave}
                                  nomeNoPedido={nomeNoPedidoPorChave.get(chave) ?? naoCoberto.exame.nome}
                                  naoCoberto={naoCoberto}
                                  convenio={convenio}
                                  marcado={marcados.has(chave)}
                                  onAlternar={() => alternarMarcado(chave)}
                                />
                              );
                            })}
                          </ul>
                        </section>
                      )}
                      {conferencia.cobertos.length > 0 && (
                        <section>
                          <h3 className={TITULO_GRUPO}>Cobertos ({conferencia.cobertos.length})</h3>
                          <ul className={LISTA_GRUPO}>{conferencia.cobertos.map((exame) => linhaReconhecido(exame, true))}</ul>
                        </section>
                      )}
                    </>
                  )}

                  {leitura.semCorrespondencia.length > 0 && (
                    <section>
                      <h3 className={TITULO_GRUPO}>
                        Não encontrados na tabela ({leitura.semCorrespondencia.length})
                        <span className="ml-1 font-normal text-xs text-gray-500 dark:text-gray-400">· fora da conta</span>
                      </h3>
                      <ul className="divide-y divide-amber-200/70 rounded-xl border border-amber-200 bg-amber-50/60 dark:divide-amber-800/40 dark:border-amber-800/60 dark:bg-amber-900/10">
                        {leitura.semCorrespondencia.map(({ nomeNoPedido }, i) => (
                          <li key={`${nomeNoPedido}-${i}`} className="px-3 py-2.5">
                            <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">“{nomeNoPedido}”</span>
                            <span className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-200">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {FRASE_FORA_DA_TABELA}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {leitura.reconhecidos.length === 0 && leitura.semCorrespondencia.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum exame foi lido no pedido.</p>
                  )}
                </>
              )}
            </>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 rounded-b-2xl flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {!leitura ? (
            <>
              <button type="button" onClick={onFechar} disabled={analisando} className={BOTAO_SECUNDARIO}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={analisar}
                disabled={arquivos.length === 0 || !!problema || analisando}
                className={BOTAO_PRIMARIO}
              >
                {analisando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analisar
                pedido
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setLeitura(null);
                  setArquivos([]);
                }}
                className={BOTAO_SECUNDARIO}
              >
                Ler outro pedido
              </button>
              <button
                type="button"
                onClick={() => {
                  onAdicionar(selecionados);
                  onFechar();
                }}
                disabled={selecionados.length === 0}
                className={BOTAO_PRIMARIO}
              >
                <Plus className="w-4 h-4" /> Adicionar {selecionados.length} ao carrinho
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeituraPedidoMedicoModal;
