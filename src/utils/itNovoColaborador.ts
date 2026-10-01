// ─── Chamado de TI "Novo colaborador" ────────────────────────────────────────
// Pedido de acesso de quem está entrando no laboratório (conta no FlowLab,
// e-mail/alias do setor, apLIS). Os campos não têm coluna própria: o formulário
// é montado num texto padronizado em it_requests.description, e o título é
// gerado a partir do nome. O CPF fica protegido pelo RLS de SELECT do chamado
// (só solicitante e TI leem chamados desse tipo).

import { DepartmentLabels, type Department } from '../types';
import { formatCPF, validateCPF } from './cpf';

export const NOVO_COLABORADOR_TYPE = 'novo_colaborador';

export interface NovoColaboradorForm {
  nomeCompleto: string;
  cpf: string;
  emailContato: string;
  setor: Department | 'OUTRO' | '';
  setorOutro: string;
  cargo: string;
  atribuicoesAplis: string;
  caixaEmailPropria: boolean;
}

export type NovoColaboradorErros = Partial<Record<keyof NovoColaboradorForm, string>>;

export const NOVO_COLABORADOR_VAZIO: NovoColaboradorForm = {
  nomeCompleto: '',
  cpf: '',
  emailContato: '',
  setor: '',
  setorOutro: '',
  cargo: '',
  atribuicoesAplis: '',
  caixaEmailPropria: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarNovoColaborador(form: NovoColaboradorForm): NovoColaboradorErros {
  const erros: NovoColaboradorErros = {};
  if (!form.nomeCompleto.trim()) erros.nomeCompleto = 'Informe o nome completo.';
  if (!form.cpf.trim()) erros.cpf = 'Informe o CPF.';
  else if (!validateCPF(form.cpf)) erros.cpf = 'CPF inválido.';
  if (!form.emailContato.trim()) erros.emailContato = 'Informe o e-mail de contato.';
  else if (!EMAIL_RE.test(form.emailContato.trim())) erros.emailContato = 'E-mail inválido.';
  if (!form.setor) erros.setor = 'Selecione o setor.';
  else if (form.setor === 'OUTRO' && !form.setorOutro.trim()) erros.setorOutro = 'Informe o setor.';
  if (!form.cargo.trim()) erros.cargo = 'Informe o cargo/função.';
  if (!form.atribuicoesAplis.trim()) erros.atribuicoesAplis = 'Descreva as atribuições no apLIS.';
  return erros;
}

export function montarTituloNovoColaborador(form: NovoColaboradorForm): string {
  return `Novo colaborador — ${form.nomeCompleto.trim()}`;
}

function rotuloSetor(form: NovoColaboradorForm): string {
  if (form.setor === 'OUTRO') return form.setorOutro.trim();
  return form.setor ? DepartmentLabels[form.setor] : '';
}

export function montarDescricaoNovoColaborador(form: NovoColaboradorForm): string {
  return [
    '**Novo colaborador**',
    `Nome completo: ${form.nomeCompleto.trim()}`,
    `CPF: ${formatCPF(form.cpf)}`,
    `E-mail de contato: ${form.emailContato.trim()}`,
    `Setor: ${rotuloSetor(form)}`,
    `Cargo/função: ${form.cargo.trim()}`,
    `Caixa de e-mail própria: ${form.caixaEmailPropria ? 'Sim' : 'Não (alias do setor)'}`,
    '',
    'Atribuições no apLIS:',
    form.atribuicoesAplis.trim(),
  ].join('\n');
}
