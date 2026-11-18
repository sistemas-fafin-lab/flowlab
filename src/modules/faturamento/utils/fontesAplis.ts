// De onde veio o recebido do apLIS nas telas de conferência e de baixas
// (.scratch/faturamento-recebidos-aplis-site): retrato lido no site (principal)
// e banco de backup (reserva).

import type { FontesAplis } from '../types';
import { formatData, formatDataHora } from './formato';

/** `meta` das rotas (titulos-conferencia-aplis, titulos-baixas-aplis-previa). */
export function fontesDaMeta(meta: Partial<FontesAplis> | undefined): FontesAplis {
  return {
    dadoAte: meta?.dadoAte ?? null,
    retratoSiteEm: meta?.retratoSiteEm ?? null,
    bancoIndisponivel: Boolean(meta?.bancoIndisponivel),
    lotesDoSite: Number(meta?.lotesDoSite ?? 0),
    titulosSemFonte: Number(meta?.titulosSemFonte ?? 0),
  };
}

/** "site do apLIS em 18/11/2026, 07:12 · banco até 16/11/2026" */
export function textoFontesAplis(f: FontesAplis | null | undefined): string {
  if (!f) return 'dados do apLIS';
  const partes: string[] = [];
  if (f.retratoSiteEm) partes.push(`site do apLIS em ${formatDataHora(f.retratoSiteEm)}`);
  partes.push(f.bancoIndisponivel ? 'banco de backup fora do ar' : `banco até ${f.dadoAte ? formatData(f.dadoAte) : '—'}`);
  return partes.join(' · ');
}

/** Aviso para a tela, ou null quando está tudo coberto. */
export function avisoFontesAplis(f: FontesAplis | null | undefined): string | null {
  if (!f) return null;
  if (f.titulosSemFonte > 0) {
    const n = f.titulosSemFonte;
    return `O banco de backup do apLIS está fora do ar e ${n} ${n === 1 ? 'título ficou' : 'títulos ficaram'} de fora `
      + '(lote ainda não lido no site). Use "Buscar no apLIS agora" ou tente mais tarde.';
  }
  if (!f.retratoSiteEm) {
    return 'O site do apLIS ainda não foi lido: os valores vêm só do banco de backup, que atrasa cerca de 1 dia. '
      + 'Use "Buscar no apLIS agora" para trazer as baixas de hoje.';
  }
  return null;
}
