import React, { useMemo, useState } from 'react';
import { FilePlus } from 'lucide-react';
import { dayKey } from '../../../../utils/datas';
import { FORMAS_PAGAMENTO, NATUREZAS } from '../../constants';
import { despesaDoAvulso, validarVencimentoNoMes } from '../../domain/avulso';
import { formatarCompetencia, partesCompetencia, ultimoDiaDoMes, vencimentoNaCompetencia } from '../../domain/competencia';
import { validarDespesa, type ErrosDespesa } from '../../domain/validacaoDespesa';
import { formatarValorCampo, parseValorBR } from '../../domain/valores';
import type { FornecedorOpcao, ResultadoCriarFornecedor } from '../../hooks/useFornecedoresTI';
import type { CategoriaTI, DespesaInput, FormaPagamento, NaturezaGasto } from '../../types';
import CampoFornecedor from '../despesas/CampoFornecedor';
import CampoArquivos from '../ui/CampoArquivos';
import ModalFormulario from '../ui/ModalFormulario';
import { campo, classeRotulo } from '../ui/campos';

export interface PagamentoAvulso {
  pagoEm: string;
  notaFiscal: string | null;
  arquivos: File[];
}

interface GastoAvulsoModalProps {
  competencia: string;
  categorias: CategoriaTI[];
  fornecedores: FornecedorOpcao[];
  criarFornecedorRapido: (nome: string, documento: string) => Promise<ResultadoCriarFornecedor>;
  sugestoesAutorizador: string[];
  /** pagamento null = só registrar a cobrança; com pagamento, a baixa é feita logo em seguida. */
  onSalvar: (despesa: DespesaInput, pagamento: PagamentoAvulso | null) => Promise<string | null>;
  onFechar: () => void;
}

/** Cobrança que não estava prevista (RF14): vira despesa única no mês aberto, opcionalmente já paga. */
const GastoAvulsoModal: React.FC<GastoAvulsoModalProps> = ({
  competencia,
  categorias,
  fornecedores,
  criarFornecedorRapido,
  sugestoesAutorizador,
  onSalvar,
  onFechar,
}) => {
  const hoje = useMemo(() => dayKey(new Date()), []);
  const { ano, mes } = partesCompetencia(competencia);
  const primeiroDia = vencimentoNaCompetencia(competencia, 1);
  const ultimoDia = vencimentoNaCompetencia(competencia, ultimoDiaDoMes(ano, mes));
  const hojeNoMes = hoje >= primeiroDia && hoje <= ultimoDia;

  const [descricao, setDescricao] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [natureza, setNatureza] = useState<NaturezaGasto>('opex');
  const [fornecedor, setFornecedor] = useState<{ id: string | null; nome: string }>({ id: null, nome: '' });
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState(hojeNoMes ? hoje : primeiroDia);
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [autorizadoPor, setAutorizadoPor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [jaPago, setJaPago] = useState(true);
  const [pagoEm, setPagoEm] = useState(hoje < vencimento ? hoje : vencimento);
  const [notaFiscal, setNotaFiscal] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erros, setErros] = useState<ErrosDespesa & { vencimento?: string; pagoEm?: string }>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const ativas = categorias.filter((c) => c.ativo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const despesa = despesaDoAvulso(
      {
        descricao,
        categoriaId,
        natureza,
        fornecedorId: fornecedor.id,
        fornecedorNome: fornecedor.nome,
        valor: parseValorBR(valor),
        vencimento,
        formaPagamento: forma,
        autorizadoPor,
        autorizadoEm: null,
        observacoes,
      },
      competencia,
    );
    const errosCampo: typeof erros = { ...validarDespesa(despesa, hoje) };
    const erroVencimento = validarVencimentoNoMes(vencimento, competencia);
    if (erroVencimento) errosCampo.vencimento = erroVencimento;
    delete errosCampo.diaVencimento;
    if (valor.trim() && parseValorBR(valor) === null) errosCampo.valorBase = 'Valor inválido. Use o formato 2.480,00.';
    if (jaPago && (!pagoEm || pagoEm > hoje)) errosCampo.pagoEm = pagoEm ? 'A data do pagamento não pode ser futura.' : 'Informe a data do pagamento.';
    setErros(errosCampo);
    if (Object.keys(errosCampo).length > 0) {
      setErroGeral('Confira os campos destacados.');
      return;
    }
    setSalvando(true);
    setErroGeral(null);
    const erro = await onSalvar(despesa, jaPago ? { pagoEm, notaFiscal: notaFiscal.trim() || null, arquivos } : null);
    setSalvando(false);
    if (erro) setErroGeral(erro);
    else onFechar();
  };

  const mensagem = (texto?: string) => texto && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{texto}</p>;

  return (
    <ModalFormulario
      titulo="Gasto avulso"
      subtitulo={`Cobrança fora da previsão em ${formatarCompetencia(competencia)}`}
      icone={FilePlus}
      onFechar={onFechar}
      onSubmit={handleSubmit}
      ocupado={salvando}
      rotuloSalvar={jaPago ? 'Registrar e dar baixa' : 'Registrar cobrança'}
      erro={erroGeral}
      largura="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Vira uma despesa de cobrança única neste mês e aparece também na aba Despesas.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={classeRotulo} htmlFor="avulso-descricao">
              Descrição
            </label>
            <input
              id="avulso-descricao"
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={200}
              placeholder="Ex.: Cobrança extra de armazenamento"
              className={campo(erros.descricao)}
              autoFocus
            />
            {mensagem(erros.descricao)}
          </div>
          <div>
            <label className={classeRotulo} htmlFor="avulso-categoria">
              Categoria
            </label>
            <select
              id="avulso-categoria"
              value={categoriaId}
              onChange={(e) => {
                setCategoriaId(e.target.value);
                const c = categorias.find((cat) => cat.id === e.target.value);
                if (c) setNatureza(c.naturezaPadrao);
              }}
              className={campo(erros.categoriaId)}
            >
              <option value="">Escolha a categoria</option>
              {ativas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {mensagem(erros.categoriaId)}
          </div>
          <div>
            <label className={classeRotulo} htmlFor="avulso-natureza">
              Natureza
            </label>
            <select id="avulso-natureza" value={natureza} onChange={(e) => setNatureza(e.target.value as NaturezaGasto)} className={campo()}>
              {NATUREZAS.map((n) => (
                <option key={n.valor} value={n.valor}>
                  {n.rotulo} — {n.dica}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={classeRotulo} htmlFor="avulso-fornecedor">
              Fornecedor
            </label>
            <CampoFornecedor
              id="avulso-fornecedor"
              fornecedores={fornecedores}
              fornecedorId={fornecedor.id}
              fornecedorNome={fornecedor.nome}
              onMudar={setFornecedor}
              onCriarRapido={criarFornecedorRapido}
              erro={erros.fornecedorNome}
            />
          </div>
          <div>
            <label className={classeRotulo} htmlFor="avulso-valor">
              Valor (R$)
            </label>
            <input
              id="avulso-valor"
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onBlur={() => {
                const v = parseValorBR(valor);
                if (v !== null) setValor(formatarValorCampo(v));
              }}
              placeholder="0,00"
              className={`${campo(erros.valorBase)} tabular-nums`}
            />
            {mensagem(erros.valorBase)}
          </div>
          <div>
            <label className={classeRotulo} htmlFor="avulso-vencimento">
              Vencimento
            </label>
            <input
              id="avulso-vencimento"
              type="date"
              value={vencimento}
              min={primeiroDia}
              max={ultimoDia}
              onChange={(e) => setVencimento(e.target.value)}
              className={campo(erros.vencimento)}
            />
            {mensagem(erros.vencimento)}
          </div>
          <div>
            <label className={classeRotulo} htmlFor="avulso-forma">
              Forma de pagamento
            </label>
            <select id="avulso-forma" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)} className={campo()}>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={classeRotulo} htmlFor="avulso-autorizado-por">
              Autorizado por
            </label>
            <input
              id="avulso-autorizado-por"
              type="text"
              list="avulso-autorizadores"
              value={autorizadoPor}
              onChange={(e) => setAutorizadoPor(e.target.value)}
              className={campo(erros.autorizadoPor)}
            />
            <datalist id="avulso-autorizadores">
              {sugestoesAutorizador.map((nome) => (
                <option key={nome} value={nome} />
              ))}
            </datalist>
            {mensagem(erros.autorizadoPor)}
          </div>
          <div className="sm:col-span-2">
            <label className={classeRotulo} htmlFor="avulso-observacoes">
              Observações <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              id="avulso-observacoes"
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className={`${campo()} resize-none`}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={jaPago}
              onChange={(e) => setJaPago(e.target.checked)}
              className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
            Já foi pago (registrar a baixa pelo mesmo valor)
          </label>
          {jaPago && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={classeRotulo} htmlFor="avulso-pago-em">
                  Pago em
                </label>
                <input id="avulso-pago-em" type="date" value={pagoEm} max={hoje} onChange={(e) => setPagoEm(e.target.value)} className={campo(erros.pagoEm)} />
                {mensagem(erros.pagoEm)}
              </div>
              <div>
                <label className={classeRotulo} htmlFor="avulso-nf">
                  Nota fiscal <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <input id="avulso-nf" type="text" value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} className={campo()} />
              </div>
              <div className="sm:col-span-2">
                <label className={classeRotulo} htmlFor="avulso-anexos">
                  Comprovante <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <CampoArquivos id="avulso-anexos" arquivos={arquivos} onMudar={setArquivos} />
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalFormulario>
  );
};

export default GastoAvulsoModal;
