// api/_lib/aplisSite/sessao.ts
// Sessão no SITE do apLIS (https://lab.aplis.inf.br, `/areas/<area>/<modulo>.php?f=<funcao>`):
// as chamadas internas que as telas fazem — não é a API de integração (api/_lib/apoio/aplis.ts).
// Port do script da skill aplis-site-interno (scripts/aplis.mjs): login com usuário/senha
// cifrados em AES (chave e IV da própria página de login), aceite LGPD, `au` da sessão em
// toda chamada e logout no fim. Nada disso é contrato do fornecedor: pode mudar sem aviso.
//
// Env: APLIS_WEB_URL (padrão https://lab.aplis.inf.br), APLIS_WEB_USUARIO, APLIS_WEB_SENHA.
//
// Login recusado várias vezes ativa captcha para TODOS que usam o mesmo usuário (inclusive o
// backend do projeto-admissao). Depois de uma recusa, esta instância não tenta de novo por
// 10 min. O bloqueio é por instância serverless — não substitui conferir as credenciais.

import crypto from 'node:crypto';

const URL_PADRAO = 'https://lab.aplis.inf.br';
const TIMEOUT_MS = 30_000;
const ESPERA_APOS_RECUSA_MS = 10 * 60 * 1000;

let recusadoEm = 0;

export class ErroAplisSite extends Error {}

function config() {
  const url = (process.env.APLIS_WEB_URL ?? '').trim().replace(/\/+$/, '') || URL_PADRAO;
  const usuario = (process.env.APLIS_WEB_USUARIO ?? '').trim();
  const senha = (process.env.APLIS_WEB_SENHA ?? '').trim();
  if (!usuario || !senha) throw new ErroAplisSite('APLIS_WEB_USUARIO/APLIS_WEB_SENHA não configurados no servidor.');
  return { url, usuario, senha };
}

/** Igual ao `encriptar` do js/index.js do apLIS: CryptoJS.AES (CBC, PKCS7), chave e IV em hex. */
function encriptar(texto: string, chaveHex: string, ivHex: string): string {
  const chave = Buffer.from(chaveHex, 'hex');
  const cifra = crypto.createCipheriv(`aes-${chave.length * 8}-cbc`, chave, Buffer.from(ivHex, 'hex'));
  return Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]).toString('base64');
}

type Form = Record<string, string> | [string, string][];

interface RespostaLogin {
  sucesso?: boolean;
  tfa?: unknown;
  vc?: unknown;
  msg?: string;
  url?: string;
}

function motivoRecusa(resp: Response, corpo: RespostaLogin | null): string {
  if (corpo?.tfa) return 'pede 2FA';
  if (corpo?.vc) return 'captcha ativado';
  return (corpo?.msg ?? '').replace(/<[^>]+>/g, ' ').trim() || `HTTP ${resp.status}`;
}

export class SessaoAplisSite {
  private readonly cookies = new Map<string, string>();
  private au: string | null = null;

  private constructor(private readonly cfg: ReturnType<typeof config>) {}

  private async http(caminho: string, opcoes: { form?: Form; query?: Record<string, string> } = {}): Promise<Response> {
    const url = new URL(this.cfg.url + caminho);
    for (const [k, v] of Object.entries(opcoes.query ?? {})) url.searchParams.set(k, v);
    const resp = await fetch(url, {
      method: opcoes.form ? 'POST' : 'GET',
      body: opcoes.form ? new URLSearchParams(opcoes.form).toString() : undefined,
      headers: {
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(opcoes.form ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } : {}),
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    for (const sc of resp.headers.getSetCookie?.() ?? []) {
      const [par] = sc.split(';');
      const i = par.indexOf('=');
      if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
    }
    return resp;
  }

  /** POST no autenticar.php com as credenciais; devolve a resposta crua do site. */
  private async autenticar(usuario: string, senha: string): Promise<{ resp: Response; corpo: RespostaLogin | null; au: string }> {
    const html = await (await this.http('/index.php')).text();
    const campo = (id: string): string => {
      const m = new RegExp(`id="${id}"\\s+value="([^"]*)"`).exec(html);
      if (!m) throw new ErroAplisSite(`Campo #${id} ausente na página de login do apLIS — o site mudou?`);
      return m[1];
    };
    const ck = campo('ck');
    const ci = campo('ci');
    const au = campo('auth_token');

    // Aceite da política de cookies (LGPD) que o site envia antes do login.
    await this.http('/areas/shared/autenticar.php', { query: { f: 'prosseguir' }, form: { Prosseguir: '1' } });

    const resp = await this.http('/areas/shared/autenticar.php', {
      form: { l: encriptar(usuario, ck, ci), s: encriptar(senha, ck, ci), t: au, w: '1280', f: '', c: '' },
    });
    const corpo = (await resp.json().catch(() => null)) as RespostaLogin | null;
    return { resp, corpo, au };
  }

  private async login(): Promise<void> {
    const falta = recusadoEm + ESPERA_APOS_RECUSA_MS - Date.now();
    if (recusadoEm && falta > 0) {
      throw new ErroAplisSite(
        `O login no apLIS foi recusado há pouco. Nova tentativa em ${Math.ceil(falta / 60000)} min (evita ativar o captcha).`,
      );
    }
    const { resp, corpo, au } = await this.autenticar(this.cfg.usuario, this.cfg.senha);
    if (!corpo?.sucesso) {
      recusadoEm = Date.now();
      throw new ErroAplisSite(`Login no apLIS recusado (${motivoRecusa(resp, corpo)}). Confira APLIS_WEB_USUARIO/APLIS_WEB_SENHA.`);
    }
    recusadoEm = 0;
    this.au = au;
  }

  private async logout(): Promise<void> {
    if (!this.au) return;
    await this.http('/areas/shared/logoff.php').catch(() => undefined);
    this.au = null;
  }

  /** Abre a sessão, roda `fn` e sempre faz logout. */
  static async com<T>(fn: (s: SessaoAplisSite) => Promise<T>): Promise<T> {
    const sessao = new SessaoAplisSite(config());
    try {
      await sessao.login();
      return await fn(sessao);
    } finally {
      await sessao.logout();
    }
  }

  /**
   * Tenta entrar UMA vez com as credenciais de um usuário do Laudo Web (mesma página de
   * login do site) e sai em seguida. Não usa nem mexe na trava do usuário de serviço, e
   * nunca repete: recusas seguidas ativam captcha para esse usuário da clínica.
   * Efeito colateral: o apLIS registra o acesso ("Últ. Login" do usuário).
   */
  static async conferirLogin(usuario: string, senha: string): Promise<{ ok: boolean; motivo: string }> {
    const sessao = new SessaoAplisSite(config());
    const { resp, corpo, au } = await sessao.autenticar(usuario, senha);
    if (!corpo?.sucesso) return { ok: false, motivo: motivoRecusa(resp, corpo) };
    sessao.au = au;
    await sessao.logout();
    return { ok: true, motivo: '' };
  }

  private async conferir(resp: Response, caminho: string): Promise<Response> {
    if (resp.status >= 300 && resp.status < 400) throw new ErroAplisSite(`${caminho}: sessão recusada pelo apLIS.`);
    if (resp.status !== 200) throw new ErroAplisSite(`${caminho}: HTTP ${resp.status} do apLIS.`);
    return resp;
  }

  /** GET com `au` na query (autocompletes). */
  async get(caminho: string, query: Record<string, string>): Promise<Response> {
    return this.conferir(await this.http(caminho, { query: { ...query, au: this.au! } }), caminho);
  }

  /** POST com `au` no corpo (padrão das telas); `f` vai na query. */
  async post(caminho: string, funcao: string | null, form: Form): Promise<Response> {
    const pares: [string, string][] = [['au', this.au!], ...(Array.isArray(form) ? form : Object.entries(form))];
    return this.conferir(await this.http(caminho, { query: funcao ? { f: funcao } : {}, form: pares }), caminho);
  }
}
