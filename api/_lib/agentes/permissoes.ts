// api/_lib/agentes/permissoes.ts
// Manifesto de permissões por agente de IA: o único lugar do código que diz
// quais operações cada agente pode fazer. Toda rota de agente pergunta aqui
// ("o agente X pode a operação Y?") depois de validar a chave e antes de ler
// os parâmetros. Spec: .scratch/lab-brain-chamados/spec.md (D3, D8).
// As rotas HTTP fazem essa pergunta por autorizarAgente (agentes/rotaAgente.ts).
//
// Sem tabela nem tela na v1: mudar uma permissão é mudar este arquivo.

export type Operacao = 'apoio.ler' | 'chamados.criar' | 'chamados.ler';

const MANIFESTO = {
  'lab-brain': ['apoio.ler', 'chamados.criar', 'chamados.ler'],
} as const satisfies Record<string, readonly Operacao[]>;

export type Agente = keyof typeof MANIFESTO;

export function agentePode(agente: Agente, operacao: Operacao): boolean {
  // O tipo já barra agente desconhecido, mas api/tsconfig.json roda sem strict:
  // um nome fora do manifesto ainda pode chegar aqui e precisa dar "não".
  const operacoes: readonly Operacao[] = MANIFESTO[agente] ?? [];
  return operacoes.includes(operacao);
}
