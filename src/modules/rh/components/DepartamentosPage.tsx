import React, { useMemo, useState } from 'react';
import { AlertTriangle, Building2, DollarSign, Loader2, Plus, Users } from 'lucide-react';
import Select, { type SelectOption } from '../../../components/Select';
import { SkeletonTableRow } from '../../../components/PageLoadingSkeleton';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { useColaboradores } from '../hooks/useColaboradores';
import { useDepartamentos } from '../hooks/useDepartamentos';
import {
  autorizadoresAptos,
  chaveGestor,
  colaboradoresSemDepartamento,
  departamentosSemAutorizador,
  gestoresComDepartamentos,
  ROTULO_SITUACAO_GESTOR,
  validarNomeDepartamento,
} from '../utils/departamentos';
import DepartamentoDetalheModal from './DepartamentoDetalheModal';

const inputClassName =
  'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

type Visao = 'departamentos' | 'gestores';

interface Props {
  /** Dentro da aba Departamentos de Usuários: sem o título da página (a aba já diz). */
  embutido?: boolean;
}

// Departamentos do RH: quem está em cada um, os gestores (que respondem por ele e, marcados,
// autorizam os pagamentos de quem está nele) e o aprovador de SC. A mesma tela abre em
// RH › Departamentos e na aba Departamentos de Usuários.
const DepartamentosPage: React.FC<Props> = ({ embutido = false }) => {
  const {
    colaboradores,
    loading: carregandoColaboradores,
    error: erroColaboradores,
    definirDepartamento,
  } = useColaboradores();
  const {
    departamentos,
    painel,
    loading: carregandoDepartamentos,
    error: erroDepartamentos,
    criar,
    renomear,
    definirAtivo,
    definirAprovador,
    adicionarResponsavel,
    removerResponsavel,
    definirAutorizaPagamentos,
    transferirAutorizacoes,
  } = useDepartamentos();
  const { userProfile } = useAuth();
  // Membros, pendência e aprovador vêm de colaboradores, cujo RLS pede canViewColaboradores.
  const semVerColaboradores = !hasPermission(userProfile?.permissions || [], 'canViewColaboradores');
  const [visao, setVisao] = useState<Visao>('departamentos');
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const selecionado = selecionadoId ? departamentos.find((d) => d.id === selecionadoId) ?? null : null;
  const loading = carregandoColaboradores || carregandoDepartamentos;
  const erroCarga = erroColaboradores || erroDepartamentos;

  const nomeDoColaborador = useMemo(() => new Map(colaboradores.map((c) => [c.id, c.nome])), [colaboradores]);
  const membrosAtivos = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const c of colaboradores) {
      if (c.status === 'ativo' && c.departamentoId) contagem.set(c.departamentoId, (contagem.get(c.departamentoId) ?? 0) + 1);
    }
    return contagem;
  }, [colaboradores]);
  const semDepartamento = useMemo(() => colaboradoresSemDepartamento(colaboradores), [colaboradores]);
  // Sem o painel (carregando ou sem permissão) não dá para saber quem é apto: nada de alarme.
  const semAutorizador = useMemo(
    () => (painel ? departamentosSemAutorizador(departamentos, painel.situacoes) : []),
    [departamentos, painel],
  );
  const gestores = useMemo(() => gestoresComDepartamentos(departamentos, colaboradores), [departamentos, colaboradores]);
  const opcoesDepartamento: SelectOption[] = departamentos.filter((d) => d.ativo).map((d) => ({ value: d.id, label: d.nome }));

  const handleCriar = async () => {
    const erroNome = validarNomeDepartamento(novoNome, departamentos);
    if (erroNome) {
      setErro(erroNome);
      return;
    }
    setCriando(true);
    setErro(null);
    const resultado = await criar(novoNome);
    setCriando(false);
    if (resultado) {
      setErro(resultado);
      return;
    }
    setNovoNome('');
  };

  const atribuir = async (colaboradorId: string, departamentoId: string) => {
    setErro(null);
    const resultado = await definirDepartamento(colaboradorId, departamentoId);
    if (resultado) setErro(resultado);
  };

  return (
    <div className="space-y-6">
      {!embutido && (
        <div className="animate-fade-in-up">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            Departamentos
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Quem está em cada departamento, os gestores (que autorizam os pagamentos) e quem aprova as Solicitações de Compra
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCriar()}
          placeholder="Nome do novo departamento"
          aria-label="Nome do novo departamento"
          className={inputClassName}
          disabled={criando}
        />
        <button
          type="button"
          onClick={handleCriar}
          disabled={criando || !novoNome.trim()}
          className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Criar departamento
        </button>
      </div>

      {semVerColaboradores && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-amber-800 dark:text-amber-300 text-sm">
          Seu cargo não tem "Visualizar Colaboradores": os membros, os gestores e o aprovador não aparecem, e não dá para mudar o departamento de ninguém.
        </div>
      )}

      {(erro || erroCarga) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
          {erro || erroCarga}
        </div>
      )}

      {!loading && semAutorizador.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-medium text-sm mb-2">
            <AlertTriangle className="w-4 h-4" />
            {semAutorizador.length === 1
              ? '1 departamento sem gestor que autorize pagamentos'
              : `${semAutorizador.length} departamentos sem gestor que autorize pagamentos`}
          </div>
          <p className="text-xs text-red-700 dark:text-red-300 mb-3">
            Quem está neles não consegue pedir pagamento. Abra o departamento, adicione o gestor e marque "Autoriza pagamentos".
          </p>
          <div className="flex flex-wrap gap-2">
            {semAutorizador.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelecionadoId(d.id)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                {d.nome}
                {membrosAtivos.get(d.id) ? ` · ${membrosAtivos.get(d.id)} ${membrosAtivos.get(d.id) === 1 ? 'pessoa' : 'pessoas'}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && semDepartamento.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium text-sm mb-3">
            <AlertTriangle className="w-4 h-4" />
            {semDepartamento.length === 1 ? '1 colaborador ativo sem departamento' : `${semDepartamento.length} colaboradores ativos sem departamento`}
          </div>
          <ul className="divide-y divide-amber-100 dark:divide-amber-900/40">
            {semDepartamento.map((c) => (
              <li key={c.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                <span className="text-gray-700 dark:text-gray-200">{c.nome}</span>
                <Select
                  value=""
                  onChange={(valor) => valor && atribuir(c.id, valor)}
                  options={opcoesDepartamento}
                  placeholder="Escolher departamento..."
                  controlClass={inputClassName}
                  wrapperClass="sm:w-72"
                  ariaLabel={`Departamento de ${c.nome}`}
                  searchable
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div role="tablist" aria-label="Visão" className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        {([
          ['departamentos', 'Por departamento', Building2],
          ['gestores', 'Por gestor', Users],
        ] as const).map(([valor, rotulo, Icone]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={visao === valor}
            onClick={() => setVisao(valor)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              visao === valor
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Icone className="w-4 h-4" />
            {rotulo}
          </button>
        ))}
      </div>

      {visao === 'departamentos' ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3">Departamento</th>
                  <th className="px-4 py-3">Gestores</th>
                  <th className="px-4 py-3">Aprovador de SC</th>
                  <th className="px-4 py-3">Membros ativos</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} columns={5} />)}

                {!loading && departamentos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Nenhum departamento cadastrado ainda.
                    </td>
                  </tr>
                )}

                {!loading &&
                  departamentos.map((d) => {
                    const aptos = painel ? autorizadoresAptos(d, painel.situacoes) : [];
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelecionadoId(d.id)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer align-top"
                      >
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{d.nome}</td>
                        <td className="px-4 py-3">
                          {d.responsavelIds.length === 0 ? (
                            !(painel && d.ativo) && <span className="text-gray-400 dark:text-gray-500">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {d.responsavelIds.map((id) => {
                                const autoriza = d.autorizaPagamentosIds.includes(id);
                                const apto = aptos.includes(id);
                                const situacao = painel?.situacoes[chaveGestor(d.id, id)];
                                return (
                                  <span
                                    key={id}
                                    title={
                                      autoriza
                                        ? apto
                                          ? 'Autoriza pagamentos'
                                          : `Marcado, mas não autoriza: ${situacao ? ROTULO_SITUACAO_GESTOR[situacao] : '—'}`
                                        : 'Gestor (não autoriza pagamentos)'
                                    }
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${
                                      autoriza && apto
                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                        : autoriza
                                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                          : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300'
                                    }`}
                                  >
                                    {autoriza && <DollarSign className="w-3 h-3" />}
                                    {nomeDoColaborador.get(id) ?? '—'}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {painel && d.ativo && aptos.length === 0 && (
                            <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">
                              Sem gestor que autorize pagamentos
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {d.aprovadorScId ? nomeDoColaborador.get(d.aprovadorScId) ?? '—' : (
                            <span className="text-amber-600 dark:text-amber-400">Sem aprovador</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{membrosAtivos.get(d.id) ?? 0}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              d.ativo
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {d.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3">Gestor</th>
                  <th className="px-4 py-3">Departamentos que controla</th>
                  <th className="px-4 py-3">Situação para autorizar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonTableRow key={i} columns={3} />)}

                {!loading && gestores.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Nenhum gestor cadastrado ainda. Abra um departamento para adicionar.
                    </td>
                  </tr>
                )}

                {!loading &&
                  gestores.map(({ colaborador, departamentos: deles }) => {
                    // A situação é da pessoa (colaborador, login, cargo): igual em todos os departamentos.
                    const situacao = deles.map((d) => painel?.situacoes[chaveGestor(d.id, colaborador.id)]).find(Boolean);
                    return (
                      <tr key={colaborador.id} className="align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 dark:text-gray-100">{colaborador.nome}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{colaborador.departamentoNome ?? 'Sem departamento'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {deles.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => setSelecionadoId(d.id)}
                                title={d.autorizaPagamentos ? 'Autoriza os pagamentos deste departamento' : 'Gestor, sem autorizar pagamentos'}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium transition-colors ${
                                  d.autorizaPagamentos
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                } ${d.ativo ? '' : 'opacity-60'}`}
                              >
                                {d.autorizaPagamentos && <DollarSign className="w-3 h-3" />}
                                {d.nome}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {situacao ? (
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                situacao === 'apto'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {ROTULO_SITUACAO_GESTOR[situacao]}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selecionado && (
        <DepartamentoDetalheModal
          departamento={selecionado}
          departamentos={departamentos}
          colaboradores={colaboradores}
          onClose={() => setSelecionadoId(null)}
          renomear={renomear}
          definirAtivo={definirAtivo}
          definirAprovador={definirAprovador}
          adicionarResponsavel={adicionarResponsavel}
          removerResponsavel={removerResponsavel}
          painel={painel}
          definirAutorizaPagamentos={definirAutorizaPagamentos}
          transferirAutorizacoes={transferirAutorizacoes}
          definirDepartamento={definirDepartamento}
        />
      )}
    </div>
  );
};

export default DepartamentosPage;
