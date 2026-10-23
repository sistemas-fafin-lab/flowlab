import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import Select from '../../../components/Select';
import type { DadosRegrasPrazo } from '../hooks/useRegrasPrazo';
import type {
  ChaveRegraPrazo,
  FontePagadoraRegra,
  RegraPrazoCadastro,
  RegrasPrazoConvenio,
  TipoRegraPrazo,
} from '../utils/regraPrazo';
import { lerRegraPrazo, REGRAS_PRAZO, TIPOS_COM_N, TIPOS_REGRA_PRAZO } from '../utils/regraPrazo';

// Edição das regras de prazo de um convênio (ou criação de um novo): as quatro
// regras e as fontes pagadoras do apLIS ligadas a ele. Só aberto por quem tem
// canManageBilling; a RLS recusa a escrita de qualquer forma.

interface RegraEmEdicao {
  tipo: TipoRegraPrazo;
  n: string;
  texto: string;
}

interface Props {
  /** null: convênio novo. */
  convenio: RegrasPrazoConvenio | null;
  /** Fontes pagadoras que podem ser ligadas: as do apLIS e as da foto. */
  fontesDisponiveis: FontePagadoraRegra[];
  /** Convênio a que cada fonte já está ligada, para avisar que ela muda de regra. */
  convenioDaFonte: Map<number, string>;
  onSalvar: (dados: DadosRegrasPrazo) => Promise<string | null>;
  onFechar: () => void;
}

const CAMPO = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white';

const OPCOES_TIPO = TIPOS_REGRA_PRAZO.map((t) => ({ value: t.tipo, label: t.label }));

function emEdicao(regra: RegraPrazoCadastro | undefined): RegraEmEdicao {
  return {
    tipo: regra?.tipo ?? 'sem_prazo',
    n: regra?.n === null || regra?.n === undefined ? '' : String(regra.n),
    texto: regra?.texto ?? '',
  };
}

const RegraPrazoModal: React.FC<Props> = ({ convenio, fontesDisponiveis, convenioDaFonte, onSalvar, onFechar }) => {
  const [nome, setNome] = useState(convenio?.convenio ?? '');
  const [regras, setRegras] = useState<Record<ChaveRegraPrazo, RegraEmEdicao>>(() => {
    const inicial = {} as Record<ChaveRegraPrazo, RegraEmEdicao>;
    for (const { chave } of REGRAS_PRAZO) inicial[chave] = emEdicao(convenio?.regras[chave]);
    return inicial;
  });
  const [fontes, setFontes] = useState<FontePagadoraRegra[]>(convenio?.fontes ?? []);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !salvando) onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar, salvando]);

  const leituras = useMemo(() => {
    const saida = {} as Record<ChaveRegraPrazo, ReturnType<typeof lerRegraPrazo>>;
    for (const { chave } of REGRAS_PRAZO) saida[chave] = lerRegraPrazo(regras[chave].tipo, regras[chave].n);
    return saida;
  }, [regras]);

  const ligadas = useMemo(() => new Set(fontes.map((f) => f.id)), [fontes]);
  const opcoesFonte = useMemo(
    () => fontesDisponiveis
      .filter((f) => !ligadas.has(f.id))
      .map((f) => {
        const dono = convenioDaFonte.get(f.id);
        return {
          value: String(f.id),
          label: f.nome,
          description: dono && dono !== convenio?.convenio ? `Ligada a ${dono}: passa para este convênio` : `#${f.id}`,
          keywords: String(f.id),
        };
      }),
    [fontesDisponiveis, ligadas, convenioDaFonte, convenio],
  );

  const alterarRegra = (chave: ChaveRegraPrazo, parcial: Partial<RegraEmEdicao>) => {
    setRegras((r) => ({ ...r, [chave]: { ...r[chave], ...parcial } }));
  };

  const salvar = async () => {
    if (!nome.trim()) {
      setErro('Informe o nome do convênio.');
      return;
    }
    const dados: DadosRegrasPrazo = { id: convenio?.id ?? null, convenio: nome, regras: {} as DadosRegrasPrazo['regras'], fontes };
    for (const { chave, label } of REGRAS_PRAZO) {
      const leitura = leituras[chave];
      if ('erro' in leitura) {
        setErro(`${label}: ${leitura.erro}`);
        return;
      }
      dados.regras[chave] = { ...leitura.regra, texto: regras[chave].texto };
    }
    setSalvando(true);
    setErro(null);
    try {
      const falha = await onSalvar(dados);
      if (falha) setErro(falha);
      else onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gravar as regras.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {convenio ? `Regras de prazo — ${convenio.convenio}` : 'Novo convênio'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Dias úteis contam de segunda a sexta, sem feriados
            </p>
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

        <div className="px-6 py-4 space-y-5 flex-1 overflow-y-auto">
          {erro && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
            Convênio
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={`mt-1 ${CAMPO}`} />
          </label>

          <section className="space-y-3">
            {REGRAS_PRAZO.map(({ chave, label, usoNaTela }) => {
              const regra = regras[chave];
              const leitura = leituras[chave];
              const comN = TIPOS_COM_N.includes(regra.tipo);
              return (
                <div key={chave} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{usoNaTela}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_6rem] gap-2">
                    <Select
                      value={regra.tipo}
                      onChange={(v) => alterarRegra(chave, { tipo: v as TipoRegraPrazo })}
                      options={OPCOES_TIPO}
                      controlClass={CAMPO}
                      ariaLabel={`Tipo da regra ${label}`}
                    />
                    <input
                      type="number"
                      min={1}
                      value={comN ? regra.n : ''}
                      onChange={(e) => alterarRegra(chave, { n: e.target.value })}
                      disabled={!comN}
                      placeholder="N"
                      aria-label={`N da regra ${label}`}
                      className={`${CAMPO} disabled:opacity-40 ${comN && 'erro' in leitura ? 'border-red-400 dark:border-red-500' : ''}`}
                    />
                  </div>
                  <input
                    type="text"
                    value={regra.texto}
                    onChange={(e) => alterarRegra(chave, { texto: e.target.value })}
                    placeholder="Observação (o que o contrato diz)"
                    aria-label={`Observação da regra ${label}`}
                    className={CAMPO}
                  />
                </div>
              );
            })}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Fontes pagadoras do apLIS</h3>
            {fontes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma fonte ligada: os prazos deste convênio não valem para nenhum lote.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {fontes.map((f) => (
                  <li
                    key={f.id}
                    className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-xs text-blue-700 dark:text-blue-300"
                  >
                    {f.nome}
                    <span className="text-blue-400 tabular-nums">#{f.id}</span>
                    <button
                      type="button"
                      onClick={() => setFontes((atual) => atual.filter((x) => x.id !== f.id))}
                      className="p-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800"
                      aria-label={`Desligar ${f.nome}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Select
              value=""
              onChange={(v) => {
                const fonte = fontesDisponiveis.find((f) => String(f.id) === v);
                if (fonte) setFontes((atual) => [...atual, fonte]);
              }}
              options={opcoesFonte}
              placeholder="Ligar fonte pagadora…"
              controlClass={CAMPO}
              searchable
              searchPlaceholder="Buscar pelo nome ou código"
              emptyText="Nenhuma fonte pagadora encontrada"
            />
          </section>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={onFechar}
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
      </div>
    </div>
  );
};

export default RegraPrazoModal;
