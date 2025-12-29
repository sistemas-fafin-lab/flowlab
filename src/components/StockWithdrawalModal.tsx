import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SignatureCanvas from 'react-signature-canvas';
import { X, Check, Package, AlertTriangle, Loader2, CheckCircle2, XCircle, Info } from 'lucide-react';
import { useNotification } from '../hooks/useNotification';
import { RequestItem, Product } from '../types';

interface WithdrawalItem extends RequestItem {
  currentStock: number;
  hasStock: boolean;
  willDeduct: boolean;
  isProcessed?: boolean;
  processError?: string;
}

interface StockWithdrawalModalProps {
  requestId: string;
  requestReason: string;
  approvedBy?: string;
  items: RequestItem[];
  products: Product[];
  onConfirm: (
    signature: string,
    receiverName: string,
    itemsToDeduct: WithdrawalItem[],
    onItemProcessed: (itemId: string, success: boolean, error?: string) => void
  ) => Promise<void>;
  onClose: () => void;
}

const StockWithdrawalModal: React.FC<StockWithdrawalModalProps> = ({
  requestId,
  requestReason,
  approvedBy,
  items,
  products,
  onConfirm,
  onClose,
}) => {
  const { showError } = useNotification();
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [receiverName, setReceiverName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [currentProcessingItem, setCurrentProcessingItem] = useState<string | null>(null);
  
  // Prevenir duplo clique com ref
  const isSubmittingRef = useRef(false);
  
  // Timeout para prevenir submissões muito rápidas
  const lastSubmitTimeRef = useRef<number>(0);
  const SUBMIT_COOLDOWN_MS = 3000; // 3 segundos entre submissões
  
  // Preparar itens com informações de estoque
  const [withdrawalItems, setWithdrawalItems] = useState<WithdrawalItem[]>(() => {
    return items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const currentStock = product?.quantity || 0;
      const hasStock = product !== undefined && currentStock >= item.quantity;
      
      return {
        ...item,
        currentStock,
        hasStock,
        willDeduct: hasStock && item.productId !== null, // Só deduz se tem estoque e é produto cadastrado
        isProcessed: false,
        processError: undefined
      };
    });
  });

  // Itens que serão baixados
  const itemsToDeduct = withdrawalItems.filter(item => item.willDeduct);
  const itemsWithIssues = withdrawalItems.filter(item => !item.willDeduct && item.productId !== null);
  const unregisteredItems = withdrawalItems.filter(item => item.productId === null);
  
  // Verifica se todos os itens são não cadastrados (permite confirmar sem dedução de estoque)
  const allItemsUnregistered = unregisteredItems.length === withdrawalItems.length && withdrawalItems.length > 0;
  
  // Verifica se pode confirmar a retirada (tem itens para deduzir OU todos são não cadastrados)
  const canConfirmWithdrawal = itemsToDeduct.length > 0 || allItemsUnregistered;
  
  // Callback para atualizar status de processamento de cada item
  const handleItemProcessed = (itemId: string, success: boolean, error?: string) => {
    setWithdrawalItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, isProcessed: true, processError: success ? undefined : error }
        : item
    ));
    setCurrentProcessingItem(null);
  };

  const handleConfirm = async () => {
    // Validações básicas
    if (!receiverName.trim()) {
      showError('Informe o nome de quem está recebendo.');
      return;
    }
    if (sigCanvasRef.current?.isEmpty()) {
      showError('A assinatura é obrigatória.');
      return;
    }
    
    // Verificar cooldown
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < SUBMIT_COOLDOWN_MS) {
      showError('Aguarde alguns segundos antes de tentar novamente.');
      return;
    }
    
    // Verificar se já está processando (duplo clique)
    if (isSubmittingRef.current || isProcessing) {
      console.warn('Tentativa de submissão duplicada bloqueada');
      return;
    }
    
    // Verificar se pode prosseguir com a retirada
    if (!canConfirmWithdrawal) {
      showError('Não há itens disponíveis para processar a retirada.');
      return;
    }

    try {
      // Marcar como processando
      isSubmittingRef.current = true;
      lastSubmitTimeRef.current = now;
      setIsProcessing(true);

      const signatureData = sigCanvasRef.current?.toDataURL();
      
      // Processar a confirmação
      await onConfirm(
        signatureData!,
        receiverName.trim(),
        itemsToDeduct,
        handleItemProcessed
      );
      
      setProcessingComplete(true);
      
      // Fechar automaticamente após 2 segundos de sucesso
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao processar retirada:', error);
      isSubmittingRef.current = false;
      setIsProcessing(false);
    }
  };

  // Resetar flags se o modal for fechado e reaberto
  useEffect(() => {
    return () => {
      isSubmittingRef.current = false;
    };
  }, []);

  const getItemStatusIcon = (item: WithdrawalItem) => {
    if (currentProcessingItem === item.id) {
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    }
    if (item.isProcessed) {
      return item.processError 
        ? <XCircle className="w-4 h-4 text-red-500" />
        : <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
    if (!item.willDeduct) {
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    }
    return <Package className="w-4 h-4 text-gray-400" />;
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-3">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Confirmação de Retirada</h3>
                <p className="text-sm text-white/80">Solicitação #{requestId.slice(0, 8)}</p>
              </div>
            </div>
            {!isProcessing && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Aviso de segurança */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Verificação de Segurança</p>
                <p>Revise cuidadosamente os itens abaixo antes de confirmar. Esta ação irá deduzir as quantidades do estoque de forma permanente.</p>
              </div>
            </div>
          </div>

          {/* Lista de itens que serão baixados */}
          {itemsToDeduct.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                Itens que serão baixados do estoque ({itemsToDeduct.length})
              </h4>
              <div className="bg-green-50 border border-green-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-green-100/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-green-800">Produto</th>
                      <th className="px-4 py-2 text-center font-semibold text-green-800">Qtd. Solicitada</th>
                      <th className="px-4 py-2 text-center font-semibold text-green-800">Estoque Atual</th>
                      <th className="px-4 py-2 text-center font-semibold text-green-800">Estoque Final</th>
                      <th className="px-4 py-2 text-center font-semibold text-green-800">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-200">
                    {itemsToDeduct.map((item) => (
                      <tr key={item.id} className="hover:bg-green-100/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{item.productName}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{item.currentStock}</td>
                        <td className="px-4 py-3 text-center font-semibold text-green-700">
                          {item.currentStock - item.quantity}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getItemStatusIcon(item)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Itens com problemas de estoque */}
          {itemsWithIssues.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <AlertTriangle className="w-4 h-4 text-amber-500 mr-2" />
                Itens com estoque insuficiente ({itemsWithIssues.length})
              </h4>
              <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-amber-100/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-amber-800">Produto</th>
                      <th className="px-4 py-2 text-center font-semibold text-amber-800">Qtd. Solicitada</th>
                      <th className="px-4 py-2 text-center font-semibold text-amber-800">Estoque Atual</th>
                      <th className="px-4 py-2 text-center font-semibold text-amber-800">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-200">
                    {itemsWithIssues.map((item) => (
                      <tr key={item.id} className="hover:bg-amber-100/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{item.productName}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-center text-red-600 font-semibold">{item.currentStock}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs px-2 py-1 bg-amber-200 text-amber-800 rounded-full">
                            Não será baixado
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Itens não cadastrados */}
          {unregisteredItems.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Info className="w-4 h-4 text-gray-400 mr-2" />
                Itens não cadastrados ({unregisteredItems.length})
              </h4>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-2">
                  Estes itens não estão no sistema e não afetarão o estoque:
                </p>
                <div className="flex flex-wrap gap-2">
                  {unregisteredItems.map((item) => (
                    <span key={item.id} className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-full">
                      {item.productName} ({item.quantity} un.)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Processamento concluído */}
          {processingComplete && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center">
                <CheckCircle2 className="w-6 h-6 text-green-500 mr-3" />
                <div>
                  <p className="font-semibold text-green-800">Retirada processada com sucesso!</p>
                  <p className="text-sm text-green-600">Fechando em instantes...</p>
                </div>
              </div>
            </div>
          )}

          {!processingComplete && (
            <>
              {/* Nome do recebedor */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome de quem está recebendo *
                </label>
                <input
                  type="text"
                  placeholder="Digite o nome completo"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Área de assinatura */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assinatura do recebedor *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
                  <SignatureCanvas
                    ref={sigCanvasRef}
                    penColor="black"
                    canvasProps={{
                      className: 'w-full h-40 cursor-crosshair',
                      style: { touchAction: 'none' }
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => sigCanvasRef.current?.clear()}
                  disabled={isProcessing}
                  className="mt-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Limpar assinatura
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer com botões */}
        {!processingComplete && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 flex items-center font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing || !canConfirmWithdrawal}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 flex items-center font-medium transition-all shadow-md shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {allItemsUnregistered 
                    ? 'Confirmar Retirada (sem itens em estoque)'
                    : `Confirmar Retirada (${itemsToDeduct.length} ${itemsToDeduct.length === 1 ? 'item' : 'itens'})`
                  }
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default StockWithdrawalModal;
