import { describe, expect, it } from 'vitest';
import { fraseDoNaoEncontrado, problemaNosArquivosDoPedido, resolverLeituraDoPedido } from './pedidoMedico';
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
  const semRelacionados = { relacionados: [], tipo: null };

  it('separa reconhecidos (com o exame da lista da tela) e não encontrados', () => {
    const leitura = resolverLeituraDoPedido(
      [
        { nomeNoPedido: 'Hemograma', item: { tuss: '40304361', nome: 'Hemograma Completo' }, ...semRelacionados },
        { nomeNoPedido: 'Lipo B', item: null, relacionados: ['LIPOPROTEÍNA - a'], tipo: 'variante' },
      ],
      lista,
    );

    expect(leitura).toEqual({
      reconhecidos: [{ nomeNoPedido: 'Hemograma', exame: hemograma }],
      semCorrespondencia: [{ nomeNoPedido: 'Lipo B', relacionados: ['LIPOPROTEÍNA - a'], tipo: 'variante' }],
    });
  });

  it('item que a tela não tem na lista conta como não encontrado', () => {
    const leitura = resolverLeituraDoPedido(
      [{ nomeNoPedido: 'TSH', item: { tuss: '40316521', nome: 'TSH' }, ...semRelacionados }],
      lista,
    );

    expect(leitura).toEqual({
      reconhecidos: [],
      semCorrespondencia: [{ nomeNoPedido: 'TSH', relacionados: [], tipo: null }],
    });
  });

  it('o mesmo exame da lista lido duas vezes aparece uma vez só', () => {
    const leitura = resolverLeituraDoPedido(
      [
        { nomeNoPedido: 'Glicose', item: { tuss: '40302040', nome: 'Glicemia de Jejum' }, ...semRelacionados },
        { nomeNoPedido: 'Glicemia', item: { tuss: '40302040', nome: 'Glicemia de Jejum' }, ...semRelacionados },
      ],
      lista,
    );

    expect(leitura.reconhecidos).toEqual([{ nomeNoPedido: 'Glicose', exame: glicemia }]);
  });
});

describe('fraseDoNaoEncontrado', () => {
  const lipoA = ['LIPOPROTEÍNA - a'];

  it('variante não realizada', () => {
    expect(fraseDoNaoEncontrado({ nomeNoPedido: 'Lipo B', relacionados: lipoA, tipo: 'variante' })).toBe(
      "Não realizamos o exame 'Lipo B'. Realizamos apenas:",
    );
  });

  it('pedido genérico', () => {
    expect(fraseDoNaoEncontrado({ nomeNoPedido: 'Lipoproteína', relacionados: lipoA, tipo: 'generico' })).toBe(
      "O pedido cita 'Lipoproteína' sem especificar. O laboratório realiza somente:",
    );
  });

  it('com relacionados e sem tipo, frase neutra', () => {
    expect(fraseDoNaoEncontrado({ nomeNoPedido: 'Lipo B', relacionados: lipoA, tipo: null })).toBe(
      "'Lipo B' não foi encontrado na tabela. Exames relacionados que realizamos:",
    );
  });

  it('sem relacionados, só diz que não encontrou, qualquer que seja o tipo', () => {
    expect(fraseDoNaoEncontrado({ nomeNoPedido: 'Células LE', relacionados: [], tipo: 'variante' })).toBe(
      "'Células LE' não foi encontrado na tabela.",
    );
  });
});
