import { describe, expect, it } from 'vitest';
import { calcularAlertasRiscos, type ContingenciaParaAlerta, type RiscoComHistorico } from './riscosAlertas';
import type { PlanoAcaoDTO, ReavaliacaoRiscoDTO, RiscoDTO } from '../types';

const hoje = '2026-08-31';

function risco(sobras: Partial<RiscoDTO> = {}): RiscoDTO {
  return {
    id: 'r1',
    setorId: 's1',
    setorNome: 'Histologia',
    processo: 'Microtomia',
    riscoIdentificado: 'Perda de material durante o corte',
    causa: null,
    consequencia: null,
    controleExistente: null,
    origemRisco: 'outro',
    ocorrenciaOrigemId: null,
    probabilidade: 3,
    severidade: 5,
    score: 15,
    nivel: 'alto',
    tratamento: 'reduzir',
    criadoPor: 'u1',
    criadoEm: '2026-01-01T00:00:00Z',
    ...sobras,
  };
}

function plano(sobras: Partial<PlanoAcaoDTO> = {}): PlanoAcaoDTO {
  return {
    id: 'p1',
    riscoId: 'r1',
    acao: 'Dupla conferência antes do corte',
    responsavelId: 'u2',
    responsavelNome: 'Supervisão',
    dataPrevista: '2026-01-31',
    dataConclusao: null,
    status: 'em_andamento',
    evidencias: [],
    eficaz: null,
    avaliadoEm: null,
    avaliadoPor: null,
    observacaoEficacia: null,
    planoAnteriorId: null,
    criadoPor: 'u1',
    criadoEm: '2026-01-01T00:00:00Z',
    ...sobras,
  };
}

function reavaliacao(sobras: Partial<ReavaliacaoRiscoDTO> = {}): ReavaliacaoRiscoDTO {
  return {
    id: 'rv1',
    riscoId: 'r1',
    probabilidade: 2,
    severidade: 5,
    score: 10,
    observacao: null,
    reavaliadoPor: 'u1',
    reavaliadoEm: '2026-02-01T00:00:00Z',
    ...sobras,
  };
}

function contingencia(sobras: Partial<ContingenciaParaAlerta> = {}): ContingenciaParaAlerta {
  return {
    id: 'pc1',
    codigo: 'PC-001',
    evento: 'Queda do sistema APLIS',
    status: 'ativo',
    proximoTeste: null,
    ...sobras,
  };
}

function comHistorico(sobras: Partial<RiscoComHistorico> & { risco: RiscoDTO }): RiscoComHistorico {
  return { planosAcao: [], reavaliacoes: [], ...sobras };
}

describe('calcularAlertasRiscos — riscos críticos sem plano', () => {
  it('alerta quando risco crítico não tem nenhum plano de ação', () => {
    const alertas = calcularAlertasRiscos(
      [comHistorico({ risco: risco({ nivel: 'critico' }), planosAcao: [] })],
      [],
      hoje,
      20,
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0].tipo).toBe('critico_sem_plano');
    expect(alertas[0].riscoId).toBe('r1');
  });

  it('não alerta quando risco crítico já tem plano de ação', () => {
    const alertas = calcularAlertasRiscos(
      [comHistorico({ risco: risco({ nivel: 'critico' }), planosAcao: [plano()] })],
      [],
      hoje,
      20,
    );
    expect(alertas.filter((a) => a.tipo === 'critico_sem_plano')).toHaveLength(0);
  });

  it('não alerta para risco alto (só crítico dispara este alerta)', () => {
    const alertas = calcularAlertasRiscos([comHistorico({ risco: risco({ nivel: 'alto' }), planosAcao: [] })], [], hoje, 20);
    expect(alertas.filter((a) => a.tipo === 'critico_sem_plano')).toHaveLength(0);
  });
});

describe('calcularAlertasRiscos — ações vencidas', () => {
  it('alerta quando o prazo já passou e o status não é concluído', () => {
    const alertas = calcularAlertasRiscos(
      [comHistorico({ risco: risco(), planosAcao: [plano({ dataPrevista: '2026-08-01', status: 'em_andamento' })] })],
      [],
      hoje,
      20,
    );
    expect(alertas.some((a) => a.tipo === 'acao_vencida' && a.planoAcaoId === 'p1')).toBe(true);
  });

  it('não alerta quando o plano já está concluído, mesmo com prazo no passado', () => {
    const alertas = calcularAlertasRiscos(
      [
        comHistorico({
          risco: risco(),
          planosAcao: [plano({ dataPrevista: '2026-08-01', status: 'concluido', dataConclusao: '2026-07-30' })],
        }),
      ],
      [],
      hoje,
      20,
    );
    expect(alertas.filter((a) => a.tipo === 'acao_vencida')).toHaveLength(0);
  });

  it('não alerta quando o prazo ainda não chegou', () => {
    const alertas = calcularAlertasRiscos(
      [comHistorico({ risco: risco(), planosAcao: [plano({ dataPrevista: '2026-12-01', status: 'em_andamento' })] })],
      [],
      hoje,
      20,
    );
    expect(alertas.filter((a) => a.tipo === 'acao_vencida')).toHaveLength(0);
  });
});

describe('calcularAlertasRiscos — aguardando reavaliação', () => {
  it('alerta quando o plano concluído mais recente não tem reavaliação posterior', () => {
    const alertas = calcularAlertasRiscos(
      [
        comHistorico({
          risco: risco(),
          planosAcao: [plano({ status: 'concluido', dataConclusao: '2026-08-01' })],
          reavaliacoes: [],
        }),
      ],
      [],
      hoje,
      20,
    );
    expect(alertas.some((a) => a.tipo === 'aguardando_reavaliacao')).toBe(true);
  });

  it('não alerta quando já existe reavaliação após a conclusão', () => {
    const alertas = calcularAlertasRiscos(
      [
        comHistorico({
          risco: risco(),
          planosAcao: [plano({ status: 'concluido', dataConclusao: '2026-01-15' })],
          reavaliacoes: [reavaliacao({ reavaliadoEm: '2026-02-01T00:00:00Z' })],
        }),
      ],
      [],
      hoje,
      20,
    );
    expect(alertas.filter((a) => a.tipo === 'aguardando_reavaliacao')).toHaveLength(0);
  });

  it('não alerta quando nenhum plano de ação foi concluído ainda', () => {
    const alertas = calcularAlertasRiscos(
      [comHistorico({ risco: risco(), planosAcao: [plano({ status: 'em_andamento', dataConclusao: null })] })],
      [],
      hoje,
      20,
    );
    expect(alertas.filter((a) => a.tipo === 'aguardando_reavaliacao')).toHaveLength(0);
  });
});

describe('calcularAlertasRiscos — contingência a vencer', () => {
  it('alerta quando o próximo teste está dentro da janela configurada', () => {
    const alertas = calcularAlertasRiscos([], [contingencia({ proximoTeste: '2026-09-10' })], hoje, 20);
    expect(alertas.some((a) => a.tipo === 'contingencia_a_vencer' && a.planoContingenciaId === 'pc1')).toBe(true);
  });

  it('não alerta quando o próximo teste está fora da janela configurada', () => {
    const alertas = calcularAlertasRiscos([], [contingencia({ proximoTeste: '2027-01-10' })], hoje, 20);
    expect(alertas.filter((a) => a.tipo === 'contingencia_a_vencer')).toHaveLength(0);
  });

  it('alerta quando o teste já está vencido', () => {
    const alertas = calcularAlertasRiscos([], [contingencia({ proximoTeste: '2026-08-01' })], hoje, 20);
    expect(alertas.some((a) => a.tipo === 'contingencia_a_vencer')).toBe(true);
  });

  it('não alerta para plano inativo/em revisão, mesmo com teste a vencer', () => {
    const alertas = calcularAlertasRiscos([], [contingencia({ status: 'inativo', proximoTeste: '2026-09-05' })], hoje, 20);
    expect(alertas.filter((a) => a.tipo === 'contingencia_a_vencer')).toHaveLength(0);
  });

  it('não alerta quando o plano nunca foi testado (sem próximo teste previsto)', () => {
    const alertas = calcularAlertasRiscos([], [contingencia({ proximoTeste: null })], hoje, 20);
    expect(alertas.filter((a) => a.tipo === 'contingencia_a_vencer')).toHaveLength(0);
  });
});
