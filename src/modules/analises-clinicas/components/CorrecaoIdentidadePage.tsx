import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert,
  Search,
  Loader2,
  UserCheck,
  Check,
  AlertTriangle,
  CheckCircle2,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { useCorrecaoIdentidade, type CorrecaoIdentidadeResultado } from '../hooks/useCorrecaoIdentidade';
import type { PacienteBuscaItem } from '../hooks/useAgendamentos';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { normalizeCPF, formatCPF, validateCPF } from '../../../utils/cpf';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { hojeISO } from '../domain/datas';

/**
 * Correção de identidade do paciente (CPF / data de nascimento).
 *
 * No LAB-HUB esses dois campos ficam imutáveis assim que a pessoa vincula a
 * conta — foi a trava que fechou o caminho pelo qual um paciente reescrevia o
 * próprio CPF e puxava o laudo de outra pessoa. O que sobrou sem saída foi o
 * erro de digitação percebido depois do cadastro, e esta tela é essa saída.
 *
 * O que a torna legítima não é nada que o sistema saiba: CPF antigo, nascimento,
 * e-mail e telefone são todos coisas que o dono da conta já tem. É a conferência
 * do documento FÍSICO pelo operador — por isso a tela pede qual documento foi
 * conferido e o motivo, e os dois viram trilha permanente no LAB-HUB junto com
 * quem estava logado aqui.
 */

// ─── Estilos compartilhados (mesma linguagem do módulo) ───────────────────────
const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500';

const fieldCls = (erro = false, valid = false) =>
  `w-full px-3 py-2 rounded-lg border ${
    erro
      ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
      : valid
        ? 'border-emerald-500 dark:border-emerald-500 focus:ring-emerald-500'
        : 'border-gray-200 dark:border-gray-600 focus:ring-rose-500'
  } bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Data de nascimento real (não inexistente/futura/anterior a 1900). 'YYYY-MM-DD'.
// Mesma regra do LAB-HUB (nascimentoValido em schemas/recepcao.ts): um valor que
// não passaria no cadastro também não pode entrar por correção.
const nascimentoValido = (s: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(ano, mes - 1, dia);
  if (dt.getFullYear() !== ano || dt.getMonth() !== mes - 1 || dt.getDate() !== dia) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return ano >= 1900 && dt <= hoje;
};

// Data pura (YYYY-MM-DD) → dd/mm/aaaa. Sem new Date() de propósito: data pura não
// tem fuso e new Date('YYYY-MM-DD') recuaria um dia em fusos oeste.
const fmtNasc = (d: string): string => {
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
};

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Documentos que a recepção costuma ter em mãos no balcão. "Outro" abre texto
// livre — o campo é descritivo e vai inteiro para a trilha.
const DOCUMENTOS = ['RG', 'CNH', 'Passaporte', 'CTPS', 'Certidão de nascimento', 'Cartão CPF'];
const DOC_OUTRO = '__outro__';

const CorrecaoIdentidadePage: React.FC = () => {
  const { userProfile, user } = useAuth();
  const { buscarPacientes, corrigir, salvando } = useCorrecaoIdentidade();

  const podeCorrigir = hasPermission(userProfile?.permissions || [], 'canCorrigirIdentidade');
  // Espelha o autorizadoPor que o servidor monta a partir da sessão. Aqui é só
  // para o operador ver, antes de confirmar, o nome que vai ficar na trilha.
  const operador = userProfile?.name || user?.email || 'Operador';

  // Busca
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<PacienteBuscaItem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [paciente, setPaciente] = useState<PacienteBuscaItem | null>(null);

  // Formulário
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [docSel, setDocSel] = useState('');
  const [docOutro, setDocOutro] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<CorrecaoIdentidadeResultado | null>(null);

  // Typeahead com debounce, igual ao do agendamento manual.
  useEffect(() => {
    const q = termo.trim();
    if (paciente || q.length < 2) {
      setResultados([]);
      setBuscou(false);
      setBuscando(false);
      return;
    }
    // `vivo` descarta a resposta que chega depois de o termo já ter mudado —
    // clearTimeout só cobre a busca que ainda não partiu.
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      const achados = await buscarPacientes(q);
      if (!vivo) return;
      setResultados(achados);
      setBuscando(false);
      setBuscou(true);
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [termo, paciente, buscarPacientes]);

  const escolherPaciente = (p: PacienteBuscaItem) => {
    setPaciente(p);
    setResultados([]);
    setErro(null);
    setCpf('');
    // Nascimento já vem preenchido com o atual: o caso comum é corrigir só o CPF,
    // e a API exige os dois campos em toda correção.
    setDataNascimento(p.dataNascimento);
    setDocSel('');
    setDocOutro('');
    setMotivo('');
  };

  const recomecar = () => {
    setResultado(null);
    setPaciente(null);
    setTermo('');
    setResultados([]);
    setBuscou(false);
    setErro(null);
  };

  const documentoConferido = docSel === DOC_OUTRO ? docOutro.trim() : docSel;

  const cpfErro = cpf.length > 0 && !validateCPF(cpf);
  const cpfValido = validateCPF(cpf);
  const nascErro = dataNascimento.length > 0 && !nascimentoValido(dataNascimento);
  const nascValido = nascimentoValido(dataNascimento);

  // O CPF atual chega mascarado (só os 2 verificadores), então não dá para
  // comparar por inteiro daqui — a checagem de "nada a corrigir" é do LAB-HUB.
  // O que dá para saber é se o nascimento mudou.
  const nascimentoMudou = Boolean(paciente) && dataNascimento !== paciente?.dataNascimento;

  const formCompleto = useMemo(
    () =>
      Boolean(paciente) &&
      cpfValido &&
      nascValido &&
      documentoConferido.length > 0 &&
      motivo.trim().length >= 5,
    [paciente, cpfValido, nascValido, documentoConferido, motivo],
  );

  const enviar = async () => {
    setConfirmando(false);
    if (!paciente) return;
    setErro(null);
    const r = await corrigir({
      pacienteId: paciente.id,
      cpf: normalizeCPF(cpf),
      dataNascimento,
      motivo: motivo.trim(),
      documentoConferido,
    });
    if ('erro' in r) {
      setErro(r.erro);
      return;
    }
    setResultado(r.resultado);
  };

  if (!podeCorrigir) {
    return (
      <div className="max-w-3xl mx-auto pt-4 sm:pt-6 pb-10">
        <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center">
          <ShieldAlert className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Você não tem permissão para corrigir a identidade de pacientes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pt-4 sm:pt-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/25">
          <ShieldAlert className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Correção de Identidade
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            CPF e data de nascimento de paciente do Lab Hub
          </p>
        </div>
      </div>

      {resultado ? (
        /* ── Comprovante da correção ───────────────────────────────────────── */
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-emerald-800 dark:text-emerald-200">
                Identidade corrigida
              </h2>
              <p className="text-sm text-emerald-700/90 dark:text-emerald-300/90 mt-0.5">
                {paciente?.nome} · registrado em {fmtDataHora(resultado.corrigidoEm)}
              </p>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-emerald-700/70 dark:text-emerald-300/70 w-40 shrink-0">
                    CPF anterior
                  </dt>
                  <dd className="text-emerald-900 dark:text-emerald-100 tabular-nums">
                    {resultado.cpfAnteriorMascarado}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-emerald-700/70 dark:text-emerald-300/70 w-40 shrink-0">
                    CPF corrigido
                  </dt>
                  <dd className="text-emerald-900 dark:text-emerald-100 tabular-nums">
                    {formatCPF(cpf)}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-emerald-700/70 dark:text-emerald-300/70 w-40 shrink-0">
                    Nascimento
                  </dt>
                  <dd className="text-emerald-900 dark:text-emerald-100 tabular-nums">
                    {fmtNasc(dataNascimento)}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-emerald-700/70 dark:text-emerald-300/70 w-40 shrink-0">
                    Laudos invalidados
                  </dt>
                  <dd className="text-emerald-900 dark:text-emerald-100 tabular-nums">
                    {resultado.laudosInvalidados}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-emerald-700/70 dark:text-emerald-300/70 w-40 shrink-0">
                    Protocolo
                  </dt>
                  <dd className="text-emerald-900 dark:text-emerald-100 font-mono text-xs break-all">
                    {resultado.correcaoId}
                  </dd>
                </div>
              </dl>

              {resultado.laudosInvalidados > 0 && (
                <p className="mt-4 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  Os {resultado.laudosInvalidados} laudo(s) em cache foram descartados: tinham sido
                  buscados nos sistemas do laboratório com o CPF antigo. Eles voltam sozinhos na
                  próxima consulta do paciente no portal.
                </p>
              )}

              <button
                onClick={recomecar}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Corrigir outro paciente
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Aviso: o que essa operação é e o que ela exige */}
          <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1.5">
              <p className="font-semibold">Confira o documento físico antes de corrigir.</p>
              <p className="text-amber-700/90 dark:text-amber-300/90">
                CPF e nascimento ficam travados assim que o paciente cria a conta no portal —
                é o que impede alguém de assumir o histórico clínico de outra pessoa. Nada que o
                sistema guarda prova que o CPF novo é de quem está pedindo; só a conferência
                presencial. A correção fica registrada em nome de{' '}
                <strong className="font-semibold">{operador}</strong>, de forma permanente.
              </p>
            </div>
          </div>

          {/* 1 — Paciente */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
              1. Paciente
            </h2>

            {paciente ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-900/20">
                <div className="w-9 h-9 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {paciente.nome}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300 tabular-nums truncate">
                    Hoje: CPF {paciente.cpfMascarado} · Nasc. {fmtNasc(paciente.dataNascimento)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={recomecar}
                  className="text-xs font-medium text-rose-700 dark:text-rose-300 hover:underline shrink-0"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <div className="relative flex items-center">
                  <Search className="absolute left-3 w-4 h-4 text-gray-400" />
                  <input
                    value={termo}
                    onChange={(e) => setTermo(e.target.value)}
                    placeholder="Buscar paciente pelo nome"
                    autoComplete="off"
                    className={`${inputCls} pl-9 pr-10`}
                  />
                  {buscando && (
                    <Loader2 className="absolute right-3 w-4 h-4 text-gray-400 animate-spin" />
                  )}
                </div>

                {termo.trim().length >= 2 && buscou && (
                  <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
                    {resultados.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                        Nenhum paciente encontrado com esse nome no Lab Hub.
                      </div>
                    ) : (
                      resultados.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => escolherPaciente(p)}
                          className="w-full text-left px-3 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 border-b border-gray-50 dark:border-gray-700/50 last:border-0 transition-colors"
                        >
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                            {p.nome}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                            CPF {p.cpfMascarado} · Nasc. {fmtNasc(p.dataNascimento)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  A busca é por nome e o CPF vem mascarado — confirme a pessoa pelos dois últimos
                  dígitos e pela data de nascimento.
                </p>
              </>
            )}
          </div>

          {/* 2 — Novos dados + autorização */}
          {paciente && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                2. Dados corretos e autorização
              </h2>

              {/* Três campos curtos numa linha só: em duas colunas o documento
                  ficava sozinho, com meia linha vazia ao lado. */}
              <div className="grid sm:grid-cols-3 gap-x-4 gap-y-3 items-start">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CPF correto
                  </label>
                  <div className="relative flex items-center">
                    <input
                      value={cpf}
                      onChange={(e) => setCpf(formatCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      className={`${fieldCls(cpfErro, cpfValido)} tabular-nums pr-9`}
                    />
                    {cpfValido && <Check className="absolute right-3 w-4 h-4 text-emerald-500" />}
                  </div>
                  <p
                    className={`mt-1 text-xs ${cpfErro ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}
                  >
                    {cpfErro ? 'CPF inválido. Confira os números.' : 'Como está no documento.'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data de nascimento
                  </label>
                  <input
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    min="1900-01-01"
                    max={hojeISO()}
                    // Só fica verde depois de mudar: o campo nasce preenchido com o
                    // valor do cadastro, e "válido" ali não é informação nenhuma.
                    className={`${fieldCls(nascErro, nascimentoMudou && nascValido)} [color-scheme:light] dark:[color-scheme:dark]`}
                  />
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {nascimentoMudou
                      ? `Era ${fmtNasc(paciente.dataNascimento)}.`
                      : 'Mantida como no cadastro.'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Documento conferido
                  </label>
                  <select
                    value={docSel}
                    onChange={(e) => setDocSel(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Selecione…</option>
                    {DOCUMENTOS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value={DOC_OUTRO}>Outro…</option>
                  </select>
                  {/* Cresce dentro da própria célula — abrir uma coluna nova só
                      para este caso desalinharia a linha inteira. */}
                  {docSel === DOC_OUTRO && (
                    <input
                      value={docOutro}
                      onChange={(e) => setDocOutro(e.target.value)}
                      maxLength={60}
                      autoFocus
                      placeholder="Qual documento"
                      className={`${inputCls} mt-2`}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Motivo da correção
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Ex.: CPF digitado com um dígito trocado no atendimento de 12/05; conferido no RG apresentado pela paciente."
                  className={`${inputCls} resize-y`}
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Fica na trilha permanente — escreva o que outra pessoa precisaria ler para
                  entender a correção daqui a um ano. Mínimo de 5 caracteres.
                </p>
              </div>

              {erro && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                  {erro}
                </div>
              )}

              {/* Autoria e ação na mesma linha: separadas, a nota ficava solta e o
                  botão flutuando sobre um vão vazio. */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 pt-1">
                  <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Autorizado por <strong className="font-semibold">{operador}</strong> — vem da
                    sua sessão.
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!formCompleto || salvando}
                  onClick={() => setConfirmando(true)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white text-sm font-semibold shadow-lg shadow-rose-500/25 hover:from-rose-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Corrigindo…
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4" />
                      Corrigir identidade
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmando}
        type="danger"
        title="Confirmar correção de identidade"
        confirmText="Sim, corrigir"
        onCancel={() => setConfirmando(false)}
        onConfirm={() => void enviar()}
        // Só elementos inline aqui: o ConfirmDialog renderiza `message` dentro de
        // um <p>, e <div>/<p> aninhados ali quebram a validação de DOM do React.
        message={
          <>
            <span className="block text-left">
              O CPF de <strong>{paciente?.nome}</strong> passa a ser{' '}
              <strong className="tabular-nums">{formatCPF(cpf)}</strong>
              {nascimentoMudou && (
                <>
                  {' '}e o nascimento passa a ser{' '}
                  <strong className="tabular-nums">{fmtNasc(dataNascimento)}</strong>
                </>
              )}
              .
            </span>
            <span className="block text-left mt-2">
              O histórico de laudos em cache do paciente é descartado (foi buscado com o CPF
              antigo) e volta na próxima consulta dele.
            </span>
            <span className="block text-left mt-2 text-xs">
              Registrado em nome de {operador}, com o documento {documentoConferido || '—'}. A
              trilha não pode ser apagada nem editada depois.
            </span>
          </>
        }
      />
    </div>
  );
};

export default CorrecaoIdentidadePage;
