// Fábricas de dados fictícios para os testes do domínio da EVA.
import type { CardTI } from '../demandas';
import type { ProjetoTI, SprintTI } from '../projetos';

let seq = 0;

export function card(parcial: Partial<CardTI> = {}): CardTI {
  seq += 1;
  return {
    id: `c${seq}`,
    codigo: `IT-${String(seq).padStart(3, '0')}`,
    title: `Card ${seq}`,
    priority: 'medium',
    status: 'pending',
    kanban_status: 'todo',
    assigned_to: [],
    due_date: null,
    kanban_hidden: false,
    project_id: null,
    sprint_id: null,
    updated_at: '2026-10-13T12:00:00Z',
    created_at: '2026-10-01T12:00:00Z',
    ...parcial,
  };
}

export function projeto(parcial: Partial<ProjetoTI> = {}): ProjetoTI {
  seq += 1;
  return { id: `p${seq}`, name: `Projeto ${seq}`, color: '#3b82f6', ...parcial };
}

export function sprint(parcial: Partial<SprintTI> = {}): SprintTI {
  seq += 1;
  return {
    id: `s${seq}`,
    project_id: 'p0',
    name: `Sprint ${seq}`,
    start_date: null,
    end_date: null,
    status: 'active',
    ...parcial,
  };
}
