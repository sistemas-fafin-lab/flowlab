// Chips do Início (§12.1, D25): Granola e Wa-ha a partir de ti_agente_config e, para
// os gestores, as sugestões que esperam aprovação. Puro, sem IA.
import type { IntegrationStatus } from '../types';

export interface ConfigIntegracoes {
  granola_folder_id: string | null;
  /** Fim da última sincronização sem erro (não o cursor `granola_ultima_sync_em`). */
  granola_verificado_em: string | null;
  granola_ultimo_erro: string | null;
  waha_status: string | null;
  waha_verificado_em: string | null;
}

/** O cron roda nos dias úteis; mais de 4 dias sem sincronizar quer dizer que parou. */
export const GRANOLA_PAROU_MS = 4 * 86_400_000;
/** O script da VPS avisa a cada execução; 5 minutos sem aviso é "sem sinal" (igual a Configurações). */
export const WAHA_SEM_SINAL_MS = 5 * 60_000;

const quando = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso))
    .replace(',', ' às');

function granola(cfg: ConfigIntegracoes | null, agora: number): IntegrationStatus {
  const base = { id: 'granola' as const, name: 'Granola' };
  if (!cfg || !cfg.granola_folder_id) return { ...base, detail: 'ainda não configurado', state: 'pending' };
  if (cfg.granola_ultimo_erro) return { ...base, detail: 'erro na última sincronização', state: 'offline' };
  if (!cfg.granola_verificado_em) return { ...base, detail: 'aguardando a 1ª sincronização', state: 'pending' };
  const parou = agora - new Date(cfg.granola_verificado_em).getTime() > GRANOLA_PAROU_MS;
  return { ...base, detail: `${parou ? 'sem sincronizar desde' : 'sincronizado'} ${quando(cfg.granola_verificado_em)}`, state: parou ? 'offline' : 'online' };
}

function waha(cfg: ConfigIntegracoes | null, agora: number): IntegrationStatus {
  const base = { id: 'waha' as const, name: 'Wa-ha' };
  if (!cfg?.waha_verificado_em) return { ...base, detail: 'ainda não configurado', state: 'pending' };
  if (agora - new Date(cfg.waha_verificado_em).getTime() > WAHA_SEM_SINAL_MS) return { ...base, detail: 'sem sinal da VPS', state: 'offline' };
  if (cfg.waha_status === 'WORKING') return { ...base, detail: 'conectado', state: 'online' };
  // O script da VPS grava INACESSIVEL quando nem o WAHA responde (api/_lib/ti-agente/outbox.ts).
  if (cfg.waha_status === 'INACESSIVEL') return { ...base, detail: 'fora do ar', state: 'offline' };
  if (cfg.waha_status === 'SCAN_QR_CODE') return { ...base, detail: 'aguardando o QR code', state: 'offline' };
  if (cfg.waha_status === 'STARTING') return { ...base, detail: 'iniciando', state: 'pending' };
  return { ...base, detail: 'desconectado', state: 'offline' };
}

/** `pendentes` só conta para gestor (D25): para os demais, o chip não aparece. */
export function montarIntegracoes(cfg: ConfigIntegracoes | null, pendentes: number | null, ehGestor: boolean, agora = Date.now()): IntegrationStatus[] {
  const chips = [granola(cfg, agora), waha(cfg, agora)];
  if (ehGestor && pendentes && pendentes > 0) {
    chips.push({
      id: 'sugestoes',
      name: `${pendentes} ${pendentes === 1 ? 'sugestão' : 'sugestões'}`,
      detail: 'aguardando',
      state: 'attention',
      href: '/it/eva',
    });
  }
  return chips;
}
