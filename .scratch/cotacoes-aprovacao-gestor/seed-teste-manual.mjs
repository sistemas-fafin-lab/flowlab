// Seed do ambiente de teste manual — aprovação de cotações pelo gestor do pedido.
// Roda contra o projeto Supabase de TESTE (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
// de .env.development.local). Idempotente: reaproveita usuários/fornecedores e
// recria as cotações COT-TESTE-*.
import { createRequire } from 'node:module';

const require = createRequire('/home/erudhir101/projects/flowlab/package.json');
const { createClient } = require('@supabase/supabase-js');

const TEST_REF = 'eqzqkztgzcngnxmihdom';
const url = process.env.SUPABASE_URL ?? '';
if (!url.includes(TEST_REF)) {
  console.error(`Abortado: SUPABASE_URL não é o projeto de teste (${TEST_REF}).`);
  process.exit(2);
}
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PASSWORD = 'FlowLab-Teste-2026!';
const ROLE = {
  admin: 'a0000000-0000-0000-0000-000000000001',
  operador: 'a0000000-0000-0000-0000-000000000002',
  solicitante: 'a0000000-0000-0000-0000-000000000003',
};

const USERS = [
  { key: 'comprador', name: 'TESTE Comprador', email: 'ti+flow-comprador@laboratoriolab.com.br', role: 'requester', customRole: ROLE.operador, department: 'Compras' },
  { key: 'gestorA', name: 'TESTE Gestor A (sem alçada)', email: 'ti+flow-gestora@laboratoriolab.com.br', role: 'requester', customRole: ROLE.solicitante, department: 'Área técnica' },
  { key: 'gestorB', name: 'TESTE Gestor B (alçada 10 mil)', email: 'ti+flow-gestorb@laboratoriolab.com.br', role: 'requester', customRole: ROLE.solicitante, department: 'Área técnica' },
  { key: 'aprovador', name: 'TESTE Aprovador (alçada 100 mil)', email: 'ti+flow-aprovador@laboratoriolab.com.br', role: 'requester', customRole: ROLE.operador, department: 'Financeiro' },
  { key: 'admin', name: 'TESTE Admin', email: 'ti+flow-admin@laboratoriolab.com.br', role: 'admin', customRole: ROLE.admin, department: 'Financeiro' },
  { key: 'outro', name: 'TESTE Outro usuário', email: 'ti+flow-outro@laboratoriolab.com.br', role: 'requester', customRole: ROLE.operador, department: 'Compras' },
];

// CPF válido determinístico a partir de uma semente de 9 dígitos.
function cpfFromSeed(seed) {
  const d = String(seed).padStart(9, '0').split('').map(Number);
  const dv = (digits) => {
    const sum = digits.reduce((acc, n, i) => acc + n * (digits.length + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(d));
  d.push(dv(d));
  return d.join('');
}

const must = (label, { data, error }) => {
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
};

// listUsers falha neste projeto ("Database error finding users"); o perfil
// tem o mesmo id do Auth, então a busca vai por ele.
async function findAuthUserByEmail(email) {
  const profile = must('profile lookup', await sb.from('user_profiles').select('id').eq('email', email).maybeSingle());
  if (!profile) return null;
  const { data, error } = await sb.auth.admin.getUserById(profile.id);
  return error ? null : data.user;
}

async function ensureUser(u, index) {
  const cpf = cpfFromSeed(987650000 + index);
  must(`whitelist ${u.key}`, await sb.from('user_whitelist').upsert({ cpf, name: u.name, activity: true }, { onConflict: 'cpf' }));

  let authUser = await findAuthUserByEmail(u.email);
  if (!authUser) {
    authUser = must(`auth ${u.key}`, await sb.auth.admin.createUser({
      email: u.email, password: PASSWORD, email_confirm: true,
      user_metadata: { name: u.name, department: u.department },
    })).user;
  } else {
    must(`auth update ${u.key}`, await sb.auth.admin.updateUserById(authUser.id, {
      password: PASSWORD, user_metadata: { name: u.name, department: u.department },
    }));
  }

  must(`profile ${u.key}`, await sb.from('user_profiles').upsert({
    id: authUser.id, email: u.email, name: u.name, role: u.role, custom_role_id: u.customRole,
    department: u.department, cpf, disabled_at: null, deleted_at: null,
  }, { onConflict: 'id' }));
  return authUser.id;
}

async function setApprovalLimit(userId, fields) {
  const existing = must('limit lookup', await sb.from('user_approval_limits').select('id').eq('user_id', userId).maybeSingle());
  if (existing) must('limit update', await sb.from('user_approval_limits').update(fields).eq('id', existing.id));
  else must('limit insert', await sb.from('user_approval_limits').insert({ user_id: userId, ...fields }));
}

const SUPPLIERS = [
  { key: 'alfa', name: 'TESTE Fornecedor Alfa Ltda', cnpj: '00000000000101' },
  { key: 'beta', name: 'TESTE Fornecedor Beta S.A.', cnpj: '00000000000102' },
  { key: 'html', name: 'TESTE Fornecedor & <b>Cia</b>', cnpj: '00000000000103' },
];

async function ensureSupplier(s) {
  const existing = must('supplier lookup', await sb.from('suppliers').select('id').eq('cnpj', s.cnpj).maybeSingle());
  const row = { name: s.name, cnpj: s.cnpj, email: `fornecedor-${s.key}@example.com`, phone: '0000000000', status: 'active', whatsapp: null };
  if (existing) {
    must('supplier update', await sb.from('suppliers').update(row).eq('id', existing.id));
    return existing.id;
  }
  return must('supplier insert', await sb.from('suppliers').insert(row).select('id').single()).id;
}

async function main() {
  const ids = {};
  for (const [i, u] of USERS.entries()) ids[u.key] = await ensureUser(u, i);

  await setApprovalLimit(ids.gestorB, { approval_level: 'level_2', custom_max_amount: 10000, can_approve: true, notes: 'TESTE gestor com alçada' });
  await setApprovalLimit(ids.aprovador, { approval_level: 'level_3', custom_max_amount: null, can_approve: true, notes: 'TESTE aprovador' });

  // Único aprovador pré-existente no teste usa teste@gmail.com (endereço de
  // terceiro): fora da lista de alçada durante os testes.
  const outsider = must('outsider', await sb.from('user_profiles').select('id').eq('email', 'teste@gmail.com').maybeSingle());
  if (outsider) must('outsider limit', await sb.from('user_approval_limits').update({ can_approve: false }).eq('user_id', outsider.id));

  const sup = {};
  for (const s of SUPPLIERS) sup[s.key] = await ensureSupplier(s);

  // SC criada pelo Gestor A — testa o pré-preenchimento do "Gestor do pedido".
  const scReason = 'TESTE SC para cotação C1 (pré-preenchimento do gestor)';
  let sc = must('sc lookup', await sb.from('requests').select('id').eq('reason', scReason).maybeSingle());
  if (!sc) {
    sc = must('sc insert', await sb.from('requests').insert({
      reason: scReason, requested_by: USERS[1].name, requested_by_user_id: ids.gestorA,
      type: 'SC', status: 'approved', department: 'Área técnica',
      items: [{ name: 'Luva nitrílica M', quantity: 10, unit: 'cx' }],
    }).select('id').single());
  }

  // Recria as cotações de teste do zero (cascata leva itens, propostas, aprovações).
  must('cleanup', await sb.from('quotations').delete().like('code', 'COT-TESTE-%'));

  const QUOTATIONS = [
    { code: 'COT-TESTE-C1', title: 'TESTE C1 — gestor sem alçada (fluxo completo)', product: 'Luva nitrílica M', qty: 10, unit: 'cx', winner: ['alfa', 5000], other: ['beta', 6000], requestId: sc.id },
    { code: 'COT-TESTE-C2', title: 'TESTE C2 — gestor rejeita', product: 'Máscara N95', qty: 50, unit: 'un', winner: ['alfa', 5000], other: ['html', 6000] },
    { code: 'COT-TESTE-C3', title: 'TESTE C3 — troca de vencedora acima da alçada', product: 'Centrífuga de bancada', qty: 1, unit: 'un', winner: ['alfa', 8000], other: ['beta', 12000] },
    { code: 'COT-TESTE-C4', title: 'TESTE C4 — gestor com alçada (etapa 2 dispensada)', product: 'Pipeta automática', qty: 5, unit: 'un', winner: ['beta', 5000], other: ['html', 6000] },
    { code: 'COT-TESTE-C5', title: 'TESTE C5 — permissões e valor defasado', product: 'Tubo de coleta EDTA', qty: 100, unit: 'cx', winner: ['alfa', 5000], other: ['beta', 6000] },
  ];

  const supplierName = Object.fromEntries(SUPPLIERS.map((s) => [s.key, s.name]));
  const comprador = USERS[0];

  for (const q of QUOTATIONS) {
    const quotation = must(`quotation ${q.code}`, await sb.from('quotations').insert({
      code: q.code, title: q.title, product_name: q.product, requested_quantity: q.qty,
      status: 'under_review', quotation_type: 'compras', priority: 'medium', department: 'Compras',
      created_by: ids.comprador, created_by_name: comprador.name, request_id: q.requestId ?? null,
      estimated_total: q.winner[1],
    }).select('id').single());

    const item = must(`item ${q.code}`, await sb.from('quotation_items').insert({
      quotation_id: quotation.id, product_name: q.product, quantity: q.qty, unit: q.unit, status: 'pending',
    }).select('id').single());

    let winnerId = null;
    for (const [isWinner, [key, total]] of [[true, q.winner], [false, q.other]]) {
      const proposal = must(`proposal ${q.code}/${key}`, await sb.from('quotation_proposals').insert({
        quotation_id: quotation.id, supplier_id: sup[key], supplier_name: supplierName[key], total_amount: total,
        average_delivery_days: isWinner ? 7 : 10, payment_method: 'boleto', boleto_due_days: 30,
        status: isWinner ? 'selected' : 'rejected', is_winner: isWinner, selected_at: isWinner ? new Date().toISOString() : null,
      }).select('id').single());
      must(`proposal item ${q.code}/${key}`, await sb.from('quotation_proposal_items').insert({
        proposal_id: proposal.id, quotation_item_id: item.id, unit_price: total / q.qty, total_price: total,
        delivery_days: isWinner ? 7 : 10,
      }));
      if (isWinner) winnerId = proposal.id;
    }

    must(`winner ${q.code}`, await sb.from('quotations').update({ selected_proposal_id: winnerId, final_total_amount: q.winner[1] }).eq('id', quotation.id));
    console.log(`ok ${q.code}`);
  }

  console.log(JSON.stringify({ users: USERS.map((u) => ({ name: u.name, email: u.email })), password: PASSWORD, scId: sc.id }, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
