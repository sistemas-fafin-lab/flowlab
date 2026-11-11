// api/_lib/atendimento/senhaClinica.ts
/**
 * API Routes da aba "Resetar senha clínica" (área Atendimento):
 *   GET  /api/atendimento/senha-clinica-buscar?termo=<texto>   → clínicas do apLIS (autocomplete)
 *   GET  /api/atendimento/senha-clinica-usuarios?id=<id>       → usuários do Laudo Web da clínica
 *   POST /api/atendimento/senha-clinica-resetar {idInstituicao, idUsuario, senha}
 *
 * Tudo passa pelo SITE do apLIS (api/_lib/aplisSite): cada chamada faz login, a operação e
 * logout. O reset regrava o cadastro inteiro da instituição. Ver senhaLaudoWeb.ts.
 * O log do apLIS registra o usuário de serviço (APLIS_WEB_USUARIO), não o operador: quem
 * resetou o quê fica em public.atendimento_reset_senha_clinica (sem a senha).
 *
 * Autorização: `Authorization: Bearer <access_token>` da sessão, com canResetarSenhaClinica.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APLIS_WEB_URL, APLIS_WEB_USUARIO, APLIS_WEB_SENHA.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { describeError } from '../errors.js';
import { autorizarResetSenhaClinica, tokenDoHeader } from './autorizacao.js';
import { ErroAplisSite } from '../aplisSite/sessao.js';
import { FormularioInstituicaoInvalido } from '../aplisSite/instituicaoForm.js';
import { buscarClinicas, lerClinica, resetarSenhaLaudoWeb, SenhaRecusada } from '../aplisSite/senhaLaudoWeb.js';

type Acao = 'buscar' | 'usuarios' | 'resetar';

const METODO: Record<Acao, string> = { buscar: 'GET', usuarios: 'GET', resetar: 'POST' };

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : Array.isArray(v) ? texto(v[0]) : '');
const ehId = (v: string): boolean => /^\d{1,10}$/.test(v);

function responderErro(res: VercelResponse, rota: string, err: unknown): void {
  if (err instanceof SenhaRecusada) {
    res.status(422).json({ success: false, error: err.message });
  } else if (err instanceof FormularioInstituicaoInvalido) {
    console.error(`[atendimento/${rota}] cadastro inesperado:`, err.message);
    res.status(502).json({ success: false, error: `Nada foi gravado: ${err.message}` });
  } else if (err instanceof ErroAplisSite) {
    console.error(`[atendimento/${rota}] apLIS:`, err.message);
    res.status(502).json({ success: false, error: err.message });
  } else {
    console.error(`[atendimento/${rota}] erro:`, describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

async function registrar(linha: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseAdminClient().from('atendimento_reset_senha_clinica').insert(linha);
  if (error) console.error('[atendimento/senha-clinica-resetar] falha ao registrar:', describeError(error));
}

export function criarHandlerSenhaClinica(acao: Acao) {
  const rota = `senha-clinica-${acao}`;
  return async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    if (req.method !== METODO[acao]) {
      res.setHeader('Allow', METODO[acao]);
      res.status(405).json({ success: false, error: 'Método não permitido' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');

    const autorizacao = await autorizarResetSenhaClinica(tokenDoHeader(req.headers.authorization)).catch((err) => {
      console.error(`[atendimento/${rota}] autorização:`, describeError(err));
      return { falha: { status: 500, payload: { success: false, error: 'Erro interno' } } };
    });
    if ('falha' in autorizacao) {
      res.status(autorizacao.falha.status).json(autorizacao.falha.payload);
      return;
    }

    try {
      if (acao === 'buscar') {
        const termo = texto(req.query.termo);
        if (termo.length < 3) {
          res.status(400).json({ success: false, error: 'Digite ao menos 3 letras do nome da clínica.' });
          return;
        }
        res.status(200).json({ success: true, clinicas: await buscarClinicas(termo.slice(0, 80)) });
        return;
      }

      if (acao === 'usuarios') {
        const id = texto(req.query.id);
        if (!ehId(id)) {
          res.status(400).json({ success: false, error: 'Clínica inválida.' });
          return;
        }
        const clinica = await lerClinica(id);
        res.status(200).json({
          success: true,
          clinica: { id: clinica.idInstituicao, nome: clinica.nomeFantasia, razaoSocial: clinica.razaoSocial, ...clinica.detalhes },
          usuarios: clinica.usuariosLaudoWeb,
        });
        return;
      }

      const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}) as Record<string, unknown>;
      const idInstituicao = texto(String(body.idInstituicao ?? ''));
      const idUsuario = texto(String(body.idUsuario ?? ''));
      const senha = typeof body.senha === 'string' ? body.senha : '';
      if (!ehId(idInstituicao) || !ehId(idUsuario)) {
        res.status(400).json({ success: false, error: 'Clínica ou usuário inválido.' });
        return;
      }

      const base = { user_id: autorizacao.acesso.userId, id_instituicao: Number(idInstituicao), id_usuario_web: Number(idUsuario) };
      try {
        const r = await resetarSenhaLaudoWeb(idInstituicao, idUsuario, senha);
        await registrar({
          ...base,
          nome_instituicao: r.nomeClinica,
          usuario_web: r.usuario,
          sucesso: true,
          cadastro_intacto: r.cadastroIntacto,
          diferencas: r.diferencas,
          login_conferido: r.login.status,
          mensagem: r.login.motivo ? r.login.motivo.slice(0, 500) : null,
        });
        if (!r.cadastroIntacto) {
          console.error(`[atendimento/${rota}] cadastro ${idInstituicao} mudou além da senha:`, r.diferencas);
        }
        res.status(200).json({ success: true, ...r });
      } catch (err) {
        await registrar({ ...base, sucesso: false, mensagem: err instanceof Error ? err.message.slice(0, 500) : 'erro' });
        throw err;
      }
    } catch (err) {
      responderErro(res, rota, err);
    }
  };
}

