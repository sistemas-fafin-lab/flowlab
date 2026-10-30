// Ajuste da REQ891: retiradas gravadas como transferência Estoque→Estoque (bug de origem).
// Salva o saldo atual em .scratch/estoque-ajuste-req891/antes-do-ajuste.json e grava as
// movimentações de correção; o trigger de stock_movements atualiza product_stock/products.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.prod.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const ESTOQUE = '3e8bf93a-2e62-4ad9-93de-39898b561391';
const AREA = 'bf40a2df-96d6-4239-91e2-22de2788cac3';
const P = {
  esp: '62ed42c8-b76b-4ff1-b591-8d093a14a22e',
  meio: 'b4650b8a-4f16-472d-a102-1c35fcc8ed1a',
  cito: '1667f63b-a7b1-49e4-b89d-f21a9a8e8985',
  conv: '9d2173cc-3786-4ab1-94d2-4bd45a468890',
  lam: '7f24e562-6f57-460d-8fc0-12443d46f146',
};
const ids = Object.values(P);
const locName = id => (id === ESTOQUE ? 'Estoque' : id === AREA ? 'Área técnica' : id.slice(0, 8));

const { data: prods, error: e1 } = await sb.from('products').select('id,name,quantity,unit_price').in('id', ids);
const { data: before, error: e2 } = await sb.from('product_stock').select('*').in('product_id', ids);
if (e1 || e2) { console.log('ERRO lendo saldo', e1 ?? e2); process.exit(1); }

const dir = '.scratch/estoque-ajuste-req891';
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${dir}/antes-do-ajuste.json`, JSON.stringify({ products: prods, product_stock: before }, null, 2));

// Guarda: só aplica se o saldo ainda é o que foi conferido (Estoque 6/12/19/1/39, Área técnica 195).
const esperado = { [P.esp]: 6, [P.meio]: 12, [P.cito]: 19, [P.conv]: 1, [P.lam]: 39 };
const saldo = (pid, loc) => before.find(r => r.product_id === pid && r.location_id === loc)?.quantity;
for (const [pid, q] of Object.entries(esperado)) {
  if (saldo(pid, ESTOQUE) !== q) { console.log('ABORTADO: saldo mudou', pid, saldo(pid, ESTOQUE), '≠', q); process.exit(1); }
}
if (saldo(P.lam, AREA) !== 195) { console.log('ABORTADO: Área técnica mudou', saldo(P.lam, AREA)); process.exit(1); }

const pr = id => prods.find(p => p.id === id);
const note = 'Ajuste REQ891: retirada gravada como transferência Estoque→Estoque (bug de origem)';
const mk = (id, type, qty, from, to, notes) => ({
  product_id: id,
  product_name: pr(id).name,
  type,
  reason: type === 'out' ? 'sale' : 'internal-transfer',
  quantity: qty,
  date: '2026-10-27',
  request_id: 'REQ891',
  authorized_by: 'Ajuste sistema',
  notes,
  from_location_id: from,
  to_location_id: to,
  unit_price: pr(id).unit_price || 0,
});

const rows = [
  mk(P.esp, 'out', 4, ESTOQUE, null, note),
  mk(P.meio, 'out', 2, ESTOQUE, null, note),
  mk(P.cito, 'out', 10, ESTOQUE, null, note),
  mk(P.conv, 'out', 1, ESTOQUE, null, note),
  mk(P.lam, 'transfer', 10, ESTOQUE, AREA, 'Ajuste REQ891: devolve 10 tirados indevidamente da Área técnica'),
  mk(P.lam, 'out', 10, ESTOQUE, null, note),
];
for (const r of rows) {
  const { error } = await sb.from('stock_movements').insert(r);
  if (error) { console.log('ERRO', r.product_name, error); process.exit(1); }
  console.log('ok', r.type, r.quantity, r.product_name.trim());
}

const { data: after } = await sb.from('product_stock').select('product_id,location_id,quantity').in('product_id', ids);
const { data: pa } = await sb.from('products').select('id,name,quantity').in('id', ids);
for (const p of pa) {
  const locs = after.filter(a => a.product_id === p.id).map(a => `${locName(a.location_id)}:${a.quantity}`).join(', ');
  console.log(`${p.name.trim()} | total ${p.quantity} | ${locs}`);
}
