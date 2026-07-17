// Re-exporta do contexto para manter compatibilidade com todos os imports existentes.
// A lógica foi migrada para React Context (AuthProvider) para eliminar
// instâncias duplicadas do hook que causavam subscriptions múltiplas e
// desmontagem do estado de erro durante o fluxo de login.
export { useAuth, AuthProvider } from '../contexts/AuthContext';
