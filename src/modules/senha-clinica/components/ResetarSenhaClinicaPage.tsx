import React, { useState } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowLeft, Building2, CalendarDays, Check, CheckCircle2, Copy, Eye, EyeOff, FileText, KeyRound, Loader2,
  Mail, MapPin, Phone, RefreshCw, Search, ShieldAlert, ShieldCheck, Smartphone, User, X,
} from 'lucide-react';
import ConfirmDialog from '../../../components/ConfirmDialog';
import {
  buscarClinicas, buscarUsuarios, resetarSenha, type Clinica, type ContatoClinica, type DetalhesClinica, type ResultadoReset, type UsuarioLaudoWeb,
} from '../api';
import { gerarSenha, mensagemAcesso, validarSenha } from '../domain/senha';

const CARD = 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm';
const INPUT =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/80 text-sm text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40';
const BOTAO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed';
const BOTAO_SEC =
  'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl text-gray-700 border border-gray-200 hover:bg-gray-50 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700';

const Erro: React.FC<{ msg: string }> = ({ msg }) => (
  <p className="flex items-start gap-2 px-3 py-2 text-sm rounded-xl bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/60">
    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {msg}
  </p>
);

const Selo: React.FC<{ cor: 'verde' | 'vermelho' | 'cinza' | 'azul'; children: React.ReactNode }> = ({ cor, children }) => {
  const cores = {
    verde: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    vermelho: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    cinza: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    azul: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${cores[cor]}`}>{children}</span>;
};

const Info: React.FC<{ icone: React.ElementType; rotulo: string; children: React.ReactNode }> = ({ icone: Icone, rotulo, children }) => (
  <div className="flex items-start gap-2 min-w-0">
    <Icone className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{rotulo}</p>
      <p className="text-sm text-gray-800 dark:text-gray-100 break-words">{children}</p>
    </div>
  </div>
);

const temDado = (c: ContatoClinica) => !!(c.nome || c.telefone || c.celular || c.email);

const DetalhesDaClinica: React.FC<{ clinica: DetalhesClinica }> = ({ clinica }) => {
  const contatos = clinica.contatos.filter(temDado);
  return (
    <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {clinica.cnpj && <Info icone={FileText} rotulo="CPF/CNPJ"><span className="tabular-nums">{clinica.cnpj}</span></Info>}
        {clinica.dataInclusao && (
          <Info icone={CalendarDays} rotulo="Cadastrada em">
            {clinica.dataInclusao}
            {clinica.inativa && clinica.dataDesativacao && <> · desativada em {clinica.dataDesativacao}</>}
          </Info>
        )}
        {clinica.endereco && <div className="sm:col-span-2"><Info icone={MapPin} rotulo="Endereço">{clinica.endereco}</Info></div>}
      </div>

      {contatos.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Contatos</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {contatos.map((c, i) => (
              <li key={i} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 text-sm space-y-0.5 min-w-0">
                <p className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100 min-w-0">
                  <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{c.nome || 'Sem nome'}</span>
                  {(c.cargo || c.setor) && <span className="text-xs font-normal text-gray-500 dark:text-gray-400 truncate">· {[c.cargo, c.setor].filter(Boolean).join(' · ')}</span>}
                </p>
                {c.telefone && <p className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300"><Phone className="w-3.5 h-3.5 text-gray-400" /> {c.telefone}</p>}
                {c.celular && <p className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300"><Smartphone className="w-3.5 h-3.5 text-gray-400" /> {c.celular}</p>}
                {c.email && <p className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 min-w-0"><Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" /> <span className="truncate">{c.email}</span></p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

type Reset = ResultadoReset & { senha: string };

/** Resultado do login de teste que o servidor faz com a senha nova. */
const StatusLogin: React.FC<{ login: Reset['login'] }> = ({ login }) => {
  if (login.status === 'ok') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-300">
        <ShieldCheck className="w-4 h-4" /> Login conferido no Laudo Web
      </p>
    );
  }
  const falhou = login.status === 'falhou';
  return (
    <p className={`flex items-start gap-1.5 text-xs font-medium ${falhou ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
      <ShieldAlert className="w-4 h-4 shrink-0" />
      <span>
        {falhou ? 'O login de teste falhou' : 'Login não conferido'}
        {login.motivo && <span className="font-normal">: {login.motivo}</span>}
        {falhou && <span className="font-normal"> Não tente de novo em seguida (recusas seguidas ativam o captcha); avise a TI.</span>}
      </span>
    </p>
  );
};

/** Senha recém-trocada, na linha do usuário: fica visível até sair da clínica. */
const CredencialNova: React.FC<{ reset: Reset }> = ({ reset }) => {
  const [copiado, setCopiado] = useState<'senha' | 'acesso' | null>(null);
  const copiar = async (qual: 'senha' | 'acesso') => {
    const texto = qual === 'senha' ? reset.senha : mensagemAcesso(reset.nomeClinica, reset.usuario, reset.senha);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
    } catch {
      setCopiado(null);
    }
  };
  return (
    <div className="w-full mt-1 p-3 rounded-xl bg-green-50/60 border border-green-200 dark:bg-green-900/10 dark:border-green-800/60 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-300">
          <CheckCircle2 className="w-4 h-4" /> Senha alterada no apLIS
        </p>
        <StatusLogin login={reset.login} />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <dl className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Usuário</dt>
            <dd className="font-mono text-gray-900 dark:text-gray-100 select-all break-all">{reset.usuario}</dd>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Senha</dt>
            <dd className="font-mono tracking-wide text-gray-900 dark:text-gray-100 select-all break-all">{reset.senha}</dd>
            <button type="button" onClick={() => copiar('senha')} title="Copiar só a senha" aria-label="Copiar só a senha" className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white dark:hover:bg-gray-700 dark:hover:text-gray-200">
              {copiado === 'senha' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </dl>
        <button type="button" onClick={() => copiar('acesso')} className={`${BOTAO} shrink-0`}>
          {copiado === 'acesso' ? <><Check className="w-4 h-4" /> Copiado</> : <><Copy className="w-4 h-4" /> Copiar usuário e senha</>}
        </button>
      </div>
      {!reset.cadastroIntacto && (
        <p className="flex items-start gap-2 px-3 py-2 text-xs rounded-xl bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/60">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          O cadastro da clínica no apLIS mudou em outros {reset.diferencas.length} campo(s) além da senha. Avise a TI para conferir.
        </p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">A senha não fica salva no flowlab: some ao sair desta clínica.</p>
    </div>
  );
};

/** Aba Atendimento → Resetar senha clínica: busca a clínica, escolhe o usuário do Laudo Web e grava a senha nova no apLIS. */
const ResetarSenhaClinicaPage: React.FC = () => {
  const [termo, setTermo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [clinicas, setClinicas] = useState<Clinica[] | null>(null);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  const [clinica, setClinica] = useState<Clinica | null>(null);
  const [detalhes, setDetalhes] = useState<DetalhesClinica | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioLaudoWeb[] | null>(null);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [erroUsuarios, setErroUsuarios] = useState<string | null>(null);

  const [alvo, setAlvo] = useState<UsuarioLaudoWeb | null>(null);
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroReset, setErroReset] = useState<string | null>(null);
  /** Resets feitos nesta clínica, por id do usuário web (só na memória da tela). */
  const [resetados, setResetados] = useState<Record<string, Reset>>({});

  const termoValido = termo.trim().length >= 3;
  const erroSenha = senha ? validarSenha(senha) : null;

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!termoValido || buscando) return;
    setBuscando(true);
    setErroBusca(null);
    try {
      setClinicas(await buscarClinicas(termo.trim()));
    } catch (err) {
      setErroBusca((err as Error).message);
      setClinicas(null);
    } finally {
      setBuscando(false);
    }
  };

  const abrirClinica = async (c: Clinica) => {
    setClinica(c);
    setDetalhes(null);
    setUsuarios(null);
    setResetados({});
    setErroUsuarios(null);
    setCarregandoUsuarios(true);
    try {
      const r = await buscarUsuarios(c.id);
      setClinica(r.clinica);
      setDetalhes(r.clinica);
      setUsuarios(r.usuarios);
    } catch (err) {
      setErroUsuarios((err as Error).message);
    } finally {
      setCarregandoUsuarios(false);
    }
  };

  const voltar = () => {
    setClinica(null);
    setDetalhes(null);
    setUsuarios(null);
    setResetados({});
    fecharReset();
  };

  const abrirReset = (u: UsuarioLaudoWeb) => {
    setAlvo(u);
    setSenha(gerarSenha());
    setMostrarSenha(true);
    setErroReset(null);
  };

  function fecharReset() {
    setAlvo(null);
    setSenha('');
    setErroReset(null);
    setConfirmando(false);
  }

  const gravar = async () => {
    if (!clinica || !alvo) return;
    setConfirmando(false);
    setSalvando(true);
    setErroReset(null);
    try {
      const r = await resetarSenha(clinica.id, alvo.id, senha);
      setResetados((atual) => ({ ...atual, [alvo.id]: { ...r, senha } }));
      fecharReset();
    } catch (err) {
      setErroReset((err as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pt-4 sm:pt-6 pb-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <KeyRound className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Resetar senha clínica</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Senha do usuário da clínica no Laudo Web (apLIS)</p>
        </div>
      </div>

      {!clinica ? (
        <section className={`${CARD} p-4 sm:p-6 animate-fade-in`}>
          <form onSubmit={buscar} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Nome da clínica (mín. 3 letras)"
                aria-label="Nome da clínica"
                className={`${INPUT} pl-10`}
              />
            </div>
            <button type="submit" disabled={!termoValido || buscando} className={BOTAO}>
              {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {erroBusca && <Erro msg={erroBusca} />}
            {clinicas && clinicas.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 px-1">Nenhuma clínica encontrada para “{termo.trim()}”.</p>
            )}
            {clinicas && clinicas.length > 0 && (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {clinicas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => abrirClinica(c)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                    >
                      <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{c.nome}</span>
                        {c.razaoSocial && c.razaoSocial !== c.nome && (
                          <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{c.razaoSocial}</span>
                        )}
                      </span>
                      <span className="ml-auto text-xs text-gray-400 tabular-nums">#{c.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : (
        <section className={`${CARD} animate-fade-in`}>
          <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex items-start gap-3">
            <button type="button" onClick={voltar} className={BOTAO_SEC} aria-label="Voltar para a busca">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">{clinica.nome}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {clinica.razaoSocial && clinica.razaoSocial !== clinica.nome ? `${clinica.razaoSocial} · ` : ''}#{clinica.id}
              </p>
              {detalhes && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Selo cor={detalhes.inativa ? 'vermelho' : 'verde'}>{detalhes.inativa ? 'Inativa' : 'Ativa'}</Selo>
                  {detalhes.segmento && <Selo cor="azul">{detalhes.segmento}</Selo>}
                  {detalhes.tipos.map((t) => <Selo key={t} cor="cinza">{t}</Selo>)}
                </div>
              )}
            </div>
          </div>

          {detalhes && <DetalhesDaClinica clinica={detalhes} />}

          <div className="p-4 sm:p-6">
            {usuarios && usuarios.length > 0 && (
              <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Usuários do Laudo Web</p>
            )}
            {carregandoUsuarios && (
              <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Lendo o cadastro da clínica no apLIS…
              </p>
            )}
            {erroUsuarios && <Erro msg={erroUsuarios} />}
            {usuarios && usuarios.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Esta clínica não tem usuários no Laudo Web.</p>
            )}
            {usuarios && usuarios.length > 0 && (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {usuarios.map((u) => (
                  <li key={u.id} className="py-3 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{u.usuario}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3">
                        {u.setor && <span>Setor: {u.setor}</span>}
                        <span>Último login: {u.ultimoLogin || '—'}</span>
                        {!u.liberado && <span className="text-amber-600 dark:text-amber-400">Não liberado</span>}
                      </p>
                    </div>
                    <button type="button" onClick={() => abrirReset(u)} className={BOTAO_SEC}>
                      <KeyRound className="w-4 h-4" /> {resetados[u.id] ? 'Resetar de novo' : 'Resetar senha'}
                    </button>
                    {resetados[u.id] && <CredencialNova reset={resetados[u.id]} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {alvo && clinica && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-40 animate-fade-in">
          <div className={`${CARD} w-full max-w-md p-6`} role="dialog" aria-modal="true" aria-labelledby="titulo-reset">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 id="titulo-reset" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nova senha de {alvo.usuario}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{clinica.nome}</p>
              </div>
              <button type="button" onClick={fecharReset} disabled={salvando} aria-label="Fechar" className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
                <div>
                  <label htmlFor="nova-senha" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Senha nova</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        id="nova-senha"
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        autoComplete="new-password"
                        spellCheck={false}
                        className={`${INPUT} pr-10 font-mono`}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button type="button" onClick={() => setSenha(gerarSenha())} className={BOTAO_SEC} title="Gerar outra senha">
                      <RefreshCw className="w-4 h-4" /> Gerar
                    </button>
                  </div>
                  <p className={`mt-1 text-xs ${erroSenha ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {erroSenha ?? 'Mínimo 8 caracteres, com letra e número.'}
                  </p>
                </div>
                {erroReset && <Erro msg={erroReset} />}
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  disabled={!senha || !!erroSenha || salvando}
                  className={`${BOTAO} w-full`}
                >
                  {salvando ? <><Loader2 className="w-4 h-4 animate-spin" /> Gravando e conferindo o login…</> : <><KeyRound className="w-4 h-4" /> Resetar senha</>}
                </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmando}
        type="warning"
        title="Resetar senha no apLIS?"
        message={
          <>
            A senha de <strong>{alvo?.usuario}</strong> em <strong>{clinica?.nome}</strong> será trocada no Laudo Web. A senha
            atual deixa de funcionar na hora.
          </>
        }
        confirmText="Resetar"
        onConfirm={gravar}
        onCancel={() => setConfirmando(false)}
      />
    </div>
  );
};

export default ResetarSenhaClinicaPage;
