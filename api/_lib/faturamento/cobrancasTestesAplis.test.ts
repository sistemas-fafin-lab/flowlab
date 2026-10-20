import { describe, expect, it } from 'vitest';
import { cobrancasComTestes } from './cobrancasTestesAplis.js';

describe('cobrancasComTestes', () => {
  it('a cobrança traz os testes ativos dos exames ligados a ela, por nome', () => {
    const resultado = cobrancasComTestes(
      [{ IdExameTipo: 30, NomExameTipo: 'PCR', Inativo: 0 }],
      [{ IdExameTipo: 30, CodExame: 51 }],
      [
        { IdExame: 51, IdTeste: 121, NomTeste: 'Genotipagem HPV 28 - PCR', Inativo: 0 },
        { IdExame: 51, IdTeste: 9, NomTeste: 'Gonococos + Clamídia', Inativo: 0 },
        { IdExame: 51, IdTeste: 7, NomTeste: 'Antigo', Inativo: 1 },
        { IdExame: 49, IdTeste: 115, NomTeste: 'Hemograma', Inativo: 0 },
      ],
    );

    expect(resultado).toEqual([
      {
        id: 30,
        nome: 'PCR',
        inativa: false,
        testes: [
          { id: 121, nome: 'Genotipagem HPV 28 - PCR' },
          { id: 9, nome: 'Gonococos + Clamídia' },
        ],
      },
    ]);
  });

  it('19 (Captura Híbrida) traz os testes do exame 22, que não está em fatexameexametipo', () => {
    const [captura] = cobrancasComTestes(
      [{ IdExameTipo: 19, NomExameTipo: 'CAPTURA HIBRIDA', Inativo: 0 }],
      [{ IdExameTipo: 19, CodExame: 29 }],
      [{ IdExame: 22, IdTeste: 121, NomTeste: 'Genotipagem HPV 28 - PCR', Inativo: 0 }],
    );

    expect(captura.testes).toEqual([{ id: 121, nome: 'Genotipagem HPV 28 - PCR' }]);
  });
});
