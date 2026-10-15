import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, UserPlus, Users } from 'lucide-react';
import EvaAdminShell from './EvaAdminShell';
import EvaModal from './EvaModal';
import HistoricoMembro from './HistoricoMembro';
import Select from '../../../../components/Select';
import Switch from '../../../../components/Switch';
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
  const [aberto, setAberto] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [testando, setTestando] = useState<Record<string, string>>({});
  const [falhas, setFalhas] = useState<Record<string, { erro: string | null; created_at: string }>>({});

  useEffect(() => {
    agenteAdmin.ultimasFalhas().then(setFalhas).catch(() => setFalhas({}));
  }, [versao, dados]);

  /** RF19: põe o teste na fila e acompanha até "enviada" ou "falhou" (o script da VPS roda a cada minuto). */
  const enviarTeste = async (m: Membro) => {
    setTestando((t) => ({ ...t, [m.id]: 'Na fila…' }));
    try {
      const { mensagemId } = await agenteAdmin.enviarTeste(m.id);
      for (let i = 0; i < 30; i += 1) {
        await new Promise((r) => setTimeout(r, 5000));
        const s = await agenteAdmin.statusMensagem(mensagemId).catch(() => null);
        if (s && s.status !== 'pendente') {
          setTestando((t) => ({ ...t, [m.id]: '' }));
          setAviso({
            id: Date.now(),
            texto: s.status === 'falhou' ? `O teste para ${m.nome} falhou: ${s.erro ?? 'sem detalhe'}` : `Teste enviado para ${m.nome}. Confira no celular.`,
            tom: s.status === 'falhou' ? 'erro' : 'sucesso',
          });
          setVersao((v) => v + 1);
          return;
        }
      }
      setTestando((t) => ({ ...t, [m.id]: '' }));
      setAviso({ id: Date.now(), texto: 'O teste continua na fila. Confira se o timer da VPS está rodando e se a sessão do WAHA está conectada.', tom: 'erro' });
    } catch (e) {
      setTestando((t) => ({ ...t, [m.id]: '' }));
      setAviso({ id: Date.now(), texto: e instanceof Error ? e.message : 'Não consegui enviar o teste.', tom: 'erro' });
    }
  };

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
    .map((p) => ({ value: p.id, label: p.name, description: p.department || undefined }));

  return (
    <EvaAdminShell
      subtitulo="Quem a EVA conhece e acompanha"
      acoes={<button type="button" className={BOTAO_PRIMARIO} onClick={novo}><UserPlus className="w-4 h-4" /> Adicionar membro</button>}
    >
      <GlassCard className="gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Os apelidos são os nomes com que a pessoa aparece nos resumos das reuniões ("@Gabriel Carneiro"). Enquanto esta lista
          estiver vazia, a EVA usa as pessoas do departamento TI. A cobrança pelo WhatsApp só vai para quem tem a adesão marcada;
          as respostas só valem de números cadastrados aqui.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Os papéis vêm do cargo de cada pessoa ou da aba{' '}
          <Link to="/it/eva/permissoes" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Permissões</Link>, e o administrador tem os três:{' '}
          <strong className="font-semibold text-slate-600 dark:text-slate-300">Configura</strong> (abas Membros, Permissões e Configurações),{' '}
          <strong className="font-semibold text-slate-600 dark:text-slate-300">Gestor</strong> (cobrar a equipe, avisar o grupo e as pessoas, ver a fila do WhatsApp) e{' '}
          <strong className="font-semibold text-slate-600 dark:text-slate-300">Aprova</strong> (aprovar e rejeitar sugestões). Para usar o papel pelo
          WhatsApp, a pessoa também precisa estar aqui, com o WhatsApp cadastrado.
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
          const falha = falhas[m.id];
          return (
            <div key={m.id} className={`${LINHA} flex flex-col gap-3 ${m.ativo ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-[1_1_280px]">
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{m.nome}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Apelidos: {m.apelidos.length ? m.apelidos.join(', ') : '—'} · WhatsApp: {formatarWhatsapp(m.whatsapp)}
                    {m.cargo ? ` · Cargo: ${m.cargo}` : ''}
                    {m.origemPapeis === 'definido' ? ' · Papéis definidos na aba Permissões' : ''}
                  </p>
                  {(m.papeis.gestor || m.papeis.aprova) && !m.whatsapp && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cadastre o WhatsApp para usar o papel pelo WhatsApp da EVA.</p>
                  )}
                  {temDuplicado && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Há um apelido igual em outro membro: a EVA não vai saber quem é quem.</p>}
                  {falha && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400 [overflow-wrap:anywhere]">
                      A última mensagem falhou{falha.erro ? `: ${falha.erro}` : '.'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {m.papeis.configura && (
                    <span title="Abas Membros e Configurações da EVA">
                      <StatusBadge tone="neutral">Configura</StatusBadge>
                    </span>
                  )}
                  {m.papeis.gestor && (
                    <span title="Cobra a equipe, avisa o grupo e vê a fila do WhatsApp">
                      <StatusBadge tone="info">Gestor</StatusBadge>
                    </span>
                  )}
                  {m.papeis.aprova && (
                    <span title="Aprova e rejeita as sugestões da EVA, na tela e pelo WhatsApp">
                      <StatusBadge tone="warning">Aprova</StatusBadge>
                    </span>
                  )}
                  {m.recebe_cobranca && <StatusBadge tone="success">Recebe cobrança</StatusBadge>}
                  {!m.ativo && <StatusBadge tone="neutral">Inativo</StatusBadge>}
                  {m.whatsapp && m.ativo && (
                    <button type="button" className={BOTAO_SECUNDARIO} onClick={() => void enviarTeste(m)} disabled={!!testando[m.id]}>
                      <Send className="w-3.5 h-3.5" /> {testando[m.id] || 'Enviar teste'}
                    </button>
                  )}
                  <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setAberto(aberto === m.id ? null : m.id)} aria-expanded={aberto === m.id}>
                    Histórico
                  </button>
                  <button type="button" className={BOTAO_SECUNDARIO} onClick={() => editar(m)}>Editar</button>
                </div>
              </div>
              {aberto === m.id && <HistoricoMembro membroId={m.id} versao={versao} />}
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
              <Select
                tone="vidro"
                searchable
                value={rascunho.user_id}
                onChange={escolherPessoa}
                options={opcoesPessoas}
                placeholder="Escolha um usuário"
                searchPlaceholder="Buscar nome ou departamento"
                emptyText="Ninguém com esse nome."
                controlClass={CAMPO}
                ariaLabel="Pessoa"
                disabled={!!rascunho.id}
              />
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
            <label className={`flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 ${soDigitos(rascunho.whatsapp) ? 'cursor-pointer' : 'opacity-60'}`}>
              <Switch size="sm" checked={rascunho.recebe_cobranca} disabled={!soDigitos(rascunho.whatsapp)} onChange={(v) => setRascunho({ ...rascunho, recebe_cobranca: v })} />
              Recebe cobrança pelo WhatsApp
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
              <Switch size="sm" checked={rascunho.ativo} onChange={(v) => setRascunho({ ...rascunho, ativo: v })} />
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
