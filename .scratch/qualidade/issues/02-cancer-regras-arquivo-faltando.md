Status: done
Type: bug

# cancerRegras.ts (regras de negócio de Câncer) não existe no repositório

## Onde

`src/modules/qualidade/domain/cancerRegras.test.ts` importa de `../../../../api/_lib/qualidade/cancerRegras.js` — esse arquivo não existe em lugar nenhum do repositório nem veio no pacote importado (`import_files/FLOWLAB_QUALIDADE/flowlab-main`). É a lógica real de cálculo de funil (`calcularFunil`), avaliação de candidatura (`avaliarCandidaturaCancer`, `combinarCandidaturas`, `elegivelParaExportacao`) e sugestão de classificação CID-O (`sugerirMorfologia`, `sugerirTopografia`).

Confirmado com `npx vitest run src/modules/qualidade`: os 3 outros submódulos (Ocorrências, Cortesias, IHQ) passam limpo (22 testes); só `cancerRegras.test.ts` falha por módulo não encontrado.

## O que fazer

1. Localizar `api/_lib/qualidade/cancerRegras.ts` no repositório de origem (provável "flowlab-qualidade", separado deste) e portar para cá.
2. Sem esse arquivo, a página de Registro de Câncer (`CancerPage.tsx`) não tem como funcionar — depende dele indiretamente via os handlers da issue `01-api-qualidade-dispatcher.md` (`buscar-funil-cancer`, `buscar-detalhe-cancer`).

## Critérios de aceite

- `npx vitest run src/modules/qualidade` passa sem falhas (4 arquivos de teste, todos verdes).

## Comments

Resolvido como efeito colateral da issue `01-api-qualidade-dispatcher.md`: os handlers de
Câncer (`buscar-funil-cancer`/`buscar-detalhe-cancer`) precisavam desse arquivo para
funcionar, então `api/_lib/qualidade/cancerRegras.ts` foi implementado direto contra o
contrato já fixado em `cancerRegras.test.ts` — as 4 suítes de teste do módulo passam.
