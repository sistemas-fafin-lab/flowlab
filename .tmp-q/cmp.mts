import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod.local' });
import { readFileSync } from 'node:fs';
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data } = await sb.from('custo_exames').select('id,nome,tuss').limit(2000);
const porTuss = new Map<string, string[]>();
for (const e of data!) { const t = e.tuss.trim(); if (!t) continue; porTuss.set(t, [...(porTuss.get(t) ?? []), e.nome]); }
const rows = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const byE = new Map<number, any[]>();
for (const r of rows) if (r.e != null) byE.set(r.e, [...(byE.get(r.e) ?? []), r]);
const desc = (codes: string[]) => codes.map(c => `${c}(${porTuss.get(c)?.length ?? 0})`).join(',');
for (const [e, rs] of byE) {
  const all = [...new Set(rs.map(r => r.c.trim()))];
  const base = [...new Set(rs.filter(r => !r.ex).map(r => r.c.trim()))];
  const baseCat = base.filter(c => porTuss.has(c));
  const allCat = all.filter(c => porTuss.has(c));
  console.log(`${e}\tA(todos)=${desc(all)}\n\tB(Excecao=0)=${desc(base)}\n\tB∩cat=${desc(baseCat)}  todos∩cat=${desc(allCat)}`);
}
