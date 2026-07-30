# Controle de Períodos de Solicitações - Guia de Implementação

Este documento descreve a lógica de implementação da funcionalidade de controle de períodos de solicitações, permitindo configurar janelas de tempo específicas para criação de solicitações. Esta implementação foi abstraída para ser reutilizada em outros projetos React.

## 📋 Visão Geral

A funcionalidade permite que administradores configurem períodos específicos do mês (por exemplo, do dia 1 ao dia 15) durante os quais os usuários podem criar solicitações. Fora desse período, a criação de novas solicitações é bloqueada.

## 🗄️ Estrutura do Banco de Dados

### Tabela: `request_periods`

```sql
CREATE TABLE IF NOT EXISTS request_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  start_day INTEGER NOT NULL CHECK (start_day >= 1 AND start_day <= 31),
  end_day INTEGER NOT NULL CHECK (end_day >= 1 AND end_day <= 31),
  department TEXT NOT NULL UNIQUE, -- Use 'general' para período padrão
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_request_periods_department ON request_periods(department);

-- Habilitar RLS (Row Level Security)
ALTER TABLE request_periods ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Allow authenticated users to read periods"
  ON request_periods
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to manage periods"
  ON request_periods
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

### Estrutura dos Dados

Cada registro na tabela representa um período:

```typescript
interface RequestPeriod {
  id: string;
  start_day: number;    // Dia inicial do período (1-31)
  end_day: number;      // Dia final do período (1-31)
  department: string;   // Identificador do grupo/departamento
  created_at: string;
  updated_at: string;
}
```

## 🔧 Implementação Frontend

### 1. Hook Personalizado para Verificação de Período

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface PeriodCheck {
  isOpen: boolean;
  period: { start_day: number; end_day: number } | null;
}

export const useRequestPeriod = (userRole?: string): PeriodCheck => {
  const [isOpen, setIsOpen] = useState(true);
  const [period, setPeriod] = useState<{ start_day: number; end_day: number } | null>(null);

  useEffect(() => {
    const checkPeriod = async () => {
      // Se o usuário não é do tipo que precisa respeitar períodos, libera
      if (userRole !== 'requester') {
        setIsOpen(true);
        return;
      }

      // Busca o período configurado
      const { data, error } = await supabase
        .from('request_periods')
        .select('*')
        .eq('department', 'general') // Ou qualquer identificador que você usar
        .maybeSingle();

      if (error || !data) {
        setIsOpen(true); // Se não há configuração, permite solicitações
        return;
      }

      setPeriod(data);

      // Verifica se o dia atual está dentro do período
      const today = new Date().getDate();
      const isWithinPeriod = today >= data.start_day && today <= data.end_day;
      setIsOpen(isWithinPeriod);
    };

    checkPeriod();
  }, [userRole]);

  return { isOpen, period };
};
```

### 2. Componente de Configuração de Períodos

```typescript
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save } from 'lucide-react';

const RequestPeriodConfig: React.FC = () => {
  const [startDay, setStartDay] = useState<number | ''>('');
  const [endDay, setEndDay] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  // Carregar período atual
  useEffect(() => {
    const fetchPeriod = async () => {
      const { data, error } = await supabase
        .from('request_periods')
        .select('*')
        .eq('department', 'general')
        .maybeSingle();
      
      if (!error && data) {
        setStartDay(data.start_day);
        setEndDay(data.end_day);
      }
    };

    fetchPeriod();
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDay || !endDay) return;
    
    setLoading(true);

    try {
      const { error } = await supabase
        .from('request_periods')
        .upsert({
          start_day: startDay,
          end_day: endDay,
          department: 'general',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'department'
        });

      if (error) {
        alert('Erro ao salvar período.');
      } else {
        alert('Período salvo com sucesso!');
      }
    } catch (error) {
      alert('Erro ao salvar período.');
    }

    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Configurar Período de Solicitações</h2>
      <p className="text-gray-600 mb-6">
        Defina os dias do mês em que solicitações podem ser criadas
      </p>
      
      {startDay && endDay && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Período atual:</strong> Dia {startDay} ao dia {endDay}
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dia de Início
          </label>
          <input
            type="number"
            value={startDay}
            onChange={(e) => setStartDay(Number(e.target.value))}
            min={1}
            max={31}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dia Final
          </label>
          <input
            type="number"
            value={endDay}
            onChange={(e) => setEndDay(Number(e.target.value))}
            min={1}
            max={31}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {loading ? (
            <span className="animate-spin h-5 w-5 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          Salvar Período
        </button>
      </form>
    </div>
  );
};

export default RequestPeriodConfig;
```

### 3. Aplicando a Verificação no Componente de Solicitações

```typescript
import React from 'react';
import { useRequestPeriod } from '../hooks/useRequestPeriod';

const RequestManagement: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { isOpen: isPeriodOpen, period: requestPeriod } = useRequestPeriod(userProfile?.role);
  
  const [showAddRequest, setShowAddRequest] = useState(false);

  const handleNewRequestClick = () => {
    // Verificar se o período está aberto
    if (!isPeriodOpen && userProfile?.role === 'requester') {
      alert(
        `Período fechado! Solicitações só são permitidas entre os dias ${requestPeriod?.start_day} e ${requestPeriod?.end_day} de cada mês.`
      );
      return;
    }
    
    setShowAddRequest(true);
  };

  return (
    <div>
      <button 
        onClick={handleNewRequestClick}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Nova Solicitação
      </button>
      
      {/* Indicador visual do período */}
      {!isPeriodOpen && userProfile?.role === 'requester' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
          <p className="text-yellow-800 text-sm">
            ⚠️ Solicitações só são permitidas entre os dias {requestPeriod?.start_day} e {requestPeriod?.end_day} de cada mês.
          </p>
        </div>
      )}
      
      {showAddRequest && (
        <div>
          {/* Formulário de criação de solicitação */}
        </div>
      )}
    </div>
  );
};

export default RequestManagement;
```

## 🎯 Casos de Uso

### 1. Configurar um Período

```typescript
// Exemplo: Permitir solicitações apenas entre dia 1 e dia 15 de cada mês
const period = {
  start_day: 1,
  end_day: 15,
  department: 'general'
};

await supabase
  .from('request_periods')
  .upsert(period, { onConflict: 'department' });
```

### 2. Verificar se Hoje Está Dentro do Período

```typescript
const checkIfTodayIsInPeriod = (period: { start_day: number; end_day: number }): boolean => {
  const today = new Date().getDate();
  return today >= period.start_day && today <= period.end_day;
};
```

### 3. Desabilitar Período (Liberar Todas as Datas)

```typescript
// Opção 1: Deletar o registro
await supabase
  .from('request_periods')
  .delete()
  .eq('department', 'general');

// Opção 2: Configurar período que cobre o mês inteiro
await supabase
  .from('request_periods')
  .upsert({
    start_day: 1,
    end_day: 31,
    department: 'general'
  }, { onConflict: 'department' });
```

## 🔐 Permissões e Segurança

### Controle de Acesso

```typescript
// utils/permissions.ts
export const PERMISSIONS = {
  admin: {
    canConfigureRequestPeriods: true,
    canBypassPeriodRestriction: true,
  },
  operator: {
    canConfigureRequestPeriods: false,
    canBypassPeriodRestriction: true,
  },
  requester: {
    canConfigureRequestPeriods: false,
    canBypassPeriodRestriction: false,
  },
};

export const hasPermission = (role: string, permission: string): boolean => {
  return PERMISSIONS[role]?.[permission] || false;
};
```

### Aplicando Permissões

```typescript
const RequestPeriodConfig: React.FC = () => {
  const { userProfile } = useAuth();
  
  if (!hasPermission(userProfile?.role, 'canConfigureRequestPeriods')) {
    return <div className="text-red-600 p-4">Acesso restrito.</div>;
  }
  
  // Restante do componente...
};
```

## 📱 UX/UI - Boas Práticas

### 1. Feedback Visual para Período Fechado

```typescript
{!isPeriodOpen && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
    <div className="flex">
      <div className="flex-shrink-0">
        ⚠️
      </div>
      <div className="ml-3">
        <p className="text-sm text-yellow-700">
          Período de solicitações fechado. Solicitações permitidas apenas entre os dias{' '}
          <strong>{requestPeriod?.start_day}</strong> e <strong>{requestPeriod?.end_day}</strong> de cada mês.
        </p>
      </div>
    </div>
  </div>
)}
```

### 2. Indicador no Botão de Nova Solicitação

```typescript
<button
  onClick={handleNewRequestClick}
  disabled={!isPeriodOpen && userProfile?.role === 'requester'}
  className={`px-4 py-2 rounded-lg ${
    isPeriodOpen || userProfile?.role !== 'requester'
      ? 'bg-blue-500 hover:bg-blue-600 text-white'
      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
  }`}
>
  Nova Solicitação
  {!isPeriodOpen && userProfile?.role === 'requester' && ' (Período Fechado)'}
</button>
```

### 3. Mostrar Contagem Regressiva

```typescript
const getDaysUntilPeriodOpens = (startDay: number): number => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let nextPeriodStart: Date;
  
  if (currentDay < startDay) {
    // Ainda neste mês
    nextPeriodStart = new Date(currentYear, currentMonth, startDay);
  } else {
    // Próximo mês
    nextPeriodStart = new Date(currentYear, currentMonth + 1, startDay);
  }
  
  const diffTime = nextPeriodStart.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};
```

## 🧪 Testes

### Teste de Verificação de Período

```typescript
describe('Request Period Validation', () => {
  it('should allow requests within the period', () => {
    const period = { start_day: 1, end_day: 15 };
    const today = 10;
    
    const isWithinPeriod = today >= period.start_day && today <= period.end_day;
    expect(isWithinPeriod).toBe(true);
  });
  
  it('should block requests outside the period', () => {
    const period = { start_day: 1, end_day: 15 };
    const today = 20;
    
    const isWithinPeriod = today >= period.start_day && today <= period.end_day;
    expect(isWithinPeriod).toBe(false);
  });
  
  it('should allow requests when no period is configured', () => {
    const period = null;
    const isAllowed = period === null;
    
    expect(isAllowed).toBe(true);
  });
});
```

## 🔄 Extensões e Variações

### Múltiplos Períodos por Mês

Se você precisa de múltiplos períodos no mesmo mês:

```typescript
interface RequestPeriod {
  id: string;
  start_day: number;
  end_day: number;
  department: string;
  priority?: number; // Para ordenar múltiplos períodos
}

// Verificação com múltiplos períodos
const checkMultiplePeriods = (periods: RequestPeriod[]): boolean => {
  const today = new Date().getDate();
  
  return periods.some(period => 
    today >= period.start_day && today <= period.end_day
  );
};
```

### Períodos com Horários Específicos

Se você precisa controlar também o horário:

```sql
ALTER TABLE request_periods 
  ADD COLUMN start_hour INTEGER CHECK (start_hour >= 0 AND start_hour <= 23),
  ADD COLUMN end_hour INTEGER CHECK (end_hour >= 0 AND end_hour <= 23);
```

```typescript
const checkPeriodWithTime = (period: RequestPeriod): boolean => {
  const now = new Date();
  const today = now.getDate();
  const currentHour = now.getHours();
  
  const isDayInRange = today >= period.start_day && today <= period.end_day;
  const isHourInRange = currentHour >= period.start_hour && currentHour <= period.end_hour;
  
  return isDayInRange && isHourInRange;
};
```

### Períodos por Tipo de Solicitação

Se você tem diferentes tipos de solicitações com períodos diferentes:

```sql
ALTER TABLE request_periods 
  ADD COLUMN request_type TEXT; -- 'purchase', 'material', etc.
```

## 📝 Notas Importantes

1. **Validação no Frontend e Backend**: Sempre valide períodos tanto no frontend quanto no backend para garantir segurança.

2. **Fuso Horário**: Considere o fuso horário do servidor ao comparar datas. Use `new Date()` com cuidado.

3. **Performance**: A verificação de período é feita no lado do cliente. Para aplicações críticas, adicione validação também no servidor.

4. **Meses com Dias Diferentes**: Tenha cuidado com meses que têm menos de 31 dias (fevereiro, por exemplo). Valide isso na configuração:

```typescript
const validatePeriod = (startDay: number, endDay: number): boolean => {
  if (startDay < 1 || startDay > 31) return false;
  if (endDay < 1 || endDay > 31) return false;
  if (startDay > endDay) return false;
  
  // Aviso para dias acima de 28 (seguro para todos os meses)
  if (endDay > 28) {
    console.warn('Atenção: Período pode não funcionar corretamente em fevereiro');
  }
  
  return true;
};
```

5. **Cache**: Considere cachear o período para evitar consultas desnecessárias:

```typescript
const [period, setPeriod] = useState<RequestPeriod | null>(() => {
  const cached = localStorage.getItem('request_period');
  return cached ? JSON.parse(cached) : null;
});
```

## 🚀 Próximos Passos

Para implementar esta funcionalidade em seu projeto:

1. Crie a tabela `request_periods` no banco de dados
2. Implemente o hook `useRequestPeriod`
3. Crie o componente de configuração `RequestPeriodConfig`
4. Integre a verificação no componente de solicitações
5. Adicione permissões adequadas para configuração
6. Teste em diferentes cenários (dentro/fora do período, sem configuração, etc.)

## 📚 Recursos Adicionais

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [React Hooks Best Practices](https://react.dev/reference/react)
- [Date Handling in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)
