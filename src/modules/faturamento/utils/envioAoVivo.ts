// Revalidação ao vivo do `dataEnvio` de um lote (issue 15 do feedback do setor).
//
// `dataEnvio` do título vem de um snapshot gravado uma única vez, na criação
// (fat_criar_titulo). Se o título nasceu antes do apLIS preencher DtaEnvio —
// comum, já que o envio costuma acontecer depois do lote fechado — o snapshot
// fica desatualizado pra sempre. Esta função decide, na exibição, se usa o
// valor ao vivo (consultado direto no apLIS, ver api/faturamento/titulo-lotes-envio)
// ou cai de volta pro snapshot.

import type { TituloLote } from '../types';

/**
 * `envios` mapeia aplisId → DtaEnvio ao vivo (null quando o apLIS confirma que
 * o lote ainda não tem envio). É `null` inteiro quando a consulta ao vivo
 * ainda não voltou ou falhou (túnel fora do ar, lote não encontrado) — nesse
 * caso a tela não pode quebrar nem inventar dado: cai pro snapshot.
 */
export function dataEnvioEfetiva(
  lote: Pick<TituloLote, 'aplisId' | 'dataEnvio'>,
  envios: Record<string, string | null> | null,
): string | null {
  if (!envios || !lote.aplisId || !(lote.aplisId in envios)) return lote.dataEnvio;
  return envios[lote.aplisId];
}
