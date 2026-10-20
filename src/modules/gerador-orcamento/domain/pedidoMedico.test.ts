import { describe, expect, it } from 'vitest';
import { problemaNosArquivosDoPedido, resolverLeituraDoPedido } from './pedidoMedico';
import type { ItemGeradorOrcamento } from '../types';

const MB = 1024 * 1024;
const arquivo = (nome: string, tipo: string, tamanho = 1 * MB) => ({ name: nome, type: tipo, size: tamanho });

describe('problemaNosArquivosDoPedido', () => {
  it('aceita de 1 a 5 imagens ou PDFs de até 10MB', () => {
    const arquivos = [
      arquivo('pedido.jpg', 'image/jpeg'),
      arquivo('pedido.png', 'image/png'),
      arquivo('verso.heic', 'image/heic'),
      arquivo('pedido.pdf', 'application/pdf'),
      arquivo('limite.pdf', 'application/pdf', 10 * MB),
    ];
    expect(problemaNosArquivosDoPedido(arquivos)).toBeNull();
  });

  it('pede ao menos um arquivo', () => {
    expect(problemaNosArquivosDoPedido([])).toMatch(/ao menos um/i);
  });

  it('recusa mais de 5 arquivos', () => {
    const arquivos = Array.from({ length: 6 }, (_, i) => arquivo(`p${i}.jpg`, 'image/jpeg'));
    expect(problemaNosArquivosDoPedido(arquivos)).toMatch(/até 5 arquivos/i);
  });

  it('recusa arquivo acima de 10MB, dizendo qual', () => {
    expect(problemaNosArquivosDoPedido([arquivo('grande.pdf', 'application/pdf', 10 * MB + 1)])).toMatch(
      /grande\.pdf.*10MB/,
    );
  });

  it('recusa o que não é imagem nem PDF, dizendo qual', () => {
    expect(problemaNosArquivosDoPedido([arquivo('pedido.docx', 'application/msword')])).toMatch(
      /pedido\.docx.*imagens ou PDF/,
    );
  });

  it('aceita PDF sem tipo informado pelo navegador, pela extensão', () => {
    expect(problemaNosArquivosDoPedido([arquivo('PEDIDO.PDF', '')])).toBeNull();
  });
});

describe('resolverLeituraDoPedido', () => {
  const exame = (tuss: string, nome: string): ItemGeradorOrcamento => ({
    tuss,
    nome,
    preco: 10,
    custo: 3,
    elegivelDescontoParticular: true,
    conveniosAceitos: [],
  });
  const hemograma = exame('40304361', 'Hemograma Completo');
  const glicemia = exame('40302040', 'Glicemia de Jejum');
  const lista = [hemograma, glicemia];

  it('separa reconhecidos (com o exame da lista da tela) e sem correspondência', () => {
    const leitura = resolverLeituraDoPedido(
      [
        { nomeNoPedido: 'Hemograma', item: { tuss: '40304361', nome: 'Hemograma Completo' } },
        { nomeNoPedido: 'Vitamina D', item: null },
      ],
      lista,
    );

    expect(leitura).toEqual({
      reconhecidos: [{ nomeNoPedido: 'Hemograma', exame: hemograma }],
      semCorrespondencia: ['Vitamina D'],
    });
  });

  it('item que a tela não tem na lista conta como sem correspondência', () => {
    const leitura = resolverLeituraDoPedido(
      [{ nomeNoPedido: 'TSH', item: { tuss: '40316521', nome: 'TSH' } }],
      lista,
    );

    expect(leitura).toEqual({ reconhecidos: [], semCorrespondencia: ['TSH'] });
  });

  it('o mesmo exame da lista lido duas vezes aparece uma vez só', () => {
    const leitura = resolverLeituraDoPedido(
      [
        { nomeNoPedido: 'Glicose', item: { tuss: '40302040', nome: 'Glicemia de Jejum' } },
        { nomeNoPedido: 'Glicemia', item: { tuss: '40302040', nome: 'Glicemia de Jejum' } },
      ],
      lista,
    );

    expect(leitura.reconhecidos).toEqual([{ nomeNoPedido: 'Glicose', exame: glicemia }]);
  });
});
