/**
 * URL base pública do app, usada em links que vão dentro de emails.
 *
 * Os emails são enviados ao solicitante e devem SEMPRE apontar para a aplicação
 * publicada — inclusive quando o email é disparado a partir do ambiente local
 * (onde `window.location.origin` seria `http://localhost:5173`).
 *
 * Configurável via `VITE_APP_URL`; quando não definida, usa a URL de produção.
 */
export const APP_BASE_URL = (
  import.meta.env.VITE_APP_URL || 'https://flow-lab.vercel.app'
).replace(/\/+$/, '');
