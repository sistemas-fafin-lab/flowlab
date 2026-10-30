import dotenv from 'dotenv';
dotenv.config();
const { listarLotesFechadosDesde } = await import('../api/_lib/faturamento/bdLab.ts');
const r: any = await listarLotesFechadosDesde('2026-09-25');
if (r.erro) { console.error(r.erro); process.exit(1); }
console.log(JSON.stringify(r.lotes.map((x: any) => ({ id: x.lote.idLote, st: x.lote.status, fech: x.lote.dtaFechamento, criac: x.lote.dtaCriacao, valor: x.lote.valor, fonte: x.lote.fontePagadora?.nome, part: x.particular, prot: x.lote.protocolo }))));
process.exit(0);
