// Regras puras de data do módulo analises-clinicas. Tudo aqui é local-time
// (meia-noite local, chaves YYYY-MM-DD locais) e recebe `agora`/`hoje` por
// parâmetro quando precisa de "o dia de hoje" — assim as regras são testáveis
// sem relógio global e sem montar uma página.

import { dayKey } from '../../../utils/datas';

export { dayKey };

// Hoje em YYYY-MM-DD local (en-CA usa o formato ISO). Teto dos seletores de
// data e piso do "retroativo".
export const hojeISO = (agora: Date = new Date()): string =>
  agora.toLocaleDateString('en-CA');

// Instante ISO → chave YYYY-MM-DD no fuso local do navegador.
export const dataKeyDeIso = (iso: string): string => new Date(iso).toLocaleDateString('en-CA');

// Chave YYYY-MM-DD → Date na meia-noite local. Sem recuo de fuso: ao contrário
// de new Date('YYYY-MM-DD') (UTC), 'YYYY-MM-DDT00:00:00' é meia-noite local.
export const parseDataLocal = (dateKey: string): Date => new Date(`${dateKey}T00:00:00`);

// Janela completa de um dia local (chave YYYY-MM-DD): da meia-noite ao último
// milissegundo — os limites usados para filtrar timestamptz por um dia local.
export const janelaDoDia = (dateKey: string): { inicio: Date; fim: Date } => ({
  inicio: parseDataLocal(dateKey),
  fim: new Date(`${dateKey}T23:59:59.999`),
});

// Chave YYYY-MM-DD → "seg., 05/08". Meia-noite local evita o recuo de fuso.
export const fmtDiaSemana = (dateKey: string): string =>
  parseDataLocal(dateKey).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

// Como chamar um dia JÁ PASSADO escolhido no calendário (chave YYYY-MM-DD local).
// Quem lança agendamento retroativo precisa enxergar de imediato que aquele dia
// ficou para trás. null = hoje ou futuro.
export const rotuloDiaPassado = (dateKey: string, hoje: string = hojeISO()): string | null => {
  if (dateKey >= hoje) return null;
  const [ano, mes, dia] = hoje.split('-').map(Number);
  const ontem = dayKey(new Date(ano, mes - 1, dia - 1));
  return dateKey === ontem ? 'ontem' : 'retroativo';
};

// A grade de disponibilidade tem alguma data já passada? A janela retroativa do
// operador existe porque o lançamento é assíncrono: o atendimento já aconteceu.
export const temDataRetroativa = (datas: string[], hoje: string = hojeISO()): boolean =>
  datas.some((d) => d < hoje);

// O horário escolhido (ISO) já passou?
export const ehSlotRetroativo = (slotIso: string, agora: Date = new Date()): boolean =>
  Boolean(slotIso) && new Date(slotIso).getTime() < agora.getTime();
