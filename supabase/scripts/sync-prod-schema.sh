#!/usr/bin/env bash
#
# sync-prod-schema.sh — puxa o schema (e, opcionalmente, os dados) do banco de
# PRODUÇÃO do Flow LAB via `supabase db dump`, sem precisar estar logado na conta
# dona do projeto (o --db-url conecta direto com a senha).
#
# ┌─ Pré-requisito ────────────────────────────────────────────────────────────┐
# │ Você precisa da SENHA do banco de produção. Se não a tem:                    │
# │   Dashboard (prod) → Settings → Database → "Reset database password".        │
# │   Isso NÃO derruba o app (ele usa a anon key via HTTPS, não a senha do PG).  │
# │ Pegue a connection string em:                                                │
# │   Settings → Database → Connection string → aba URI → modo "Session pooler"  │
# │   e troque [YOUR-PASSWORD] pela senha.                                        │
# └──────────────────────────────────────────────────────────────────────────────┘
#
# Uso:
#   PROD_DB_URL="postgresql://postgres.<ref>:<senha>@<host>:5432/postgres" \
#     ./supabase/scripts/sync-prod-schema.sh [--data]
#
#   # ou passando a URL como argumento:
#   ./supabase/scripts/sync-prod-schema.sh "postgresql://..." [--data]
#
# Flags:
#   --data     também baixa os dados (--data-only) em prod_data.sql
#   -h|--help  mostra esta ajuda
#
# Saídas (na raiz do repo):
#   supabase/prod_schema.sql   estrutura (tabelas, funções, triggers, RLS, views)
#   supabase/prod_data.sql     dados (só com --data)
#
set -euo pipefail

# ── localizar a raiz do repo (2 níveis acima deste script) ───────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="$REPO_ROOT/supabase"

WANT_DATA=0
DB_URL="${PROD_DB_URL:-}"

# ── parse de argumentos ──────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --data) WANT_DATA=1 ;;
    -h|--help)
      sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    postgres://*|postgresql://*) DB_URL="$arg" ;;
    *) echo "Argumento desconhecido: $arg" >&2; exit 2 ;;
  esac
done

# ── validar URL ──────────────────────────────────────────────────────────────
if [[ -z "$DB_URL" ]]; then
  cat >&2 <<'EOF'
✗ Nenhuma connection string informada.

  Defina PROD_DB_URL ou passe a URL como argumento. Ex.:
    PROD_DB_URL="postgresql://postgres.<ref>:<senha>@<host>:5432/postgres" \
      ./supabase/scripts/sync-prod-schema.sh

  Pegue a URL no dashboard de produção:
    Settings → Database → Connection string → URI → Session pooler
  (troque [YOUR-PASSWORD] pela senha; se não a tem, "Reset database password").
EOF
  exit 1
fi

# host mascarado (sem senha) só pra você confirmar qual banco vai ser lido
MASKED_HOST="$(printf '%s' "$DB_URL" | sed -E 's#^(postgres(ql)?://)[^@]*@#\1***:***@#')"

# ── escolher engine: pg_dump (sem Docker) ou supabase db dump (com Docker) ───
ENGINE=""
PGDUMP_MAJOR=""
if command -v pg_dump >/dev/null 2>&1; then
  ENGINE="pg_dump"
  PGDUMP_MAJOR="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
elif command -v supabase >/dev/null 2>&1; then
  ENGINE="supabase"   # usa Docker por baixo
fi

echo "▶ Alvo (somente leitura): $MASKED_HOST"
echo "▶ Saída:                  $OUT_DIR/"
echo "▶ Engine:                 ${ENGINE:-nenhuma}$([[ "$ENGINE" == pg_dump ]] && echo " v$PGDUMP_MAJOR (sem Docker)")$([[ "$ENGINE" == supabase ]] && echo " (precisa de Docker)")"
echo

if [[ -z "$ENGINE" ]]; then
  echo "✗ Nem 'pg_dump' nem 'supabase' encontrados no PATH." >&2
  echo "  Instale um dos dois: 'postgresql-client-17' (pg_dump, sem Docker) ou o Supabase CLI + Docker." >&2
  exit 1
fi

if [[ "$ENGINE" == "pg_dump" && -n "$PGDUMP_MAJOR" && "$PGDUMP_MAJOR" -lt 17 ]]; then
  echo "⚠ pg_dump é v$PGDUMP_MAJOR, mas o servidor é PostgreSQL 17 — pode falhar por" >&2
  echo "  incompatibilidade de versão. Instale o client 17 (postgresql-client-17)." >&2
  echo
fi

# ── função de dump que abstrai a engine ──────────────────────────────────────
dump() {  # dump <schema|data> <arquivo_saida>
  local mode="$1" out="$2"
  if [[ "$ENGINE" == "pg_dump" ]]; then
    local args=(--no-owner --no-privileges --schema=public)
    [[ "$mode" == "schema" ]] && args+=(--schema-only)
    [[ "$mode" == "data"   ]] && args+=(--data-only)
    pg_dump "$DB_URL" "${args[@]}" -f "$out"
  else
    local args=()
    [[ "$mode" == "data" ]] && args+=(--data-only)
    supabase db dump --db-url "$DB_URL" "${args[@]}" -f "$out"
  fi
}

# ── dump do schema (estrutura) ───────────────────────────────────────────────
echo "→ Baixando SCHEMA (estrutura)…"
dump schema "$OUT_DIR/prod_schema.sql"
echo "✓ $OUT_DIR/prod_schema.sql ($(wc -l < "$OUT_DIR/prod_schema.sql") linhas)"

# ── dump dos dados (opcional) ────────────────────────────────────────────────
if [[ "$WANT_DATA" -eq 1 ]]; then
  echo "→ Baixando DADOS (--data-only)…"
  dump data "$OUT_DIR/prod_data.sql"
  echo "✓ $OUT_DIR/prod_data.sql ($(wc -l < "$OUT_DIR/prod_data.sql") linhas)"
fi

echo
echo "✅ Concluído. Produção só foi LIDA (db dump não escreve nada)."
echo
echo "Próximo passo (reconstruir o banco de test a partir deste schema):"
echo "  ver o procedimento em MEMORY → 'Ambiente Supabase de test'"
echo "  (mover as 66 migrations, deixar prod_schema.sql + cutover, db reset --linked)."
