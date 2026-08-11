import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Filter, Search, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatData } from '../utils/formato';
import { ViewsSalvasMenu } from './ViewsSalvasMenu';
import DatePicker from '../../../components/DatePicker';
import type { DashboardReceberFiltros, OperadoraResumo } from '../../billing/types';

// Filtros do painel de Contas a Receber: uma barra enxuta que abre um modal.
//
// Os três recortes aceitam VÁRIOS valores: dentro de um campo os valores são OR
// e entre campos é AND ("AMIL ou GEAP, e lote 6423 ou 6424") — a mesma semântica
// que fat_dashboard_receber aplica no banco.
//
// O modal edita uma CÓPIA dos filtros e só devolve tudo no "Aplicar". Filtrar a
// cada tecla dispararia uma agregação inteira no banco por caractere digitado, e
// no meio de montar um recorte de cinco campos os números da tela seriam
// intermediários que ninguém pediu para ver.

/** Painel de vidro, o mesmo molde dos widgets do Dashboard principal. */
const VIDRO =
  'bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 shadow-sm';

const CAMPO =
  'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70 text-sm text-gray-900 dark:text-gray-100';

// `%` e `_` do que o operador digitou viram curinga do LIKE; escapa antes de compor.
const paraIlike = (termo: string): string => `%${termo.replace(/[%_]/g, '\\$&')}%`;

/** Códigos de lote já cadastrados que combinam com o que foi digitado, para sugerir no campo. */
async function buscarLotesSugeridos(termo: string): Promise<string[]> {
  const { data } = await supabase
    .from('lotes')
    .select('codigo_lote')
    .ilike('codigo_lote', paraIlike(termo))
    .order('codigo_lote')
    .limit(8);
  return Array.from(
    new Set((data ?? []).map((l) => l.codigo_lote as string | null).filter((c): c is string => Boolean(c))),
  );
}

/** Números de nota fiscal já cadastrados que combinam com o que foi digitado. */
async function buscarNotasSugeridas(termo: string): Promise<string[]> {
  const { data } = await supabase
    .from('notas')
    .select('numero_nota')
    .ilike('numero_nota', paraIlike(termo))
    .order('numero_nota')
    .limit(8);
  return Array.from(
    new Set((data ?? []).map((n) => n.numero_nota as string | null).filter((c): c is string => Boolean(c))),
  );
}

/** Pílula de valor escolhido, dentro do campo ou no resumo da barra. */
const Pilula: React.FC<{ texto: string; onRemover?: () => void }> = ({ texto, onRemover }) => (
  <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg bg-blue-500/10 dark:bg-blue-400/15 text-blue-700 dark:text-blue-300 text-xs max-w-[200px]">
    <span className="truncate">{texto}</span>
    {onRemover && (
      <button
        type="button"
        onClick={onRemover}
        className="p-0.5 rounded hover:bg-blue-500/20 transition-colors"
        aria-label={`Remover ${texto}`}
      >
        <X className="w-3 h-3" />
      </button>
    )}
  </span>
);

// ─── Seleção múltipla (operadoras) ────────────────────────────────────────────
// Um <select multiple> nativo é desenhado pelo sistema operacional: não segue o
// tema escuro e exige Ctrl+clique, que ninguém descobre. Este painel é o mesmo
// molde do Select do design system, com caixas de seleção no lugar do rádio.

interface SelecaoMultiplaProps {
  valores: string[];
  opcoes: OperadoraResumo[];
  onChange: (valores: string[]) => void;
  placeholder: string;
  rotuloPlural: string;
}

const SelecaoMultipla: React.FC<SelecaoMultiplaProps> = ({
  valores,
  opcoes,
  onChange,
  placeholder,
  rotuloPlural,
}) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [posicao, setPosicao] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      // A lista mora num portal fora do wrapper (ver comentário abaixo), então
      // clicar nela também conta como "dentro".
      if (wrapperRef.current?.contains(alvo) || listaRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  // O modal rola o formulário inteiro (overflow-y-auto) para caber num viewport
  // pequeno; um menu position:absolute dentro dele fica cortado assim que passa
  // da borda visível do formulário, mesmo com z-index alto. Um portal para
  // document.body com position:fixed escapa desse recorte. Como fixed não
  // acompanha o scroll do formulário sozinho, fechamos o menu se esse ancestral
  // rolar, em vez de tentar recalcular a posição a cada evento de scroll.
  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return;
    const atualizarPosicao = () => {
      const rect = botaoRef.current!.getBoundingClientRect();
      setPosicao({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    atualizarPosicao();

    const scrollAncestor = wrapperRef.current?.closest('.overflow-y-auto');
    const fechar = () => setAberto(false);
    scrollAncestor?.addEventListener('scroll', fechar);
    window.addEventListener('resize', atualizarPosicao);
    return () => {
      scrollAncestor?.removeEventListener('scroll', fechar);
      window.removeEventListener('resize', atualizarPosicao);
    };
  }, [aberto]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return opcoes;
    return opcoes.filter((o) => o.nome.toLowerCase().includes(termo));
  }, [opcoes, busca]);

  const alternar = (id: string) => {
    onChange(valores.includes(id) ? valores.filter((v) => v !== id) : [...valores, id]);
  };

  // Um nome só cabe no botão; a partir de dois vira contagem, senão o controle
  // cresce e empurra o resto do formulário.
  const resumo =
    valores.length === 0
      ? placeholder
      : valores.length === 1
        ? opcoes.find((o) => o.id === valores[0])?.nome ?? '1 selecionada'
        : `${valores.length} ${rotuloPlural}`;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className={`${CAMPO} flex items-center justify-between gap-2 text-left transition-colors ${
          valores.length > 0 ? 'border-blue-300 dark:border-blue-700 bg-blue-500/5 text-blue-700 dark:text-blue-300' : ''
        }`}
      >
        <span className="truncate">{resumo}</span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-150 ${aberto ? 'rotate-180' : ''}`}
        />
      </button>

      {aberto && posicao &&
        createPortal(
          <div
            ref={listaRef}
            role="listbox"
            aria-multiselectable
            style={{ position: 'fixed', top: posicao.top, left: posicao.left, width: posicao.width }}
            className="z-[60] rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden"
          >
            <div className="p-2 border-b border-gray-100 dark:border-slate-700">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar…"
                  autoFocus
                  className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="max-h-[200px] overflow-y-auto py-1">
              {filtradas.length === 0 ? (
                <p className="px-3 py-3 text-sm text-gray-400 text-center">Nenhuma encontrada.</p>
              ) : (
                filtradas.map((opcao) => {
                  const escolhida = valores.includes(opcao.id);
                  return (
                    <button
                      key={opcao.id}
                      type="button"
                      role="option"
                      aria-selected={escolhida}
                      onClick={() => alternar(opcao.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/30 ${
                        escolhida ? 'text-blue-600 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                          escolhida
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 dark:border-slate-500'
                        }`}
                      >
                        {escolhida && <Check className="w-3 h-3" />}
                      </span>
                      <span className="truncate">{opcao.nome}</span>
                    </button>
                  );
                })
              )}
            </div>

            {valores.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full px-3 py-2 text-xs text-gray-500 hover:text-red-500 border-t border-gray-100 dark:border-slate-700 transition-colors"
              >
                Limpar seleção
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

// ─── Campo de termos (lote, nota fiscal) ──────────────────────────────────────
// Não é um select: o operador digita o que tem na mão (um código de lote, um
// número de nota), e cada termo vira uma pílula. Cada termo continua sendo busca
// PARCIAL no banco — "642" acha 6423 e 6424.

interface CampoTermosProps {
  termos: string[];
  onChange: (termos: string[]) => void;
  placeholder: string;
  ariaLabel: string;
  /** Busca incremental os códigos já cadastrados que combinam com o que foi digitado. */
  buscarSugestoes?: (termo: string) => Promise<string[]>;
}

const CampoTermos: React.FC<CampoTermosProps> = ({
  termos,
  onChange,
  placeholder,
  ariaLabel,
  buscarSugestoes,
}) => {
  const [rascunho, setRascunho] = useState('');
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // Vírgula e ponto-e-vírgula junto do Enter: colar "6423, 6424" de uma planilha
  // é o caminho mais provável de chegar aqui com vários códigos.
  const confirmar = (bruto: string) => {
    const novos = bruto
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter((t) => t !== '' && !termos.includes(t));
    if (novos.length > 0) onChange([...termos, ...novos]);
    setRascunho('');
    setSugestoesAbertas(false);
  };

  const escolherSugestao = (valor: string) => {
    if (!termos.includes(valor)) onChange([...termos, valor]);
    setRascunho('');
    setSugestoesAbertas(false);
  };

  // Debounce: cada tecla não pode virar uma consulta ao banco, senão "6423"
  // dispara cinco buscas antes do operador terminar de digitar.
  useEffect(() => {
    if (!buscarSugestoes || rascunho.trim() === '') {
      setSugestoes([]);
      setSugestoesAbertas(false);
      return;
    }
    let vivo = true;
    const temporizador = setTimeout(() => {
      void buscarSugestoes(rascunho.trim()).then((resultado) => {
        if (!vivo) return;
        setSugestoes(resultado.filter((r) => !termos.includes(r)));
        setSugestoesAbertas(true);
      });
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(temporizador);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunho, buscarSugestoes]);

  // Mesmo problema do seletor de operadoras: um menu preso ao formulário rolável
  // do modal é cortado na borda. Portal para document.body com position:fixed
  // escapa do recorte; fecha se esse ancestral rolar.
  useLayoutEffect(() => {
    if (!sugestoesAbertas || !wrapperRef.current) return;
    const atualizarPosicao = () => {
      const rect = wrapperRef.current!.getBoundingClientRect();
      setPosicao({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    atualizarPosicao();

    const scrollAncestor = wrapperRef.current.closest('.overflow-y-auto');
    const fechar = () => setSugestoesAbertas(false);
    scrollAncestor?.addEventListener('scroll', fechar);
    window.addEventListener('resize', atualizarPosicao);
    return () => {
      scrollAncestor?.removeEventListener('scroll', fechar);
      window.removeEventListener('resize', atualizarPosicao);
    };
  }, [sugestoesAbertas]);

  useEffect(() => {
    if (!sugestoesAbertas) return;
    const aoClicarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (wrapperRef.current?.contains(alvo) || listaRef.current?.contains(alvo)) return;
      setSugestoesAbertas(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [sugestoesAbertas]);

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      // Impede que o Enter do campo submeta o formulário do modal antes de o
      // termo virar pílula — o recorte que o operador acabou de digitar sumiria.
      e.preventDefault();
      e.stopPropagation();
      confirmar(rascunho);
      return;
    }
    if (e.key === 'Escape' && sugestoesAbertas) {
      // Fecha só a lista de sugestões; o Escape do modal inteiro continua
      // disponível numa segunda tecla.
      e.stopPropagation();
      setSugestoesAbertas(false);
      return;
    }
    // Apagar de trás para frente também remove a última pílula, como em qualquer
    // campo de destinatários.
    if (e.key === 'Backspace' && rascunho === '' && termos.length > 0) {
      onChange(termos.slice(0, -1));
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-xl border min-h-[42px] ${
          termos.length > 0
            ? 'border-blue-300 dark:border-blue-700 bg-blue-500/5'
            : 'border-gray-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70'
        }`}
      >
        {termos.map((termo) => (
          <Pilula
            key={termo}
            texto={termo}
            onRemover={() => onChange(termos.filter((t) => t !== termo))}
          />
        ))}
        <input
          type="text"
          value={rascunho}
          aria-label={ariaLabel}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={aoTeclar}
          // Sair do campo confirma o que estava digitado: perder o termo por não
          // ter apertado Enter seria a falha mais provável deste controle.
          onBlur={() => confirmar(rascunho)}
          placeholder={termos.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[90px] bg-transparent px-1 py-0.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
        />
      </div>

      {sugestoesAbertas &&
        posicao &&
        sugestoes.length > 0 &&
        createPortal(
          <div
            ref={listaRef}
            role="listbox"
            style={{ position: 'fixed', top: posicao.top, left: posicao.left, width: posicao.width }}
            className="z-[60] rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden max-h-[200px] overflow-y-auto py-1"
          >
            {sugestoes.map((sugestao) => (
              <button
                key={sugestao}
                type="button"
                role="option"
                aria-selected={false}
                // preventDefault no mousedown mantém o foco no input, senão o
                // blur dispara antes do clique e `confirmar` já teria transformado
                // o rascunho numa pílula duplicada.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolherSugestao(sugestao)}
                className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                {sugestao}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  filtros: DashboardReceberFiltros;
  padrao: DashboardReceberFiltros;
  operadoras: OperadoraResumo[];
  onAplicar: (filtros: DashboardReceberFiltros) => void;
  onFechar: () => void;
}

const ModalFiltros: React.FC<ModalProps> = ({
  filtros,
  padrao,
  operadoras,
  onAplicar,
  onFechar,
}) => {
  const [rascunho, setRascunho] = useState<DashboardReceberFiltros>(filtros);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const alterar = (patch: Partial<DashboardReceberFiltros>) =>
    setRascunho((atual) => ({ ...atual, ...patch }));

  const recortes =
    rascunho.operadoraIds.length + rascunho.lotes.length + rascunho.notas.length;

  // Período invertido não devolve nada e não tem como o operador perceber pelos
  // números — o aviso é mais útil aqui do que uma tela vazia.
  const periodoInvertido = rascunho.desde > rascunho.ate;

  const submeter = (e: React.FormEvent) => {
    e.preventDefault();
    if (periodoInvertido) return;
    onAplicar(rascunho);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        // Só o clique no fundo fecha: um arraste que começa dentro do painel e
        // termina fora não pode descartar o que foi montado.
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtros do painel"
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Filtros</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Vários valores por campo; dentro do campo valem como “ou”, entre campos como “e”
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-700/70"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submeter} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Emissão do título
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-500 dark:text-slate-400">
                De
                <DatePicker
                  value={rascunho.desde}
                  onChange={(v) => alterar({ desde: v })}
                  controlClass={`mt-1 ${CAMPO}`}
                />
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Até
                <DatePicker
                  value={rascunho.ate}
                  onChange={(v) => alterar({ ate: v })}
                  controlClass={`mt-1 ${CAMPO}`}
                />
              </label>
            </div>
            {periodoInvertido && (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                A data inicial está depois da final.
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Operadoras
            </p>
            <SelecaoMultipla
              valores={rascunho.operadoraIds}
              opcoes={operadoras}
              onChange={(operadoraIds) => alterar({ operadoraIds })}
              placeholder="Todas"
              rotuloPlural="operadoras"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Lotes
            </p>
            <CampoTermos
              termos={rascunho.lotes}
              onChange={(lotes) => alterar({ lotes })}
              placeholder="Digite o código e tecle Enter…"
              ariaLabel="Adicionar código de lote"
              buscarSugestoes={buscarLotesSugeridos}
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              Busca parcial: “642” encontra 6423 e 6424. Colar “6423, 6424” separa sozinho.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Notas fiscais
            </p>
            <CampoTermos
              termos={rascunho.notas}
              onChange={(notas) => alterar({ notas })}
              placeholder="Digite o número e tecle Enter…"
              ariaLabel="Adicionar número de nota fiscal"
              buscarSugestoes={buscarNotasSugeridas}
            />
          </div>
        </form>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 dark:border-slate-700/50">
          <button
            type="button"
            onClick={() => setRascunho(padrao)}
            className="px-3 py-2 text-sm text-slate-500 hover:text-red-500 transition-colors"
          >
            Limpar tudo
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-700/70 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => !periodoInvertido && onAplicar(rascunho)}
              disabled={periodoInvertido}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-500 text-white shadow-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Aplicar{recortes > 0 ? ` (${recortes})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Barra ────────────────────────────────────────────────────────────────────

interface Props {
  filtros: DashboardReceberFiltros;
  /** Aplica o recorte inteiro de uma vez, no "Aplicar" do modal. */
  onFiltrar: (filtros: DashboardReceberFiltros) => void;
  /** Volta todos os campos ao padrão (últimos 3 meses, sem recorte). */
  onLimpar: () => void;
  /** O mesmo padrão do "Limpar", para o modal poder zerar sem fechar. */
  padrao: DashboardReceberFiltros;
  operadoras: OperadoraResumo[];
}

const FiltrosReceber: React.FC<Props> = ({ filtros, onFiltrar, onLimpar, padrao, operadoras }) => {
  const [modalAberto, setModalAberto] = useState(false);

  // O período fica fora da contagem porque sempre tem valor (nasce nos últimos
  // 3 meses) e apareceria como "1 filtro" na tela recém-aberta, sem ninguém ter
  // filtrado nada.
  const recortes = filtros.operadoraIds.length + filtros.lotes.length + filtros.notas.length;

  const nomesOperadoras = filtros.operadoraIds
    .map((id) => operadoras.find((o) => o.id === id)?.nome)
    .filter((nome): nome is string => Boolean(nome));

  return (
    <>
      <div className={`${VIDRO} rounded-3xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2`}>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
            recortes > 0
              ? 'bg-blue-500 border-blue-500 text-white shadow-md hover:bg-blue-600'
              : 'bg-white/70 dark:bg-slate-800/70 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {recortes > 0 && (
            <span className="px-1.5 rounded-md bg-white/25 text-xs tabular-nums">{recortes}</span>
          )}
        </button>

        {/* Mescla com `padrao` antes de aplicar: uma view salva num formato mais
            antigo (sem `lotes`/`notas`, por exemplo) não pode chegar com campo
            faltando em quem lê `filtros.operadoraIds.length` sem checar. */}
        <ViewsSalvasMenu
          tela="dashboard"
          filtros={filtros}
          onAplicar={(view) => onFiltrar({ ...padrao, ...view })}
        />

        {/* Com o modal fechado a barra ainda diz sobre o que os números falam. */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 min-w-0">
          <span>
            Emissão {formatData(filtros.desde)} a {formatData(filtros.ate)}
          </span>
          {nomesOperadoras.map((nome) => (
            <Pilula key={nome} texto={nome} />
          ))}
          {filtros.lotes.map((lote) => (
            <Pilula key={`lote-${lote}`} texto={`Lote ${lote}`} />
          ))}
          {filtros.notas.map((nota) => (
            <Pilula key={`nf-${nota}`} texto={`NF ${nota}`} />
          ))}
        </div>

        {recortes > 0 && (
          <button
            type="button"
            onClick={onLimpar}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
      </div>

      {modalAberto && (
        <ModalFiltros
          filtros={filtros}
          padrao={padrao}
          operadoras={operadoras}
          onAplicar={(novos) => {
            onFiltrar(novos);
            setModalAberto(false);
          }}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </>
  );
};

export default FiltrosReceber;
