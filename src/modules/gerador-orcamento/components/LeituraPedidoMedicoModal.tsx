import React, { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Plus } from 'lucide-react';
import { analisarPedidoMedico } from '../api';
import { chaveExame } from '../domain/carrinho';
import {
  conferirCobertura,
  nomeDaEscolha,
  type EscolhaCobertura,
  type ExameNaoCoberto,
  type ResumoCobertura,
} from '../domain/cobertura';
import SeletorConvenio from './SeletorConvenio';
import { ConveniosPorFonte } from './ListaConvenios';
import SeloCobertura from './SeloCobertura';
import {
  AcoesDoEnvio,
  AreaArquivosDoPedido,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  MolduraLeituraPedido,
  SecaoNaoEncontrados,
} from './PedidoMedicoComum';
import { useArquivosDoPedido } from '../hooks/useArquivosDoPedido';
import { resolverLeituraDoPedido, type LeituraDoPedido } from '../domain/pedidoMedico';
import type { ItemGeradorOrcamento } from '../types';
import { formatCurrency } from '../../../utils/paymentUtils';

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
              Outros convênios ({outrosConvenios.reduce((n, g) => n + g.convenios.length, 0)})
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandido ? 'rotate-180' : ''}`} />
            </span>
          </span>
          <SeloCobertura coberto={false} convenio={convenio} />
        </button>
        {expandido &&
          (outrosConvenios.length > 0 ? (
            <ConveniosPorFonte grupos={outrosConvenios} />
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
  /** fontes para o seletor, já em ordem (fontesDaLista) */
  fontes: readonly string[];
  /** convênios da fonte escolhida, já em ordem (conveniosDaFonte) */
  convenios: readonly string[];
  escolha: EscolhaCobertura | null;
  onEscolher: (escolha: EscolhaCobertura | null) => void;
  onFechar: () => void;
  /** `paciente`: o nome lido no pedido (null se a IA não achou), para o atendente confirmar no carrinho. */
  onAdicionar: (exames: ItemGeradorOrcamento[], paciente: string | null) => void;
}> = ({ exames, fontes, convenios, escolha, onEscolher, onFechar, onAdicionar }) => {
  const [leitura, setLeitura] = useState<LeituraDoPedido | null>(null);
  const [pacienteLido, setPacienteLido] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const envio = useArquivosDoPedido(async (arquivos) => {
    const analise = await analisarPedidoMedico(arquivos, 'particular');
    setPacienteLido(analise.paciente);
    setLeitura(resolverLeituraDoPedido(analise.exames, exames));
  });

  const alternarMarcado = (chave: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const selecionados = useMemo(
    () => (leitura?.reconhecidos ?? []).filter((r) => marcados.has(chaveExame(r.exame))).map((r) => r.exame),
    [leitura, marcados],
  );

  const [aba, setAba] = useState<Aba>('particular');
  const convenio = escolha && nomeDaEscolha(escolha);
  const conferencia = useMemo(
    () => (leitura && escolha ? conferirCobertura(leitura.reconhecidos.map((r) => r.exame), escolha) : null),
    [leitura, escolha],
  );
  const todosOsReconhecidos = () => new Set((leitura?.reconhecidos ?? []).map((r) => chaveExame(r.exame)));
  const soNaoCobertos = (naoCobertos: readonly ExameNaoCoberto[]) =>
    new Set(naoCobertos.map(({ exame }) => chaveExame(exame)));

  // Na aba de cobertura, com a fonte pagadora escolhida, o pedido vem só com os não cobertos
  // marcados (são os que o paciente paga); no orçamento particular, vem tudo marcado. Volta ao
  // padrão a cada leitura, troca de fonte ou troca de aba.
  const conferenciaDaAba = aba === 'cobertura' ? conferencia : null;
  const [conferidoAntes, setConferidoAntes] = useState({ leitura, conferenciaDaAba });
  if (conferidoAntes.leitura !== leitura || conferidoAntes.conferenciaDaAba !== conferenciaDaAba) {
    setConferidoAntes({ leitura, conferenciaDaAba });
    setMarcados(conferenciaDaAba ? soNaoCobertos(conferenciaDaAba.naoCobertos) : todosOsReconhecidos());
  }
  const todosMarcados = (leitura?.reconhecidos ?? []).every((r) => marcados.has(chaveExame(r.exame)));

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
    <MolduraLeituraPedido
      subtitulo="A IA identifica os exames; você revisa antes de ir ao carrinho."
      analisando={envio.analisando}
      onFechar={onFechar}
      // Na aba de cobertura, altura mínima para a lista do seletor de convênio
      // abrir inteira, sem ficar cortada pelo rodapé.
      classeCorpo={leitura && aba === 'cobertura' && leitura.reconhecidos.length > 0 ? 'min-h-[27rem]' : ''}
      rodape={
        !leitura ? (
          <AcoesDoEnvio estado={envio} onFechar={onFechar} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setLeitura(null);
                setPacienteLido(null);
                envio.limpar();
              }}
              className={BOTAO_SECUNDARIO}
            >
              Ler outro pedido
            </button>
            <button
              type="button"
              onClick={() => {
                onAdicionar(selecionados, pacienteLido);
                onFechar();
              }}
              disabled={selecionados.length === 0}
              className={BOTAO_PRIMARIO}
            >
              <Plus className="w-4 h-4" /> Adicionar {selecionados.length} ao carrinho
            </button>
          </>
        )
      }
    >
          {!leitura ? (
            <AreaArquivosDoPedido estado={envio} />
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
              <SecaoNaoEncontrados exames={leitura.semCorrespondencia} />

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
                <SeletorConvenio fontes={fontes} convenios={convenios} escolha={escolha} onEscolher={onEscolher} />
              )}

              {leitura.reconhecidos.length > 0 && !conferencia ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Escolha a fonte pagadora do paciente (e, se quiser, o convênio dela) para conferir quais exames do pedido são cobertos.
                </p>
              ) : (
                <>
                  {conferencia && convenio && conferencia.resumo.total > 0 && (
                    <>
                      <ResumoCoberturaDoPedido resumo={conferencia.resumo} convenio={convenio} />
                      <div className="flex justify-end -mt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setMarcados(todosMarcados ? soNaoCobertos(conferencia.naoCobertos) : todosOsReconhecidos())
                          }
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {todosMarcados ? 'Marcar só os não cobertos' : 'Marcar todos'}
                        </button>
                      </div>
                      {conferencia.naoCobertos.length > 0 && (
                        <section>
                          <h3 className={TITULO_GRUPO}>Não cobertos ({conferencia.naoCobertos.length})</h3>
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
    </MolduraLeituraPedido>
  );
};

export default LeituraPedidoMedicoModal;
