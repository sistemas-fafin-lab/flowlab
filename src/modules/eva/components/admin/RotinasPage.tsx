import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import EvaAdminShell from './EvaAdminShell';
import EvaModal from './EvaModal';
import Switch from '../../../../components/Switch';
import Select from '../../../../components/Select';
import MultiSelect from '../../../../components/MultiSelect';
import DatePicker from '../../../../components/DatePicker';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import { GlassCard, SectionHeader, StatusBadge } from '../ui';
import { EvaToast } from '../EvaToast';
import { usePapeisEva, usePessoas, useProjetosESprints, useResponsaveis, useRotinas } from '../../hooks/useAgenteAdmin';
import { agenteAdmin, type RotinaEva } from '../../services/agenteAdmin';
import type { AvisoEva } from '../../hooks/useEvaHome';
import { PRIORITY_CONFIG } from '../../constants';
import { formatarDiaMes, hojeSP } from '../../domain/datas';
import { ANTECEDENCIA_PADRAO, FREQUENCIAS, MAX_ANTECEDENCIA, descreverRotina, diaDeCriar, validarRotina, type Frequencia } from '../../domain/rotinas';
import { BOTAO_PERIGO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, LINHA, ROTULO } from './estilos';

interface Formulario {
  titulo: string;
  descricao: string;
  frequencia: Frequencia;
  proxima_em: string;
  antecedencia_dias: number;
  responsaveis: string[];
  prioridade: string;
  projeto_id: string;
}

const VAZIO: Formulario = {
  titulo: '', descricao: '', frequencia: 'mensal', proxima_em: '', antecedencia_dias: ANTECEDENCIA_PADRAO, responsaveis: [], prioridade: 'medium', projeto_id: '',
};
const OPCOES_FREQUENCIA = FREQUENCIAS.map((f) => ({ value: f.valor, label: f.rotulo }));
const OPCOES_PRIORIDADE = Object.entries(PRIORITY_CONFIG).map(([value, c]) => ({ value, label: c.label }));
const quandoFoi = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** "sai em 02/12", "sai hoje" (o relógio cria em até 10 min). */
function quandoSai(proxima: string, antecedencia: number, hoje: string): string {
  const dia = diaDeCriar({ antecedencia_dias: antecedencia }, proxima);
  return dia <= hoje ? 'sai hoje' : `sai em ${formatarDiaMes(dia)}`;
}

/** /it/eva/rotinas — rotinas sem custo que viram card sozinhas (D50, issue 36). */
const RotinasPage: React.FC = () => {
  const rotinas = useRotinas();
  const pessoas = usePessoas();
  const responsaveis = useResponsaveis();
  const projetos = useProjetosESprints();
  const { gestor, configura } = usePapeisEva();
  const podeEditar = gestor || configura;
  const hoje = hojeSP();

  const [editando, setEditando] = useState<{ id: string | null; form: Formulario } | null>(null);
  const [excluindo, setExcluindo] = useState<RotinaEva | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<AvisoEva | null>(null);

  const avisar = (texto: string, tom: AvisoEva['tom'] = 'sucesso') => setAviso({ id: Date.now(), texto, tom });
  const executar = async (fn: () => Promise<void>, ok: string) => {
    setSalvando(true);
    try {
      await fn();
      avisar(ok);
      await rotinas.recarregar();
      return true;
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não consegui salvar.', 'erro');
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const form = editando?.form ?? VAZIO;
  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setEditando((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));
  const validada = useMemo(() => validarRotina({ ...form, projeto_id: form.projeto_id || null }, hoje), [form, hoje]);

  const opcoesPessoas = [
    ...responsaveis.map((x) => ({ value: x.id, label: x.name, description: x.department || undefined })),
    ...form.responsaveis.filter((id) => !responsaveis.some((x) => x.id === id)).map((id) => ({ value: id, label: pessoas.nome(id) })),
  ];
  const opcoesProjeto = [{ value: '', label: 'Sem projeto' }, ...(projetos.dados?.projetos ?? []).map((p) => ({ value: p.id, label: p.name }))];
  const nomes = (ids: string[]) => (ids.length ? ids.map((id) => pessoas.nome(id)).join(', ') : 'Sem responsável');

  const salvar = async () => {
    if (!editando || 'erro' in validada) return;
    const { rotina } = validada;
    const ok = await executar(() => agenteAdmin.salvarRotina(editando.id, rotina), editando.id ? 'Rotina salva.' : 'Rotina criada.');
    if (ok) setEditando(null);
  };

  return (
    <EvaAdminShell
      subtitulo="Rotinas que viram card sozinhas"
      acoes={podeEditar && (
        <button type="button" className={BOTAO_PRIMARIO} onClick={() => setEditando({ id: null, form: VAZIO })}>
          <Plus className="w-4 h-4" aria-hidden /> Nova rotina
        </button>
      )}
    >
      <GlassCard className="gap-4">
        <SectionHeader icon={Repeat} tone="from-teal-500 to-emerald-600 shadow-teal-500/25" title="Rotinas" subtitle="Backup, revisão de acessos e o que mais se repete sem custo" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Alguns dias antes de cada data, a EVA cria o card no Kanban, com os responsáveis e o prazo, e já marca a próxima data. Licenças, contratos e
          certificados com custo ficam no Gastos de TI: a EVA avisa antes de cada renovação.
        </p>
        {rotinas.erro && <p className="text-sm text-red-600 dark:text-red-400">Não consegui carregar as rotinas: {rotinas.erro}</p>}
        {!rotinas.carregando && !rotinas.erro && (rotinas.dados ?? []).length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma rotina ainda. {podeEditar ? 'Comece pela que mais se esquece, como o backup do mês.' : ''}</p>
        )}
        <div className="flex flex-col gap-2">
          {(rotinas.dados ?? []).map((r) => (
            <div key={r.id} className={`${LINHA} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
              <div className="min-w-0 flex flex-col gap-0.5">
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100 [overflow-wrap:anywhere]">
                  {r.titulo}
                  {!r.ativa && <StatusBadge tone="neutral">Pausada</StatusBadge>}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {descreverRotina(r)} · próximo card vence {formatarDiaMes(r.proxima_em)}
                  {r.ativa ? ` e ${quandoSai(r.proxima_em, r.antecedencia_dias, hoje)}` : ''}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {nomes(r.responsaveis)} · prioridade {PRIORITY_CONFIG[r.prioridade]?.label.toLowerCase() ?? r.prioridade}
                </p>
                {r.ultimo_card && r.ultima_criacao_em && (
                  <p className="text-[11px] text-slate-400">Último card: {r.ultimo_card.codigo}, criado em {quandoFoi(r.ultima_criacao_em)}</p>
                )}
                {r.ultimo_erro && <p className="text-[11px] text-red-600 dark:text-red-400 [overflow-wrap:anywhere]">{r.ultimo_erro}</p>}
              </div>
              {podeEditar && (
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={r.ativa}
                    disabled={salvando}
                    ariaLabel={`${r.ativa ? 'Pausar' : 'Retomar'} a rotina ${r.titulo}`}
                    title={r.ativa ? 'Pausar' : 'Retomar'}
                    onChange={(v) => void executar(() => agenteAdmin.ativarRotina(r.id, v), v ? 'Rotina retomada.' : 'Rotina pausada.')}
                  />
                  <button
                    type="button"
                    className={BOTAO_SECUNDARIO}
                    disabled={salvando}
                    onClick={() => setEditando({
                      id: r.id,
                      form: {
                        titulo: r.titulo, descricao: r.descricao ?? '', frequencia: r.frequencia, proxima_em: r.proxima_em, antecedencia_dias: r.antecedencia_dias,
                        responsaveis: r.responsaveis, prioridade: r.prioridade, projeto_id: r.projeto_id ?? '',
                      },
                    })}
                  >
                    <Pencil className="w-4 h-4" aria-hidden /> Editar
                  </button>
                  <button type="button" className={BOTAO_PERIGO} disabled={salvando} aria-label={`Excluir a rotina ${r.titulo}`} onClick={() => setExcluindo(r)}>
                    <Trash2 className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      <EvaModal
        aberto={!!editando}
        titulo={editando?.id ? 'Editar rotina' : 'Nova rotina'}
        subtitulo="O card sai sozinho, com estes dados, alguns dias antes de cada data."
        onFechar={() => setEditando(null)}
        largura="max-w-xl"
        rodape={
          <>
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setEditando(null)} disabled={salvando}>Cancelar</button>
            <button type="button" className={BOTAO_PRIMARIO} onClick={() => void salvar()} disabled={salvando || !validada.ok}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className={ROTULO} htmlFor="rotina-titulo">Título do card</label>
            <input id="rotina-titulo" className={CAMPO} value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex.: Backup mensal do servidor de arquivos" />
          </div>
          <div>
            <label className={ROTULO} htmlFor="rotina-descricao">Descrição (opcional)</label>
            <textarea id="rotina-descricao" rows={3} className={CAMPO} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="O passo a passo ou o que conferir" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={ROTULO}>Frequência</span>
              <Select tone="vidro" value={form.frequencia} onChange={(v) => set('frequencia', v as Frequencia)} options={OPCOES_FREQUENCIA} controlClass={CAMPO} ariaLabel="Frequência" />
            </div>
            <div>
              <span className={ROTULO}>Prazo do próximo card</span>
              <DatePicker tone="vidro" value={form.proxima_em} onChange={(v) => set('proxima_em', v)} controlClass={CAMPO} ariaLabel="Prazo do próximo card" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={ROTULO} htmlFor="rotina-antecedencia">Criar o card quantos dias antes</label>
              <input
                id="rotina-antecedencia"
                type="number"
                min={0}
                max={MAX_ANTECEDENCIA}
                className={CAMPO}
                value={form.antecedencia_dias}
                onChange={(e) => set('antecedencia_dias', Number(e.target.value))}
              />
            </div>
            <div>
              <span className={ROTULO}>Prioridade</span>
              <Select tone="vidro" value={form.prioridade} onChange={(v) => set('prioridade', v)} options={OPCOES_PRIORIDADE} controlClass={CAMPO} ariaLabel="Prioridade" />
            </div>
          </div>
          <div>
            <span className={ROTULO}>Responsáveis</span>
            <MultiSelect
              tone="vidro"
              value={form.responsaveis}
              onChange={(v) => set('responsaveis', v)}
              options={opcoesPessoas}
              placeholder="Ninguém ainda"
              searchPlaceholder="Buscar nome ou departamento"
              emptyText="Ninguém com esse nome."
              controlClass={`${CAMPO} min-h-[38px] !py-1.5`}
              ariaLabel="Responsáveis"
            />
          </div>
          <div>
            <span className={ROTULO}>Projeto (opcional)</span>
            <Select
              tone="vidro"
              value={form.projeto_id}
              onChange={(v) => set('projeto_id', v)}
              options={opcoesProjeto}
              searchable
              searchPlaceholder="Buscar projeto"
              emptyText="Nenhum projeto com esse nome."
              controlClass={CAMPO}
              ariaLabel="Projeto"
            />
          </div>
          <p className={`text-xs ${'erro' in validada ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`} aria-live="polite">
            {'erro' in validada
              ? validada.erro
              : `O card de ${formatarDiaMes(validada.rotina.proxima_em)} ${quandoSai(validada.rotina.proxima_em, validada.rotina.antecedencia_dias, hoje)}; depois, ${descreverRotina(validada.rotina).toLowerCase()}.`}
          </p>
        </div>
      </EvaModal>

      <ConfirmDialog
        isOpen={!!excluindo}
        title="Excluir rotina"
        message={excluindo ? `A rotina "${excluindo.titulo}" para de criar cards. Os cards que ela já criou continuam no Kanban.` : ''}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
        onCancel={() => setExcluindo(null)}
        onConfirm={() => {
          const alvo = excluindo;
          setExcluindo(null);
          if (alvo) void executar(() => agenteAdmin.excluirRotina(alvo.id), 'Rotina excluída.');
        }}
      />

      <EvaToast aviso={aviso} onClose={() => setAviso(null)} />
    </EvaAdminShell>
  );
};

export default RotinasPage;
