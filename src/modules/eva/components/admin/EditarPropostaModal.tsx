import React, { useEffect, useState } from 'react';
import Select from '../../../../components/Select';
import DatePicker from '../../../../components/DatePicker';
import { KANBAN_STATUS_LABELS, PRIORITY_CONFIG } from '../../constants';
import type { Pessoa, PropostaCard, TipoSugestao } from '../../services/agenteAdmin';
import EvaModal from './EvaModal';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, ROTULO } from './estilos';

interface Props {
  aberto: boolean;
  tipo: TipoSugestao;
  proposta: PropostaCard;
  /** Quem pode ser responsável (os membros da EVA). */
  pessoas: Pessoa[];
  /** Projetos e sprints ativas/planejadas, para o card novo. */
  projetos?: { id: string; name: string }[];
  sprints?: { id: string; project_id: string; name: string; status: string }[];
  salvando: boolean;
  onCancelar: () => void;
  /** Recebe a proposta editada; quem chama aprova com ela. */
  onAprovar: (p: PropostaCard) => void;
}

const COLUNAS = Object.entries(KANBAN_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const PRIORIDADES = Object.entries(PRIORITY_CONFIG).map(([value, c]) => ({ value, label: c.label }));

/** Gestor ajusta a proposta antes de aprovar (RF14). Só os campos que o tipo usa aparecem. */
const EditarPropostaModal: React.FC<Props> = ({ aberto, tipo, proposta, pessoas, projetos = [], sprints = [], salvando, onCancelar, onAprovar }) => {
  const [p, setP] = useState<PropostaCard>(proposta);
  useEffect(() => { if (aberto) setP(proposta); }, [aberto, proposta]);

  const set = <K extends keyof PropostaCard>(k: K, v: PropostaCard[K]) => setP((x) => ({ ...x, [k]: v }));
  // Quem a IA já escolheu continua na lista, mesmo se saiu dos membros.
  const opcoesPessoas = [
    ...pessoas,
    ...(p.responsaveis ?? []).filter((id) => !pessoas.some((x) => x.id === id)).map((id) => ({ id, name: 'Fora dos membros' })),
  ];
  const opcoesProjeto = [{ value: '', label: 'Sem projeto' }, ...projetos.map((x) => ({ value: x.id, label: x.name }))];
  const opcoesSprint = [
    { value: '', label: 'Sem sprint' },
    ...sprints.filter((s) => s.project_id === p.projeto_id).map((s) => ({ value: s.id, label: `${s.name}${s.status === 'active' ? ' (ativa)' : ''}` })),
  ];
  const alternarPessoa = (id: string) =>
    set('responsaveis', (p.responsaveis ?? []).includes(id) ? (p.responsaveis ?? []).filter((x) => x !== id) : [...(p.responsaveis ?? []), id]);

  const ehCriar = tipo === 'criar_card';
  const mostra = (campo: keyof PropostaCard) => ehCriar || campo in proposta;
  const invalido = (ehCriar && !p.titulo?.trim()) || (tipo === 'comentar_card' && !p.comentario?.trim());

  return (
    <EvaModal
      aberto={aberto}
      titulo="Editar e aprovar"
      subtitulo="A EVA executa a proposta com os valores abaixo assim que você aprovar."
      onFechar={onCancelar}
      largura="max-w-xl"
      rodape={
        <>
          <button type="button" className={BOTAO_SECUNDARIO} onClick={onCancelar} disabled={salvando}>Cancelar</button>
          <button type="button" className={BOTAO_PRIMARIO} onClick={() => onAprovar(p)} disabled={salvando || invalido}>
            {salvando ? 'Executando…' : 'Aprovar e executar'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {ehCriar && (
          <>
            <div>
              <label className={ROTULO} htmlFor="eva-titulo">Título</label>
              <input id="eva-titulo" className={CAMPO} value={p.titulo ?? ''} onChange={(e) => set('titulo', e.target.value)} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="eva-descricao">Descrição</label>
              <textarea id="eva-descricao" rows={3} className={CAMPO} value={p.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} />
            </div>
          </>
        )}
        {mostra('kanban_status') && (
          <div>
            <span className={ROTULO}>Coluna</span>
            <Select tone="vidro" value={p.kanban_status ?? ''} onChange={(v) => set('kanban_status', v)} options={COLUNAS} controlClass={CAMPO} ariaLabel="Coluna" />
          </div>
        )}
        {mostra('prioridade') && (
          <div>
            <span className={ROTULO}>Prioridade</span>
            <Select tone="vidro" value={p.prioridade ?? ''} onChange={(v) => set('prioridade', v)} options={PRIORIDADES} controlClass={CAMPO} ariaLabel="Prioridade" />
          </div>
        )}
        {mostra('prazo') && (
          <div>
            <span className={ROTULO}>Prazo</span>
            <DatePicker tone="vidro" value={p.prazo ?? ''} onChange={(v) => set('prazo', v || null)} controlClass={CAMPO} allowClear ariaLabel="Prazo" />
          </div>
        )}
        {mostra('responsaveis') && (
          <div>
            <span className={ROTULO}>Responsáveis</span>
            <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
              {opcoesPessoas.map((pessoa) => {
                const marcado = (p.responsaveis ?? []).includes(pessoa.id);
                return (
                  <button
                    key={pessoa.id}
                    type="button"
                    onClick={() => alternarPessoa(pessoa.id)}
                    aria-pressed={marcado}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      marcado ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {pessoa.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {ehCriar && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={ROTULO}>Projeto</span>
              <Select
                tone="vidro"
                value={p.projeto_id ?? ''}
                onChange={(v) => setP((x) => ({ ...x, projeto_id: v || null, sprint_id: null }))}
                options={opcoesProjeto}
                controlClass={CAMPO}
                ariaLabel="Projeto"
              />
            </div>
            <div>
              <span className={ROTULO}>Sprint</span>
              <Select
                tone="vidro"
                value={p.sprint_id ?? ''}
                onChange={(v) => set('sprint_id', v || null)}
                options={opcoesSprint}
                controlClass={CAMPO}
                ariaLabel="Sprint"
                disabled={!p.projeto_id}
              />
            </div>
          </div>
        )}
        {(tipo === 'comentar_card' || 'comentario' in proposta) && (
          <div>
            <label className={ROTULO} htmlFor="eva-comentario">Comentário</label>
            <textarea id="eva-comentario" rows={3} className={CAMPO} value={p.comentario ?? ''} onChange={(e) => set('comentario', e.target.value)} />
          </div>
        )}
      </div>
    </EvaModal>
  );
};

export default EditarPropostaModal;
