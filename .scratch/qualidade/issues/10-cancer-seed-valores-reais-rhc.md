Status: done
Type: bug

# Registro de Câncer: 8 dos 15 campos fixos têm valor real confirmado no padrão RHC/INCA e continuam vazios

## Onde

Segue a issue 09 (`qa_parametros` semeado com placeholder vazio `''` para 15
das 16 chaves `cancer.*`). Usuário reportou que Fonte, Cor, Endereço, Região
administrativa, Município, Estado, Naturalidade, Nacionalidade, Profissão,
Meio Diagnóstico, Extensão, Caso raro, Estado civil, Escolaridade e
Registrador continuam sem "aquele padrão de dados preenchidos" no app.

## Causa raiz

`20260825130000_qualidade_cancer_seed_parametros_cido.sql` seguiu correto ao
não inventar valor pra nenhum dos 15 — mas o repositório não tinha, até
agora, uma fonte confiável pra confirmar quais desses valores já são
conhecidos e quais são pendência real de negócio.

O projeto irmão `Flowlab_Controle_Qualidade` (implementação independente do
mesmo domínio, feita por outro colega) tem um dicionário de dados
(`docs/Planing/data-dictionaries/Positivos_Cancer.md`) que confirma, contra
o mesmo LIS/MySQL do laboratório, que 8 desses campos **são o próprio
padrão fixo do layout RHC** — não são configuração do laboratório, são
constantes do formato nacional:

| Chave `qa_parametros` | Campo | Valor confirmado |
| --- | --- | --- |
| `cancer.cor_ignorado` | Cor | `9` (ignorado — `paciente` não tem coluna de cor/raça) |
| `cancer.endereco_codigo` | Endereço | `0` |
| `cancer.profissao_codigo` | Profissão | `0` |
| `cancer.meio_diagnostico` | Meio Diagnóstico | `1` (todo caso é anatomopatológico) |
| `cancer.extensao` | Extensão | `1` |
| `cancer.caso_raro` | Caso raro | `2` |
| `cancer.estado_civil_ignorado` | Estado civil | `9` (ignorado — `paciente.EstadoCivil` existe mas nunca é preenchido, fica `0`) |
| `cancer.escolaridade_ignorado` | Escolaridade | `9` (ignorado) |

`cancer.cnes` já está correto (`3744221`, issue 09). Os 6 campos restantes
(`fonte`, `regiao_administrativa`, `municipio`, `estado`,
`naturalidade_fixa`, `nacionalidade_fixa`) **não** têm valor confirmado nem
no dicionário do colega — ver issue 11, não fazem parte desta issue.

## Correção proposta

Nova migration `qa_parametros` (módulo `cancer`) fazendo `UPDATE` (as linhas
já existem, criadas pela 09) nas 8 chaves acima para os valores confirmados,
citando o dicionário como fonte. Não usar `INSERT ... ON CONFLICT DO
NOTHING` (não criaria nada novo) — usar `UPDATE ... WHERE chave = '...'`.

Conferir depois: abrir `/qualidade/cancer`, um caso qualquer, e checar no
drawer que os 8 campos aparecem preenchidos (não mais vazios) e batem com a
tabela acima.

## Comments

Fonte da comparação: `Flowlab_Controle_Qualidade/docs/Planing/data-dictionaries/Positivos_Cancer.md`
(linhas 17-38) e `openspec/changes/etapa-6-cancer/design.md` (linha 36) do
mesmo repositório irmão — dicionário produzido testando contra o MySQL real
do laboratório, não é suposição.

Implementado em `20260825140000_qualidade_cancer_seed_valores_reais_rhc.sql`:
8 `UPDATE ... WHERE chave = '...'` para os valores confirmados. Cada UPDATE
tem uma guarda extra `AND valor = '""'::jsonb` (achada em code review) — como
20260825130000 já tornou essas 8 chaves editáveis pela tela no mesmo commit
em que as semeou vazias, um lab worker pode já ter preenchido alguma
manualmente no intervalo entre os dois deploys; a guarda evita sobrescrever
esse valor manual sem aviso.
