// Validação manual do seam 3 (spec: Testing Decisions) — trigger
// quotation_guard_info_edit e concessão da migration 20261019120000.
// Roda contra o projeto Supabase de TESTE, DEPOIS de colar a migration no SQL
// Editor de teste. Usa os usuários do seed de cotacoes-aprovacao-gestor.
//
//   set -a; . ./.env.development.local; set +a
//   node .scratch/cotacoes-edicao-informacoes/validar-trigger-teste.mjs
//
// Cria cotações COT-TESTE-INFO-* (apagadas no início de cada rodada) e um
// cargo temporário "TESTE só Administrar Cotações", que é removido no fim; o
// usuário "outro" volta ao cargo Operador.
import { createRequire } from 'node:module';

const require = createRequire('/home/erudhir101/projects/flowlab/package.json');
const { createClient } = require('@supabase/supabase-js');

const TEST_REF = 'eqzqkztgzcngnxmihdom';
const url = process.env.SUPABASE_URL ?? '';
if (!url.includes(TEST_REF)) {
  console.error(`Abortado: SUPABASE_URL não é o projeto de teste (${TEST_REF}).`);
  process.exit(2);
}
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PASSWORD = 'FlowLab-Teste-2026!';
const OPERADOR = 'a0000000-0000-0000-0000-000000000002';
const SYSTEM_UUID = '00000000-0000-0000-0000-000000000000';
const EMAIL = {
  comprador: 'ti+flow-comprador@laboratoriolab.com.br', // Operador: tem canCreateQuotations → recebe a nova
  semPermissao: 'ti+flow-gestora@laboratoriolab.com.br', // Solicitante: nenhuma das duas
  soAdmin: 'ti+flow-outro@laboratoriolab.com.br', // vai para o cargo temporário
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASSOU' : 'FALHOU'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const must = (label, { data, error }) => {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
};

async function login(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  must(`login ${email}`, await client.auth.signInWithPassword({ email, password: PASSWORD }));
  return client;
}

async function newQuotation(code, status, profileId) {
  return must(`cotação ${code}`, await sb.from('quotations').insert({
    code, title: `TESTE ${code}`, product_name: 'Item teste', requested_quantity: 1,
    status, quotation_type: 'compras', priority: 'medium', department: 'Compras',
    justification: 'Estoque baixo', created_by: profileId, created_by_name: 'TESTE Comprador',
  }).select('id').single()).id;
}

const infoLogs = async (quotationId) => must('logs', await sb.from('quotation_audit_logs')
  .select('performed_by, performed_by_name, details').eq('quotation_id', quotationId).eq('action', 'info_edited'));

async function main() {
  const profiles = must('perfis', await sb.from('user_profiles').select('id, email, custom_role_id').in('email', Object.values(EMAIL)));
  const idOf = (email) => profiles.find((p) => p.email === email).id;

  must('limpeza', await sb.from('quotations').delete().like('code', 'COT-TESTE-INFO-%'));
  must('limpeza cargo', await sb.from('custom_roles').delete().eq('name', 'TESTE só Administrar Cotações'));

  // 8. Concessão da migration
  const roles = must('cargos', await sb.from('custom_roles').select('name, permissions'));
  const semNova = roles.filter((r) => (r.permissions ?? []).includes('canCreateQuotations') && !(r.permissions ?? []).includes('canEditQuotationInfo'));
  check('migration concede canEditQuotationInfo a todo cargo com canCreateQuotations', semNova.length === 0, semNova.map((r) => r.name).join(', '));

  const tempRole = must('cargo temporário', await sb.from('custom_roles').insert({
    name: 'TESTE só Administrar Cotações', description: 'Temporário (validar-trigger-teste.mjs)',
    permissions: ['canViewQuotations', 'canAdministerQuotations'],
  }).select('id').single());
  must('troca de cargo', await sb.from('user_profiles').update({ custom_role_id: tempRole.id }).eq('id', idOf(EMAIL.soAdmin)));

  try {
    const comprador = await login(EMAIL.comprador);
    const semPermissao = await login(EMAIL.semPermissao);
    const soAdmin = await login(EMAIL.soAdmin);
    const owner = idOf(EMAIL.comprador);

    // 1. Com a permissão nova, em cotação aprovada
    const aprovada = await newQuotation('COT-TESTE-INFO-APROVADA', 'approved', owner);
    let r = await comprador.from('quotations').update({ justification: 'Estoque baixo\nRequisição: REQ-866', priority: 'urgent' }).eq('id', aprovada).select('id');
    let logs = await infoLogs(aprovada);
    check('com canEditQuotationInfo edita cotação aprovada', !r.error && r.data?.length === 1, r.error?.message);
    check('  … e grava info_edited com o diff', logs.length === 1
      && logs[0].performed_by === owner
      && logs[0].details?.justification?.para === 'Estoque baixo\nRequisição: REQ-866'
      && logs[0].details?.priority?.de === 'medium' && logs[0].details?.priority?.para === 'urgent'
      && Object.keys(logs[0].details).length === 2, JSON.stringify(logs));

    // 2. Só canAdministerQuotations
    r = await soAdmin.from('quotations').update({ title: 'TESTE editado pelo admin' }).eq('id', aprovada).select('id');
    check('só com canAdministerQuotations edita', !r.error && r.data?.length === 1, r.error?.message);

    // 3. Sem nenhuma das duas
    r = await semPermissao.from('quotations').update({ title: 'não deveria' }).eq('id', aprovada).select('id');
    check('sem permissão recebe erro de permissão', /permissão/.test(r.error?.message ?? ''), r.error?.message ?? 'sem erro');

    // 4. Cancelada e rejeitada
    for (const [status, word] of [['cancelled', 'cancelada'], ['rejected', 'rejeitada']]) {
      const id = await newQuotation(`COT-TESTE-INFO-${status.toUpperCase()}`, status, owner);
      r = await comprador.from('quotations').update({ justification: 'x' }).eq('id', id).select('id');
      check(`cotação ${word} recusa a edição`, new RegExp(word).test(r.error?.message ?? ''), r.error?.message ?? 'sem erro');
    }

    // 5. Validação
    r = await comprador.from('quotations').update({ title: '   ' }).eq('id', aprovada).select('id');
    check('título vazio é recusado', /título/.test(r.error?.message ?? ''), r.error?.message ?? 'sem erro');
    r = await comprador.from('quotations').update({ priority: 'critical' }).eq('id', aprovada).select('id');
    check('prioridade inválida é recusada', /Prioridade inválida/.test(r.error?.message ?? ''), r.error?.message ?? 'sem erro');

    // 6. Sem usuário logado (chave de serviço, como no SQL Editor)
    const rascunho = await newQuotation('COT-TESTE-INFO-RASCUNHO', 'draft', owner);
    r = await sb.from('quotations').update({ cost_center: 'CC-999', title: '  ' }).eq('id', rascunho).select('id');
    logs = await infoLogs(rascunho);
    check('sem usuário logado grava sem checagem (até título vazio)', !r.error, r.error?.message);
    check('  … e registra "Sistema (SQL)" com o UUID fixo', logs.length === 1
      && logs[0].performed_by === SYSTEM_UUID && logs[0].performed_by_name === 'Sistema (SQL)', JSON.stringify(logs));

    // 7. Mudança só de status
    const antes = (await infoLogs(rascunho)).length;
    r = await comprador.from('quotations').update({ status: 'sent_to_suppliers' }).eq('id', rascunho).select('id');
    r = r.error ? r : await comprador.from('quotations').update({ status: 'cancelled' }).eq('id', rascunho).select('id');
    check('mudança só de status passa e não gera info_edited', !r.error && (await infoLogs(rascunho)).length === antes, r.error?.message);
  } finally {
    must('volta de cargo', await sb.from('user_profiles').update({ custom_role_id: OPERADOR }).eq('id', idOf(EMAIL.soAdmin)));
    must('remove cargo temporário', await sb.from('custom_roles').delete().eq('id', tempRole.id));
  }

  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - failed}/${results.length} cenários passaram.`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
