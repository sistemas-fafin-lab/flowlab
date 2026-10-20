import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Loader2, Power, UserMinus } from 'lucide-react';
import DetailModal from '../../../components/DetailModal';
import Select, { type SelectOption } from '../../../components/Select';
import { bloqueioDesativarDepartamento, porNome, validarNomeDepartamento } from '../utils/departamentos';
import type { Colaborador, Departamento } from '../types';

interface DepartamentoDetalheModalProps {
  departamento: Departamento;
  departamentos: Departamento[];
  colaboradores: Colaborador[];
  onClose: () => void;
  renomear: (id: string, nome: string) => Promise<string | null>;
  definirAtivo: (id: string, ativo: boolean) => Promise<string | null>;
  definirAprovador: (id: string, colaboradorId: string | null) => Promise<string | null>;
  adicionarResponsavel: (id: string, colaboradorId: string) => Promise<string | null>;
  removerResponsavel: (id: string, colaboradorId: string) => Promise<string | null>;
  definirDepartamento: (colaboradorId: string, departamentoId: string | null) => Promise<string | null>;
}

// Sentinela para "nenhum" nos selects — nunca colide com um uuid real.
const NENHUM = '';

const inputClassName =
  'w-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded-xl px-3 py-2';

const tituloClassName = 'text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2';

const botaoLinkClassName =
  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-60 transition-colors';

/** Opção de colaborador para os selects, com o departamento atual como descrição. */
const opcaoColaborador = (c: Colaborador): SelectOption => ({
  value: c.id,
  label: c.nome,
  description: c.departamentoNome ?? 'Sem departamento',
});

const DepartamentoDetalheModal: React.FC<DepartamentoDetalheModalProps> = ({
  departamento,
  departamentos,
  colaboradores,
  onClose,
  renomear,
  definirAtivo,
  definirAprovador,
  adicionarResponsavel,
  removerResponsavel,
  definirDepartamento,
}) => {
  const [nome, setNome] = useState(departamento.nome);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setNome(departamento.nome);
    setErro(null);
  }, [departamento.id, departamento.nome]);

  const ativos = useMemo(
    () => colaboradores.filter((c) => c.status === 'ativo').sort(porNome),
    [colaboradores],
  );
  const membros = useMemo(
    () => colaboradores.filter((c) => c.departamentoId === departamento.id).sort(porNome),
    [colaboradores, departamento.id],
  );
  const responsaveis = useMemo(
    () => colaboradores.filter((c) => departamento.responsavelIds.includes(c.id)).sort(porNome),
    [colaboradores, departamento.responsavelIds],
  );

  /** Roda uma escrita mostrando o erro dela, se houver. */
  const executar = async (escrita: () => Promise<string | null>): Promise<void> => {
    setOcupado(true);
    setErro(null);
    const resultado = await escrita();
    setOcupado(false);
    if (resultado) setErro(resultado);
  };

  const salvarNome = () => {
    const erroNome = validarNomeDepartamento(nome, departamentos, departamento.id);
    if (erroNome) {
      setErro(erroNome);
      return;
    }
    executar(() => renomear(departamento.id, nome));
  };

  const alternarAtivo = () => {
    if (departamento.ativo) {
      const bloqueio = bloqueioDesativarDepartamento(departamento.id, colaboradores);
      if (bloqueio) {
        setErro(bloqueio);
        return;
      }
    }
    executar(() => definirAtivo(departamento.id, !departamento.ativo));
  };

  // O aprovador atual continua na lista mesmo desligado, para a seleção não "sumir".
  // Sem login ele não aprova (requests_resolver_aprovador): a opção avisa.
  const aprovador = colaboradores.find((c) => c.id === departamento.aprovadorScId);
  const opcoesAprovador: SelectOption[] = [
    { value: NENHUM, label: 'Sem aprovador' },
    ...[...ativos, ...(aprovador && aprovador.status !== 'ativo' ? [aprovador] : [])].map((c, index) => {
      const opcao = opcaoColaborador(c);
      const aviso = c.status !== 'ativo' ? 'desligado, não aprova' : !c.userProfileId ? 'sem login, não aprova' : null;
      return { ...opcao, description: aviso ? `${opcao.description} · ${aviso}` : opcao.description, separatorBefore: index === 0 };
    }),
  ];
  const opcoesResponsavel = ativos.filter((c) => !departamento.responsavelIds.includes(c.id)).map(opcaoColaborador);
  const opcoesMembro = ativos.filter((c) => c.departamentoId !== departamento.id).map(opcaoColaborador);

  return (
    <DetailModal title={departamento.nome} icon={<Building2 className="w-5 h-5 text-white" />} onClose={onClose}>
      <div className="space-y-6">
        {erro && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
            {erro}
          </p>
        )}

        <section>
          <h3 className={tituloClassName}>Nome</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputClassName}
              aria-label="Nome do departamento"
              disabled={ocupado}
            />
            <button
              type="button"
              onClick={salvarNome}
              disabled={ocupado || nome.trim() === departamento.nome}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Renomear
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className={departamento.ativo ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}>
              {departamento.ativo ? 'Ativo' : 'Inativo'}
            </span>
            <button
              type="button"
              onClick={alternarAtivo}
              disabled={ocupado}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60 transition-colors"
            >
              <Power className="w-3.5 h-3.5" />
              {departamento.ativo ? 'Desativar' : 'Reativar'}
            </button>
          </div>
        </section>

        <section>
          <h3 className={tituloClassName}>Aprovador de SC</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Aprova as Solicitações de Compra de quem está neste departamento. Pode ser de outro departamento.
          </p>
          <Select
            value={departamento.aprovadorScId ?? NENHUM}
            onChange={(valor) => executar(() => definirAprovador(departamento.id, valor || null))}
            options={opcoesAprovador}
            controlClass={inputClassName}
            ariaLabel="Aprovador de SC"
            searchable
            disabled={ocupado}
          />
        </section>

        <section>
          <h3 className={tituloClassName}>Responsáveis</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Respondem pelo departamento, estando nele ou não. Com "Visualizar Holerites da Equipe", veem os holerites de quem está nele.
          </p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700 mb-2">
            {responsaveis.length === 0 && <li className="py-2 text-sm text-gray-400 dark:text-gray-500">Nenhum responsável.</li>}
            {responsaveis.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-700 dark:text-gray-200">
                  {c.nome}
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{c.departamentoNome ?? 'Sem departamento'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => executar(() => removerResponsavel(departamento.id, c.id))}
                  disabled={ocupado}
                  className={botaoLinkClassName}
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  Remover
                </button>
              </li>
            ))}
          </ul>
          <Select
            value={NENHUM}
            onChange={(valor) => valor && executar(() => adicionarResponsavel(departamento.id, valor))}
            options={opcoesResponsavel}
            placeholder="Adicionar responsável..."
            controlClass={inputClassName}
            ariaLabel="Adicionar responsável"
            searchable
            disabled={ocupado}
          />
        </section>

        <section>
          <h3 className={tituloClassName}>Membros ({membros.length})</h3>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700 mb-2">
            {membros.length === 0 && <li className="py-2 text-sm text-gray-400 dark:text-gray-500">Ninguém neste departamento.</li>}
            {membros.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className={c.status === 'ativo' ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
                  {c.nome}
                  {c.status !== 'ativo' && <span className="ml-2 text-xs">(desligado)</span>}
                </span>
                <button
                  type="button"
                  onClick={() => executar(() => definirDepartamento(c.id, null))}
                  disabled={ocupado}
                  className={botaoLinkClassName}
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  Tirar
                </button>
              </li>
            ))}
          </ul>
          {departamento.ativo && (
            <Select
              value={NENHUM}
              onChange={(valor) => valor && executar(() => definirDepartamento(valor, departamento.id))}
              options={opcoesMembro}
              placeholder="Adicionar membro (sai do departamento atual)..."
              controlClass={inputClassName}
              ariaLabel="Adicionar membro"
              searchable
              disabled={ocupado}
            />
          )}
        </section>
      </div>
    </DetailModal>
  );
};

export default DepartamentoDetalheModal;
