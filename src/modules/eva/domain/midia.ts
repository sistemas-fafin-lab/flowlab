// Áudio e imagem pelo WhatsApp (D43, issue 32). Puro: a api/ (NodeNext) importa, com ".js".
//
// O arquivo fica no WAHA local da VPS, que a Vercel não alcança (D9). Por isso:
// 1. o webhook guarda a mensagem com a mídia "pendente" (só quando a VPS avisou que sabe baixar);
// 2. a VPS baixa do WAHA, sobe para o bucket privado ti-agente-midias e avisa a Vercel;
// 3. a Vercel transcreve o áudio (Gemini: o Claude não ouve áudio) e trata o texto como uma
//    mensagem escrita, ou anexa a imagem ao card ou chamado citado na legenda.

export type TipoMidia = 'audio' | 'imagem' | 'outro';

/**
 * Mesmos valores do CHECK de ti_agente_mensagens.midia_status.
 * pendente (webhook) → baixada ou nao_baixou (VPS) → processando (Vercel) → processada, aguardando_card
 * (imagem sem o código do card) ou erro (a IA não entendeu; a EVA já respondeu). aguardando_card →
 * processada (veio o código) ou expirada (2 h).
 */
export type SituacaoMidia = 'pendente' | 'baixada' | 'nao_baixou' | 'processando' | 'processada' | 'aguardando_card' | 'erro' | 'expirada';

/** Bucket privado: o áudio e a imagem ficam aqui só até serem tratados. */
export const BUCKET_MIDIAS = 'ti-agente-midias';
/** O mesmo limite dos anexos dos chamados (ANEXO_MAX_BYTES). */
export const MIDIA_MAX_BYTES = 10 * 1024 * 1024;
/** O WAHA apaga o arquivo depois de alguns minutos (WHATSAPP_FILES_LIFETIME, 180 s por padrão). */
export const MIDIA_DESISTE_MS = 3 * 60 * 1000;
/** Imagem sem o código do card espera a pessoa dizer qual é, por este tempo. */
export const IMAGEM_AGUARDA_MS = 2 * 60 * 60 * 1000;
/** Os recursos que a VPS anuncia junto com o sinal de vida (ti_agente_config.vps_recursos). */
export const RECURSO_MIDIA = 'midia';
export const RECURSO_RELOGIO = 'relogio';
/** Sinal de vida mais velho que isso: a VPS parou, e a mídia não deve ficar esperando por ela. */
export const VPS_VIVA_MS = 5 * 60 * 1000;

/** O tipo sem os parâmetros ("audio/ogg; codecs=opus" → "audio/ogg"). */
export const mimeBase = (mimetype: string | null | undefined): string => (mimetype ?? '').split(';')[0].trim().toLowerCase();

export function tipoDaMidia(mimetype: string | null | undefined): TipoMidia {
  const m = mimeBase(mimetype);
  if (m.startsWith('audio/')) return 'audio';
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(m)) return 'imagem';
  return 'outro';
}

/** Figurinha chega como imagem webp sem legenda. É reação, como um 👍: não responde. */
export const ehFigurinha = (mimetype: string | null | undefined, legenda: string | null | undefined): boolean =>
  mimeBase(mimetype) === 'image/webp' && !(legenda ?? '').trim();

/**
 * O caminho do arquivo no WAHA (/api/files/…), qualquer que seja o host da URL: o WAHA monta a URL
 * com o WAHA_BASE_URL dele (localhost ou o ngrok). A VPS baixa sempre pelo localhost (D9).
 */
export function caminhoNoWaha(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, 'http://localhost');
    return u.pathname.startsWith('/api/files/') ? `${u.pathname}${u.search}` : null;
  } catch {
    return null;
  }
}

const EXTENSOES: Record<string, string> = {
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/webm': 'webm', 'audio/amr': 'amr',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};

export const extensaoDaMidia = (mimetype: string | null | undefined): string => EXTENSOES[mimeBase(mimetype)] ?? 'bin';

/** No bucket privado, uma pasta por membro. */
export const caminhoDaMidia = (membroId: string, mensagemId: string, mimetype: string | null | undefined): string =>
  `${membroId}/${mensagemId}.${extensaoDaMidia(mimetype)}`;

/** O nome do anexo no card: "whatsapp-24-11-2026-1432.jpg" (dia e hora de Brasília). */
export function nomeDoAnexo(recebidaEm: string, mimetype: string | null | undefined): string {
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(recebidaEm));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `whatsapp-${v('day')}-${v('month')}-${v('year')}-${v('hour')}${v('minute')}.${extensaoDaMidia(mimetype)}`;
}

// ── Os códigos de card na legenda ou na resposta ──────────────────────────────

const RE_CODIGO = /\bIT[\s-]?0*(\d{1,6})\b/gi;

/** Os códigos citados ("IT-045", "it 45", "IT45"), no formato do banco (IT-045), sem repetir. */
export function codigosNoTexto(texto: string | null | undefined): string[] {
  const vistos = new Set<string>();
  for (const m of (texto ?? '').matchAll(RE_CODIGO)) vistos.add(`IT-${m[1].padStart(3, '0')}`);
  return Array.from(vistos);
}

const SOBRA_DE_CODIGO = /^(?:[\s,.;:!?e&+/-]|é|eh|do|da|no|na|o|a|pro|pra|para|card|chamado|cards|chamados|anexa|anexar|coloca|põe|poe|aqui|nesse|neste|ao|à)*$/iu;

/** A mensagem é só o código ("IT-045", "é do IT-045", "IT-12 e IT-13"): não precisa de IA. */
export function soCodigos(texto: string | null | undefined): boolean {
  const t = (texto ?? '').replace(RE_CODIGO, ' ').trim();
  if (codigosNoTexto(texto).length === 0) return false;
  return t.split(/\s+/).every((palavra) => !palavra || SOBRA_DE_CODIGO.test(palavra));
}

// ── O que a EVA responde ──────────────────────────────────────────────────────

const juntarCodigos = (cs: string[]) => (cs.length <= 1 ? cs.join('') : `${cs.slice(0, -1).join(', ')} e ${cs[cs.length - 1]}`);

export const anexei = (codigos: string[], quantas = 1): string =>
  `📎 Anexei ${quantas > 1 ? `as ${quantas} imagens` : 'a imagem'} ${codigos.length > 1 ? 'aos' : 'ao'} ${juntarCodigos(codigos)}.`;

export const PEDIR_CARD_DA_IMAGEM = '📎 Recebi a imagem. De qual card ou chamado ela é? Me manda o código (ex.: IT-045) que eu anexo. Fico esperando por 2 h.';
export const AUDIO_NAO_ENTENDI = 'Não consegui entender o áudio 😕 Pode repetir ou mandar por texto?';
export const MIDIA_NAO_BAIXOU = 'Não consegui abrir o arquivo que você mandou 😕 Pode mandar de novo?';
export const MIDIA_GRANDE = 'Esse arquivo passa de 10 MB, e eu não consigo abrir. Anexa direto no card pelo FlowLab?';
export const MIDIA_NAO_SUPORTADA = 'Por aqui eu entendo texto, áudio e imagem. Vídeo e documento, anexa direto no card pelo FlowLab.';
/** Quando a VPS ainda não sabe baixar mídia (o pacote antigo): a resposta de antes, mais clara. */
export const AUDIO_AINDA_NAO = 'Ainda não consigo ouvir áudio por aqui. Me manda por texto?';
export const CARD_NAO_ACHADO = (codigos: string[]) => `Não achei ${codigos.length > 1 ? 'os cards' : 'o card'} ${juntarCodigos(codigos)} entre os que você pode atualizar. Confere o código?`;

/** A VPS anunciou que baixa mídia, e o sinal de vida dela é recente. */
export function vpsBaixaMidia(cfg: { vps_recursos?: string[] | null; waha_verificado_em?: string | null } | null, agora: number): boolean {
  if (!cfg?.vps_recursos?.includes(RECURSO_MIDIA) || !cfg.waha_verificado_em) return false;
  return agora - Date.parse(cfg.waha_verificado_em) <= VPS_VIVA_MS;
}
