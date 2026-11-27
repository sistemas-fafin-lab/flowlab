// Leitura do pedido médico por IA no modo Tabela Colaborador (.scratch/tabela-colaborador/spec.md
// → "Tela e PDF"). O servidor casa os exames lidos com a lista do modo colaborador (com os
// Exames de uso interno). A janela mostra os não encontrados (como no particular), os
// "consultar a gestão" à parte, com o motivo e sem marcação, e os disponíveis marcados para o
// carrinho. Nada entra no carrinho sem a revisão; fechar descarta arquivos e resultado.

import React, { useState } from 'react';
import { Info, Plus } from 'lucide-react';
import { analisarPedidoMedico } from '../api';
import { chaveExame } from '../domain/carrinho';
import { resolverLeituraColaborador, type LeituraDoPedidoColaborador } from '../domain/pedidoMedicoColaborador';
import {
  AcoesDoEnvio,
  AreaArquivosDoPedido,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  MolduraLeituraPedido,
  SecaoNaoEncontrados,
} from './PedidoMedicoComum';
import { useArquivosDoPedido } from '../hooks/useArquivosDoPedido';
import type { ItemColaboradorDisponivel, ItemTabelaColaborador } from '../types';

const brl = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const LISTA_GRUPO = 'divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700';

const LeituraPedidoColaboradorModal: React.FC<{
  exames: readonly ItemTabelaColaborador[];
  onFechar: () => void;
  /** `paciente`: o nome lido no pedido (null se a IA não achou). */
  onAdicionar: (exames: ItemColaboradorDisponivel[], paciente: string | null) => void;
}> = ({ exames, onFechar, onAdicionar }) => {
  const [leitura, setLeitura] = useState<LeituraDoPedidoColaborador | null>(null);
  const [pacienteLido, setPacienteLido] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const envio = useArquivosDoPedido(async (arquivos) => {
    const analise = await analisarPedidoMedico(arquivos, 'colaborador');
    const nova = resolverLeituraColaborador(analise.exames, exames);
    setPacienteLido(analise.paciente);
    setLeitura(nova);
    setMarcados(new Set(nova.disponiveis.map((d) => chaveExame(d.exame))));
  });

  const alternarMarcado = (chave: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const selecionados = (leitura?.disponiveis ?? []).filter((d) => marcados.has(chaveExame(d.exame))).map((d) => d.exame);
  const nada =
    leitura && leitura.disponiveis.length === 0 && leitura.consultarGestao.length === 0 && leitura.semCorrespondencia.length === 0;

  return (
    <MolduraLeituraPedido
      subtitulo="A IA identifica os exames da Tabela Colaborador; você revisa antes de ir ao carrinho."
      analisando={envio.analisando}
      onFechar={onFechar}
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
          <SecaoNaoEncontrados exames={leitura.semCorrespondencia} />

          {leitura.consultarGestao.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Consultar a gestão ({leitura.consultarGestao.length})
              </h3>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                Estes exames não têm Valor colaborador e não entram no carrinho.
              </p>
              <ul className="divide-y divide-amber-200/70 rounded-xl border border-amber-200 bg-amber-50/60 dark:divide-amber-800/40 dark:border-amber-800/60 dark:bg-amber-900/10">
                {leitura.consultarGestao.map(({ nomeNoPedido, exame, motivo }) => (
                  <li key={chaveExame(exame)} className="flex items-start gap-3 px-3 py-2.5">
                    <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{exame.nome}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        No pedido: “{nomeNoPedido}” · TUSS {exame.tuss || '—'}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-300 text-right max-w-[12rem]">
                      {motivo}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Com Valor colaborador ({leitura.disponiveis.length})
            </h3>
            {leitura.disponiveis.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum exame do pedido tem Valor colaborador.</p>
            ) : (
              <ul className={LISTA_GRUPO}>
                {leitura.disponiveis.map(({ nomeNoPedido, exame }) => {
                  const chave = chaveExame(exame);
                  return (
                    <li key={chave}>
                      <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <input
                          type="checkbox"
                          checked={marcados.has(chave)}
                          onChange={() => alternarMarcado(chave)}
                          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{exame.nome}</span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            No pedido: “{nomeNoPedido}” · TUSS {exame.tuss || '—'}
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
                          {brl(exame.precoColaborador.valor)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {nada && <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum exame foi lido no pedido.</p>}
        </>
      )}
    </MolduraLeituraPedido>
  );
};

export default LeituraPedidoColaboradorModal;
