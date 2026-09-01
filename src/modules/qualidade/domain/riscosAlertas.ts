// Cálculo dos alertas do dashboard da aba Riscos
// (.scratch/qualidade-riscos-indicadores/issues/04-riscos-dashboard-mapa-alertas.md)
// — agregação pura (mesmo padrão de riscosClassificacao.ts/riscosGerenciamento.ts),
// sem I/O. A data de referência ("hoje") é sempre argumento explícito — nenhuma
// função aqui chama `new Date()`/`NOW()` (mesmo princípio já usado em
// `periodoParaIntervalo`, types.ts). Quem decide "agora" é sempre quem chama
// (riscos.ts).

import type { AlertaRiscoDTO, PlanoAcaoDTO, ReavaliacaoRiscoDTO, RiscoDTO, StatusPlanoContingencia } from '../types';

export interface RiscoComHistorico {
  risco: RiscoDTO;
  planosAcao: readonly PlanoAcaoDTO[];
  reavaliacoes: readonly ReavaliacaoRiscoDTO[];
}

/**
 * Contingência reduzida ao que os alertas precisam — `proximoTeste` já
 * resolvido por quem chama a partir do histórico de testes (mesma lógica de
 * `domain/riscosContingencia.ts`: `proximaDataPrevistaAtual`).
 */
export interface ContingenciaParaAlerta {
  id: string;
  codigo: string;
  evento: string;
  status: StatusPlanoContingencia;
  proximoTeste: string | null;
}

function riscosCriticosSemPlano(riscos: readonly RiscoComHistorico[]): AlertaRiscoDTO[] {
  return riscos
    .filter((r) => r.risco.nivel === 'critico' && r.planosAcao.length === 0)
    .map((r) => ({
      tipo: 'critico_sem_plano',
      riscoId: r.risco.id,
      planoAcaoId: null,
      planoContingenciaId: null,
      mensagem: `Risco crítico "${r.risco.riscoIdentificado}" (${r.risco.setorNome ?? r.risco.setorId}) sem plano de ação.`,
    }));
}

function acoesVencidas(riscos: readonly RiscoComHistorico[], hoje: string): AlertaRiscoDTO[] {
  const alertas: AlertaRiscoDTO[] = [];
  for (const r of riscos) {
    for (const plano of r.planosAcao) {
      if (plano.status !== 'concluido' && plano.dataPrevista != null && plano.dataPrevista < hoje) {
        alertas.push({
          tipo: 'acao_vencida',
          riscoId: r.risco.id,
          planoAcaoId: plano.id,
          planoContingenciaId: null,
          mensagem: `Ação "${plano.acao}" do risco "${r.risco.riscoIdentificado}" está vencida (prazo ${plano.dataPrevista}).`,
        });
      }
    }
  }
  return alertas;
}

/** Aguardando reavaliação: tem ao menos um plano concluído e nenhuma reavaliação registrada depois da conclusão mais recente. */
function riscosAguardandoReavaliacao(riscos: readonly RiscoComHistorico[]): AlertaRiscoDTO[] {
  const alertas: AlertaRiscoDTO[] = [];
  for (const r of riscos) {
    const concluidos = r.planosAcao.filter((p) => p.status === 'concluido' && p.dataConclusao != null);
    if (concluidos.length === 0) continue;

    const conclusaoMaisRecente = concluidos.reduce((mais, atual) =>
      (atual.dataConclusao as string) > (mais.dataConclusao as string) ? atual : mais,
    ).dataConclusao as string;

    const temReavaliacaoPosterior = r.reavaliacoes.some((rv) => rv.reavaliadoEm > conclusaoMaisRecente);
    if (!temReavaliacaoPosterior) {
      alertas.push({
        tipo: 'aguardando_reavaliacao',
        riscoId: r.risco.id,
        planoAcaoId: null,
        planoContingenciaId: null,
        mensagem: `Risco "${r.risco.riscoIdentificado}" tem plano de ação concluído aguardando reavaliação.`,
      });
    }
  }
  return alertas;
}

function contingenciasAVencer(
  planos: readonly ContingenciaParaAlerta[],
  hoje: string,
  diasAlerta: number,
): AlertaRiscoDTO[] {
  const limite = adicionarDias(hoje, diasAlerta);
  return planos
    .filter((p) => p.status === 'ativo' && p.proximoTeste != null && p.proximoTeste <= limite)
    .map((p) => ({
      tipo: 'contingencia_a_vencer',
      riscoId: null,
      planoAcaoId: null,
      planoContingenciaId: p.id,
      mensagem:
        p.proximoTeste! < hoje
          ? `Plano de contingência "${p.codigo}" (${p.evento}) está com teste vencido.`
          : `Plano de contingência "${p.codigo}" (${p.evento}) precisa ser testado até ${p.proximoTeste}.`,
    }));
}

/** Soma dias a uma data `YYYY-MM-DD` sem depender de fuso/hora local — só aritmética de calendário UTC. */
function adicionarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

export function calcularAlertasRiscos(
  riscos: readonly RiscoComHistorico[],
  planosContingencia: readonly ContingenciaParaAlerta[],
  hoje: string,
  diasAlertaContingencia: number,
): AlertaRiscoDTO[] {
  return [
    ...riscosCriticosSemPlano(riscos),
    ...acoesVencidas(riscos, hoje),
    ...riscosAguardandoReavaliacao(riscos),
    ...contingenciasAVencer(planosContingencia, hoje, diasAlertaContingencia),
  ];
}
