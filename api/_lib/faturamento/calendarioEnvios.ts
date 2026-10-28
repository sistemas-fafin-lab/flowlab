// api/_lib/faturamento/calendarioEnvios.ts
// Calendário de envios do Faturamento (.scratch/faturamento-calendario-envios/spec.md).
// Módulo puro: não acessa banco nem relógio. Datas são 'YYYY-MM-DD' e os feriados
// entram por parâmetro. As funções de dia útil do recurso de glosa e da EVA ignoram
// feriados e ficam como estão; as do calendário moram aqui.

/** Janela em que o convênio aceita o envio. Uma Regra de envio tem uma ou mais. */
export type JanelaEnvio =
  | { tipo: 'dias_corridos'; de: number; ate: number } // "1 ao 15", "até o 19" (de = 1)
  | { tipo: 'dias_uteis'; de: number; ate: number } // "1º ao 5º dia útil", "15º e 16º"
  | { tipo: 'dias_fixos'; dias: number[] } // "dia 03 e 16"
  | { tipo: 'ultimo_dia_util' }
  | { tipo: 'todos_os_dias' }
  | { tipo: 'calendario_convenio' }; // datas lançadas à mão

/** Dia da semana de 'YYYY-MM-DD' (0 = domingo), sem depender do fuso do servidor. */
function diaDaSemana(data: string): number {
  return new Date(`${data}T00:00:00Z`).getUTCDay();
}

/** 'YYYY-MM-DD' somado de `dias` dias corridos. */
export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Segunda a sexta e fora dos feriados. */
export function ehDiaUtil(data: string, feriados: readonly string[]): boolean {
  const semana = diaDaSemana(data);
  return semana !== 0 && semana !== 6 && !feriados.includes(data);
}

/** O primeiro dia útil depois de `data`: numa sexta, a segunda; na véspera de feriado, pula o feriado. */
export function proximoDiaUtil(data: string, feriados: readonly string[]): string {
  let dia = somarDias(data, 1);
  while (!ehDiaUtil(dia, feriados)) dia = somarDias(dia, 1);
  return dia;
}

/** Dias úteis do mês de `data`, em ordem. */
function diasUteisDoMes(data: string, feriados: readonly string[]): string[] {
  const dias: string[] = [];
  for (let dia = `${data.slice(0, 7)}-01`; dia.slice(0, 7) === data.slice(0, 7); dia = somarDias(dia, 1)) {
    if (ehDiaUtil(dia, feriados)) dias.push(dia);
  }
  return dias;
}

/** O dia `dia` do mês de `data`; se não é dia útil, o próximo dia útil. */
function diaFixoAjustado(data: string, dia: number, feriados: readonly string[]): string {
  const fixo = `${data.slice(0, 7)}-${String(dia).padStart(2, '0')}`;
  return ehDiaUtil(fixo, feriados) ? fixo : proximoDiaUtil(fixo, feriados);
}

function janelaContem(janela: JanelaEnvio, data: string, feriados: readonly string[]): boolean {
  switch (janela.tipo) {
    case 'dias_corridos': {
      const dia = Number(data.slice(8, 10));
      return dia >= janela.de && dia <= janela.ate;
    }
    case 'dias_uteis': {
      const ordem = diasUteisDoMes(data, feriados).indexOf(data) + 1;
      return ordem >= janela.de && ordem <= janela.ate;
    }
    case 'dias_fixos':
      return janela.dias.some((dia) => diaFixoAjustado(data, dia, feriados) === data);
    case 'ultimo_dia_util':
      return diasUteisDoMes(data, feriados).at(-1) === data;
    case 'todos_os_dias':
    case 'calendario_convenio':
      return true;
  }
}

/**
 * Índice da primeira janela da regra que contém `data`, ou null quando a data cai fora
 * de todas. "Todos os dias" e "calendário do convênio" aceitam qualquer data.
 */
export function janelaDaData(data: string, janelas: readonly JanelaEnvio[], feriados: readonly string[]): number | null {
  const indice = janelas.findIndex((janela) => janelaContem(janela, data, feriados));
  return indice === -1 ? null : indice;
}

/** Último dia do mês de `data`. */
export function fimDoMes(data: string): string {
  return somarDias(`${somarDias(`${data.slice(0, 7)}-28`, 4).slice(0, 7)}-01`, -1);
}

/**
 * Os dias em que a janela termina no mês de `data` (dias fixos terminam em cada dia),
 * ou null para as janelas sem fim: "todos os dias" e "calendário do convênio".
 */
function finsDaJanela(janela: JanelaEnvio, data: string, feriados: readonly string[]): string[] | null {
  switch (janela.tipo) {
    case 'dias_corridos': {
      const ate = `${data.slice(0, 7)}-${String(janela.ate).padStart(2, '0')}`;
      const fim = fimDoMes(data);
      return [ate < fim ? ate : fim];
    }
    case 'dias_uteis': {
      const uteis = diasUteisDoMes(data, feriados);
      return [uteis[Math.min(janela.ate, uteis.length) - 1]];
    }
    case 'dias_fixos':
      return janela.dias.map((dia) => diaFixoAjustado(data, dia, feriados));
    case 'ultimo_dia_util':
      return [diasUteisDoMes(data, feriados).at(-1) as string];
    case 'todos_os_dias':
    case 'calendario_convenio':
      return null;
  }
}

/**
 * O último dia para enviar o agendamento sem estourar a janela, ou null quando não há
 * prazo. Dentro de uma janela, o fim dela; fora de todas, o fim da próxima janela do
 * mês; depois de todas, o próprio dia previsto.
 */
function prazoDoAgendamento(dataPrevista: string, janelas: readonly JanelaEnvio[], feriados: readonly string[]): string | null {
  const indice = janelaDaData(dataPrevista, janelas, feriados);
  const candidatas = indice === null ? janelas : [janelas[indice]];
  const fins: string[] = [];
  for (const janela of candidatas) {
    const daJanela = finsDaJanela(janela, dataPrevista, feriados);
    if (!daJanela) return null;
    fins.push(...daJanela.filter((fim) => fim >= dataPrevista));
  }
  return fins.length > 0 ? fins.reduce((a, b) => (a < b ? a : b)) : dataPrevista;
}

/**
 * A data prevista ou a de envio cai fora de todas as janelas da regra no mês do
 * agendamento. Regras com "todos os dias" ou "calendário do convênio" nunca caem.
 */
function foraDaJanelaDoMes(
  { dataPrevista, dataEnvio }: { dataPrevista: string; dataEnvio: string | null },
  janelas: readonly JanelaEnvio[],
  feriados: readonly string[],
): boolean {
  if (janelas.some((janela) => finsDaJanela(janela, dataPrevista, feriados) === null)) return false;
  const datas = dataEnvio ? [dataPrevista, dataEnvio] : [dataPrevista];
  return datas.some((data) => data.slice(0, 7) !== dataPrevista.slice(0, 7) || janelaDaData(data, janelas, feriados) === null);
}

/** Status de um Agendamento de envio (regras de status da spec). */
export type StatusAgendamento = 'pendente' | 'enviado' | 'atrasado' | 'fora_do_prazo';

export interface ClassificacaoAgendamento {
  status: StatusAgendamento;
  /** Selo cinza, só informativo: a data prevista ou a de envio cai fora de todas as janelas no mês. */
  foraDaJanela: boolean;
}

/**
 * Classifica o agendamento em `hoje`. Os painéis, o bloco Atrasados e o contador do
 * menu usam todos esta função; as telas não recalculam.
 */
export function classificarAgendamento(
  agendamento: { dataPrevista: string; dataEnvio: string | null },
  regra: { janelas: readonly JanelaEnvio[] },
  feriados: readonly string[],
  hoje: string,
): ClassificacaoAgendamento {
  const foraDaJanela = foraDaJanelaDoMes(agendamento, regra.janelas, feriados);
  if (agendamento.dataEnvio) return { status: 'enviado', foraDaJanela };
  const prazo = prazoDoAgendamento(agendamento.dataPrevista, regra.janelas, feriados);
  if (prazo !== null && hoje > prazo) return { status: 'fora_do_prazo', foraDaJanela };
  if (hoje > agendamento.dataPrevista) return { status: 'atrasado', foraDaJanela };
  return { status: 'pendente', foraDaJanela };
}

/**
 * A lista "Pode enviar qualquer dia": as regras ativas com janela de "todos os dias",
 * que a equipe agenda no dia que escolher. Mantém a ordem recebida.
 */
export function regrasDeQualquerDia<R extends { janelas: readonly JanelaEnvio[]; ativo: boolean }>(regras: readonly R[]): R[] {
  return regras.filter((regra) => regra.ativo && regra.janelas.some((janela) => janela.tipo === 'todos_os_dias'));
}

const TIPOS_JANELA: readonly JanelaEnvio['tipo'][] = [
  'dias_corridos',
  'dias_uteis',
  'dias_fixos',
  'ultimo_dia_util',
  'todos_os_dias',
  'calendario_convenio',
];

/** Um mês tem no máximo 31 dias e 23 dias úteis. */
const MAXIMO_DIA_CORRIDO = 31;
export const MAXIMO_DIA_UTIL = 23;

const diaEntre = (valor: unknown, maximo: number): valor is number =>
  Number.isInteger(valor) && (valor as number) >= 1 && (valor as number) <= maximo;

/** Uma janela vinda do cadastro, só com os campos do tipo dela. */
function validarJanela(bruta: unknown): { janela: JanelaEnvio } | { erro: string } {
  const janela = (bruta && typeof bruta === 'object' ? bruta : {}) as Record<string, unknown>;
  const tipo = janela.tipo as JanelaEnvio['tipo'];
  if (!TIPOS_JANELA.includes(tipo)) return { erro: 'tipo de janela inválido.' };
  switch (tipo) {
    case 'dias_corridos':
    case 'dias_uteis': {
      const maximo = tipo === 'dias_uteis' ? MAXIMO_DIA_UTIL : MAXIMO_DIA_CORRIDO;
      const { de, ate } = janela;
      if (!diaEntre(de, maximo) || !diaEntre(ate, maximo)) {
        return { erro: `${tipo === 'dias_uteis' ? 'dias úteis' : 'dias corridos'} vão de 1 a ${maximo}.` };
      }
      if (de > ate) return { erro: `o início (${de}) passa do fim (${ate}).` };
      return { janela: { tipo, de, ate } };
    }
    case 'dias_fixos': {
      const dias = janela.dias;
      if (!Array.isArray(dias) || dias.length === 0) return { erro: 'informe ao menos um dia.' };
      if (!dias.every((dia) => diaEntre(dia, MAXIMO_DIA_CORRIDO))) {
        return { erro: `dias fixos vão de 1 a ${MAXIMO_DIA_CORRIDO}.` };
      }
      return { janela: { tipo, dias: [...new Set(dias as number[])].sort((a, b) => a - b) } };
    }
    default:
      return { janela: { tipo } };
  }
}

/**
 * As janelas de uma Regra de envio vindas do cadastro: ao menos uma, cada uma só com
 * os campos do tipo dela. A mensagem de erro diz qual janela está errada.
 */
export function validarJanelas(brutas: unknown): { janelas: JanelaEnvio[] } | { erro: string } {
  if (!Array.isArray(brutas) || brutas.length === 0) return { erro: 'Informe ao menos uma janela.' };
  const janelas: JanelaEnvio[] = [];
  for (const [i, bruta] of brutas.entries()) {
    const lida = validarJanela(bruta);
    if ('erro' in lida) return { erro: `Janela ${i + 1}: ${lida.erro}` };
    janelas.push(lida.janela);
  }
  return { janelas };
}

/** Um Agendamento de envio do mês, como a sugestão o vê. */
export interface AgendamentoDoMes {
  id: string;
  regraId: string;
  dataPrevista: string;
  origem: 'sugestao' | 'manual';
  editado: boolean;
  dataEnvio: string | null;
}

/** Um agendamento que a sugestão cria (origem "sugestão"). */
export interface AgendamentoSugerido {
  regraId: string;
  dataPrevista: string;
  janelaIndice: number | null;
}

/**
 * Uma vaga da sugestão: um agendamento a pôr num dos `dias`, no de menor carga. As
 * vagas são postas por fase (1: dias fixos e último dia útil; 2: faixas; 3: "todos os
 * dias") e, dentro da fase, das mais estreitas para as mais largas.
 */
interface Vaga {
  regraId: string;
  /** Null na faixa sem dia útil no mês, posta no dia útil seguinte a ela. */
  janelaIndice: number | null;
  fase: 1 | 2 | 3;
  dias: string[];
}

/** As vagas de uma janela no mês. */
function vagasDaJanela(
  { id: regraId, enviosSugeridosMes }: { id: string; enviosSugeridosMes: number | null },
  janela: JanelaEnvio,
  janelaIndice: number,
  uteis: string[],
  feriados: readonly string[],
): Vaga[] {
  // Faixa sem dia útil no mês (só fim de semana e feriado, ou além do último dia útil):
  // o primeiro dia útil depois dela, ou o último dia útil do mês.
  const faixa = (dias: string[], ultimoDia: number): Vaga[] => {
    if (dias.length > 0) return [{ regraId, janelaIndice, fase: 2, dias }];
    const seguinte = uteis.find((dia) => Number(dia.slice(8, 10)) > ultimoDia) ?? (uteis.at(-1) as string);
    return [{ regraId, janelaIndice: null, fase: 2, dias: [seguinte] }];
  };
  switch (janela.tipo) {
    case 'dias_corridos':
      return faixa(uteis.filter((dia) => Number(dia.slice(8, 10)) >= janela.de && Number(dia.slice(8, 10)) <= janela.ate), janela.ate);
    case 'dias_uteis':
      return faixa(uteis.slice(janela.de - 1, janela.ate), 31);
    case 'dias_fixos': {
      // O dia 31 num mês de 30 é o último dia; se o próximo dia útil sai do mês, fica o último dia útil.
      const fim = fimDoMes(uteis[0]);
      const datas = janela.dias.map((dia) => {
        const ajustado = diaFixoAjustado(uteis[0], Math.min(dia, Number(fim.slice(8, 10))), feriados);
        return ajustado <= fim ? ajustado : (uteis.at(-1) as string);
      });
      return [...new Set(datas)].map((dia) => ({ regraId, janelaIndice, fase: 1, dias: [dia] }));
    }
    case 'ultimo_dia_util':
      return [{ regraId, janelaIndice, fase: 1, dias: [uteis.at(-1) as string] }];
    case 'todos_os_dias': {
      // N trechos seguidos de dias úteis, do tamanho mais parecido possível.
      const trechos = Math.min(enviosSugeridosMes ?? 0, uteis.length);
      return Array.from({ length: trechos }, (_, i) => ({
        regraId,
        janelaIndice,
        fase: 3 as const,
        dias: uteis.slice(Math.floor((i * uteis.length) / trechos), Math.floor(((i + 1) * uteis.length) / trechos)),
      }));
    }
    case 'calendario_convenio':
      return [];
  }
}

/** Distância em dias de `data` até o dia mais próximo da vaga. */
function distancia(vaga: Vaga, data: string): number {
  const alvo = Date.parse(data);
  return Math.min(...vaga.dias.map((dia) => Math.abs(Date.parse(dia) - alvo)));
}

/** O sugerido pendente e não editado: é o único que a sugestão refaz. */
const ehRefeito = (a: AgendamentoDoMes): boolean => a.origem === 'sugestao' && !a.editado && a.dataEnvio === null;

/**
 * Tira de `vagas` as que os agendamentos que ficam já ocupam. Na janela, ocupa a vaga
 * daquela janela que contém o dia (num trecho de "todos os dias", o trecho em que caiu);
 * se ela já foi ocupada, é um envio extra. Fora de todas as janelas, o sugerido movido
 * à mão ocupa a vaga livre mais próxima da regra, e o manual é um envio extra.
 */
function ocuparVagas(
  vagas: Vaga[],
  mantidos: readonly AgendamentoDoMes[],
  janelasPorRegra: Map<string, readonly JanelaEnvio[]>,
  feriados: readonly string[],
): Vaga[] {
  const livres = [...vagas];
  const ocupar = (vaga: Vaga | undefined) => {
    if (vaga) livres.splice(livres.indexOf(vaga), 1);
  };
  const foraDaJanela: AgendamentoDoMes[] = [];
  for (const agendamento of mantidos) {
    const janelas = janelasPorRegra.get(agendamento.regraId);
    if (!janelas) continue;
    const indice = janelaDaData(agendamento.dataPrevista, janelas, feriados);
    if (indice === null) {
      if (agendamento.origem === 'sugestao') foraDaJanela.push(agendamento);
      continue;
    }
    ocupar(livres.find((v) => v.regraId === agendamento.regraId && v.janelaIndice === indice && v.dias.includes(agendamento.dataPrevista)));
  }
  // Depois dos que estão na janela, para não tomarem a vaga deles.
  for (const agendamento of foraDaJanela) {
    const daRegra = livres.filter((v) => v.regraId === agendamento.regraId);
    // No empate, a vaga que vem antes na ordem das janelas.
    ocupar(daRegra.reduce<Vaga | undefined>(
      (melhor, v) => (!melhor || distancia(v, agendamento.dataPrevista) < distancia(melhor, agendamento.dataPrevista) ? v : melhor),
      undefined,
    ));
  }
  return livres;
}

/**
 * A sugestão do mês `mes` ('YYYY-MM'), pelas Regras da sugestão da spec: os
 * agendamentos a criar e os ids a remover, a partir das regras (só as ativas geram),
 * dos feriados e dos agendamentos que o mês já tem.
 *
 * - Só os sugeridos pendentes e não editados são refeitos; manuais, editados e
 *   enviados ficam, contam na carga e ocupam a janela deles (ocuparVagas).
 * - Cada vaga vai para o dia de menor carga e, no empate, o mais cedo. A carga é a de
 *   todos os convênios: o que fica mais o que a sugestão já pôs.
 * - O sugerido refeito que cairia no mesmo dia continua: gerar de novo sem mudança não
 *   cria nem remove nada.
 */
export function gerarSugestaoDoMes(
  mes: string,
  regras: readonly { id: string; janelas: readonly JanelaEnvio[]; enviosSugeridosMes: number | null; ativo: boolean }[],
  feriados: readonly string[],
  existentes: readonly AgendamentoDoMes[],
): { criar: AgendamentoSugerido[]; remover: string[] } {
  const uteis = diasUteisDoMes(`${mes}-01`, feriados);
  const ativas = regras.filter((regra) => regra.ativo);
  const doMes = existentes.filter((a) => a.dataPrevista.slice(0, 7) === mes);
  const mantidos = doMes.filter((a) => !ehRefeito(a));
  const refeitos = doMes.filter(ehRefeito);

  const vagas = ocuparVagas(
    ativas.flatMap((regra) => regra.janelas.flatMap((janela, i) => vagasDaJanela(regra, janela, i, uteis, feriados))),
    mantidos,
    new Map(ativas.map((regra) => [regra.id, regra.janelas])),
    feriados,
  )
    // sort é estável: no empate fica a ordem das regras recebidas.
    .sort((a, b) => a.fase - b.fase || a.dias.length - b.dias.length);

  const carga = new Map<string, number>();
  for (const { dataPrevista } of mantidos) carga.set(dataPrevista, (carga.get(dataPrevista) ?? 0) + 1);
  const criar: AgendamentoSugerido[] = [];
  const remover = new Set(refeitos.map((a) => a.id));
  for (const vaga of vagas) {
    const dia = vaga.dias.reduce((melhor, d) => ((carga.get(d) ?? 0) < (carga.get(melhor) ?? 0) ? d : melhor));
    carga.set(dia, (carga.get(dia) ?? 0) + 1);
    const igual = refeitos.find((a) => remover.has(a.id) && a.regraId === vaga.regraId && a.dataPrevista === dia);
    if (igual) remover.delete(igual.id);
    else criar.push({ regraId: vaga.regraId, dataPrevista: dia, janelaIndice: vaga.janelaIndice });
  }
  return { criar, remover: [...remover] };
}
