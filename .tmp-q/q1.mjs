import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const sb = createClient(env.SUPABASE_URL||env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const terms = ['especulo','meio','bloco','convencional','lâmina','lamina'];
for (const t of terms) {
  const { data, error } = await sb.from('products').select('id,name,code,quantity,location,updated_at').ilike('name', `%${t}%`);
  if (error) { console.log(t, error); continue; }
  console.log('==', t); for (const p of data) console.log(JSON.stringify(p));
}
