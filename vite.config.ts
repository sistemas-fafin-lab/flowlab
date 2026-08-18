import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createUmamiClient, buildTimeRangeParams } from './api/_lib/umami';
import type { UmamiTimeRange, UmamiTimeUnit } from './api/_lib/umami';
import { authorizeUmamiRequest } from './api/_lib/umamiAuth';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
// ── Dev-only middleware para POST /api/notifications/email ───────────────────
function emailApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'email-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.url !== '/api/notifications/email' || req.method !== 'POST') return next();

        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };

        // Lê body JSON
        let body: Record<string, unknown> = {};
        try {
          await new Promise<void>((resolve, reject) => {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
              try { body = JSON.parse(raw); resolve(); }
              catch { reject(new Error('JSON inválido')); }
            });
            req.on('error', reject);
          });
        } catch {
          return send(400, { success: false, error: 'Body inválido' });
        }

        const { to, templateSlug, variables } = body as {
          to?: string;
          templateSlug?: string;
          variables?: Record<string, string>;
        };

        if (!to || !templateSlug || !variables) {
          return send(400, { success: false, error: 'Campos obrigatórios ausentes: to, templateSlug, variables' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
          return send(400, { success: false, error: 'Endereço de email inválido' });
        }

        // Busca template no Supabase
        const supabaseUrl = env.VITE_SUPABASE_URL;
        const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
          console.error('[dev/email] VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env');
          return send(500, { success: false, error: 'Configuração Supabase ausente no .env' });
        }

        let finalSubject: string;
        let finalHtml: string;

        try {
          const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: template, error } = await supabase
            .from('notification_templates')
            .select('subject_template, body_html')
            .eq('slug', templateSlug)
            .single();

          if (error || !template) {
            console.error('[dev/email] Template não encontrado:', templateSlug, error?.message);
            return send(404, { success: false, error: 'Template not found' });
          }

          const render = (str: string) =>
            str.replace(/{{(\w+)}}/g, (_m: string, k: string) => variables[k] ?? '');

          finalSubject = render(template.subject_template);
          finalHtml    = render(template.body_html);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erro desconhecido';
          console.error('[dev/email] Erro ao buscar template:', message);
          return send(500, { success: false, error: 'Erro interno ao carregar template' });
        }

        const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = env;

        if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
          console.error('[dev/email] Variáveis SMTP não configuradas no .env');
          return send(500, { success: false, error: 'Configuração SMTP ausente' });
        }

        try {
          const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT),
            secure: Number(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
          });

          const info = await transporter.sendMail({
            from: SMTP_FROM,
            to,
            subject: finalSubject,
            html: finalHtml,
          });

          console.log('[dev/email] Enviado:', info.messageId);
          send(200, { success: true, messageId: info.messageId });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erro desconhecido';
          console.error('[dev/email] Falha:', message);
          send(500, { success: false, error: message });
        }
      });
    },
  };
}
// ── Dev-only middleware that emula /api/umami sem precisar do vercel dev ──────
function umamiApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'umami-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith('/api/umami')) return next();

        const url = new URL(req.url, 'http://localhost');
        const param = (key: string): string | null => url.searchParams.get(key);

        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(body));
        };

        // Mesma autorização da produção: dev que não exige sessão esconde 401/403
        // que só apareceriam depois do deploy. `authorizeUmamiRequest` lê os
        // segredos de process.env, então mapeamos as vars do .env antes.
        for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
          if (env[k] && !process.env[k]) process.env[k] = env[k];
        }
        const auth = await authorizeUmamiRequest(req.headers.authorization);
        if (!auth.ok) return send(auth.status, { error: auth.error });

        const websiteId  = param('id');
        const startAtRaw = param('startAt');
        const endAtRaw   = param('endAt');
        const unitRaw    = param('unit') as UmamiTimeUnit | null;
        const rangeRaw   = param('range');
        const timezone   = param('timezone');
        const all        = param('all') === 'true';

        const range: UmamiTimeRange =
          startAtRaw && endAtRaw
            ? { startAt: Number(startAtRaw), endAt: Number(endAtRaw), unit: unitRaw ?? 'day' }
            : ((rangeRaw ?? '24h') as UmamiTimeRange);

        // Sem fallback de credencial, igual à produção (ver api/umami.ts).
        if (!env.UMAMI_BASE_URL || !env.UMAMI_USER || !env.UMAMI_PASS) {
          return send(500, {
            error: 'Defina UMAMI_BASE_URL, UMAMI_USER e UMAMI_PASS no .env',
          });
        }

        const client = createUmamiClient({
          baseUrl:  env.UMAMI_BASE_URL,
          username: env.UMAMI_USER,
          password: env.UMAMI_PASS,
          timezone: env.UMAMI_TIMEZONE ?? 'America/Sao_Paulo',
        });

        try {
          await client.authenticate();
          const websites = await client.getWebsites();
          // Mesmo contrato do handler de produção (api/umami.ts): o timezone do
          // cliente manda, para os buckets baterem com os rótulos do gráfico.
          const params   = { ...buildTimeRangeParams(range), ...(timezone ? { timezone } : {}) };

          if (all) {
            if (!websites.length) {
              return send(200, { websites: [], results: [], error: 'Nenhum site encontrado' });
            }
            const results = await Promise.all(
              websites.map(async (site) => {
                const [stats, events, pageviews] = await Promise.all([
                  client.getStats(site.id, params),
                  client.getEvents(site.id, params),
                  client.getPageviews(site.id, params),
                ]);
                return { id: site.id, stats, events, pageviews };
              }),
            );
            return send(200, { websites, results });
          }

          const targetId = websiteId ?? (websites[0]?.id ?? null);
          if (!targetId) return send(200, { websites, error: 'Nenhum site encontrado' });

          const [stats, events, pageviews] = await Promise.all([
            client.getStats(targetId, params),
            client.getEvents(targetId, params),
            client.getPageviews(targetId, params),
          ]);
          return send(200, { websites, currentId: targetId, stats, events, pageviews });
        } catch (err) {
          console.error('[dev/api/umami]', err);
          send(500, { error: err instanceof Error ? err.message : 'Erro ao buscar dados do Umami' });
        }
      });
    },
  };
}

// ── Dev-only middleware para POST /api/users/create ──────────────────────────
// Carrega o fluxo (api/_lib/createUser.ts) sob demanda via ssrLoadModule, para
// não puxar googleapis/nodemailer para o bundle da config. O fluxo lê segredos
// de process.env, então mapeamos as vars do .env antes de invocá-lo.
function createUserApiPlugin(env: Record<string, string>): Plugin {
  const SERVER_ENV_KEYS = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
    'SLACK_INVITE_URL',
  ];

  const ensureProcessEnv = () => {
    for (const k of SERVER_ENV_KEYS) {
      if (env[k] && !process.env[k]) process.env[k] = env[k];
    }
    // getSupabaseAdminClient lê SUPABASE_URL; no dev temos VITE_SUPABASE_URL
    if (!process.env.SUPABASE_URL && env.VITE_SUPABASE_URL) {
      process.env.SUPABASE_URL = env.VITE_SUPABASE_URL;
    }
  };

  return {
    name: 'create-user-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.url !== '/api/users/create' || req.method !== 'POST') return next();

        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };

        let body: Record<string, unknown> = {};
        try {
          await new Promise<void>((resolve, reject) => {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
              try { body = raw ? JSON.parse(raw) : {}; resolve(); }
              catch { reject(new Error('JSON inválido')); }
            });
            req.on('error', reject);
          });
        } catch {
          return send(400, { success: false, error: 'Body inválido' });
        }

        const authHeader = (req.headers['authorization'] as string) ?? '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        try {
          ensureProcessEnv();
          const mod = await server.ssrLoadModule('/api/_lib/createUser.ts');
          const { status, payload } = await mod.createUserFlow(token, body);
          send(status, payload);
        } catch (err) {
          console.error('[dev/users/create]', err);
          send(500, { success: false, error: err instanceof Error ? err.message : 'Erro interno' });
        }
      });
    },
  };
}

// ── Dev-only middleware para GET /api/analises-clinicas/get-documentos ───────
// `npm run dev` é vite puro (sem runtime Vercel): sem este plugin a rota cai no
// fallback do SPA e devolve index.html, e o .json() do hook estoura com
// "Unexpected token '<'".
function documentosApiPlugin(env: Record<string, string>): Plugin {
  const SERVER_ENV_KEYS = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'LABHUB_API_URL', 'FLOWLAB_API_KEY',
  ];

  const ensureProcessEnv = () => {
    for (const k of SERVER_ENV_KEYS) {
      if (env[k] && !process.env[k]) process.env[k] = env[k];
    }
    // getSupabaseAdminClient lê SUPABASE_URL; no dev temos VITE_SUPABASE_URL
    if (!process.env.SUPABASE_URL && env.VITE_SUPABASE_URL) {
      process.env.SUPABASE_URL = env.VITE_SUPABASE_URL;
    }
  };

  return {
    name: 'documentos-checkin-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        // Compara o pathname, não req.url: aqui vem query string junto.
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname !== '/api/analises-clinicas/get-documentos' || req.method !== 'GET') {
          return next();
        }

        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(body));
        };

        const authHeader = (req.headers['authorization'] as string) ?? '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        try {
          ensureProcessEnv();
          const mod = await server.ssrLoadModule('/api/_lib/documentosCheckin.ts');
          const { status, payload } = await mod.listarDocumentosCheckin(
            token,
            url.searchParams.get('agendamentoId') ?? undefined,
          );
          send(status, payload);
        } catch (err) {
          console.error('[dev/analises-clinicas/get-documentos]', err);
          send(500, { success: false, error: err instanceof Error ? err.message : 'Erro interno' });
        }
      });
    },
  };
}

// ── Dev-only middleware para as rotas da recepção contra o LAB-HUB ───────────
// Proxies autenticados por JWT do operador:
//   GET  /api/analises-clinicas/disponibilidade-operador
//   GET  /api/analises-clinicas/buscar-pacientes?q=   (typeahead)
//   POST /api/analises-clinicas/criar-agendamento-labhub
//   POST /api/analises-clinicas/corrigir-identidade   (CPF/nascimento do paciente)
// Sem este plugin, `npm run dev` (vite puro) cai no fallback do SPA e devolve
// index.html, quebrando o .json() do hook.
function recepcaoAgendamentoApiPlugin(env: Record<string, string>): Plugin {
  const SERVER_ENV_KEYS = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'LABHUB_API_URL', 'FLOWLAB_API_KEY',
    'DISPONIBILIDADE_DIAS', 'AGENDA_RETROATIVO_DIAS', 'AGENDA_TZ_OFFSET',
  ];

  const ensureProcessEnv = () => {
    for (const k of SERVER_ENV_KEYS) {
      if (env[k] && !process.env[k]) process.env[k] = env[k];
    }
    // getSupabaseAdminClient lê SUPABASE_URL; no dev temos VITE_SUPABASE_URL
    if (!process.env.SUPABASE_URL && env.VITE_SUPABASE_URL) {
      process.env.SUPABASE_URL = env.VITE_SUPABASE_URL;
    }
  };

  return {
    name: 'recepcao-agendamento-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const isDisp =
          url.pathname === '/api/analises-clinicas/disponibilidade-operador' && req.method === 'GET';
        const isBuscar =
          url.pathname === '/api/analises-clinicas/buscar-pacientes' && req.method === 'GET';
        const isCriar =
          url.pathname === '/api/analises-clinicas/criar-agendamento-labhub' && req.method === 'POST';
        const isCorrigir =
          url.pathname === '/api/analises-clinicas/corrigir-identidade' && req.method === 'POST';
        if (!isDisp && !isBuscar && !isCriar && !isCorrigir) return next();

        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          // Ambas carregam dado pessoal de paciente (a correção devolve o CPF
          // anterior mascarado).
          if (isDisp || isBuscar || isCorrigir) res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(body));
        };

        const authHeader = (req.headers['authorization'] as string) ?? '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        try {
          ensureProcessEnv();
          const mod = await server.ssrLoadModule('/api/_lib/recepcaoAgendamento.ts');

          if (isDisp) {
            const { status, payload } = await mod.disponibilidadeOperador(token);
            return send(status, payload);
          }

          if (isBuscar) {
            const { status, payload } = await mod.buscarPacientesRecepcao(
              token,
              url.searchParams.get('q') ?? undefined,
            );
            return send(status, payload);
          }

          // POSTs (criar / corrigir) — leem o corpo JSON.
          let body: Record<string, unknown> = {};
          try {
            await new Promise<void>((resolve, reject) => {
              let raw = '';
              req.on('data', (chunk) => { raw += chunk; });
              req.on('end', () => {
                try { body = raw ? JSON.parse(raw) : {}; resolve(); }
                catch { reject(new Error('JSON inválido')); }
              });
              req.on('error', reject);
            });
          } catch {
            return send(400, { success: false, error: 'Body inválido' });
          }

          const { status, payload } = isCorrigir
            ? await mod.corrigirIdentidadePaciente(token, body)
            : await mod.criarAgendamentoRecepcao(token, body);
          send(status, payload);
        } catch (err) {
          console.error('[dev/analises-clinicas/recepcao-agendamento]', err);
          send(500, { success: false, error: err instanceof Error ? err.message : 'Erro interno' });
        }
      });
    },
  };
}

// ── Dev-only middleware para o upload de documento da recepção ───────────────
// POST /api/analises-clinicas/upload-documento — corpo BINÁRIO cru (o arquivo),
// `agendamentoId` + `tipo` na query e o nome no header x-nome-arquivo. Sem este
// plugin, `npm run dev` (vite puro) cai no fallback do SPA e devolve index.html.
function uploadDocumentoApiPlugin(env: Record<string, string>): Plugin {
  const SERVER_ENV_KEYS = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'LABHUB_API_URL', 'FLOWLAB_API_KEY',
  ];
  const TAMANHO_MAX_BYTES = 10 * 1024 * 1024;

  const ensureProcessEnv = () => {
    for (const k of SERVER_ENV_KEYS) {
      if (env[k] && !process.env[k]) process.env[k] = env[k];
    }
    if (!process.env.SUPABASE_URL && env.VITE_SUPABASE_URL) {
      process.env.SUPABASE_URL = env.VITE_SUPABASE_URL;
    }
  };

  return {
    name: 'upload-documento-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname !== '/api/analises-clinicas/upload-documento' || req.method !== 'POST') {
          return next();
        }

        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(body));
        };

        const authHeader = (req.headers['authorization'] as string) ?? '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        // Lê o corpo cru em Buffer, abortando ao passar do teto.
        let buffer: Buffer;
        try {
          buffer = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            let total = 0;
            req.on('data', (chunk) => {
              const b = Buffer.from(chunk);
              total += b.length;
              if (total > TAMANHO_MAX_BYTES) {
                reject(new Error('too-large'));
                req.destroy();
              } else {
                chunks.push(b);
              }
            });
            req.on('end', () => resolve(Buffer.concat(chunks)));
            req.on('error', reject);
          });
        } catch (err) {
          if (err instanceof Error && err.message === 'too-large') {
            return send(413, { success: false, error: 'Arquivo maior que 10 MB.' });
          }
          return send(400, { success: false, error: 'Falha ao ler o arquivo.' });
        }

        const nomeHeader = req.headers['x-nome-arquivo'];
        let nomeArquivo: string | undefined;
        try {
          nomeArquivo = typeof nomeHeader === 'string' ? decodeURIComponent(nomeHeader) : undefined;
        } catch {
          nomeArquivo = undefined;
        }

        try {
          ensureProcessEnv();
          const mod = await server.ssrLoadModule('/api/_lib/uploadDocumentoRecepcao.ts');
          const { status, payload } = await mod.uploadDocumentoRecepcao(
            token,
            url.searchParams.get('agendamentoId') ?? undefined,
            url.searchParams.get('tipo') ?? undefined,
            nomeArquivo,
            buffer,
          );
          send(status, payload);
        } catch (err) {
          console.error('[dev/analises-clinicas/upload-documento]', err);
          send(500, { success: false, error: err instanceof Error ? err.message : 'Erro interno' });
        }
      });
    },
  };
}

// ── Dev-only middleware para as actions de Envio ao Apoio (Álvaro) ───────────
// No Vercel, /api/analises-clinicas/apoio-* cai na rota dinâmica [action].ts. Sob
// `npm run dev` (vite puro, sem runtime Vercel) esse dispatcher não roda, então o
// POST não casa com nada e retorna 404. Este plugin emula as quatro actions
// (process-image, rebuild-xml, transferir, auto-stage) carregando cada handler
// Vercel via ssrLoadModule e adaptando o req/res cru para o contrato VercelRequest
// /VercelResponse que os handlers esperam (req.body, res.status().json()).
function apoioApiPlugin(env: Record<string, string>): Plugin {
  const APOIO_ACTIONS = new Set([
    'apoio-process-image', 'apoio-rebuild-xml', 'apoio-transferir', 'apoio-auto-stage',
  ]);
  const SERVER_ENV_KEYS = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY', 'GEMINI_MODEL',
    'APLIS_BASE_URL', 'APLIS_USUARIO', 'APLIS_SENHA', 'APLIS_TOKEN',
    'AOL_BASE_URL', 'AOL_IDAGENTE', 'AOL_SENHA', 'AOL_CHAVE', 'AOL_ENTIDADE',
    'LABHUB_API_URL', 'FLOWLAB_API_KEY',
  ];

  const ensureProcessEnv = () => {
    for (const k of SERVER_ENV_KEYS) {
      if (env[k] && !process.env[k]) process.env[k] = env[k];
    }
    // getSupabaseAdminClient lê SUPABASE_URL; no dev temos VITE_SUPABASE_URL
    if (!process.env.SUPABASE_URL && env.VITE_SUPABASE_URL) {
      process.env.SUPABASE_URL = env.VITE_SUPABASE_URL;
    }
  };

  return {
    name: 'apoio-alvaro-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const match = url.pathname.match(/^\/api\/analises-clinicas\/([^/]+)$/);
        const action = match?.[1];
        if (!action || !APOIO_ACTIONS.has(action) || req.method !== 'POST') return next();

        // Corpo JSON (todas as actions apoio recebem JSON).
        let body: Record<string, unknown> = {};
        try {
          await new Promise<void>((resolve, reject) => {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
              try { body = raw ? JSON.parse(raw) : {}; resolve(); }
              catch { reject(new Error('JSON inválido')); }
            });
            req.on('error', reject);
          });
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Body inválido' }));
          return;
        }

        // Adapta o req/res cru do Node ao contrato Vercel que os handlers usam.
        const vReq = Object.assign(req, { body, query: { action } });
        const vRes = Object.assign(res, {
          status(code: number) { res.statusCode = code; return vRes; },
          json(payload: unknown) {
            if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
            return vRes;
          },
        });

        try {
          ensureProcessEnv();
          const mod = await server.ssrLoadModule(`/api/_lib/handlers/${action}.ts`);
          await mod.default(vReq, vRes);
        } catch (err) {
          console.error(`[dev/analises-clinicas/${action}]`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Erro interno' }));
          }
        }
      });
    },
  };
}

// Espelho de dev das rotas de /api/faturamento/*. As de leitura recebem a entrada pela
// query string; as de escrita (titulo-criar, operadoras-sync) recebem JSON no corpo,
// como no apoioApiPlugin. O handler só precisa das credenciais do apLIS + Supabase.
function faturamentoApiPlugin(env: Record<string, string>): Plugin {
  const FATURAMENTO_ACTIONS = new Set([
    'lotes', 'lote-detalhe', 'titulo-criar', 'operadoras-sync',
    'glosas-legado', 'recursos-legado',
    'pendencias-nao-faturadas', 'pendencia-lote-detalhe', 'pendencias-particulares',
  ]);
  // O nome do arquivo do handler segue a action, exceto estas duas: os handlers
  // de pendências (issues 07/08) nasceram com nome mais curto que a action
  // pública (`faturamento-pendencias.ts`, não `faturamento-pendencias-nao-faturadas.ts`)
  // — ver o mapeamento real em api/faturamento/[action].ts. Sem este override, o
  // ssrLoadModule abaixo tenta um arquivo que não existe e a rota cai no fallback
  // do SPA, devolvendo index.html em vez de JSON.
  const FATURAMENTO_HANDLER_OVERRIDES: Record<string, string> = {
    'pendencias-nao-faturadas': 'pendencias',
    'pendencia-lote-detalhe': 'pendencia-detalhe',
  };
  // DB_* é o MySQL de backup do laboratório: a fonte da aba Faturas (antes era o apLIS).
  const SERVER_ENV_KEYS = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
  ];

  const ensureProcessEnv = () => {
    for (const k of SERVER_ENV_KEYS) {
      if (env[k] && !process.env[k]) process.env[k] = env[k];
    }
    // getSupabaseAdminClient lê SUPABASE_URL; no dev temos VITE_SUPABASE_URL
    if (!process.env.SUPABASE_URL && env.VITE_SUPABASE_URL) {
      process.env.SUPABASE_URL = env.VITE_SUPABASE_URL;
    }
  };

  return {
    name: 'faturamento-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const match = url.pathname.match(/^\/api\/faturamento\/([^/]+)$/);
        const action = match?.[1];
        if (!action || !FATURAMENTO_ACTIONS.has(action)) return next();

        // Corpo JSON nas rotas de escrita. Sem isto o handler receberia `{}` e
        // recusaria toda criação de título por "parâmetro inválido" — só em dev,
        // porque na Vercel o parsing do body é automático.
        let body: Record<string, unknown> = {};
        if (req.method === 'POST') {
          try {
            await new Promise<void>((resolve, reject) => {
              let raw = '';
              req.on('data', (chunk) => { raw += chunk; });
              req.on('end', () => {
                try { body = raw ? JSON.parse(raw) : {}; resolve(); }
                catch { reject(new Error('JSON inválido')); }
              });
              req.on('error', reject);
            });
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Body inválido' }));
            return;
          }
        }

        // Adapta o req/res cru do Node ao contrato Vercel que os handlers usam.
        // `action` entra no query junto dos filtros, como faz a rota dinâmica.
        const query: Record<string, string> = { action };
        for (const [chave, valor] of url.searchParams) query[chave] = valor;

        const vReq = Object.assign(req, { body, query });
        const vRes = Object.assign(res, {
          status(code: number) { res.statusCode = code; return vRes; },
          json(payload: unknown) {
            if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
            return vRes;
          },
        });

        try {
          ensureProcessEnv();
          const handlerName = FATURAMENTO_HANDLER_OVERRIDES[action] ?? action;
          const mod = await server.ssrLoadModule(`/api/_lib/handlers/faturamento-${handlerName}.ts`);
          await mod.default(vReq, vRes);
        } catch (err) {
          console.error(`[dev/faturamento/${action}]`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Erro interno' }));
          }
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv com prefix '' carrega TODAS as vars (inclusive UMAMI_* sem prefixo VITE_)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), emailApiPlugin(env), umamiApiPlugin(env), createUserApiPlugin(env), documentosApiPlugin(env), recepcaoAgendamentoApiPlugin(env), uploadDocumentoApiPlugin(env), apoioApiPlugin(env), faturamentoApiPlugin(env)],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
