-- Remove a constraint antiga
ALTER TABLE public.payment_requests 
DROP CONSTRAINT IF EXISTS payment_requests_forma_pagamento_check;

-- Adiciona a nova constraint com os métodos de pagamento corretos
ALTER TABLE public.payment_requests 
ADD CONSTRAINT payment_requests_forma_pagamento_check 
CHECK (
  forma_pagamento = ANY (
    ARRAY[
      'PIX'::text,
      'DINHEIRO'::text,
      'BOLETO'::text,
      'CAJU'::text,
      'SOLIDES'::text
    ]
  )
);
