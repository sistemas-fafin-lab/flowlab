// GET /api/atendimento/senha-clinica-usuarios — aba "Resetar senha clínica" (Atendimento).
// Lógica, autorização e auditoria em api/_lib/atendimento/senhaClinica.ts.
import { criarHandlerSenhaClinica } from '../atendimento/senhaClinica.js';

export default criarHandlerSenhaClinica('usuarios');
