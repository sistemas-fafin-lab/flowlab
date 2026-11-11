import { describe, expect, it } from 'vitest';
import {
  corpoComSenhaNova,
  corpoParaForm,
  formatarComoPriceFormat,
  FormularioInstituicaoInvalido,
  lerFormularioInstituicao,
  validarSenhaLaudoWeb,
} from './instituicaoForm.js';

// HTML sintético no formato do instituicao-detail.php (11/11/2026): só o que o salvar lê.
const TEXTOS = [
  'IdInstituicao', 'CodCep', 'NomFantasia', 'RazaoSocial', 'CNPJ', 'CCM', 'IE', 'ANS', 'CNES', 'EndNumero',
  'EndComplemento', 'LimiteQtdAnticorpo', 'RegTamanhoCarteira', 'RegTamanhoGuiaConv', 'RegTamanhoSenhaAut',
  'RegTamanhoGuia', 'CodBarCliente', 'CodBarCliSeq', 'CodBarCliSeqAnt', 'QtdCopia', 'IdExecutivoConta',
  'PercRetencao', 'PercRepasse', 'IdResponsavel', 'IdPrestador', 'CodigoPrestador', 'Login', 'Senha',
  'CodInstituicao', 'CodUltimoRPS', 'SerieRPS', 'EmailNFE', 'CodUltimaGuia', 'CodUltimoLote', 'CodServicoNF',
  'AliquotaNF', 'TissGrauPart', 'TissIndicacaoAcidente', 'TissRegimeAtendimento', 'IdEnotas',
  'TipoExigibilidadeSuspensa', 'NumeroProcessoExigibilidadeSuspensa',
  'DtaInclusao', 'DtaDesativacao', 'EndCep', 'EndLogradouro', 'EndBairro', 'EndCidade',
];
const CHECKS = [
  'Inativo', 'LaudoNomFantasia1', 'Local', 'FontePagadora', 'Particular', 'Afiliado', 'Filial', 'Vip', 'IHQ',
  'EmailRemarcacao', 'NaoArquivaLamina', 'PrazoTriagem', 'PrazoEventoRateado', 'ConvenioPROADI',
  'radAutorizaContatoPaciente1', 'Parceiro', 'PossuiLogo', 'RegNumCarteira', 'RegValCarteira', 'RegGuiaConv',
  'DtaAutorizacao', 'RegSenhaAut', 'RegValSenha', 'RegNumGuia', 'RegIndClinica', 'LoginTiss', 'IndicaCodOperadora1',
  'EmiteRPS', 'DesmembraProced', 'TissEquipeSadt', 'TissGuiaPrincipal', 'TissNumeroCNS', 'TissDiferenciado',
  'TissSobreporGuiaPrestador', 'TissInstituicaoContratado', 'TissHoraDiff', 'TissHoraSequencial', 'SubstTribut',
  'MedicoCredenciado', 'GeraNumGuiaAdmissao', 'TissNomMedico', 'TissBeneficiarioAut', 'TissSequencialItemContinuo',
];
const SELECTS = [
  'Segmento', 'TipoPagto', 'FormaPagto', 'ContaCorrente', 'TissVersao', 'TissVersaoAut', 'TissCodTipoSaida',
  'TissCodTipoAtendPadrao', 'TissCodTipoAtendAutorizado', 'TissNomeArquivo', 'TipoNF', 'CodAutorizadora',
];
const MULTI = ['LocalOrigem', 'WebInstExame', 'ExamesComAutorizacao'];

const tabela = (id: string, linhas: string[] = []) =>
  `<div id="${id}"><table><thead><tr><th>x</th></tr></thead><tbody>${linhas.join('')}</tbody></table></div>`;

const LINHA_WEB = (idU: string, usu: string, lib = '✔') =>
  `<tr idU="${idU}" idS="7" cpf="000" cpfOriginal="" justificativaCPF="" pwd="">` +
  `<td><img></td><td>Recepção</td><td>${usu}</td><td></td><td>${lib}</td><td></td><td>10/11/2026 09:00</td>` +
  `<td>✔</td><td></td><td></td><td></td><td></td></tr>`;

function html(
  opcoes: {
    valores?: Record<string, string>;
    marcados?: string[];
    web?: string[];
    per?: string;
    selects?: Record<string, string>;
    extra?: string;
    contatos?: string[];
  } = {},
) {
  const v = { IdInstituicao: '1389', NomFantasia: 'Clínica A &amp; B', ...opcoes.valores };
  const marcados = new Set(opcoes.marcados ?? []);
  return [
    ...['per_ins', 'per_web', 'per_exp', 'per_neg', 'per_fat'].map(
      (p) => `<input type="hidden" id="${p}" value="${opcoes.per === p ? '0' : '1'}">`,
    ),
    ...TEXTOS.map((id) => `<input type="text" id="${id}" value="${v[id] ?? ''}">`),
    ...CHECKS.map((id) => `<input type="checkbox" id="${id}" ${marcados.has(id) ? 'checked' : ''}>`),
    ...SELECTS.map((id) => `<select id="${id}">${opcoes.selects?.[id] ?? '<option value=""></option>'}</select>`),
    ...MULTI.map((id) => `<select id="${id}" multiple>${id === 'LocalOrigem' ? '<option value="3">A</option><option value="9">B</option>' : ''}</select>`),
    '<textarea id="Observacao">&lt;p&gt;Obs&lt;/p&gt;</textarea>',
    `<div id="tblDePara"><table><tbody><tr><td><input type="text" tipo="71" value="ABC" name="CampoDP"></td></tr>` +
      `<tr><td><input type="text" tipo="72" value="" name="CampoDP"></td></tr></tbody></table></div>`,
    tabela('tblSetor', ['<tr idS="7" codCep="55"><td></td><td></td><td>Recepção</td><td></td><td>10</td><td>sala 2</td></tr>']),
    tabela('tblContato', opcoes.contatos ?? []),
    tabela('tblLaudoWeb', opcoes.web ?? [LINHA_WEB('35844', 'TESTE.TI'), LINHA_WEB('35845', 'OUTRO', '')]),
    tabela('tblExpedicao'),
    tabela('tblPrazoExame'),
    tabela('tblLimiteExame'),
    tabela('tblTeste'),
    tabela('tblVencimento', ['<tr idV="1" tipo="2" vencTipo="3"><td></td><td></td><td>1</td><td>15</td><td></td><td>20</td><td>✔</td></tr>']),
    opcoes.extra ?? '',
  ].join('\n');
}

const mapa = (h: string) => new Map(corpoParaForm(lerFormularioInstituicao(h).corpo));

describe('lerFormularioInstituicao', () => {
  it('monta o corpo do salvar como a tela', () => {
    const m = mapa(html({ marcados: ['FontePagadora', 'Local', 'RegNumCarteira'], valores: { RegTamanhoCarteira: '12' } }));
    expect(m.get('Instituicao[Id]')).toBe('1389');
    expect(m.get('Instituicao[NomFantasia]')).toBe('Clínica A & B');
    expect(m.get('Instituicao[FontePagadora]')).toBe('1');
    expect(m.get('Instituicao[Inativo]')).toBe('0');
    expect(m.get('Instituicao[LocalOrigem]')).toBe('3,9');
    expect(m.get('Instituicao[Regras]')).toBe('C1^1^12|C2^0^0|C3^0^|C4^0^0|C5^0^|C6^0^0|C7^0^|C8^0^0');
    expect(m.get('Instituicao[Setores][0][DesSetor]')).toBe('Recepção');
    expect(m.get('Instituicao[Setores][0][Complemento]')).toBe('sala 2');
    expect(m.get('Instituicao[Contatos]')).toBe('');
    expect(m.get('Instituicao[DePara][0][Tip]')).toBe('71');
    expect(m.get('Instituicao[DePara][0][Ext]')).toBe('ABC');
    expect(m.has('Instituicao[DePara][1][Tip]')).toBe(false);
    expect(m.get('Instituicao[LaudoWeb][0][Usu]')).toBe('TESTE.TI');
    expect(m.get('Instituicao[LaudoWeb][0][Lib]')).toBe('1');
    expect(m.get('Instituicao[LaudoWeb][0][Res]')).toBe('1');
    expect(m.get('Instituicao[LaudoWeb][1][Lib]')).toBe('0');
    expect(m.get('Instituicao[LaudoWeb][0][Pwd]')).toBe('');
    expect(m.get('Negociacao[Observacao]')).toBe('<p>Obs</p>');
    expect(m.get('Vencimento[0][DiaUtil]')).toBe('0');
    expect(m.get('Vencimento[0][VencDiaUtil]')).toBe('1');
    expect(m.get('Expedicao[Setores]')).toBe('');
  });

  it('sem FontePagadora, Particular vai desmarcado (fonteClick ao abrir)', () => {
    expect(mapa(html({ marcados: ['Particular'] })).get('Instituicao[Particular]')).toBe('0');
    expect(mapa(html({ marcados: ['Particular', 'FontePagadora'] })).get('Instituicao[Particular]')).toBe('1');
  });

  it('select simples: a opção selected ou, sem ela, a primeira', () => {
    const m = mapa(html({ selects: { Segmento: '<option value="1">a</option><option value="11" selected>b</option>', TipoNF: '<option value="4">x</option>' } }));
    expect(m.get('Instituicao[Segmento]')).toBe('11');
    expect(m.get('Faturamento[TipoNF]')).toBe('4');
  });

  it('reformata percentuais e alíquota como o priceFormat da tela', () => {
    const m = mapa(html({ valores: { PercRetencao: '5', AliquotaNF: '2,00', PercRepasse: '' } }));
    expect(m.get('Negociacao[PercRetencao]')).toBe('0,05');
    expect(m.get('Faturamento[AliquotaNF]')).toBe('2,00');
    expect(m.get('Negociacao[PercRepasse]')).toBe('');
  });

  it('lista os usuários do Laudo Web', () => {
    const f = lerFormularioInstituicao(html());
    expect(f.usuariosLaudoWeb).toEqual([
      { id: '35844', usuario: 'TESTE.TI', setor: 'Recepção', liberado: true, ultimoLogin: '10/11/2026 09:00' },
      { id: '35845', usuario: 'OUTRO', setor: 'Recepção', liberado: false, ultimoLogin: '10/11/2026 09:00' },
    ]);
  });

  it('lê os detalhes que a tela mostra', () => {
    const f = lerFormularioInstituicao(
      html({
        marcados: ['FontePagadora', 'Local', 'Particular'],
        valores: {
          CNPJ: '00.000.000/0001-00', DtaInclusao: '01/02/2020', EndLogradouro: 'Rua A', EndNumero: '10',
          EndComplemento: 'sala 2', EndBairro: 'Centro', EndCidade: 'Recife - PE', EndCep: '50000-000',
        },
        selects: { Segmento: '<option value=""></option><option value="12" selected>Clínica</option>' },
        contatos: ['<tr idC="1" idS="7" idCargo="3"><td></td><td>Recepção</td><td>Maria</td><td>Gerente</td><td>(81) 3333-0000</td><td></td><td>m@x.com</td></tr>'],
      }),
    );
    expect(f.detalhes).toEqual({
      cnpj: '00.000.000/0001-00',
      inativa: false,
      dataInclusao: '01/02/2020',
      dataDesativacao: '',
      segmento: 'Clínica',
      tipos: ['Fonte pagadora', 'Particular', 'Local de origem'],
      endereco: 'Rua A, 10 - sala 2 - Centro - Recife - PE - CEP 50000-000',
      contatos: [{ setor: 'Recepção', nome: 'Maria', cargo: 'Gerente', telefone: '(81) 3333-0000', celular: '', email: 'm@x.com' }],
    });
  });

  it('detalhes ausentes não bloqueiam (só se mostram)', () => {
    const f = lerFormularioInstituicao(html().replace('id="EndCidade"', 'id="EndCidade2"'));
    expect(f.detalhes.endereco).toBe('');
  });

  it('recusa quando falta campo (o site mudou)', () => {
    expect(() => lerFormularioInstituicao(html().replace('id="CNES"', 'id="CNES2"'))).toThrow(FormularioInstituicaoInvalido);
  });

  it('recusa sem permissão de alguma seção', () => {
    expect(() => lerFormularioInstituicao(html({ per: 'per_fat' }))).toThrow(/per_fat/);
  });

  it('recusa quando o parser não lê todas as linhas da tabela', () => {
    // <tr> dentro de comentário: aparece no HTML cru mas não é linha.
    const quebrado = html().replace(/(<div id="tblContato"><table><thead><tr><th>x<\/th><\/tr><\/thead><tbody>)/, '$1<!-- <tr> -->');
    expect(() => lerFormularioInstituicao(quebrado)).toThrow(/tblContato/);
  });

  it('recusa id de instituição vazio', () => {
    expect(() => lerFormularioInstituicao(html({ valores: { IdInstituicao: '' } }))).toThrow(/não encontrada/);
  });
});

describe('corpoComSenhaNova', () => {
  it('troca só o Pwd do usuário escolhido, sem alterar o original', () => {
    const f = lerFormularioInstituicao(html());
    const novo = new Map(corpoParaForm(corpoComSenhaNova(f.corpo, '35845', 'Nova1234')));
    const antes = new Map(corpoParaForm(f.corpo));
    expect(novo.get('Instituicao[LaudoWeb][1][Pwd]')).toBe('Nova1234');
    expect(novo.get('Instituicao[LaudoWeb][0][Pwd]')).toBe('');
    expect(antes.get('Instituicao[LaudoWeb][1][Pwd]')).toBe('');
    const diferentes = [...antes.keys()].filter((k) => antes.get(k) !== novo.get(k));
    expect(diferentes).toEqual(['Instituicao[LaudoWeb][1][Pwd]']);
  });

  it('recusa usuário que não é da clínica', () => {
    const f = lerFormularioInstituicao(html());
    expect(() => corpoComSenhaNova(f.corpo, '1', 'Nova1234')).toThrow(/não encontrado/);
  });

  it('recusa clínica sem usuários do Laudo Web', () => {
    const f = lerFormularioInstituicao(html({ web: [] }));
    expect(() => corpoComSenhaNova(f.corpo, '35844', 'Nova1234')).toThrow(/não tem usuários/);
  });
});

describe('formatarComoPriceFormat', () => {
  it.each([
    ['', ''],
    ['0', '0,00'],
    ['5', '0,05'],
    ['2,00', '2,00'],
    ['1234567', '12.345,67'],
    ['007,5', '0,75'],
  ])('%s → %s', (entrada, saida) => expect(formatarComoPriceFormat(entrada)).toBe(saida));
});

describe('validarSenhaLaudoWeb', () => {
  it.each([
    ['abc12345', null],
    ['Abcdefg1', null],
    ['abc1234', /8 caracteres/],
    ['12345678', /letra/],
    ['abcdefgh', /número/],
    ['abcd 1234', /espaços/],
  ])('%s', (senha, esperado) => {
    const r = validarSenhaLaudoWeb(senha);
    if (esperado === null) expect(r).toBeNull();
    else expect(r).toMatch(esperado);
  });
});

describe('corpoParaForm', () => {
  it('serializa como o $.param do jQuery', () => {
    const pares = corpoParaForm({
      Instituicao: { Id: '1', LaudoWeb: [{ Id: '2', Sol: 0 }], Setores: '' },
      Expedicao: {},
      Negociacao: {},
      Faturamento: {},
      Vencimento: '',
    });
    expect(pares).toEqual([
      ['Instituicao[Id]', '1'],
      ['Instituicao[LaudoWeb][0][Id]', '2'],
      ['Instituicao[LaudoWeb][0][Sol]', '0'],
      ['Instituicao[Setores]', ''],
      ['Vencimento', ''],
    ]);
  });
});
