Status: ready-for-agent
Type: task

# Temperatura: catálogo de tipos de frasco + contagem por leitura

Ver contexto completo em `../spec.md` seção 3.

## Objetivo

Permitir registrar, em qualquer leitura de temperatura de qualquer
equipamento, quantos frascos de cada tipo (ex: Urina, Fezes) estão sendo
transportados naquela remessa. Tipos de frasco vêm de um catálogo gerenciável
pela própria tela de Temperatura.

## Arquivos envolvidos

- `supabase/migrations/20260709120000_fase7c_temperatura_equipamentos.sql` —
  schema atual de `ac_equipamentos` e `ac_temperaturas` (referência de estilo:
  RLS permissiva para `authenticated`, trigger de `updated_at`).
- `src/modules/analises-clinicas/types.ts` (~linhas 298–345) — `AcEquipamento`,
  `AcTemperatura`.
- `src/modules/analises-clinicas/components/TemperaturaEquipamentosPage.tsx` —
  `EquipamentoModal` (~286–405), `LeituraModal` (~408–679, fluxo de 2 passos:
  preencher → confirmar).
- `src/modules/analises-clinicas/hooks/useTemperaturas.ts` —
  `registrarTemperatura`, `fetchTemperaturas`, `fetchLeiturasRecentes`, CRUD de
  `ac_equipamentos`.
- `src/utils/permissions.ts` (linha ~39) — `canManageColetas` (permissão a
  reutilizar, mesma que já libera cadastrar equipamento).

## O que fazer

### 1. Nova migration — schema

Criar `supabase/migrations/<timestamp>_ac_tipos_frasco.sql` com duas tabelas
novas, seguindo o padrão de estilo já usado no módulo (RLS permissiva por
`authenticated`, `updated_at` com trigger, nomes prefixados `ac_`):

```sql
-- Catálogo gerenciável de tipos de frasco
CREATE TABLE ac_tipos_frasco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed inicial
INSERT INTO ac_tipos_frasco (nome) VALUES ('Urina'), ('Fezes');

-- Contagem de frascos por leitura de temperatura (0..N por leitura)
CREATE TABLE ac_temperatura_frascos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temperatura_id uuid NOT NULL REFERENCES ac_temperaturas(id) ON DELETE CASCADE,
  tipo_frasco_id uuid NOT NULL REFERENCES ac_tipos_frasco(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (temperatura_id, tipo_frasco_id)
);
```

Notas:

- `ac_temperaturas` é log append-only hoje (só SELECT + INSERT); manter essa
  característica — `ac_temperatura_frascos` também não deve ter policy de
  UPDATE (só INSERT/SELECT/DELETE se for preciso corrigir um registro errado
  logo após o cadastro; seguir o mesmo grau de permissividade das tabelas
  vizinhas do módulo).
- `ON DELETE RESTRICT` em `tipo_frasco_id` impede apagar fisicamente um tipo
  já usado em alguma leitura — desativar deve ser feito via `ativo = false`,
  nunca DELETE, mesmo padrão de `ac_exames`/`ativo`.
- Aplicar RLS permissiva para `authenticated` nas duas tabelas novas, igual ao
  resto do módulo (gate real fica no frontend, conforme comentários já
  existentes nas outras migrations do módulo).
- Trigger de `updated_at` só é necessária em `ac_tipos_frasco` (a outra tabela
  não tem update).

### 2. Types (`types.ts`)

```ts
export interface AcTipoFrasco {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcTemperaturaFrasco {
  id: string;
  temperatura_id: string;
  tipo_frasco_id: string;
  quantidade: number;
  created_at: string;
}
```

### 3. Hook (`useTemperaturas.ts`)

- `fetchTiposFrasco()` — lista `ac_tipos_frasco` onde `ativo = true` (para uso
  no `LeituraModal`) e uma variante que traz todos (ativos + inativos) para a
  tela de administração.
- `createTipoFrasco(nome)` / `updateTipoFrasco(id, patch)` /
  `desativarTipoFrasco(id)` (seta `ativo = false`, nunca DELETE).
- `registrarTemperatura(...)` precisa passar a aceitar uma lista opcional
  `frascos: { tipo_frasco_id: string; quantidade: number }[]` e, após inserir
  a leitura em `ac_temperaturas`, inserir as linhas correspondentes em
  `ac_temperatura_frascos` (mesma transação lógica — se o insert de frascos
  falhar, tratar como erro da operação como um todo, não deixar leitura órfã
  sem frascos silenciosamente).
- `fetchTemperaturas`/`fetchLeiturasRecentes` devem trazer os frascos
  associados a cada leitura (join ou fetch separado) para exibir no histórico.

### 4. `LeituraModal` (`TemperaturaEquipamentosPage.tsx`)

- Adicionar uma seção opcional "Frascos nesta remessa" no formulário de
  leitura (funciona para qualquer tipo de equipamento, sem restrição por
  `tipo`).
- Lista dinâmica: para cada tipo de frasco ativo no catálogo, um campo
  numérico de quantidade (pode ficar em branco/zero = não incluído). Não é
  obrigatório preencher nenhum.
- Seguir o fluxo de 2 passos já existente (preencher → confirmar) — os
  frascos preenchidos aparecem no resumo de confirmação junto com
  temperatura/observação.

### 5. Nova tela de administração do catálogo

- Dentro da própria página de Temperatura (ex: um botão/modal "Gerenciar
  tipos de frasco", ao lado de onde hoje se cadastra equipamento).
- CRUD simples: listar tipos (ativos e inativos), criar novo, editar nome,
  desativar (sem exclusão física).
- Gate de acesso: mesma permissão `canManageColetas` já usada para cadastro de
  equipamento — sem permissão nova.

### 6. Histórico / gráfico

- `HistoricoModal`/`HistoricoChart` (mesma página): exibir a lista de frascos
  de cada leitura no histórico, mesmo que de forma simples (texto "Urina: 3,
  Fezes: 2" abaixo da leitura) — não precisa entrar no gráfico de temperatura
  em si.

## Fora de escopo

- Não criar um novo "tipo de equipamento" para representar cooler.
- Não tornar frascos obrigatório em nenhuma leitura.
- Não relacionar frascos/culturas entre si — são módulos independentes.
- Não migrar dados existentes (não há dado histórico de frascos, é campo
  novo).

## Critério de aceite

- Ao registrar uma leitura de temperatura de qualquer equipamento, é possível
  (mas não obrigatório) informar quantidade de frascos por tipo.
- Catálogo inicial tem Urina e Fezes; um usuário com `canManageColetas`
  consegue adicionar um novo tipo pela tela sem precisar de deploy.
- Tipos desativados somem das opções do formulário de leitura, mas leituras
  antigas que já usaram esse tipo continuam exibindo o nome corretamente no
  histórico.
- Histórico de leituras mostra os frascos registrados em cada leitura.
