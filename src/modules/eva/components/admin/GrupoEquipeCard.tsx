import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Send, Users } from 'lucide-react';
import { GlassCard, SectionHeader } from '../ui';
import { agenteAdmin, type ConfigEva } from '../../services/agenteAdmin';
import type { AvisoEva } from '../../hooks/useEvaHome';
import { BOTAO_SECUNDARIO, CAMPO, LINHA, ROTULO } from './estilos';

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca');

interface Props {
  config: ConfigEva | null;
  salvando: boolean;
  salvar: (mudanca: Parameters<typeof agenteAdmin.salvarConfig>[0], ok: string) => Promise<void>;
  recarregar: () => Promise<unknown>;
  avisar: (aviso: AvisoEva) => void;
}

/**
 * Configurações → Grupo da equipe (issue 18, D29): o grupo do WhatsApp que recebe o fechamento
 * do dia, os resumos de reunião e os avisos pedidos por gestor. A lista vem do WAHA pela VPS.
 */
const GrupoEquipeCard: React.FC<Props> = ({ config: c, salvando, salvar, recarregar, avisar }) => {
  const [testando, setTestando] = useState('');
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const grupos = c?.waha_grupos ?? [];
  const escolhido = c?.whatsapp_grupo_id ?? '';
  // O grupo escolhido pode ter saído da lista (a EVA saiu do grupo): continua visível para trocar.
  const opcoes = escolhido && !grupos.some((g) => g.id === escolhido)
    ? [...grupos, { id: escolhido, nome: `${c?.whatsapp_grupo_nome ?? escolhido} (fora da lista atual)` }]
    : grupos;
  const temGrupo = !!escolhido;

  const escolher = (id: string) => {
    const g = grupos.find((x) => x.id === id);
    void salvar(
      { whatsapp_grupo_id: id || null, whatsapp_grupo_nome: id ? g?.nome ?? null : null },
      id ? `Grupo da equipe: ${g?.nome ?? id}.` : 'Nenhum grupo da equipe escolhido.',
    );
  };

  const atualizarLista = async () => {
    await salvar({ waha_grupos_em: null }, 'Pedi a lista de novo: a VPS relê os grupos em até 1 minuto.');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void recarregar(), 70_000);
  };

  /** Igual ao teste de membro: põe na fila e acompanha até "enviada" ou "falhou". */
  const enviarTeste = async () => {
    setTestando('Na fila…');
    try {
      const { mensagemId } = await agenteAdmin.enviarTesteGrupo();
      for (let i = 0; i < 30; i += 1) {
        await new Promise((r) => setTimeout(r, 5000));
        const s = await agenteAdmin.statusMensagem(mensagemId).catch(() => null);
        if (s && s.status !== 'pendente') {
          avisar({
            id: Date.now(),
            texto: s.status === 'falhou' ? `O teste para o grupo falhou: ${s.erro ?? 'sem detalhe'}` : 'Teste enviado para o grupo. Confira no WhatsApp.',
            tom: s.status === 'falhou' ? 'erro' : 'sucesso',
          });
          return;
        }
      }
      avisar({ id: Date.now(), texto: 'O teste ainda está na fila. Confira se o script da VPS está rodando.', tom: 'erro' });
    } catch (e) {
      avisar({ id: Date.now(), texto: e instanceof Error ? e.message : 'Não consegui enviar o teste.', tom: 'erro' });
    } finally {
      setTestando('');
    }
  };

  return (
    <GlassCard className="gap-4">
      <SectionHeader icon={Users} tone="from-teal-500 to-emerald-600 shadow-teal-500/25" title="Grupo da equipe" subtitle="Fechamento do dia, resumos de reunião e avisos" />
      <div>
        <label className={ROTULO} htmlFor="eva-grupo">Grupo no WhatsApp</label>
        <select id="eva-grupo" className={CAMPO} value={escolhido} disabled={salvando || !c} onChange={(e) => escolher(e.target.value)}>
          <option value="">Nenhum</option>
          {opcoes.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] text-slate-400">
            {c?.waha_grupos_em ? `Lista lida da VPS: ${quando(c.waha_grupos_em)}` : 'A VPS ainda não leu a lista de grupos.'}
          </p>
          <button type="button" className={`${BOTAO_SECUNDARIO} !px-2.5 !py-1 !text-xs`} disabled={salvando || !c} onClick={() => void atualizarLista()}>
            <RefreshCw className="w-3 h-3" /> Atualizar lista
          </button>
        </div>
        {grupos.length === 0 && (
          <p className="mt-1 text-[11px] text-slate-400">O número da EVA precisa estar no grupo. A lista aparece quando a VPS a lê do WAHA, a cada 30 minutos.</p>
        )}
      </div>

      {[
        { campo: 'fechamento_diario_ativo' as const, titulo: 'Fechamento do dia', texto: 'Dias úteis, às 18h: o que foi concluído hoje, o que está atrasado e o que vence até o próximo dia útil.' },
        { campo: 'resumo_reuniao_grupo_ativo' as const, titulo: 'Resumo das reuniões', texto: 'Ao terminar a análise: as principais decisões e quantas sugestões aguardam aprovação.' },
      ].map((t) => (
        <label key={t.campo} className={`${LINHA} flex items-center justify-between gap-3 ${temGrupo ? 'cursor-pointer' : 'opacity-60'}`}>
          <span>
            <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">{t.titulo}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">{t.texto}</span>
          </span>
          <input
            type="checkbox"
            className="w-5 h-5"
            checked={!!c?.[t.campo]}
            disabled={salvando || !c || !temGrupo}
            onChange={(e) => void salvar({ [t.campo]: e.target.checked }, `${t.titulo} ${e.target.checked ? 'ligado' : 'desligado'}.`)}
          />
        </label>
      ))}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className={BOTAO_SECUNDARIO} disabled={!temGrupo || !c?.whatsapp_ativo || !!testando} onClick={() => void enviarTeste()}>
          <Send className="w-3.5 h-3.5" /> {testando || 'Enviar teste ao grupo'}
        </button>
        {temGrupo && !c?.whatsapp_ativo && <span className="text-[11px] text-slate-400">Ligue o envio de WhatsApp para testar.</span>}
      </div>

      <div className={`${LINHA} text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-1`}>
        <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Comandos pelo WhatsApp</p>
        <p>Qualquer membro: responder sobre os próprios cards ("IT-045 concluída", "IT-052 vai para sexta") e fazer perguntas ("o que vence esta semana?").</p>
        <p>
          Gestores: "cobra o IT-045" ou "cobra a Ana"; "sugestões pendentes", depois "aprovar 1 e 3" ou "rejeitar 2 motivo"; "avisa no grupo que …".
          Antes de executar, a EVA mostra o que vai fazer e pede SIM (vale por 30 min).
        </p>
        <p className="text-[11px] text-slate-400">Para usar, a pessoa precisa estar na aba Membros com o WhatsApp cadastrado. As mensagens do grupo seguem o horário das cobranças.</p>
      </div>
    </GlassCard>
  );
};

export default GrupoEquipeCard;
