// POST /api/atendimento/senha-clinica-resetar — aba "Resetar senha clínica" (Atendimento).
// Lógica, autorização e auditoria em api/_lib/atendimento/senhaClinica.ts.
import { criarHandlerSenhaClinica } from '../atendimento/senhaClinica.js';

export default criarHandlerSenhaClinica('resetar');
