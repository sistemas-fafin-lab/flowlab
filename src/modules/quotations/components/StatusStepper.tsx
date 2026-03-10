import React from 'react';
import { Check, X, Circle } from 'lucide-react';
import { QuotationStatus, QuotationStatusLabels } from '../types';
import { getStatusStep } from '../workflow/stateMachine';

interface StatusStepperProps {
  currentStatus: QuotationStatus;
  className?: string;
}

export const StatusStepper: React.FC<StatusStepperProps> = ({
  currentStatus,
  className = '',
}) => {
  const currentStep = getStatusStep(currentStatus);
  const isRejected = currentStatus === 'rejected';
  const isCancelled = currentStatus === 'cancelled';

  // Show simplified steps for mobile
  const steps = [
    { status: 'draft', label: 'Rascunho', shortLabel: 'Rasc.' },
    { status: 'sent_to_suppliers', label: 'Enviada', shortLabel: 'Env.' },
    { status: 'waiting_responses', label: 'Aguardando', shortLabel: 'Agrd.' },
    { status: 'under_review', label: 'Análise', shortLabel: 'Análise' },
    { status: 'awaiting_approval', label: 'Aprovação', shortLabel: 'Aprov.' },
    { status: 'approved', label: 'Aprovada', shortLabel: 'Aprov.' },
    { status: 'converted_to_purchase', label: 'Convertida', shortLabel: 'Conv.' },
  ];

  if (isRejected || isCancelled) {
    return (
      <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl ${
        isRejected ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'
      } ${className}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isRejected ? 'bg-red-100' : 'bg-gray-100'
        }`}>
          <X className={`w-4 h-4 ${isRejected ? 'text-red-600' : 'text-gray-600'}`} />
        </div>
        <span className={`text-sm font-medium ${isRejected ? 'text-red-700' : 'text-gray-700'}`}>
          {QuotationStatusLabels[currentStatus]}
        </span>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Mobile: Show current step with progress bar */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Progresso</span>
          <span className="text-xs font-medium text-blue-600">
            {currentStep + 1}/{steps.length}
          </span>
        </div>
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
            <Circle className="w-3 h-3 text-blue-600 fill-current" />
          </div>
          <span className="text-sm font-medium text-gray-900">
            {QuotationStatusLabels[currentStatus]}
          </span>
        </div>
      </div>

      {/* Desktop: Full stepper */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = currentStep > index;
            const isCurrent = currentStep === index;
            const isUpcoming = currentStep < index;

            return (
              <React.Fragment key={step.status}>
                {/* Step */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-green-100 text-green-600'
                        : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium text-center max-w-[60px] lg:max-w-[80px] ${
                      isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    <span className="hidden lg:inline">{step.label}</span>
                    <span className="lg:hidden">{step.shortLabel}</span>
                  </span>
                </div>

                {/* Connector */}
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 lg:mx-2 ${
                      currentStep > index ? 'bg-green-400' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StatusStepper;
