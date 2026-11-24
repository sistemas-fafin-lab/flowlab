// Saúde das integrações da EVA (D39, issue 28): o que está quebrado agora, em português, para
// avisar quem configura. Mesmas regras dos chips do Início (integracoes.ts), com mais folga
// para a VPS (um reinício não vira aviso). Puro, sem imports: a api/ e o Início usam.

/** O cron roda nos dias úteis; mais de 4 dias sem sincronizar quer dizer que parou. */
export const GRANOLA_PAROU_MS = 4 * 86_400_000;
/** O script da VPS avisa a cada execução; 5 minutos sem aviso é "sem sinal" no chip. */
export const WAHA_SEM_SINAL_MS = 5 * 60_000;
/** Para avisar alguém, a VPS precisa estar sem sinal há mais tempo: um reinício não é problema. */
export const WAHA_AVISO_MS = 15 * 60_000;
/** A IA "fora" é: nas últimas 2 h, pelo menos 3 chamadas que falharam nos dois provedores e nenhuma que deu certo. */
export const IA_JANELA_MS = 2 * 60 * 60_000;
export const IA_FALHAS_PARA_AVISO = 3;

export type ChaveSaude = 'granola_erro' | 'granola_parou' | 'waha_sem_sinal' | 'waha_desconectado' | 'ia_fora';

export interface ProblemaSaude {
  chave: ChaveSaude;
  titulo: string;
  texto: string;
  /** false quando o problema é o próprio WhatsApp: aí o aviso vai só pelo sino. */
  whatsapp: boolean;
}

export interface EntradaSaude {
  agora: number;
  config: {
    whatsapp_ativo: boolean;
    granola_folder_id: string | null;
    granola_verificado_em: string | null;
    granola_ultimo_erro: string | null;
    waha_status: string | null;
    waha_verificado_em: string | null;
  };
  /** Chamadas de IA nas últimas 2 h: quantas deram certo, quantas falharam de vez, e o último erro. */
  ia: { ok: number; falhas: number; ultimoErro: string | null };
}

const quando = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso))
    .replace(',', ' às');

/** O erro do Granola como a pessoa entende e o que fazer. */
export function explicarErroGranola(erro: string): string {
  if (/SUBSCRIPTION_INACTIVE|subscription is not active|assinatura/i.test(erro)) {
    return 'A assinatura do workspace do Granola está inativa. Renove no Granola para a sincronização voltar.';
  }
  if (/inválida ou revogada|HTTP 401/i.test(erro)) {
    return 'O Granola recusou a chave (GRANOLA_API_KEY). Gere outra no Granola e troque na Vercel.';
  }
  if (/não tem acesso a esta pasta|HTTP 403/i.test(erro)) {
    return 'A chave do Granola não tem acesso à pasta escolhida. Confira a pasta em EVA → Configurações.';
  }
  if (/Pasta do Granola não configurada/i.test(erro)) return 'Nenhuma pasta do Granola escolhida (EVA → Configurações).';
  if (/GRANOLA_API_KEY não configurada/i.test(erro)) return 'A GRANOLA_API_KEY não está configurada na Vercel.';
  return `A última sincronização do Granola falhou: ${erro}`;
}

function explicarSessao(status: string): string {
  if (status === 'SCAN_QR_CODE') return 'A sessão do WhatsApp da EVA pede o QR code: conecte de novo pelo painel do WAHA.';
  if (status === 'INACESSIVEL') return 'O WAHA não responde na VPS: confira se o contêiner está de pé.';
  return `A sessão do WhatsApp da EVA está ${status}: confira no painel do WAHA.`;
}

/** O que está quebrado agora. Sem nada, lista vazia. */
export function diagnosticarSaude(e: EntradaSaude): ProblemaSaude[] {
  const c = e.config;
  const problemas: ProblemaSaude[] = [];

  if (c.granola_folder_id && c.granola_ultimo_erro) {
    problemas.push({ chave: 'granola_erro', titulo: 'Granola sem sincronizar', texto: explicarErroGranola(c.granola_ultimo_erro), whatsapp: true });
  } else if (c.granola_folder_id && c.granola_verificado_em && e.agora - Date.parse(c.granola_verificado_em) > GRANOLA_PAROU_MS) {
    problemas.push({
      chave: 'granola_parou',
      titulo: 'Granola parado',
      texto: `O Granola não sincroniza desde ${quando(c.granola_verificado_em)}: confira o cron agente-sync-cron na Vercel.`,
      whatsapp: true,
    });
  }

  if (c.whatsapp_ativo && c.waha_verificado_em) {
    if (e.agora - Date.parse(c.waha_verificado_em) > WAHA_AVISO_MS) {
      problemas.push({
        chave: 'waha_sem_sinal',
        titulo: 'VPS sem sinal',
        texto: `A VPS da EVA parou de dar sinal desde ${quando(c.waha_verificado_em)}: o timer da fila do WhatsApp parou ou a VPS caiu. As mensagens esperam na fila.`,
        whatsapp: false,
      });
    } else if (c.waha_status && c.waha_status !== 'WORKING' && c.waha_status !== 'STARTING') {
      problemas.push({ chave: 'waha_desconectado', titulo: 'WhatsApp desconectado', texto: explicarSessao(c.waha_status), whatsapp: false });
    }
  }

  if (e.ia.falhas >= IA_FALHAS_PARA_AVISO && e.ia.ok === 0) {
    problemas.push({
      chave: 'ia_fora',
      titulo: 'IA sem responder',
      texto: `A IA da EVA não está respondendo: as últimas ${e.ia.falhas} chamadas falharam no Claude e no Gemini${e.ia.ultimoErro ? ` (último erro: ${e.ia.ultimoErro.slice(0, 160)})` : ''}. O chat e as respostas pelo WhatsApp ficam sem interpretação.`,
      whatsapp: true,
    });
  }
  return problemas;
}

/** Texto do aviso de que o problema se resolveu. */
export const TEXTO_RESOLVIDO: Record<ChaveSaude, string> = {
  granola_erro: 'O Granola voltou a sincronizar.',
  granola_parou: 'O Granola voltou a sincronizar.',
  waha_sem_sinal: 'A VPS da EVA voltou a dar sinal.',
  waha_desconectado: 'A sessão do WhatsApp da EVA está conectada de novo.',
  ia_fora: 'A IA da EVA voltou a responder.',
};
