import React, { useEffect, useMemo, useState } from 'react';
import { Package, PackagePlus, Search, Boxes, AlertTriangle, X } from 'lucide-react';
import { Product } from '../types';
import UnitSelect from './UnitSelect';
import Select from './Select';

/**
 * Entrada direta no Estoque Departamental.
 *
 * Existem itens que chegam direto no setor sem passar pelo estoque central
 * (compra direta, doação, brinde de fornecedor). Este modal registra esse
 * recebimento como um movimento `type:'in'` com destino no local do setor —
 * o mesmo caminho do recebimento de NF, só que iniciado pelo próprio setor.
 *
 * Dois modos: creditar um produto que já existe no catálogo, ou cadastrar o
 * produto na hora e já creditar. Protegido por `canAddStockDepart` no pai.
 */

export type EntradaDiretaPayload = {
  mode: 'existente' | 'novo';
  /** modo 'existente' */
  productId?: string;
  /** modo 'novo' — dados mínimos do cadastro; o código é gerado pelo pai */
  novoProduto?: { name: string; unit: string; category: string };
  quantity: number;
  unitPrice: number;
  expirationDate: string;
  /** de onde veio o item (texto livre) — vai para stock_movements.notes */
  origem: string;
  /** modo 'existente': sobrescreve a validade no cadastro do produto */
  atualizarCadastro: boolean;
};

interface EntradaDiretaModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectorName: string;
  products: Product[];
  /** saldo atual do setor por produto, para mostrar o "de → para" */
  saldoPorProduto: Record<string, number>;
  onConfirm: (payload: EntradaDiretaPayload) => Promise<void>;
}

type NovoProduto = { name: string; unit: string; category: string };

const EMPTY_NOVO: NovoProduto = { name: '', unit: '', category: 'general' };

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

// Mesmo tratamento de rótulo do cadastro de produto (AddProduct).
const categoryLabel = (category: string): string =>
  category === 'general'
    ? 'Uso Geral'
    : category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const EntradaDiretaModal: React.FC<EntradaDiretaModalProps> = ({
  isOpen,
  onClose,
  sectorName,
  products,
  saldoPorProduto,
  onConfirm,
}) => {
  const [mode, setMode] = useState<'existente' | 'novo'>('existente');
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [novo, setNovo] = useState<NovoProduto>(EMPTY_NOVO);
  const [quantity, setQuantity] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [expirationDate, setExpirationDate] = useState('');
  const [origem, setOrigem] = useState('');
  const [atualizarCadastro, setAtualizarCadastro] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset a cada abertura — o modal fica montado entre usos.
  useEffect(() => {
    if (!isOpen) return;
    setMode('existente');
    setProductId('');
    setSearch('');
    setNovo(EMPTY_NOVO);
    setQuantity(0);
    setUnitPrice(0);
    setExpirationDate('');
    setOrigem('');
    setAtualizarCadastro(false);
    setSubmitting(false);
  }, [isOpen]);

  // Unidades já em uso no catálogo — evita cadastrar "caixa" de novo como "cx".
  const unidadesDoCatalogo = useMemo(
    () => [...new Set(products.map(p => p.unit).filter(Boolean))],
    [products]
  );

  // Categorias existentes no catálogo (o cadastro permite categorias livres).
  const categories = useMemo(() => {
    const set = new Set<string>(['general']);
    products.forEach(p => { if (p.category) set.add(p.category); });
    return [...set].sort();
  }, [products]);

  const selectedProduct = useMemo(
    () => products.find(p => p.id === productId),
    [products, productId]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter(p => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term))
      .slice(0, 20);
  }, [products, search]);

  // Nome igual ao de um produto do catálogo: só alerta, não bloqueia
  // (pode ser outra apresentação), mas evita duplicata por descuido.
  const nomeDuplicado = useMemo(() => {
    const name = novo.name.trim().toLowerCase();
    if (!name) return undefined;
    return products.find(p => p.name.trim().toLowerCase() === name);
  }, [products, novo.name]);

  const validadeVencida = useMemo(() => {
    if (!expirationDate) return false;
    const d = new Date(expirationDate);
    if (Number.isNaN(d.getTime())) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return d < hoje;
  }, [expirationDate]);

  if (!isOpen) return null;

  const saldoAtual = productId ? (saldoPorProduto[productId] ?? 0) : 0;

  const canSubmit =
    !submitting &&
    quantity > 0 &&
    (mode === 'existente'
      ? !!productId
      : !!novo.name.trim() && !!novo.unit.trim());

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm({
        mode,
        productId: mode === 'existente' ? productId : undefined,
        novoProduto: mode === 'novo'
          ? { name: novo.name.trim(), unit: novo.unit.trim(), category: novo.category }
          : undefined,
        quantity,
        unitPrice,
        expirationDate,
        origem: origem.trim(),
        atualizarCadastro: mode === 'existente' && atualizarCadastro,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300">
            <PackagePlus className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Entrada direta</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sectorName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Modo */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-700/50">
            {([
              { value: 'existente', label: 'Produto existente' },
              { value: 'novo', label: 'Novo produto' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                disabled={submitting}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                  mode === opt.value
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* ── Produto existente ─────────────────────────────────────────── */}
          {mode === 'existente' && (
            <div>
              <label className={LABEL_CLASS}>Produto *</label>
              {selectedProduct ? (
                <div className="flex items-center gap-3 px-3 py-2.5 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/60 dark:bg-blue-900/20">
                  <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">{selectedProduct.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedProduct.unit} • saldo no setor: {saldoAtual}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setProductId(''); setSearch(''); }}
                    disabled={submitting}
                    className="text-xs text-blue-600 dark:text-blue-300 hover:underline disabled:opacity-50"
                  >
                    trocar
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar produto…"
                      className={`${INPUT_CLASS} pl-9`}
                    />
                  </div>
                  {search.trim() && (
                    <div className="mt-2 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl">
                      {filteredProducts.length === 0 ? (
                        <p className="p-3 text-xs text-gray-500 dark:text-gray-400">
                          Nenhum produto encontrado. Use <strong>Novo produto</strong> para cadastrá-lo.
                        </p>
                      ) : (
                        filteredProducts.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setProductId(p.id); setUnitPrice(p.unitPrice ?? 0); }}
                            className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-gray-50 dark:border-gray-700 last:border-b-0 transition-colors"
                          >
                            <p className="font-medium text-sm text-gray-800 dark:text-gray-100">{p.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {p.unit} • saldo no setor: {saldoPorProduto[p.id] ?? 0}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Novo produto ──────────────────────────────────────────────── */}
          {mode === 'novo' && (
            <div className="space-y-4">
              <div>
                <label className={LABEL_CLASS}>Nome *</label>
                <input
                  type="text"
                  autoFocus
                  value={novo.name}
                  onChange={(e) => setNovo(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex.: Luva de procedimento M"
                  className={INPUT_CLASS}
                />
                {/* Some ao gravar: `addProduct` atualiza o catálogo antes de o modal
                    fechar, e o produto recém-criado casaria com o próprio nome digitado. */}
                {nomeDuplicado && !submitting && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Já existe um produto com esse nome. Considere usar “Produto existente”.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Unidade *</label>
                  <UnitSelect
                    value={novo.unit}
                    onChange={(unit) => setNovo(prev => ({ ...prev, unit }))}
                    units={unidadesDoCatalogo}
                    controlClass={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Categoria</label>
                  <Select
                    value={novo.category}
                    ariaLabel="Categoria do produto"
                    options={categories.map(c => ({ value: c, label: categoryLabel(c) }))}
                    onChange={(category) => setNovo(prev => ({ ...prev, category }))}
                    controlClass={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Comuns aos dois modos ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Quantidade *</label>
              <input
                type="number"
                min={1}
                value={quantity || ''}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                placeholder="0"
                className={INPUT_CLASS}
              />
              {mode === 'existente' && selectedProduct && quantity > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Saldo após:{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {saldoAtual + quantity} {selectedProduct.unit}
                  </span>
                </p>
              )}
            </div>
            <div>
              <label className={LABEL_CLASS}>Preço unitário</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitPrice || ''}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Validade</label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className={`${INPUT_CLASS} dark:[color-scheme:dark]`}
            />
          </div>

          {validadeVencida && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                A validade informada já passou. O item entrará no setor marcado como vencido.
              </p>
            </div>
          )}

          {/* A validade é do cadastro do produto (global), não deste recebimento no
              local — sobrescrever afeta o alerta de vencimento dos outros setores. */}
          {mode === 'existente' && selectedProduct && expirationDate && (
            <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={atualizarCadastro}
                onChange={(e) => setAtualizarCadastro(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-500 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-300">
                Atualizar a validade no cadastro do produto.
                {selectedProduct.expirationDate && (
                  <> Hoje o cadastro registra{' '}
                    <strong>{new Date(selectedProduct.expirationDate).toLocaleDateString('pt-BR')}</strong>.
                  </>
                )}{' '}
                Sem marcar, a data fica só no histórico desta entrada — a validade do cadastro vale para todos os setores.
              </span>
            </label>
          )}

          <div>
            <label className={LABEL_CLASS}>Origem / observação</label>
            <textarea
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              rows={2}
              placeholder="Ex.: compra direta pelo setor, doação do fornecedor X"
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <Boxes className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              A quantidade entra no estoque de <strong>{sectorName}</strong> e passa a somar no total do produto.
              {mode === 'novo' && ' O código do produto é gerado automaticamente.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 rounded-b-2xl flex justify-end gap-3 sticky bottom-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Registrando…' : 'Registrar entrada'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntradaDiretaModal;
