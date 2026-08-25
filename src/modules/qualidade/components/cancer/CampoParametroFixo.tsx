import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChaveParametroFixoCancer, ParametrosFixosCancerDTO } from '../../types';
import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { atualizarParametroFixoCancer } from '../../cancer.js';

interface CampoParametroFixoProps {
  chave: ChaveParametroFixoCancer;
  rotulo: string;
  valorAtual: string;
  canManage: boolean;
}

const campoInput = 'glass-field w-full rounded-lg px-2 py-1 text-sm text-slate-800 dark:text-slate-200';

/**
 * Campo institucional "fixo" (Fonte, Cor, Região administrativa etc.) —
 * raramente muda, mas não é hardcoded (P5): fica em `qa_parametros`, não
 * numa coluna por caso. Por isso editar aqui, a partir de QUALQUER caso,
 * muda o valor para TODOS os casos do módulo — daí o passo de confirmação
 * explícita antes de gravar, em vez de salvar direto ao sair do campo.
 */
export function CampoParametroFixo({ chave, rotulo, valorAtual, canManage }: CampoParametroFixoProps) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [valor, setValor] = useState(valorAtual);

  const mutation = useMutation({
    mutationFn: () => atualizarParametroFixoCancer({ chave, valor }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cancer-funil'] });
      setEditando(false);
      setConfirmando(false);
    },
  });

  if (confirmando) {
    return (
      <div className="rounded-lg bg-amber-50 p-2 text-xs dark:bg-amber-900/20">
        <p className="text-amber-800 dark:text-amber-300">
          Alterar <strong>{rotulo}</strong> de <strong>{valorAtual || '—'}</strong> para <strong>{valor}</strong> — vale
          para todos os casos do módulo, não só este. Confirma?
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={mutation.isPending || !canManage}
            onClick={() => mutation.mutate()}
            className="flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <Check className="h-3 w-3" aria-hidden />
            {mutation.isPending ? 'Salvando…' : 'Confirmar'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="rounded-lg bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-slate-300"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (editando) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-40 shrink-0 text-xs text-gray-500 dark:text-slate-400">{rotulo}</span>
        <input
          autoFocus
          className={campoInput}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditando(false);
          }}
        />
        <button
          type="button"
          title="Salvar"
          disabled={!canManage || !valor || valor === valorAtual}
          onClick={() => setConfirmando(true)}
          className="shrink-0 rounded-full p-1 text-blue-600 hover:bg-blue-50 disabled:opacity-30 dark:text-blue-400 dark:hover:bg-blue-900/20"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          title="Cancelar"
          onClick={() => {
            setValor(valorAtual);
            setEditando(false);
          }}
          className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-0.5">
        <span className="text-xs text-gray-500 dark:text-slate-400">{rotulo}</span>
        <span className="text-sm text-slate-700 dark:text-slate-200">{valorAtual || '—'}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValor(valorAtual);
        setEditando(true);
      }}
      className="group flex w-full items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-gray-50 dark:hover:bg-white/5"
    >
      <span className="text-xs text-gray-500 dark:text-slate-400">{rotulo}</span>
      <span className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-200">
        {valorAtual || '—'}
        <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 dark:text-slate-600" aria-hidden />
      </span>
    </button>
  );
}

export const ROTULOS_PARAMETRO_FIXO: Record<ChaveParametroFixoCancer, string> = {
  cnes: 'CNES',
  fonte: 'Fonte',
  cor_ignorado: 'Cor',
  endereco_codigo: 'Endereço',
  regiao_administrativa: 'Região administrativa',
  municipio: 'Município de residência',
  estado: 'Estado de residência',
  naturalidade_fixa: 'Naturalidade',
  nacionalidade_fixa: 'Nacionalidade',
  profissao_codigo: 'Profissão',
  meio_diagnostico: 'Meio diagnóstico',
  extensao: 'Extensão',
  caso_raro: 'Caso raro',
  estado_civil_ignorado: 'Estado civil',
  escolaridade_ignorado: 'Escolaridade',
};

/** Ordem de exibição — segue a ordem das colunas do layout RHC em `Positivos_Cancer.csv`. */
export const ORDEM_PARAMETRO_FIXO: ChaveParametroFixoCancer[] = [
  'cnes',
  'fonte',
  'cor_ignorado',
  'endereco_codigo',
  'regiao_administrativa',
  'municipio',
  'estado',
  'naturalidade_fixa',
  'nacionalidade_fixa',
  'profissao_codigo',
  'meio_diagnostico',
  'extensao',
  'caso_raro',
  'estado_civil_ignorado',
  'escolaridade_ignorado',
];

export function valorDoParametroFixo(fixos: ParametrosFixosCancerDTO, chave: ChaveParametroFixoCancer): string {
  const mapa: Record<ChaveParametroFixoCancer, string> = {
    cnes: fixos.cnes,
    fonte: fixos.fonte,
    cor_ignorado: fixos.corIgnorado,
    endereco_codigo: fixos.enderecoCodigo,
    regiao_administrativa: fixos.regiaoAdministrativa,
    municipio: fixos.municipio,
    estado: fixos.estado,
    naturalidade_fixa: fixos.naturalidadeFixa,
    nacionalidade_fixa: fixos.nacionalidadeFixa,
    profissao_codigo: fixos.profissaoCodigo,
    meio_diagnostico: fixos.meioDiagnostico,
    extensao: fixos.extensao,
    caso_raro: fixos.casoRaro,
    estado_civil_ignorado: fixos.estadoCivilIgnorado,
    escolaridade_ignorado: fixos.escolaridadeIgnorado,
  };
  return mapa[chave];
}
