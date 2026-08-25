// api/_lib/qualidade/cancerConsulta.ts
// Leituras Supabase compartilhadas por buscar-funil-cancer.ts e
// buscar-detalhe-cancer.ts — parâmetros fixos do RHC (`qa_parametros`,
// módulo `cancer`) e catálogo CID-O (`qa_cido_catalogo`). Mesma transformação
// de src/modules/qualidade/cancer.ts (`buscarParametrosFixosCancer`), só que
// server-side com o client service_role.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { EntradaCatalogoCido } from './cancerRegras.js';

export interface ParametrosFixosCancer {
  cnes: string;
  fonte: string;
  regiaoAdministrativa: string;
  municipio: string;
  estado: string;
  naturalidadeFixa: string;
  nacionalidadeFixa: string;
  corIgnorado: string;
  enderecoCodigo: string;
  profissaoCodigo: string;
  meioDiagnostico: string;
  extensao: string;
  casoRaro: string;
  estadoCivilIgnorado: string;
  escolaridadeIgnorado: string;
}

export async function carregarParametrosFixosCancer(supabase: SupabaseClient): Promise<ParametrosFixosCancer> {
  const { data } = await supabase.from('qa_parametros').select('chave, valor').eq('modulo', 'cancer');
  const porChave = new Map(((data ?? []) as { chave: string; valor: unknown }[]).map((l) => [String(l.chave).replace('cancer.', ''), l.valor]));
  const texto = (chave: string) => String(porChave.get(chave) ?? '');

  return {
    cnes: texto('cnes'),
    fonte: texto('fonte'),
    regiaoAdministrativa: texto('regiao_administrativa'),
    municipio: texto('municipio'),
    estado: texto('estado'),
    naturalidadeFixa: texto('naturalidade_fixa'),
    nacionalidadeFixa: texto('nacionalidade_fixa'),
    corIgnorado: texto('cor_ignorado'),
    enderecoCodigo: texto('endereco_codigo'),
    profissaoCodigo: texto('profissao_codigo'),
    meioDiagnostico: texto('meio_diagnostico'),
    extensao: texto('extensao'),
    casoRaro: texto('caso_raro'),
    estadoCivilIgnorado: texto('estado_civil_ignorado'),
    escolaridadeIgnorado: texto('escolaridade_ignorado'),
  };
}

export async function carregarCatalogoCido(
  supabase: SupabaseClient,
  tipo: 'topografia' | 'morfologia',
): Promise<EntradaCatalogoCido[]> {
  const { data } = await supabase.from('qa_cido_catalogo').select('codigo, descricao').eq('tipo', tipo).eq('ativo', true);
  return (data ?? []) as EntradaCatalogoCido[];
}
