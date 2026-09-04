Status: needs-triage
Type: feature

# Exportação (CSV/Excel) das listas de Títulos/Pendências/Atrasados

## Onde

Não existe hoje em `src/modules/faturamento/` (busca por
"csv"/"excel"/"xlsx"/"exportar" não retorna nada no módulo).

## Contexto

O levantamento de requisitos pede exportação explicitamente para a visão de
atrasados/>90 dias ("lista detalhada... com filtros e exportação"), mas o
mesmo padrão de planilha que a usuária está tentando substituir sugere que
qualquer lista operacional (Títulos, Pendências) se beneficiaria de export —
hoje não há nenhuma forma de tirar dado do flowlab para, por exemplo, anexar
num e-mail de cobrança para o convênio.

## Perguntas para triagem

- Quais telas precisam de export: só a lista de atrasados (issue 41), ou
  também Títulos e Pendências (sem lote / não faturadas)?
- Formato: CSV simples basta, ou precisa ser `.xlsx` (com formatação/moeda)?
- Export respeita os filtros ativos na tela (mais provável) ou é sempre "tudo"?

## O que fazer (após triagem)

Adicionar botão "Exportar" nas telas decididas, gerando CSV (ou XLSX se
confirmado) com as colunas visíveis da tabela, respeitando os filtros
aplicados no momento do clique.

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), item "Visão de atrasados/>90 dias... lista detalhada... com
filtros e exportação".

## Comments

**2026-09-03 — investigação de código (achado que responde a pergunta de
formato da triagem):**

O texto original buscou só por "csv"/"excel"/"xlsx"/"exportar" dentro de
`src/modules/faturamento/` e não achou nada — confirmado, o módulo de
faturamento não tem export. Mas a varredura no `src` inteiro achou que o
projeto já tem a lib `xlsx` (SheetJS) instalada (`package.json:43`,
`"xlsx": "^0.18.5"`) e **já em uso em produção** para exatamente este padrão,
em `src/components/CostControl/ExamsScreen.tsx:205-229`:

```ts
const handleExport = (scope: 'all' | 'selected') => {
  const source = scope === 'selected' ? filtered.filter(...) : filtered;
  const data = source.map(e => ({ CODIGO: e.code, ... }));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Exames');
  XLSX.writeFile(workbook, `exames_..._${data}.xlsx`);
};
```

Roda 100% no cliente (sem endpoint novo), gera `.xlsx` de verdade (não CSV) a
partir do array já filtrado em tela (`filtered`), e `XLSX.writeFile` dispara
o download direto do browser. Isso responde a uma das 3 perguntas de
triagem: **`.xlsx` não é mais caro que CSV aqui** — a lib já é dependência do
projeto e o padrão de código já existe pronto para copiar, então não há
motivo técnico para preferir CSV simples. As outras duas perguntas (quais
telas exportam, e se export sempre respeita os filtros ativos — o exemplo
acima já demonstra que respeitar filtro é trivial, bastando exportar o mesmo
array já renderizado na tela) continuam sendo decisão de produto, não
técnica.

**2026-09-03 — usuário:** deixar para depois, não priorizar agora. Segue
`needs-triage`, sem trabalho adicional até retomar.
