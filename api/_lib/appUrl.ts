// api/_lib/appUrl.ts
// URL base pública do app para links dentro de emails disparados server-side
// (sem window.location/import.meta.env disponíveis aqui). Espelha
// src/utils/appUrl.ts — mesmo fallback de produção, variável de ambiente
// própria do lado servidor (`APP_URL`, não `VITE_APP_URL`).
export const APP_BASE_URL = (process.env.APP_URL || 'https://flow-lab.vercel.app').replace(/\/+$/, '');
