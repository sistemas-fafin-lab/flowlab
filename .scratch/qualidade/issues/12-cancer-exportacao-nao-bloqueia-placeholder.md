Status: done
Type: bug

# Registro de Câncer: exportação RHC não bloqueia geração enquanto houver campo fixo pendente/placeholder

## Onde

`api/_lib/handlers/qualidade-gerar-exportacao-cancer.ts` — monta e grava o
CSV de exportação RHC no Storage (`qa_exportacoes_rhc`).

## Causa raiz

O projeto irmão `Flowlab_Controle_Qualidade` documenta este requisito
explicitamente na spec do módulo
(`openspec/changes/etapa-6-cancer/specs/cancer-exportacao/spec.md`, R4):
"Toda coluna do layout RHC sem origem no LIS (Cor, Endereço, Naturalidade,
Estado Civil, Escolaridade, Profissão, Meio Diagnóstico, Extensão, Caso
Raro) SHALL ser preenchida com o valor de `app_parametros` correspondente —
nunca deixada em branco ou omitida" — e a intenção (design.md) é que a
exportação real fique bloqueada enquanto qualquer um desses parâmetros
ainda for um placeholder, porque é um arquivo de notificação compulsória à
vigilância epidemiológica.

Aqui no flowlab, `qualidade-gerar-exportacao-cancer.ts` lê os parâmetros
fixos e monta as colunas do CSV, mas não tem nenhuma checagem de "algum
parâmetro fixo ainda é placeholder/vazio" antes de gravar o arquivo no
Storage e registrar em `qa_exportacoes_rhc`. Combinado com as issues 10/11:
mesmo depois de preenchidos os 8 valores reais, os 6 campos institucionais
pendentes (Fonte + endereço) continuam podendo vazar pra um arquivo real
enviado à vigilância.

## Correção proposta

Em `qualidade-gerar-exportacao-cancer.ts`, antes de gravar o CSV: carregar
os 16 parâmetros fixos (`carregarParametrosFixosCancer`) e recusar a
exportação (400, mensagem explícita: quais chaves ainda estão como
placeholder) se qualquer um começar com o prefixo de placeholder definido
na issue 11 (`"PLACEHOLDER — "`) — ou, se antes da 11 estiver vazio (`''`),
tratar string vazia do mesmo jeito.

Decidir junto com quem usa a tela se isso deve ser um bloqueio rígido
(erro, sem opção de prosseguir) ou uma confirmação explícita — a spec do
colega trata como bloqueio rígido dado o risco regulatório (dado de saúde
identificável, notificação compulsória).

## Comments

Depende logicamente das issues 10 e 11 (definir o valor real dos 8 campos
e o formato do placeholder dos 6 pendentes) para a checagem ter algo
concreto pra comparar.

## Answer

Implementado no commit `ecfd555`: `parametrosFixosPendentes` (`cancerRegras.ts`)
checa as 15 colunas com origem em `qa_parametros` contra o prefixo de
placeholder (issue 11) ou string vazia. `qualidade-gerar-exportacao-cancer.ts`
chama essa checagem logo após validar `casosResp.error` e antes de qualquer
consulta ao LIS ou escrita no Storage — bloqueio rígido (400, mensagem com
as chaves pendentes), sem opção de prosseguir, dado o risco regulatório.
Coberto por testes em `cancerRegras.test.ts`.
