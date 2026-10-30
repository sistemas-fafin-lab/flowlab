import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.prod.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: locs } = await sb.from('stock_locations').select('id,nome,department,is_principal,rastreavel,controla_consumo');
const ln = id => locs.find(l=>l.id===id)?.nome ?? id;
console.log('== locais'); for (const l of locs) console.log(JSON.stringify(l));
const terms = ['especulo','meio l','cito','convencional','ponta fosca'];
for (const t of terms) {
  const { data } = await sb.from('products').select('id,name,quantity,updated_at').ilike('name', `%${t}%`);
  console.log('== produto', t);
  for (const p of data) {
    const { data: st } = await sb.from('product_stock').select('location_id,quantity').eq('product_id', p.id);
    console.log(`  ${p.name} | total=${p.quantity} | upd=${p.updated_at} | ` + st.map(s=>`${ln(s.location_id)}:${s.quantity}`).join(', '));
    const { data: mv } = await sb.from('stock_movements').select('created_at,type,reason,quantity,from_location_id,to_location_id,request_id').eq('product_id', p.id).gte('created_at','2026-10-13').order('created_at',{ascending:false});
    for (const m of mv) console.log(`     ${m.created_at} ${m.type}/${m.reason} q=${m.quantity} ${ln(m.from_location_id)} -> ${ln(m.to_location_id)} req=${m.request_id}`);
  }
}
