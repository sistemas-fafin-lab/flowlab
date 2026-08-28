Status: done
Type: task

# Títulos: mensagem de lista vazia não deixava claro que era o período (reincidência da issue 20)

## Onde

`src/modules/faturamento/components/TitulosList.tsx` (mensagem de lista vazia,
antes "Nenhum título no período.").

## Problema

Relato do quarto relatório do setor (27/08): "Ao realizar uma busca
utilizando o filtro de Status, o resultado não atualiza. A tela permanece
idêntica para qualquer status selecionado." — sintoma idêntico ao já
investigado e fechado na issue 20.

## Por que reabrir em vez de só reafirmar

A issue 20 (fechada em 27/08, mais cedo no mesmo dia) já achou a causa raiz:
não é bug no filtro de Status, é o período padrão (`mesesAtras(3)`) não
cobrindo os títulos existentes — trocar Status numa lista já vazia continua
vazia. A própria issue 20 registrou como "ponto a observar, fora do escopo":
*"vale considerar... se merece um aviso mais claro que 'Nenhum título no
período' quando o motivo é a janela de datas e não a ausência real de
títulos."* O mesmo relato voltou a acontecer de forma independente no mesmo
dia — confirma que o aviso genérico não é suficiente para o setor descartar
"bug no Status" sozinho, então virou ação em vez de só nota.

## O que foi feito

Mensagem de lista vazia agora cita o período e o status filtrado
explicitamente (ex. "Nenhum título de 01/05/2026 até 31/08/2026 com status
'Aberta'."), e adiciona uma frase direta: "Amplie o período de emissão acima —
trocar o Status não muda a lista se o período já não cobrir nenhum título."

Não mudei o período padrão em si (`mesesAtras(3)`) — isso segue sendo decisão
de produto em aberto, não uma correção de bug.

## Critérios de aceite

- Lista vazia deixa explícito o intervalo de datas e o status aplicados.
- Mensagem orienta a ampliar o período antes de suspeitar do filtro de
  Status.

## Referência

Quarto relatório de feedback do setor de faturamento (27/08). Causa raiz já
confirmada na issue 20 (mesmo dia).
