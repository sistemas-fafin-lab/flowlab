import React, { useMemo, useState } from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import EvaAdminShell from './EvaAdminShell';
import Select from '../../../../components/Select';
import Switch from '../../../../components/Switch';
import { GlassCard, SectionHeader, StatusBadge } from '../ui';
import { EvaToast } from '../EvaToast';
import { useAuth } from '../../../../hooks/useAuth';
import { usePermissoesEva } from '../../hooks/useAgenteAdmin';
import { agenteAdmin, type PessoaPermissoes } from '../../services/agenteAdmin';
import { PAPEIS_EVA, quemAparece, resumoPapeis, travaDaChave, travaDoVoltar } from '../../domain/permissoes';
import { primeiroNome } from '../../domain/pessoas';
import type { PapeisEva } from '../../domain/papeis';
import type { AvisoEva } from '../../hooks/useEvaHome';
import { BOTAO_SECUNDARIO, CAMPO, LINHA, ROTULO } from './estilos';

const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const ORIGEM: Record<PessoaPermissoes['origem'], { rotulo: string; tom: 'neutral' | 'info' | 'success' }> = {
  cargo: { rotulo: 'Pelo cargo', tom: 'neutral' },
  definido: { rotulo: 'Definido aqui', tom: 'info' },
  admin: { rotulo: 'Administrador', tom: 'success' },
  inativo: { rotulo: 'Inativo', tom: 'neutral' },
};

/** /it/eva/permissoes — quem configura, quem é gestor e quem aprova, pessoa a pessoa (issue 22, D33). */
const PermissoesPage: React.FC = () => {
  const { dados, erro, carregando, recarregar } = usePermissoesEva();
  const { userProfile, refreshProfile } = useAuth();
  const euId = userProfile?.id ?? null;
  const [adicionados, setAdicionados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoEva | null>(null);

  const pessoas = useMemo(() => dados ?? [], [dados]);
  const lista = useMemo(() => quemAparece(pessoas, adicionados), [pessoas, adicionados]);
  const opcoesAdicionar = useMemo(() => {
    const listados = new Set(lista.map((p) => p.id));
    return pessoas
      .filter((p) => !listados.has(p.id))
      .map((p) => ({ value: p.id, label: p.nome, description: [p.cargo, p.departamento].filter(Boolean).join(' · ') || undefined }));
  }, [pessoas, lista]);

  const depois = async (p: PessoaPermissoes, texto: string) => {
    setAviso({ id: Date.now(), texto, tom: 'sucesso' });
    await recarregar();
    // A sessão de quem mudou as próprias permissões já reflete a mudança (menu, abas, botões).
    if (p.id === euId) refreshProfile();
  };

  const definir = async (p: PessoaPermissoes, novo: PapeisEva) => {
    setSalvando(p.id);
    try {
      await agenteAdmin.definirPapeis(p.id, novo);
      await depois(p, `${primeiroNome(p.nome)}: ${resumoPapeis(novo)}.`);
    } catch (e) {
      setAviso({ id: Date.now(), texto: e instanceof Error ? e.message : 'Não consegui salvar.', tom: 'erro' });
    } finally {
      setSalvando(null);
    }
  };

  const voltar = async (p: PessoaPermissoes) => {
    setSalvando(p.id);
    try {
      await agenteAdmin.voltarAoCargo(p.id);
      await depois(p, `${primeiroNome(p.nome)} voltou a seguir o cargo: ${resumoPapeis(p.doCargo)}.`);
    } catch (e) {
      setAviso({ id: Date.now(), texto: e instanceof Error ? e.message : 'Não consegui voltar ao cargo.', tom: 'erro' });
    } finally {
      setSalvando(null);
    }
  };

  return (
    <EvaAdminShell subtitulo="Quem configura, quem é gestor e quem aprova">
      {/* relative z-10: o vidro (backdrop-blur) empilha à parte, e a lista do seletor ficaria atrás do cartão de baixo. */}
      <GlassCard className="gap-4 relative z-10">
        <SectionHeader
          icon={ShieldCheck}
          tone="from-indigo-500 to-violet-600 shadow-indigo-500/25"
          title="Permissões da EVA"
          subtitle="Pessoa a pessoa, sem criar cargos"
        />
        <div className="grid gap-2 sm:grid-cols-3">
          {PAPEIS_EVA.map((x) => (
            <div key={x.chave} className={`${LINHA} !py-2.5`}>
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{x.rotulo}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{x.texto}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          O que você marcar aqui vale no lugar do cargo, só para a EVA ("Definido aqui"). Sem nada marcado aqui, a pessoa segue o cargo
          (Usuários → Cargos e Permissões). O administrador tem as três, sempre. No WhatsApp e no servidor, a mudança vale na hora; nas telas,
          quando a pessoa abrir o FlowLab de novo.
        </p>
        <div className="max-w-md">
          <span className={ROTULO}>Dar permissão a outra pessoa</span>
          <Select
            tone="vidro"
            searchable
            value=""
            onChange={(id) => setAdicionados((a) => [...a.filter((x) => x !== id), id])}
            options={opcoesAdicionar}
            placeholder="Escolha um usuário"
            searchPlaceholder="Buscar nome, cargo ou departamento"
            emptyText="Ninguém com esse nome."
            controlClass={CAMPO}
            ariaLabel="Dar permissão a outra pessoa"
            disabled={!dados}
          />
        </div>
      </GlassCard>

      <GlassCard className="gap-3">
        {erro && <p className="text-sm text-red-600 dark:text-red-400">Não consegui carregar as permissões: {erro}</p>}
        {!erro && carregando && !dados && <p className="text-sm text-slate-500 dark:text-slate-400">Carregando…</p>}
        {lista.map((p) => {
          const eu = p.id === euId;
          const origem = ORIGEM[p.origem];
          const ocupado = salvando === p.id;
          const travaVoltar = travaDoVoltar(p, euId);
          return (
            <div key={p.id} className={`${LINHA} flex flex-col lg:flex-row lg:items-center gap-3`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    {p.nome}
                    {eu && <span className="font-normal text-slate-400"> (você)</span>}
                  </p>
                  <StatusBadge tone={origem.tom}>{origem.rotulo}</StatusBadge>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {[p.cargo ? `Cargo: ${p.cargo}` : 'Sem cargo', p.departamento].filter(Boolean).join(' · ')}
                </p>
                {p.origem === 'definido' && (
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Definido{p.definidoPor ? ` por ${p.definidoPor}` : ''}{p.definidoEm ? ` em ${dia(p.definidoEm)}` : ''}. Pelo cargo seria: {resumoPapeis(p.doCargo)}.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
                {PAPEIS_EVA.map((x) => {
                  const trava = travaDaChave(p, x.chave, euId);
                  return (
                    <label
                      key={x.chave}
                      title={trava ?? x.texto}
                      className={`inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 ${trava || ocupado ? '' : 'cursor-pointer'}`}
                    >
                      <Switch
                        size="sm"
                        checked={p.papeis[x.chave]}
                        disabled={!!trava || ocupado}
                        onChange={(v) => void definir(p, { ...p.papeis, [x.chave]: v })}
                      />
                      {x.rotulo}
                    </label>
                  );
                })}
                {p.origem === 'definido' && (
                  <button
                    type="button"
                    className={`${BOTAO_SECUNDARIO} !px-2.5 !py-1 !text-xs`}
                    disabled={ocupado || !!travaVoltar}
                    title={travaVoltar ?? `Volta a seguir o cargo: ${resumoPapeis(p.doCargo)}`}
                    onClick={() => void voltar(p)}
                  >
                    <RotateCcw className="w-3 h-3" /> Voltar ao cargo
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </GlassCard>

      <EvaToast aviso={aviso} onClose={() => setAviso(null)} />
    </EvaAdminShell>
  );
};

export default PermissoesPage;
