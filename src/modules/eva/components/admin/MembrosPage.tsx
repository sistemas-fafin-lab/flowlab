import React, { useMemo, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import EvaAdminShell from './EvaAdminShell';
import EvaModal from './EvaModal';
import Select from '../../../../components/Select';
import { GlassCard, StatusBadge } from '../ui';
import { EvaToast } from '../EvaToast';
import { useMembros, usePessoas } from '../../hooks/useAgenteAdmin';
import { agenteAdmin, type Membro } from '../../services/agenteAdmin';
import { formatarWhatsapp, normalizarNome, primeiroNome } from '../../domain/pessoas';
import type { AvisoEva } from '../../hooks/useEvaHome';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, LINHA, ROTULO } from './estilos';

interface Rascunho {
  id?: string;
  user_id: string;
  apelidos: string;
  whatsapp: string;
  recebe_cobranca: boolean;
  ativo: boolean;
}

const soDigitos = (s: string) => s.replace(/\D/g, '');

/** /it/eva/membros — quem a EVA conhece: apelidos nas reuniões, WhatsApp e adesão (issue 07, D10). */
const MembrosPage: React.FC = () => {
  const { dados, erro, carregando, recarregar } = useMembros();
  const pessoas = usePessoas();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<AvisoEva | null>(null);
  const membros = useMemo(() => dados ?? [], [dados]);

  // RN08: o mesmo apelido em duas pessoas deixaria a EVA sem saber quem é quem.
  const duplicados = useMemo(() => {
    const vistos = new Map<string, string>();
    const dup = new Set<string>();
    for (const m of membros.filter((x) => x.ativo)) {
      for (const a of [m.nome, ...m.apelidos].map(normalizarNome).filter(Boolean)) {
        if (vistos.has(a) && vistos.get(a) !== m.id) dup.add(a);
        vistos.set(a, m.id);
      }
    }
    return dup;
  }, [membros]);

  const novo = () => setRascunho({ user_id: '', apelidos: '', whatsapp: '', recebe_cobranca: false, ativo: true });
  const editar = (m: Membro) =>
    setRascunho({ id: m.id, user_id: m.user_id, apelidos: m.apelidos.join(', '), whatsapp: m.whatsapp ?? '', recebe_cobranca: m.recebe_cobranca, ativo: m.ativo });

  const escolherPessoa = (userId: string) => {
    const nome = pessoas.lista.find((p) => p.id === userId)?.name ?? '';
    setRascunho((r) => (r ? { ...r, user_id: userId, apelidos: r.apelidos || [nome, primeiroNome(nome)].filter(Boolean).join(', ') } : r));
  };

  const whatsappValido = (w: string) => !w || /^\d{12,13}$/.test(soDigitos(w));

  const salvar = async () => {
    if (!rascunho) return;
    setSalvando(true);
    try {
      await agenteAdmin.salvarMembro({
        id: rascunho.id,
        user_id: rascunho.user_id,
        apelidos: rascunho.apelidos.split(',').map((a) => a.trim()).filter(Boolean),
        whatsapp: soDigitos(rascunho.whatsapp) || null,
        recebe_cobranca: rascunho.recebe_cobranca && !!soDigitos(rascunho.whatsapp),
        ativo: rascunho.ativo,
      });
      setRascunho(null);
      setAviso({ id: Date.now(), texto: 'Membro salvo.', tom: 'sucesso' });
      await recarregar();
    } catch (e) {
      setAviso({ id: Date.now(), texto: e instanceof Error ? e.message : 'Não consegui salvar.', tom: 'erro' });
    } finally {
      setSalvando(false);
    }
  };

  const jaMembros = new Set(membros.map((m) => m.user_id));
  const opcoesPessoas = pessoas.lista
    .filter((p) => !jaMembros.has(p.id) || p.id === rascunho?.user_id)
    .map((p) => ({ value: p.id, label: p.name }));

  return (
    <EvaAdminShell
      subtitulo="Quem a EVA conhece e acompanha"
      acoes={<button type="button" className={BOTAO_PRIMARIO} onClick={novo}><UserPlus className="w-4 h-4" /> Adicionar membro</button>}
    >
      <GlassCard className="gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Os apelidos são os nomes com que a pessoa aparece nos resumos das reuniões ("@Gabriel Carneiro"). Enquanto esta lista
          estiver vazia, a EVA usa as pessoas do departamento TI. O WhatsApp só é usado com a adesão marcada, a partir da fase de cobrança.
        </p>
        {erro && <p className="text-sm text-red-600 dark:text-red-400">Não consegui carregar os membros: {erro}</p>}
        {!erro && !carregando && membros.length === 0 && (
          <div className="py-10 text-center">
            <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nenhum membro cadastrado ainda.</p>
          </div>
        )}
        {membros.map((m) => {
          const temDuplicado = [m.nome, ...m.apelidos].some((a) => duplicados.has(normalizarNome(a)));
          return (
            <div key={m.id} className={`${LINHA} flex flex-wrap items-center justify-between gap-3 ${m.ativo ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-[1_1_280px]">
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{m.nome}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Apelidos: {m.apelidos.length ? m.apelidos.join(', ') : '—'} · WhatsApp: {formatarWhatsapp(m.whatsapp)}
                </p>
                {temDuplicado && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Há um apelido igual em outro membro: a EVA não vai saber quem é quem.</p>}
              </div>
              <div className="flex items-center gap-1.5">
                {m.recebe_cobranca && <StatusBadge tone="success">Recebe cobrança</StatusBadge>}
                {!m.ativo && <StatusBadge tone="neutral">Inativo</StatusBadge>}
                <button type="button" className={BOTAO_SECUNDARIO} onClick={() => editar(m)}>Editar</button>
              </div>
            </div>
          );
        })}
      </GlassCard>

      <EvaModal
        aberto={!!rascunho}
        titulo={rascunho?.id ? 'Editar membro' : 'Adicionar membro'}
        onFechar={() => setRascunho(null)}
        rodape={
          <>
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setRascunho(null)} disabled={salvando}>Cancelar</button>
            <button type="button" className={BOTAO_PRIMARIO} onClick={() => void salvar()} disabled={salvando || !rascunho?.user_id || !whatsappValido(rascunho?.whatsapp ?? '')}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </>
        }
      >
        {rascunho && (
          <div className="flex flex-col gap-4">
            <div>
              <span className={ROTULO}>Pessoa</span>
              <Select tone="vidro" value={rascunho.user_id} onChange={escolherPessoa} options={opcoesPessoas} placeholder="Escolha um usuário" controlClass={CAMPO} ariaLabel="Pessoa" disabled={!!rascunho.id} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="eva-apelidos">Apelidos nas reuniões (separados por vírgula)</label>
              <input id="eva-apelidos" className={CAMPO} value={rascunho.apelidos} onChange={(e) => setRascunho({ ...rascunho, apelidos: e.target.value })} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="eva-whatsapp">WhatsApp (com DDI e DDD)</label>
              <input id="eva-whatsapp" inputMode="tel" className={CAMPO} value={rascunho.whatsapp} onChange={(e) => setRascunho({ ...rascunho, whatsapp: e.target.value })} placeholder="+55 61 99999-9999" />
              {!whatsappValido(rascunho.whatsapp) && <p className="mt-1 text-[11px] text-red-600">Use DDI + DDD + número, só dígitos (12 ou 13).</p>}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={rascunho.recebe_cobranca} disabled={!soDigitos(rascunho.whatsapp)} onChange={(e) => setRascunho({ ...rascunho, recebe_cobranca: e.target.checked })} />
              Recebe cobrança pelo WhatsApp
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={rascunho.ativo} onChange={(e) => setRascunho({ ...rascunho, ativo: e.target.checked })} />
              Ativo
            </label>
          </div>
        )}
      </EvaModal>

      <EvaToast aviso={aviso} onClose={() => setAviso(null)} />
    </EvaAdminShell>
  );
};

export default MembrosPage;
