// Levantamento somente-leitura dos departamentos (texto) dos colaboradores — issue 06.
import dotenv from 'dotenv';
dotenv.config({ path: process.argv[2] });
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data, error } = await sb
  .from('colaboradores')
  .select('id, nome, departamento, status, gestor_id, user_profile_id')
  .order('departamento')
  .order('nome');
if (error) { console.log('ERR', error.message); process.exit(1); }
const nomePorId = new Map(data!.map((c) => [c.id, c.nome]));
for (const c of data!) {
  console.log([c.status, JSON.stringify(c.departamento), c.nome, 'gestor=' + (nomePorId.get(c.gestor_id) ?? '-'), c.user_profile_id ? 'login' : 'sem-login', c.id].join(' | '));
}
