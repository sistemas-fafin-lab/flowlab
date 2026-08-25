Status: done
Type: bug

# Registro de Câncer: os 6 campos fixos sem valor conhecido devem virar placeholder explícito, não string vazia

## Onde

Segue as issues 09 e 10. Depois de aplicar a issue 10, restam 6 das 16
chaves `cancer.*` em `qa_parametros` sem valor real confirmado em nenhum
lugar: `cancer.fonte`, `cancer.regiao_administrativa`, `cancer.municipio`,
`cancer.estado`, `cancer.naturalidade_fixa`, `cancer.nacionalidade_fixa`
(Fonte + os 5 campos de endereço institucional do laboratório — não do
paciente).

## Causa raiz

O projeto irmão `Flowlab_Controle_Qualidade` chegou exatamente na mesma
pendência (mesmo dicionário de dados, mesma fonte MySQL) e documentou a
decisão em `openspec/changes/etapa-6-cancer/design.md` (linha 36): "o
dicionário confirma que são fixos, idênticos em toda linha, mas nunca
registra os valores reais... preencher com dado inventado violaria a
instrução de não fabricar dado". A solução dele: gravar um placeholder
**explícito** (`"PLACEHOLDER — ..."`) em vez de string vazia, porque um
CNES/endereço errado num arquivo de notificação compulsória (RHC) é sério
o bastante pra bloquear a exportação real até estar correto.

Aqui no flowlab, a migration 09 seedou esses 6 como `''::jsonb` (string
vazia). Isso é mais perigoso que o placeholder explícito do colega: `''`
se confunde com "campo vazio por engano" ou com um valor real igualmente
vazio, e não dá nenhum sinal visual de "isto não foi preenchido de
propósito" pra quem olha a tela ou o CSV exportado.

## Correção proposta

`UPDATE qa_parametros SET valor = '"PLACEHOLDER — preencher com o valor
real (ver issue 11)"'::jsonb WHERE chave IN ('cancer.fonte',
'cancer.regiao_administrativa', 'cancer.municipio', 'cancer.estado',
'cancer.naturalidade_fixa', 'cancer.nacionalidade_fixa')`.

Confirmar que `CampoParametroFixo.tsx`/`CasoDrawer.tsx` não têm nenhuma
lógica que trate `''` como "vazio, mostrar placeholder de UI" de um jeito
que quebraria ao virar uma string não-vazia (ex.: um `|| 'â€”'` que só
dispara em string vazia) — se tiver, ajustar para não esconder o aviso.

Depende da issue 12 pra ter efeito prático: sem a trava de exportação, o
placeholder explícito ainda pode vazar pra um CSV real se alguém gerar a
exportação antes de preencher.

## Comments

Mesma fonte da issue 10. Os valores reais desses 6 campos continuam sendo
pendência de negócio genuína — nem o projeto irmão os resolveu; alguém do
laboratório precisa informar o nome oficial do laboratório (Fonte) e os
códigos de região administrativa/município/estado/naturalidade/nacionalidade
do endereço institucional antes de qualquer envio real ao RHC.

Resolvido em `20260825150000_qualidade_cancer_placeholder_explicito.sql`:
UPDATE guardado por `AND valor = '""'::jsonb` (mesmo padrão da issue 10, não
sobrescreve valor manual já preenchido pela tela). Conferido
`CampoParametroFixo.tsx`/`CasoDrawer.tsx` — o único fallback (`valorAtual ||
'—'`) só dispara em string vazia; com o placeholder não-vazio ele some e o
texto do placeholder aparece direto na tela, sem precisar de ajuste. Trava de
exportação continua pendência da issue 12.
