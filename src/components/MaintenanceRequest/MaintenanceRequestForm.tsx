import React, { useState, useRef } from 'react';
import {
  MapPin,
  FileText,
  AlertTriangle,
  Calendar,
  Upload,
  X,
  Image,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { MaintenanceRequestFormValues, MaintenancePriority } from '../../types';

interface MaintenanceRequestFormProps {
  onSubmit: (values: MaintenanceRequestFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  department: string;
}

const MaintenanceRequestForm: React.FC<MaintenanceRequestFormProps> = ({
  onSubmit,
  onCancel,
  isSubmitting,
  department
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState<MaintenanceRequestFormValues>({
    localOcorrencia: '',
    descricao: '',
    impactoOperacional: '',
    dataIdentificacao: new Date().toISOString().slice(0, 16),
    prioridade: 'common',
    images: []
  });

  // Image previews
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handle input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle priority change
  const handlePriorityChange = (priority: MaintenancePriority) => {
    setFormData(prev => ({ ...prev, prioridade: priority }));
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    newFiles.forEach(file => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return;
      }

      validFiles.push(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImagePreviews(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    setFormData(prev => ({
      ...prev,
      images: [...(prev.images || []), ...validFiles]
    }));

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index) || []
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.localOcorrencia.trim()) {
      newErrors.localOcorrencia = 'Local da ocorrência é obrigatório';
    }

    if (!formData.descricao.trim()) {
      newErrors.descricao = 'Descrição do problema é obrigatória';
    }

    if (!formData.impactoOperacional.trim()) {
      newErrors.impactoOperacional = 'Impacto operacional é obrigatório';
    }

    if (!formData.dataIdentificacao) {
      newErrors.dataIdentificacao = 'Data/hora de identificação é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Nova Solicitação de Manutenção</h3>
            <p className="text-sm text-white/80 mt-1">Preencha os dados do problema identificado</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-8">
        <div className="space-y-6">
          {/* Setor (readonly) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Setor
            </label>
            <div className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600">
              {department}
            </div>
            <p className="mt-2 text-xs text-gray-500">Setor preenchido automaticamente com base no seu perfil</p>
          </div>

          {/* Local da Ocorrência */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              <MapPin className="w-4 h-4 inline-block mr-1 mb-0.5" />
              Local da Ocorrência *
            </label>
            <input
              type="text"
              name="localOcorrencia"
              value={formData.localOcorrencia}
              onChange={handleInputChange}
              placeholder="Ex: Sala de análises, Laboratório 2, Corredor térreo..."
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
                errors.localOcorrencia ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            />
            {errors.localOcorrencia && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.localOcorrencia}
              </p>
            )}
          </div>

          {/* Descrição do Problema */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              <FileText className="w-4 h-4 inline-block mr-1 mb-0.5" />
              Descrição do Problema *
            </label>
            <textarea
              name="descricao"
              value={formData.descricao}
              onChange={handleInputChange}
              rows={4}
              placeholder="Descreva detalhadamente o problema encontrado..."
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 resize-none ${
                errors.descricao ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            />
            {errors.descricao && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.descricao}
              </p>
            )}
          </div>

          {/* Impacto Operacional */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              <AlertTriangle className="w-4 h-4 inline-block mr-1 mb-0.5" />
              Impacto Operacional *
            </label>
            <textarea
              name="impactoOperacional"
              value={formData.impactoOperacional}
              onChange={handleInputChange}
              rows={3}
              placeholder="Descreva como este problema afeta as operações do laboratório..."
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 resize-none ${
                errors.impactoOperacional ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            />
            {errors.impactoOperacional && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.impactoOperacional}
              </p>
            )}
          </div>

          {/* Data/Hora de Identificação */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              <Calendar className="w-4 h-4 inline-block mr-1 mb-0.5" />
              Data/Hora de Identificação *
            </label>
            <input
              type="datetime-local"
              name="dataIdentificacao"
              value={formData.dataIdentificacao as string}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
                errors.dataIdentificacao ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            />
            {errors.dataIdentificacao && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.dataIdentificacao}
              </p>
            )}
          </div>

          {/* Prioridade */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
              Prioridade *
            </label>
            <div className="grid grid-cols-3 gap-4">
              {/* Normal */}
              <button
                type="button"
                onClick={() => handlePriorityChange('common')}
                className={`p-4 rounded-xl border-2 transition-all duration-200 text-center ${
                  formData.prioridade === 'common'
                    ? 'border-gray-500 bg-gray-50 ring-2 ring-gray-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                  formData.prioridade === 'common' ? 'bg-gray-500' : 'bg-gray-100'
                }`}>
                  <span className={`text-lg font-bold ${
                    formData.prioridade === 'common' ? 'text-white' : 'text-gray-400'
                  }`}>N</span>
                </div>
                <span className={`text-sm font-medium ${
                  formData.prioridade === 'common' ? 'text-gray-700' : 'text-gray-500'
                }`}>Normal</span>
              </button>

              {/* Prioritário */}
              <button
                type="button"
                onClick={() => handlePriorityChange('priority')}
                className={`p-4 rounded-xl border-2 transition-all duration-200 text-center ${
                  formData.prioridade === 'priority'
                    ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500/20'
                    : 'border-gray-200 hover:border-orange-200'
                }`}
              >
                <div className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                  formData.prioridade === 'priority' ? 'bg-orange-500' : 'bg-orange-100'
                }`}>
                  <span className={`text-lg font-bold ${
                    formData.prioridade === 'priority' ? 'text-white' : 'text-orange-400'
                  }`}>P</span>
                </div>
                <span className={`text-sm font-medium ${
                  formData.prioridade === 'priority' ? 'text-orange-700' : 'text-gray-500'
                }`}>Prioritário</span>
              </button>

              {/* Urgente */}
              <button
                type="button"
                onClick={() => handlePriorityChange('urgent')}
                className={`p-4 rounded-xl border-2 transition-all duration-200 text-center ${
                  formData.prioridade === 'urgent'
                    ? 'border-red-500 bg-red-50 ring-2 ring-red-500/20'
                    : 'border-gray-200 hover:border-red-200'
                }`}
              >
                <div className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                  formData.prioridade === 'urgent' ? 'bg-red-500' : 'bg-red-100'
                }`}>
                  <AlertTriangle className={`w-5 h-5 ${
                    formData.prioridade === 'urgent' ? 'text-white' : 'text-red-400'
                  }`} />
                </div>
                <span className={`text-sm font-medium ${
                  formData.prioridade === 'urgent' ? 'text-red-700' : 'text-gray-500'
                }`}>Urgente</span>
              </button>
            </div>

            {/* Alerta para prioridade urgente */}
            {formData.prioridade === 'urgent' && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-800">Atenção!</p>
                    <p className="text-sm text-red-700 mt-1">
                      Somente selecione <strong>URGENTE</strong> quando houver risco iminente à integridade do laboratório, das instalações ou dos colaboradores.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Upload de Imagens */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
              <Image className="w-4 h-4 inline-block mr-1 mb-0.5" />
              Imagens (Opcional)
            </label>
            
            <div className="space-y-4">
              {/* Upload area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-all duration-200"
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600">
                  Clique para selecionar ou arraste imagens aqui
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  PNG, JPG ou JPEG (máx. 5MB por arquivo)
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Image previews */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-3 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-200 font-medium shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5" />
                Criar Solicitação
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MaintenanceRequestForm;
