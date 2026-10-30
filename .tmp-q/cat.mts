import dotenv from 'dotenv';
dotenv.config({ path: process.argv[2] });
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data, error } = await sb.from('custo_exames').select('*').limit(2000);
if (error) { console.log('ERR', error.message); process.exit(1); }
console.log('total', data.length, 'cols', Object.keys(data[0] ?? {}).join(','));
const tuss = ['40601129','40601153','40601269','40601250','40601137','40601161','40601285','40601293','40601323','40601110','40601196','40601200','40601226','40601170','40601188','40601218','40601080','40601277','99902034','40601340','40601145','40601013','40601072'];
for (const t of tuss) { const xs = data.filter((e: any) => e.tuss.trim() === t); console.log(t, xs.length, xs.slice(0,4).map((e: any) => e.nome).join(' | ')); }
