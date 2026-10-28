import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import Select from '../../../components/Select';
import { salvarRegraEnvio } from '../hooks/useCalendarioEnvios';
import { useConveniosGlosas } from '../hooks/useGlosasRecursos';
import type { JanelaEnvio, RegraEnvio } from '../types';
import { formatDataHora } from '../utils/formato';
import { descreverJanela, TIPOS_JANELA_ENVIO, type TipoJanelaEnvio } from '../utils/janelaEnvio';

// Calendário de envios → "Regras de envio": a lista das Regras de envio com busca e
// a edição de uma regra (janelas, observação, membros, fontes pagadoras do apLIS,
// envios sugeridos no mês e ativo). Só aberto por quem tem canManageCalendarioEnvios;
// a rota valida as janelas e a RLS recusa a escrita de qualquer forma. Desativar
// tira a regra das próximas sugestões e mantém os agendamentos e o histórico.

interface Props {
  regras: RegraEnvio[];
  onFechar: () => void;
  /** Uma regra foi gravada: o calendário relê. */
  onAlterado: () => void;
}

const CAMPO = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white';
const ROTULO = 'block text-xs font-medium text-gray-500 dark:text-gray-400';

const OPCOES_TIPO = TIPOS_JANELA_ENVIO.map((t) => ({ value: t.tipo, label: t.label }));

/** Uma janela como digitada: os números ficam em texto até salvar. */
interface JanelaEmEdicao {
  /** Identifica a linha na lista, que pode perder janelas do meio. */
  chave: number;
  tipo: TipoJanelaEnvio;
  de: string;
  ate: string;
  /** Dias fixos separados por vírgula ou espaço ("3, 16"). */
  dias: string;
}

interface RegraEmEdicao {
  id: string | null;
  convenio: string;
  membros: string;
  fontesPagadoras: number[];
  janelas: JanelaEmEdicao[];
  enviosSugeridosMes: string;
  observacao: string;
  ativo: boolean;
}

let proximaChave = 0;

const janelaNova = (): JanelaEmEdicao => ({ chave: proximaChave++, tipo: 'dias_corridos', de: '1', ate: '15', dias: '' });

function janelaEmEdicao(janela: JanelaEnvio): JanelaEmEdicao {
  const chave = proximaChave++;
  switch (janela.tipo) {
    case 'dias_corridos':
    case 'dias_uteis':
      return { chave, tipo: janela.tipo, de: String(janela.de), ate: String(janela.ate), dias: '' };
    case 'dias_fixos':
      return { chave, tipo: janela.tipo, de: '', ate: '', dias: janela.dias.join(', ') };
    default:
      return { chave, tipo: janela.tipo, de: '', ate: '', dias: '' };
  }
}

function emEdicao(regra: RegraEnvio | null): RegraEmEdicao {
  return {
    id: regra?.id ?? null,
    convenio: regra?.convenio ?? '',
    membros: regra?.membros ?? '',
    fontesPagadoras: regra?.fontesPagadoras ?? [],
    janelas: regra ? regra.janelas.map(janelaEmEdicao) : [janelaNova()],
    enviosSugeridosMes: regra?.enviosSugeridosMes ? String(regra.enviosSugeridosMes) : '',
    observacao: regra?.observacao ?? '',
    ativo: regra?.ativo ?? true,
  };
}

/** A janela a gravar. Os números vão como digitados: a rota diz o que está fora do limite. */
function paraJanela(janela: JanelaEmEdicao): JanelaEnvio {
  switch (janela.tipo) {
    case 'dias_corridos':
    case 'dias_uteis':
      return { tipo: janela.tipo, de: Number(janela.de), ate: Number(janela.ate) };
    case 'dias_fixos':
      return { tipo: janela.tipo, dias: janela.dias.split(/[\s,;]+/).filter(Boolean).map(Number) };
    default:
      return { tipo: janela.tipo };
  }
}

/** A descrição da janela enquanto é digitada, ou null se ainda não forma uma janela. */
function previa(janela: JanelaEmEdicao): string | null {
  const lida = paraJanela(janela);
  const numeros = lida.tipo === 'dias_corridos' || lida.tipo === 'dias_uteis'
    ? [lida.de, lida.ate]
    : lida.tipo === 'dias_fixos' ? lida.dias : [];
  if (lida.tipo === 'dias_fixos' && numeros.length === 0) return null;
  return numeros.every((n) => Number.isInteger(n) && n > 0) ? descreverJanela(lida) : null;
}

const temTodosOsDias = (janelas: { tipo: TipoJanelaEnvio }[]) => janelas.some((j) => j.tipo === 'todos_os_dias');

const EdicaoRegra: React.FC<{
  regra: RegraEnvio | null;
  fontesDoAplis: Map<number, string>;
  onVoltar: () => void;
  onSalvo: () => void;
  onSalvandoChange: (salvando: boolean) => void;
}> = ({ regra, fontesDoAplis, onVoltar, onSalvo, onSalvandoChange }) => {
  const [form, setForm] = useState<RegraEmEdicao>(() => emEdicao(regra));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alterar = (parcial: Partial<RegraEmEdicao>) => setForm((f) => ({ ...f, ...parcial }));
  const alterarJanela = (indice: number, parcial: Partial<JanelaEmEdicao>) =>
    setForm((f) => ({ ...f, janelas: f.janelas.map((j, i) => (i === indice ? { ...j, ...parcial } : j)) }));

  const opcoesFonte = useMemo(() => {
    const ligadas = new Set(form.fontesPagadoras);
    return [...fontesDoAplis]
      .filter(([id]) => !ligadas.has(id))
      .map(([id, nome]) => ({ value: String(id), label: nome, description: `#${id}`, keywords: String(id) }));
  }, [fontesDoAplis, form.fontesPagadoras]);

  const comEnviosSugeridos = temTodosOsDias(form.janelas);

  const salvar = async () => {
    if (!form.convenio.trim()) {
      setErro('Informe o convênio.');
      return;
    }
    const envios = form.enviosSugeridosMes.trim();
    setSalvando(true);
    onSalvandoChange(true);
    setErro(null);
    try {
      await salvarRegraEnvio({
        id: form.id,
        convenio: form.convenio,
        membros: form.membros,
        fontesPagadoras: form.fontesPagadoras,
        janelas: form.janelas.map(paraJanela),
        enviosSugeridosMes: comEnviosSugeridos && envios ? Number(envios) : null,
        observacao: form.observacao,
        ativo: form.ativo,
      });
      onSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gravar a regra de envio.');
    } finally {
      setSalvando(false);
      onSalvandoChange(false);
    }
  };

  return (
    <>
      <div className="px-6 py-4 space-y-5 flex-1 overflow-y-auto">
        {erro && (
          <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <label className={ROTULO}>
            Convênio
            <input type="text" value={form.convenio} onChange={(e) => alterar({ convenio: e.target.value })} className={`mt-1 ${CAMPO}`} />
          </label>
          <label className="inline-flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => alterar({ ativo: e.target.checked })}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Ativa
          </label>
        </div>
        {!form.ativo && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Desativada: sai das próximas sugestões e do agendamento avulso. Os agendamentos e o histórico ficam.
          </p>
        )}

        <section className="space-y-2">
          <h3 className={ROTULO}>Janelas</h3>
          {form.janelas.map((janela, i) => {
            const faixa = janela.tipo === 'dias_corridos' || janela.tipo === 'dias_uteis';
            const descricao = previa(janela);
            return (
              <div key={janela.chave} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Select
                      value={janela.tipo}
                      onChange={(v) => alterarJanela(i, { tipo: v as TipoJanelaEnvio })}
                      options={OPCOES_TIPO}
                      controlClass={CAMPO}
                      ariaLabel={`Tipo da janela ${i + 1}`}
                    />
                    {faixa && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <input
                          type="number"
                          min={1}
                          value={janela.de}
                          onChange={(e) => alterarJanela(i, { de: e.target.value })}
                          aria-label={`Início da janela ${i + 1}`}
                          className={`${CAMPO} w-20`}
                        />
                        a
                        <input
                          type="number"
                          min={1}
                          value={janela.ate}
                          onChange={(e) => alterarJanela(i, { ate: e.target.value })}
                          aria-label={`Fim da janela ${i + 1}`}
                          className={`${CAMPO} w-20`}
                        />
                      </div>
                    )}
                    {janela.tipo === 'dias_fixos' && (
                      <input
                        type="text"
                        value={janela.dias}
                        onChange={(e) => alterarJanela(i, { dias: e.target.value })}
                        placeholder="Ex.: 3, 16"
                        aria-label={`Dias da janela ${i + 1}`}
                        className={`${CAMPO} sm:w-44`}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => alterar({ janelas: form.janelas.filter((_, j) => j !== i) })}
                    disabled={form.janelas.length === 1}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                    aria-label={`Remover janela ${i + 1}`}
                    title={form.janelas.length === 1 ? 'A regra precisa de ao menos uma janela' : 'Remover janela'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {descricao && <p className="text-xs text-gray-500 dark:text-gray-400">{descricao}</p>}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => alterar({ janelas: [...form.janelas, janelaNova()] })}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <Plus className="w-4 h-4" />
            Adicionar janela
          </button>
        </section>

        {comEnviosSugeridos && (
          <label className={ROTULO}>
            Envios sugeridos no mês
            <input
              type="number"
              min={1}
              max={23}
              value={form.enviosSugeridosMes}
              onChange={(e) => alterar({ enviosSugeridosMes: e.target.value })}
              placeholder="Vazio: não entra na sugestão"
              className={`mt-1 ${CAMPO} sm:w-64`}
            />
            <span className="block mt-1 font-normal">A sugestão espalha esses envios pelos dias mais vazios do mês.</span>
          </label>
        )}

        <label className={ROTULO}>
          Observação
          <input
            type="text"
            value={form.observacao}
            onChange={(e) => alterar({ observacao: e.target.value })}
            placeholder='Ex.: "XML junto", "Física e online"'
            className={`mt-1 ${CAMPO}`}
          />
        </label>

        <label className={ROTULO}>
          Convênios membros
          <textarea
            value={form.membros}
            onChange={(e) => alterar({ membros: e.target.value })}
            rows={2}
            placeholder="Só nos agrupadores (AMHPDF): os convênios que vão junto"
            className={`mt-1 ${CAMPO}`}
          />
        </label>

        <section className="space-y-2">
          <h3 className={ROTULO}>Fontes pagadoras do apLIS</h3>
          {form.fontesPagadoras.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nenhuma fonte ligada: os lotes deste convênio não confirmam os envios sozinhos.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {form.fontesPagadoras.map((id) => {
                const nome = fontesDoAplis.get(id) ?? 'Fonte pagadora';
                return (
                  <li
                    key={id}
                    className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-xs text-blue-700 dark:text-blue-300"
                  >
                    {nome}
                    <span className="text-blue-400 tabular-nums">#{id}</span>
                    <button
                      type="button"
                      onClick={() => alterar({ fontesPagadoras: form.fontesPagadoras.filter((f) => f !== id) })}
                      className="p-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800"
                      aria-label={`Desligar ${nome}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Select
            value=""
            onChange={(v) => alterar({ fontesPagadoras: [...form.fontesPagadoras, Number(v)] })}
            options={opcoesFonte}
            placeholder="Ligar fonte pagadora…"
            controlClass={CAMPO}
            searchable
            searchPlaceholder="Buscar pelo nome ou código"
            emptyText="Nenhuma fonte pagadora encontrada"
          />
        </section>

        {regra?.alteradoPorNome && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Alterada por {regra.alteradoPorNome} em {formatDataHora(regra.alteradoEm)}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={onVoltar}
          disabled={salvando}
          className="px-4 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar
        </button>
      </div>
    </>
  );
};

const RegrasEnvioModal: React.FC<Props> = ({ regras, onFechar, onAlterado }) => {
  const operadoras = useConveniosGlosas();
  const [busca, setBusca] = useState('');
  // undefined: a lista; null: regra nova.
  const [editando, setEditando] = useState<RegraEnvio | null | undefined>(undefined);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || salvando) return;
      if (editando === undefined) onFechar();
      else setEditando(undefined);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar, salvando, editando]);

  const fontesDoAplis = useMemo(() => new Map(operadoras.map((o) => [o.id, o.nome])), [operadoras]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return regras;
    return regras.filter((r) =>
      [r.convenio, r.membros, r.observacao].some((texto) => texto?.toLocaleLowerCase('pt-BR').includes(termo)));
  }, [regras, busca]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 min-w-0">
            {editando !== undefined && (
              <button
                type="button"
                onClick={() => setEditando(undefined)}
                disabled={salvando}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Voltar para a lista"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {editando === undefined ? 'Regras de envio' : editando ? `Regra de envio — ${editando.convenio}` : 'Nova regra de envio'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Em que dias cada convênio aceita o envio. Dias úteis contam de segunda a sexta, sem feriados.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {editando !== undefined ? (
          <EdicaoRegra
            key={editando?.id ?? 'nova'}
            regra={editando}
            fontesDoAplis={fontesDoAplis}
            onVoltar={() => setEditando(undefined)}
            onSalvo={() => {
              setEditando(undefined);
              onAlterado();
            }}
            onSalvandoChange={setSalvando}
          />
        ) : (
          <div className="px-6 py-4 space-y-3 flex-1 overflow-y-auto">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar convênio, membro ou observação"
                  aria-label="Buscar regra de envio"
                  className={`${CAMPO} pl-9`}
                />
              </div>
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Nova regra
              </button>
            </div>

            {filtradas.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma regra encontrada.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtradas.map((r) => (
                  <li key={r.id} className={`py-3 flex items-start gap-3 ${r.ativo ? '' : 'opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{r.convenio}</span>
                        {!r.ativo && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[11px] text-gray-500 dark:text-gray-400">
                            Desativada
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {r.janelas.map(descreverJanela).join(' · ')}
                        {r.enviosSugeridosMes && (
                          <span className="text-gray-500 dark:text-gray-400"> · {r.enviosSugeridosMes} envios sugeridos no mês</span>
                        )}
                      </p>
                      {r.observacao && <p className="text-xs text-gray-500 dark:text-gray-400">{r.observacao}</p>}
                      {r.membros && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={r.membros}>Membros: {r.membros}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditando(r)}
                      className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      aria-label={`Editar ${r.convenio}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RegrasEnvioModal;
