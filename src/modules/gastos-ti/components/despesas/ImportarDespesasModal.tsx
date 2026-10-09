import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { dayKey } from '../../../../utils/datas';
import { DEPARTMENTS } from '../../../../utils/permissions';
import { formatarCompetencia } from '../../domain/competencia';
import { analisarPlanilha, categoriasDesconhecidas, type CampoImportacao, type LinhaImportada } from '../../domain/importacao';
import { NOME_ARQUIVO_MODELO, abaRelatorio } from '../../domain/modeloImportacao';
import type { FornecedorOpcao } from '../../hooks/useFornecedoresTI';
import { lerPlanilhaDespesas, livroModelo } from '../../planilhaImportacao';
import type { CategoriaTI, Despesa, DespesaInput } from '../../types';
import ModalFormulario from '../ui/ModalFormulario';

interface ImportarDespesasModalProps {
  categorias: CategoriaTI[];
  fornecedores: FornecedorOpcao[];
  despesas: Despesa[];
  /** Cria as categorias novas (se houver) e grava as despesas numa inserção só. */
  onImportar: (despesas: DespesaInput[], categoriasNovas: string[]) => Promise<string | null>;
  onFechar: () => void;
}

interface Planilha {
  nomeArquivo: string;
  linhas: Record<string, unknown>[];
  mapa: Map<CampoImportacao, string>;
}

const SETORES = DEPARTMENTS as string[];

/** Importação por Excel com o modelo da §7.1 (RF15). Nada é gravado antes de "Importar". */
const ImportarDespesasModal: React.FC<ImportarDespesasModalProps> = ({ categorias, fornecedores, despesas, onImportar, onFechar }) => {
  const hoje = useMemo(() => dayKey(new Date()), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [planilha, setPlanilha] = useState<Planilha | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [criarCategorias, setCriarCategorias] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  const analisadas: LinhaImportada[] = useMemo(() => {
    if (!planilha) return [];
    return analisarPlanilha(
      planilha.linhas,
      planilha.mapa,
      { hoje, categorias, fornecedores, despesasExistentes: despesas, setores: SETORES },
      { criarCategorias },
    );
  }, [planilha, hoje, categorias, fornecedores, despesas, criarCategorias]);

  const desconhecidas = useMemo(
    () => (planilha ? categoriasDesconhecidas(planilha.linhas, planilha.mapa, categorias) : []),
    [planilha, categorias],
  );

  // Nova análise (arquivo novo ou opção de categorias): marca tudo que pode entrar,
  // menos o que parece já estar cadastrado.
  useEffect(() => {
    setSelecionadas(new Set(analisadas.filter((l) => l.despesa !== null && !l.jaExiste).map((l) => l.numero)));
  }, [analisadas]);

  const contagem = useMemo(
    () => ({
      erro: analisadas.filter((l) => l.despesa === null).length,
      aviso: analisadas.filter((l) => l.despesa !== null && l.avisos.length > 0).length,
      ok: analisadas.filter((l) => l.despesa !== null && l.avisos.length === 0).length,
    }),
    [analisadas],
  );

  const baixarModelo = () => {
    XLSX.writeFile(livroModelo(categorias.filter((c) => c.ativo).map((c) => c.nome)), NOME_ARQUIVO_MODELO);
  };

  const baixarRelatorio = () => {
    const livro = XLSX.utils.book_new();
    const aba = XLSX.utils.aoa_to_sheet(abaRelatorio(analisadas, selecionadas));
    aba['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 26 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(livro, aba, 'Fora da importação');
    XLSX.writeFile(livro, 'relatorio_importacao_gastos_ti.xlsx');
  };

  const lerArquivo = (arquivo: File) => {
    setErroArquivo(null);
    setErroGeral(null);
    setPlanilha(null);
    const leitor = new FileReader();
    leitor.onload = (evento) => {
      const leitura = lerPlanilhaDespesas(evento.target?.result as ArrayBuffer);
      if (leitura.ok === false) setErroArquivo(leitura.erro);
      else setPlanilha({ nomeArquivo: arquivo.name, linhas: leitura.linhas, mapa: leitura.mapa });
    };
    leitor.readAsArrayBuffer(arquivo);
  };

  const alternar = (numero: number) =>
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(numero)) nova.delete(numero);
      else nova.add(numero);
      return nova;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const escolhidas = analisadas.filter((l) => l.despesa !== null && selecionadas.has(l.numero));
    if (escolhidas.length === 0) {
      setErroGeral(planilha ? 'Nenhuma linha selecionada para importar.' : 'Escolha a planilha primeiro.');
      return;
    }
    const categoriasNovas = [...new Set(escolhidas.map((l) => l.categoriaNova).filter((n): n is string => n !== null))];
    setImportando(true);
    setErroGeral(null);
    const erro = await onImportar(
      escolhidas.map((l) => l.despesa as DespesaInput),
      categoriasNovas,
    );
    setImportando(false);
    if (erro) setErroGeral(erro);
    else onFechar();
  };

  const totalSelecionado = selecionadas.size;

  return (
    <ModalFormulario
      titulo="Importar despesas"
      subtitulo="Planilha no modelo do módulo"
      icone={FileSpreadsheet}
      onFechar={onFechar}
      onSubmit={handleSubmit}
      ocupado={importando}
      rotuloSalvar={totalSelecionado > 0 ? `Importar ${totalSelecionado} ${totalSelecionado === 1 ? 'despesa' : 'despesas'}` : 'Importar'}
      erro={erroGeral}
      largura="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={baixarModelo}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Baixar modelo
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) lerArquivo(arquivo);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors"
          >
            <Upload className="w-4 h-4" /> {planilha ? 'Escolher outra planilha' : 'Escolher planilha'}
          </button>
          {planilha && <span className="self-center text-sm text-slate-500 dark:text-slate-400 truncate">{planilha.nomeArquivo}</span>}
        </div>

        {!planilha && !erroArquivo && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Baixe o modelo, preencha a aba <strong>Despesas</strong> (uma linha por despesa; as abas Instruções e Listas
            explicam cada coluna) e escolha o arquivo. Nada é gravado antes de você conferir e confirmar.
          </p>
        )}
        {erroArquivo && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
            {erroArquivo}
          </p>
        )}

        {planilha && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" /> {contagem.ok} ok
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" /> {contagem.aviso} com aviso
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                <AlertCircle className="w-3.5 h-3.5" /> {contagem.erro} com erro
              </span>
              <span className="text-slate-500 dark:text-slate-400">· {totalSelecionado} selecionadas</span>
              {(contagem.erro > 0 || totalSelecionado < analisadas.length) && (
                <button type="button" onClick={baixarRelatorio} className="ml-auto inline-flex items-center gap-1 text-violet-700 dark:text-violet-300 hover:underline">
                  <Download className="w-3.5 h-3.5" /> Baixar relatório das linhas de fora
                </button>
              )}
            </div>

            {desconhecidas.length > 0 && (
              <label className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criarCategorias}
                  onChange={(e) => setCriarCategorias(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-violet-600 focus:ring-violet-500"
                />
                <span>
                  Criar estas categorias: <strong>{desconhecidas.join(', ')}</strong>. Sem marcar, as linhas com essas
                  categorias ficam com erro. Confira a grafia antes: "Saas" e "SaaS" viram a mesma categoria, mas um erro
                  de digitação vira uma categoria nova.
                </span>
              </label>
            )}

            <div className="max-h-[45vh] overflow-auto rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="pl-3 pr-1 py-2 w-8">
                      <span className="sr-only">Importar</span>
                    </th>
                    <th scope="col" className="px-2 py-2 text-left font-semibold">Linha</th>
                    <th scope="col" className="px-2 py-2 text-left font-semibold">Despesa</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Valor</th>
                    <th scope="col" className="px-2 py-2 text-left font-semibold">Início</th>
                    <th scope="col" className="px-2 py-2 text-left font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/50">
                  {analisadas.map((l) => {
                    const temErro = l.despesa === null;
                    return (
                      <tr key={l.numero} className={temErro ? 'bg-red-50/40 dark:bg-red-900/10' : ''}>
                        <td className="pl-3 pr-1 py-2 align-top">
                          <input
                            type="checkbox"
                            aria-label={`Importar linha ${l.numero}`}
                            checked={selecionadas.has(l.numero)}
                            disabled={temErro}
                            onChange={() => alternar(l.numero)}
                            className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-2 py-2 align-top tabular-nums text-slate-500">{l.numero}</td>
                        <td className="px-2 py-2 align-top max-w-[260px]">
                          <span className="block font-medium text-slate-800 dark:text-slate-100 truncate">{l.resumo.descricao || '—'}</span>
                          <span className="block text-xs text-slate-400 truncate">
                            {l.resumo.categoria || 'sem categoria'}
                            {l.categoriaNova && ' (nova)'} · {l.resumo.recorrencia || 'sem recorrência'}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top text-right tabular-nums whitespace-nowrap">
                          {l.resumo.valor !== null ? formatCurrency(l.resumo.valor) : '—'}
                        </td>
                        <td className="px-2 py-2 align-top whitespace-nowrap">{formatarCompetencia(l.resumo.inicio)}</td>
                        <td className="px-2 py-2 align-top text-xs min-w-[220px]">
                          {temErro ? (
                            <ul className="space-y-0.5 text-red-700 dark:text-red-300">
                              {l.erros.map((m) => (
                                <li key={m} className="flex gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> {m}
                                </li>
                              ))}
                            </ul>
                          ) : l.avisos.length > 0 ? (
                            <ul className="space-y-0.5 text-amber-800 dark:text-amber-200">
                              {l.avisos.map((m) => (
                                <li key={m} className="flex gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> {m}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" /> ok
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </ModalFormulario>
  );
};

export default ImportarDespesasModal;
