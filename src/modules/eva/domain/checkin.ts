// Check-in diário (D46, issue 34). Puro: a api/ (NodeNext) importa, com ".js".
//
// Às 9h de dia útil, a EVA pergunta a cada membro com WhatsApp (fora quem está ausente) o que entra
// no dia e se há bloqueio. A resposta vira o plano do dia; os bloqueios viram comentário no card e
// aviso aos gestores. Às 10h, os gestores que recebem o relatório de gestão ganham o resumo.
// Quem dispara é o relógio (D44, a cada 10 min); as janelas abaixo evitam perguntar à tarde se o
// relógio ficou fora do ar de manhã.
import { ehDiaUtil, formatarDiaMes, hojeSP, type Dia } from './datas.js';
import { primeiroNome } from './pessoas.js';

/** "HH:MM" em Brasília. */
export function horaSP(agora: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(agora);
}

export const PERGUNTA_DE = '09:00';
export const PERGUNTA_ATE = '12:00';
export const RESUMO_DE = '10:00';
export const RESUMO_ATE = '13:00';

/** O que o relógio faz agora: perguntar (9h–12h) e resumir (10h–13h), só em dia útil. */
export function momentoDoCheckin(agora: Date): { hoje: Dia; perguntar: boolean; resumir: boolean } {
  const hoje = hojeSP(agora);
  const h = horaSP(agora);
  const util = ehDiaUtil(hoje);
  return { hoje, perguntar: util && h >= PERGUNTA_DE && h < PERGUNTA_ATE, resumir: util && h >= RESUMO_DE && h < RESUMO_ATE };
}

/** A pergunta da manhã. `codigos`: os cards dela atrasados ou que vencem hoje, como lembrete. */
export function perguntaDoCheckin(nome: string, codigos: string[] = []): string {
  const n = primeiroNome(nome);
  const lembrete = codigos.length
    ? `\nNo radar: ${codigos.slice(0, 5).join(', ')}${codigos.length > 5 ? ` e mais ${codigos.length - 5}` : ''} (atrasados ou vencendo hoje).`
    : '';
  return `Bom dia${n ? `, ${n}` : ''}! ☀️ Check-in de hoje: o que entra no seu dia? Tem algum bloqueio?${lembrete}\n\nResponde do seu jeito, por texto ou áudio (ex.: "hoje IT-045 e IT-050; o IT-060 está parado esperando o fornecedor").`;
}

export interface BloqueioCheckin { codigo: string; motivo: string }

export interface LinhaCheckin {
  nome: string;
  situacao: 'respondido' | 'sem_resposta' | 'ausente';
  planejados: string[];
  bloqueios: BloqueioCheckin[];
  /** O resumo da resposta, quando ela não cita cards (ex.: "fechando o relatório do RH"). */
  resumo: string | null;
  /** A ausência, já escrita ("de férias até 05/12"). */
  ausencia?: string | null;
}

const ORDEM: Record<LinhaCheckin['situacao'], number> = { respondido: 1, sem_resposta: 2, ausente: 3 };
const curto = (t: string, n = 140) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** O resumo das 10h para os gestores: bloqueios primeiro, depois quem respondeu, quem não respondeu e quem está fora. */
export function montarResumoCheckin(dia: Dia, linhas: LinhaCheckin[], link: string): string {
  const ordenadas = [...linhas].sort((a, b) =>
    (b.bloqueios.length > 0 ? 1 : 0) - (a.bloqueios.length > 0 ? 1 : 0) || ORDEM[a.situacao] - ORDEM[b.situacao] || a.nome.localeCompare(b.nome, 'pt-BR'));
  const corpo = ordenadas.map((l) => {
    const nome = primeiroNome(l.nome) || l.nome;
    if (l.situacao === 'ausente') return `• ${nome}: ${l.ausencia ?? 'ausente'}`;
    if (l.situacao === 'sem_resposta') return `• ${nome}: sem resposta`;
    const plano = l.planejados.length ? l.planejados.join(', ') : l.resumo ? `"${curto(l.resumo)}"` : 'respondeu, sem card citado';
    const bloqueios = l.bloqueios.map((b) => `\n  ⛔ ${b.codigo}: ${curto(b.motivo, 100)}`).join('');
    return `• ${nome}: ${plano}${bloqueios}`;
  });
  const totalBloqueios = linhas.reduce((s, l) => s + l.bloqueios.length, 0);
  const semResposta = linhas.filter((l) => l.situacao === 'sem_resposta').length;
  const rodape = [
    totalBloqueios ? `${totalBloqueios} ${totalBloqueios === 1 ? 'bloqueio' : 'bloqueios'}` : 'Nenhum bloqueio',
    semResposta ? `${semResposta} sem resposta` : null,
  ].filter(Boolean).join(' · ');
  return [`☀️ Check-in da equipe · ${formatarDiaMes(dia)}`, '', ...(corpo.length ? corpo : ['Ninguém foi perguntado hoje.']), '', rodape, `Detalhes no Início: ${link}`].join('\n');
}

/** A confirmação ao membro, montada pelo sistema (regra de ouro: a IA só diz o que foi dito). */
export function confirmacaoDoCheckin(nome: string, planejados: string[], bloqueios: BloqueioCheckin[]): string {
  const n = primeiroNome(nome);
  const juntar = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);
  const partes = [
    `Anotado${n ? `, ${n}` : ''}! ☀️`,
    planejados.length ? `Hoje: ${juntar(planejados)}.` : null,
    bloqueios.length ? `Avisei os gestores ${bloqueios.length === 1 ? 'do bloqueio no' : 'dos bloqueios nos'} ${juntar(bloqueios.map((b) => b.codigo))} e anotei no card.` : null,
    !planejados.length && !bloqueios.length ? 'Bom trabalho hoje 💪' : null,
  ];
  return partes.filter(Boolean).join(' ');
}
