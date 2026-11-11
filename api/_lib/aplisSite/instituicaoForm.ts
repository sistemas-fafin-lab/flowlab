// api/_lib/aplisSite/instituicaoForm.ts
// Cadastro da instituição (clínica) do SITE do apLIS — Cadastro → Instituição.
//
// A senha de um usuário do Laudo Web não tem função própria no site: ela vai junto no
// `instituicao-ajax.php?f=salvar`, que regrava o cadastro INTEIRO (dados gerais, setores,
// contatos, usuários web, expedição, negociação, faturamento TISS/RPS, vencimentos). Campo
// omitido ou vazio apaga o valor. Por isso este módulo reproduz, campo a campo, a função
// `salvar()` da tela (JS inline de /areas/cadastro/instituicao.php, lido em 11/11/2026) sobre
// o HTML do `instituicao-detail.php`, mais o que a tela muda ao abrir (detail_init):
//   - priceFormat() em PercRetencao, PercRepasse e AliquotaNF reformata valores não vazios;
//   - fonteClick(): sem FontePagadora, Particular fica desmarcado.
// Os helpers globais vêm de /js/comum.js: `_g_DePara` (inputs CampoDP não vazios →
// {Tip, Ext}) e `pesquisaItem('valores', 1)` (valores das <option> unidos por ",").
//
// Puro (sem rede): o handler busca o HTML e grava; aqui só se lê e monta o corpo.

import { parse, type HTMLElement } from 'node-html-parser';

/** Valor como o jQuery o serializa: aninhado em objetos/arrays; '' para lista vazia. */
export type ValorForm = string | number | ValorForm[] | { [k: string]: ValorForm };

export interface CorpoSalvarInstituicao {
  Instituicao: { [k: string]: ValorForm };
  Expedicao: { [k: string]: ValorForm };
  Negociacao: { [k: string]: ValorForm };
  Faturamento: { [k: string]: ValorForm };
  Vencimento: ValorForm;
}

export interface UsuarioLaudoWeb {
  /** `idU` da linha — o `Id` que o salvar usa para alterar um usuário existente. */
  id: string;
  usuario: string;
  setor: string;
  liberado: boolean;
  ultimoLogin: string;
}

export interface ContatoClinica {
  nome: string;
  setor: string;
  cargo: string;
  telefone: string;
  celular: string;
  email: string;
}

/** O que a tela mostra da clínica (só leitura; não entra no salvar). */
export interface DetalhesClinica {
  cnpj: string;
  inativa: boolean;
  dataInclusao: string;
  dataDesativacao: string;
  /** Texto da opção escolhida em Segmento ("Clínica", "Convênio"…); '' sem segmento. */
  segmento: string;
  /** Marcações do cadastro: "Fonte pagadora", "Local de origem", "Particular"… */
  tipos: string[];
  /** Endereço numa linha ("Rua X, 10 - sala 2 - Bairro - Cidade - UF - CEP 00000-000"); '' sem endereço. */
  endereco: string;
  contatos: ContatoClinica[];
}

export interface FormularioInstituicao {
  idInstituicao: string;
  nomeFantasia: string;
  razaoSocial: string;
  usuariosLaudoWeb: UsuarioLaudoWeb[];
  detalhes: DetalhesClinica;
  corpo: CorpoSalvarInstituicao;
}

/** O site mudou ou o HTML não é o esperado: não gravar. */
export class FormularioInstituicaoInvalido extends Error {}

/** Regra do servidor (msg "Senha deve conter pelo menos 8 caracteres, uma letra e um número"). */
export function validarSenhaLaudoWeb(senha: string): string | null {
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(senha)) return 'A senha precisa ter pelo menos uma letra.';
  if (!/[0-9]/.test(senha)) return 'A senha precisa ter pelo menos um número.';
  if (/\s/.test(senha)) return 'A senha não pode ter espaços.';
  return null;
}

/** Tabelas de linhas que o salvar lê; contadas também no HTML cru (ver conferirLinhas). */
const TABELAS = [
  'tblSetor', 'tblContato', 'tblLaudoWeb', 'tblExpedicao', 'tblPrazoExame',
  'tblLimiteExame', 'tblTeste', 'tblVencimento',
] as const;

const PERMISSOES = ['per_ins', 'per_web', 'per_exp', 'per_neg', 'per_fat'] as const;

class Leitor {
  constructor(private readonly raiz: HTMLElement) {}

  el(id: string): HTMLElement {
    const e = this.raiz.querySelector(`#${id}`);
    if (!e) throw new FormularioInstituicaoInvalido(`Campo #${id} ausente no cadastro da instituição — o site do apLIS mudou?`);
    return e;
  }

  /** `$('#id').val()` de input, textarea ou select simples. */
  val(id: string): string {
    const e = this.el(id);
    const tag = e.tagName.toLowerCase();
    if (tag === 'textarea') return e.text;
    if (tag === 'select') return valorSelect(e);
    return e.getAttribute('value') ?? '';
  }

  /** Para o que só se mostra na tela: campo ausente vira '' em vez de bloquear. */
  opc(id: string): string {
    return this.raiz.querySelector(`#${id}`) ? this.val(id) : '';
  }

  /** Texto da opção escolhida de um select simples. */
  rotulo(id: string): string {
    const opcoes = this.el(id).querySelectorAll('option');
    const escolhida = opcoes.find((o) => o.hasAttribute('selected')) ?? opcoes.find((o) => !o.hasAttribute('disabled'));
    return escolhida ? escolhida.text.replace(/\s+/g, ' ').trim() : '';
  }

  /** `$('#id').is(':checked') ? 1 : 0` */
  chk(id: string): number {
    return this.el(id).hasAttribute('checked') ? 1 : 0;
  }

  /** `$('#id').pesquisaItem('valores', 1)`: valores de todas as <option>, unidos por ",". */
  itens(id: string): string {
    return this.el(id).querySelectorAll('option').map(valorOption).join(',');
  }

  /** `$('tbody tr', '#tabela')` */
  linhas(tabela: string): HTMLElement[] {
    return this.el(tabela).querySelectorAll('tbody tr');
  }
}

function valorOption(o: HTMLElement): string {
  return o.getAttribute('value') ?? o.text.replace(/\s+/g, ' ').trim();
}

/** Select simples sem `selected`: o navegador escolhe a primeira opção habilitada. */
function valorSelect(sel: HTMLElement): string {
  const opcoes = sel.querySelectorAll('option');
  const escolhida = opcoes.find((o) => o.hasAttribute('selected')) ?? opcoes.find((o) => !o.hasAttribute('disabled'));
  return escolhida ? valorOption(escolhida) : '';
}

const attr = (tr: HTMLElement, nome: string): string => tr.getAttribute(nome) ?? '';
const td = (tr: HTMLElement, i: number): string => tr.querySelectorAll('td')[i]?.text ?? '';
const marcado = (tr: HTMLElement, i: number): number => (td(tr, i) === '✔' ? 1 : 0);
const lista = <T>(itens: T[]): T[] | '' => (itens.length > 0 ? itens : '');

/**
 * `priceFormat()` do jquery.priceformat (defaults: centavos ",", milhar ".", 2 casas,
 * clearOnEmpty, leadingZero), aplicado pela tela a valores não vazios ao abrir.
 */
export function formatarComoPriceFormat(valor: string): string {
  if (valor === '') return '';
  let digitos = '';
  for (const c of valor) {
    if (digitos.length === 0 && c === '0') continue;
    if (/[0-9]/.test(c)) digitos += c;
  }
  while (digitos.length < 3) digitos = '0' + digitos;
  const centavos = digitos.slice(-2);
  const inteiro = digitos.slice(0, -2);
  let comMilhar = '';
  let n = 0;
  for (let i = inteiro.length; i > 0; i--) {
    let c = inteiro[i - 1];
    if (++n % 3 === 0) c = '.' + c;
    comMilhar = c + comMilhar;
  }
  if (comMilhar.startsWith('.')) comMilhar = comMilhar.slice(1);
  return `${comMilhar},${centavos}`;
}

/**
 * Confere, no HTML cru, quantas `<tr` cada tabela tem no tbody contra o que o parser leu.
 * Um HTML malformado que o parser entendesse diferente do navegador faria o salvar
 * apagar linhas — e a releitura depois de gravar não pegaria (lê com o mesmo parser).
 */
function conferirLinhas(html: string, leitor: Leitor): void {
  for (const tabela of TABELAS) {
    const ini = html.indexOf(`id="${tabela}"`);
    const corpoIni = ini >= 0 ? html.indexOf('<tbody', ini) : -1;
    const corpoFim = corpoIni >= 0 ? html.indexOf('</tbody>', corpoIni) : -1;
    if (corpoIni < 0 || corpoFim < 0) {
      throw new FormularioInstituicaoInvalido(`Tabela #${tabela} sem <tbody> no cadastro — o site do apLIS mudou?`);
    }
    const cru = (html.slice(corpoIni, corpoFim).match(/<tr[\s>]/gi) ?? []).length;
    const lidas = leitor.linhas(tabela).length;
    if (cru !== lidas) {
      throw new FormularioInstituicaoInvalido(`Tabela #${tabela}: ${cru} linhas no HTML, ${lidas} lidas. Gravação bloqueada.`);
    }
  }
}

/** Lê o HTML do `instituicao-detail.php` e monta o corpo que a tela mandaria ao salvar sem mudar nada. */
export function lerFormularioInstituicao(html: string): FormularioInstituicao {
  const raiz = parse(html, { blockTextElements: { script: true, style: true, textarea: true } });
  const $ = new Leitor(raiz);

  for (const p of PERMISSOES) {
    if ($.val(p) !== '1') {
      throw new FormularioInstituicaoInvalido(
        `O usuário do apLIS usado pelo flowlab não tem a permissão ${p} na tela de Instituição; ` +
          'sem ela parte do cadastro não vem e o salvar apagaria dados.',
      );
    }
  }
  conferirLinhas(html, $);

  const idInstituicao = $.val('IdInstituicao');
  if (!/^\d+$/.test(idInstituicao)) throw new FormularioInstituicaoInvalido('Instituição não encontrada no apLIS.');

  const fontePagadora = $.chk('FontePagadora');
  const ins: { [k: string]: ValorForm } = {
    Id: idInstituicao,
    Inativo: $.chk('Inativo'),
    NomFantasia: $.val('NomFantasia'),
    RazaoSocial: $.val('RazaoSocial'),
    LaudoNomFantasia: $.chk('LaudoNomFantasia1'),
    CNPJ: $.val('CNPJ'),
    CCM: $.val('CCM'),
    IE: $.val('IE'),
    ANS: $.val('ANS'),
    CNES: $.val('CNES'),
    Segmento: $.val('Segmento'),
    Local: $.chk('Local'),
    FontePagadora: fontePagadora,
    // fonteClick(): sem FontePagadora o checkbox Particular é desmarcado ao abrir.
    Particular: fontePagadora ? $.chk('Particular') : 0,
    Afiliado: $.chk('Afiliado'),
    Filial: $.chk('Filial'),
    Vip: $.chk('Vip'),
    IHQ: $.chk('IHQ'),
    EmailRemarcacao: $.chk('EmailRemarcacao'),
    NaoArquivaLamina: $.chk('NaoArquivaLamina'),
    PrazoTriagem: $.chk('PrazoTriagem'),
    PrazoEventoRateado: $.chk('PrazoEventoRateado'),
    ConvenioPROADI: $.chk('ConvenioPROADI'),
    AutorizaContatoPaciente: $.chk('radAutorizaContatoPaciente1'),
    Parceiro: $.chk('Parceiro'),
    CodCep: $.val('CodCep'),
    EndNum: $.val('EndNumero'),
    EndCom: $.val('EndComplemento'),
    PossuiLogo: $.chk('PossuiLogo'),
    LocalOrigem: $.itens('LocalOrigem'),
    LimiteQtdAnticorpo: $.val('LimiteQtdAnticorpo'),
    InstituicaoExame: $.itens('WebInstExame'),
  };

  ins.Regras = [
    `C1^${$.chk('RegNumCarteira')}^${$.val('RegTamanhoCarteira')}`,
    `C2^${$.chk('RegValCarteira')}^0`,
    `C3^${$.chk('RegGuiaConv')}^${$.val('RegTamanhoGuiaConv')}`,
    `C4^${$.chk('DtaAutorizacao')}^0`,
    `C5^${$.chk('RegSenhaAut')}^${$.val('RegTamanhoSenhaAut')}`,
    `C6^${$.chk('RegValSenha')}^0`,
    `C7^${$.chk('RegNumGuia')}^${$.val('RegTamanhoGuia')}`,
    `C8^${$.chk('RegIndClinica')}^0`,
  ].join('|');

  ins.Setores = lista(
    $.linhas('tblSetor').map((tr) => ({
      Id: attr(tr, 'idS'),
      CodCep: attr(tr, 'codCep'),
      DesSetor: td(tr, 2),
      Numero: td(tr, 4),
      Complemento: td(tr, 5),
    })),
  );

  ins.Contatos = lista(
    $.linhas('tblContato').map((tr) => ({
      Id: attr(tr, 'idC'),
      IdSetor: attr(tr, 'idS'),
      Cargo: attr(tr, 'idCargo'),
      NomContato: td(tr, 2),
      Telefone: td(tr, 4),
      Celular: td(tr, 5),
      Email: td(tr, 6),
    })),
  );

  const linhasWeb = $.linhas('tblLaudoWeb');
  ins.LaudoWeb = lista(
    linhasWeb.map((tr) => ({
      Id: attr(tr, 'idU'),
      IdSetor: attr(tr, 'idS'),
      Pwd: attr(tr, 'pwd'),
      CPF: attr(tr, 'cpf'),
      JustificativaCPF: attr(tr, 'justificativaCPF'),
      Usu: td(tr, 2),
      Sol: marcado(tr, 3),
      Lib: marcado(tr, 4),
      Tab: marcado(tr, 5),
      Res: marcado(tr, 7),
      Por: marcado(tr, 8),
      Pes: marcado(tr, 9),
      Esp: marcado(tr, 10),
      Fat: marcado(tr, 11),
    })),
  );

  // _g_DePara(ins, '#tblDePara'): só os inputs de texto preenchidos.
  const dePara = $.el('tblDePara')
    .querySelectorAll('input')
    .filter((i) => (i.getAttribute('type') ?? 'text').toLowerCase() === 'text')
    .map((i) => ({ Tip: i.getAttribute('tipo') ?? '', Ext: i.getAttribute('value') ?? '' }))
    .filter((d) => d.Ext.length > 0);
  ins.DePara = lista(dePara);

  const exp: { [k: string]: ValorForm } = {
    CodBarCliente: $.val('CodBarCliente'),
    CodBarCliSeq: $.val('CodBarCliSeq'),
    CodBarCliSeqAnt: $.val('CodBarCliSeqAnt'),
    QtdCopia: $.val('QtdCopia'),
  };
  exp.Setores = lista(
    $.linhas('tblExpedicao').map((tr) => ({
      Seq: attr(tr, 'seq'),
      IdSetor: attr(tr, 'idS'),
      CodCep: attr(tr, 'codCep'),
      EndNum: td(tr, 3),
      EndCom: td(tr, 4),
    })),
  );

  const neg: { [k: string]: ValorForm } = {
    IdExecutivoConta: $.val('IdExecutivoConta'),
    TipoPagto: $.val('TipoPagto'),
    FormaPagto: $.val('FormaPagto'),
    ContaCorrente: $.val('ContaCorrente'),
    PercRetencao: formatarComoPriceFormat($.val('PercRetencao')),
    PercRepasse: formatarComoPriceFormat($.val('PercRepasse')),
  };
  // A tela só manda a observação quando o campo existe (é o caso com per_neg = 1).
  neg.Observacao = $.val('Observacao');
  neg.PrazoExame = lista(
    $.linhas('tblPrazoExame').map((tr) => ({
      Id: attr(tr, 'idNPE'),
      CodExame: attr(tr, 'codExame'),
      IdConvenio: attr(tr, 'idConvenio'),
      Quantidade: td(tr, 3),
    })),
  );
  neg.LimiteExame = lista(
    $.linhas('tblLimiteExame').map((tr) => ({
      Id: attr(tr, 'idNLE'),
      CodExame: attr(tr, 'codExame'),
      IdConvenio: attr(tr, 'idConvenio'),
      Tipo: attr(tr, 'idTipo'),
      Quantidade: td(tr, 3),
      Grupo: td(tr, 5),
      SenhaObrigatoria: attr(tr, 'senhaObr') === '1' ? 1 : 0,
    })),
  );
  neg.Teste = lista(
    $.linhas('tblTeste').map((tr) => ({ Id: attr(tr, 'idNT'), IdTeste: attr(tr, 'idTeste') })),
  );

  const fat: { [k: string]: ValorForm } = {
    IdResponsavel: $.val('IdResponsavel'),
    IdPrestador: $.val('IdPrestador'),
    CodigoPrestador: $.val('CodigoPrestador'),
    Login: $.val('Login'),
    Senha: $.val('Senha'),
    LoginTiss: $.chk('LoginTiss'),
    TissVersao: $.val('TissVersao'),
    TissVersaoAut: $.val('TissVersaoAut'),
    TissCodTipoSaida: $.val('TissCodTipoSaida'),
    TissCodTipoAtendPadrao: $.val('TissCodTipoAtendPadrao'),
    TissCodTipoAtendAutorizado: $.val('TissCodTipoAtendAutorizado'),
    TissNomeArquivo: $.val('TissNomeArquivo'),
    IndicaCodOperadora: $.chk('IndicaCodOperadora1'),
    CodInstituicao: $.val('CodInstituicao'),
    EmiteRPS: $.chk('EmiteRPS'),
    CodUltimoRPS: $.val('CodUltimoRPS'),
    SerieRPS: $.val('SerieRPS'),
    TipoNF: $.val('TipoNF'),
    EmailNFE: $.val('EmailNFE'),
    CodUltimaGuia: $.val('CodUltimaGuia'),
    CodUltimoLote: $.val('CodUltimoLote'),
    CodServicoNF: $.val('CodServicoNF'),
    AliquotaNF: formatarComoPriceFormat($.val('AliquotaNF')),
    DesmembraProced: $.chk('DesmembraProced'),
    TissEquipeSadt: $.chk('TissEquipeSadt'),
    TissGuiaPrincipal: $.chk('TissGuiaPrincipal'),
    TissNumeroCNS: $.chk('TissNumeroCNS'),
    TissDiferenciado: $.chk('TissDiferenciado'),
    TissSobreporGuiaPrestador: $.chk('TissSobreporGuiaPrestador'),
    TissInstituicaoContratado: $.chk('TissInstituicaoContratado'),
    TissHoraDiff: $.chk('TissHoraDiff'),
    TissHoraSequencial: $.chk('TissHoraSequencial'),
    TissGrauPart: $.val('TissGrauPart'),
    TissIndicacaoAcidente: $.val('TissIndicacaoAcidente'),
    TissRegimeAtendimento: $.val('TissRegimeAtendimento'),
    IdEnotas: $.val('IdEnotas'),
    TipoExigibilidadeSuspensa: $.val('TipoExigibilidadeSuspensa'),
    NumeroProcessoExigibilidadeSuspensa: $.val('NumeroProcessoExigibilidadeSuspensa'),
    SubstTributario: $.chk('SubstTribut'),
    MedicoCredenciado: $.chk('MedicoCredenciado'),
    CodAutorizadora: $.val('CodAutorizadora'),
    ExamesComAutorizacao: $.itens('ExamesComAutorizacao'),
    GeraNumGuiaAdmissao: $.chk('GeraNumGuiaAdmissao'),
    TissNomMedico: $.chk('TissNomMedico'),
    TissBeneficiarioAut: $.chk('TissBeneficiarioAut'),
    TissSequencialItemContinuo: $.chk('TissSequencialItemContinuo'),
  };

  const ven = lista(
    $.linhas('tblVencimento').map((tr) => ({
      Id: attr(tr, 'idV'),
      Tipo: attr(tr, 'tipo'),
      VencTipo: attr(tr, 'vencTipo'),
      DiaIni: td(tr, 2),
      DiaFim: td(tr, 3),
      DiaUtil: td(tr, 4) === '' ? 0 : 1,
      VencDia: td(tr, 5),
      VencDiaUtil: td(tr, 6) === '' ? 0 : 1,
    })),
  );

  const detalhes = lerDetalhes($, fontePagadora === 1);

  return {
    idInstituicao,
    detalhes,
    nomeFantasia: ins.NomFantasia as string,
    razaoSocial: ins.RazaoSocial as string,
    usuariosLaudoWeb: linhasWeb.map((tr) => ({
      id: attr(tr, 'idU'),
      usuario: td(tr, 2),
      setor: td(tr, 1),
      liberado: marcado(tr, 4) === 1,
      ultimoLogin: td(tr, 6).trim(),
    })),
    corpo: { Instituicao: ins, Expedicao: exp, Negociacao: neg, Faturamento: fat, Vencimento: ven },
  };
}

const TIPOS: [string, string][] = [
  ['FontePagadora', 'Fonte pagadora'],
  ['Particular', 'Particular'],
  ['Local', 'Local de origem'],
  ['Parceiro', 'Parceiro'],
  ['Afiliado', 'Afiliado'],
  ['Filial', 'Filial'],
  ['Vip', 'VIP'],
  ['IHQ', 'IHQ'],
  ['ConvenioPROADI', 'PROADI'],
];

function lerDetalhes($: Leitor, fontePagadora: boolean): DetalhesClinica {
  const v = (id: string) => $.opc(id).trim();
  const juntar = (partes: string[], sep: string) => partes.filter(Boolean).join(sep);
  const cep = v('EndCep');
  const endereco = juntar(
    [
      juntar([v('EndLogradouro'), v('EndNumero')], ', '),
      v('EndComplemento'),
      v('EndBairro'),
      v('EndCidade'),
      cep ? `CEP ${cep}` : '',
    ],
    ' - ',
  );
  return {
    cnpj: v('CNPJ'),
    inativa: $.chk('Inativo') === 1,
    dataInclusao: v('DtaInclusao'),
    dataDesativacao: v('DtaDesativacao'),
    segmento: $.rotulo('Segmento'),
    tipos: TIPOS.filter(([id]) => $.chk(id) === 1 && (id !== 'Particular' || fontePagadora)).map(([, nome]) => nome),
    endereco,
    contatos: $.linhas('tblContato').map((tr) => ({
      setor: td(tr, 1).trim(),
      nome: td(tr, 2).trim(),
      cargo: td(tr, 3).trim(),
      telefone: td(tr, 4).trim(),
      celular: td(tr, 5).trim(),
      email: td(tr, 6).trim(),
    })),
  };
}

/** Cópia do corpo com a senha nova só no usuário `idUsuario` (os demais seguem com Pwd ""). */
export function corpoComSenhaNova(
  corpo: CorpoSalvarInstituicao,
  idUsuario: string,
  senha: string,
): CorpoSalvarInstituicao {
  const usuarios = corpo.Instituicao.LaudoWeb;
  if (!Array.isArray(usuarios)) throw new FormularioInstituicaoInvalido('A clínica não tem usuários do Laudo Web.');
  const alvo = usuarios.filter((u) => (u as { Id?: ValorForm }).Id === idUsuario);
  if (alvo.length !== 1) throw new FormularioInstituicaoInvalido('Usuário do Laudo Web não encontrado nesta clínica.');
  const copia = structuredClone(corpo);
  copia.Instituicao.LaudoWeb = (copia.Instituicao.LaudoWeb as { [k: string]: ValorForm }[]).map((u) =>
    u.Id === idUsuario ? { ...u, Pwd: senha } : u,
  );
  return copia;
}

/** Serializa como o `$.param` do jQuery 3: `a[b][0][c]=v`; null/'' viram "". */
export function corpoParaForm(corpo: CorpoSalvarInstituicao): [string, string][] {
  const pares: [string, string][] = [];
  const add = (chave: string, valor: ValorForm): void => {
    if (Array.isArray(valor)) {
      valor.forEach((v, i) => add(`${chave}[${typeof v === 'object' ? i : ''}]`, v));
    } else if (typeof valor === 'object' && valor !== null) {
      for (const [k, v] of Object.entries(valor)) add(`${chave}[${k}]`, v);
    } else {
      pares.push([chave, valor == null ? '' : String(valor)]);
    }
  };
  for (const [k, v] of Object.entries(corpo)) add(k, v as ValorForm);
  return pares;
}
