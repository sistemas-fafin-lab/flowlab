// api/_lib/atendimento/promptPedidoMedico.ts
// Prompt da leitura do pedido médico (Gerador de Orçamento). Trazido da
// Tabela-Particular, que o buscava no `prompt.txt` de uma pasta do Google Drive;
// aqui fica versionado, e mudanças passam por revisão. Ponto de partida: a cópia
// local lib/prompt.txt da Tabela-Particular. O complemento com a lista de exames é o
// mesmo que app/api/analyze/route.ts de lá acrescentava.
//
// O formato de resposta pedido ({ exams: [{ name, matched }] }) é o que
// leituraPedidoMedico.ts lê — mudar um exige mudar o outro.

const PROMPT_BASE = `Prompt de Especialista em Identificação de Exames.
Sua função é analisar imagens de pedidos médicos e extrair os nomes dos exames solicitados.

Fluxo de Trabalho:
1. Analise TODAS as imagens fornecidas em conjunto (manuscritos e impressos).
2. Consolide os dados: se o mesmo exame aparecer em múltiplas imagens, ele deve ser listado APENAS UMA VEZ.
3. Se uma lista de procedimentos disponíveis for fornecida, ela seguirá o padrão "MNEMONICO - DESCRIÇÃO".
   - Tente mapear cada exame extraído para o item correspondente na lista.
   - Dê prioridade ao "MNEMONICO" (ex: se no pedido diz "TGO" e na lista existe "TGO - TRANSAMINASE...", o "matched" deve ser o item da lista).
   - Seja inteligente com siglas: TGO, TGP, GGT, CEA, etc., são mnemônicos comuns.

Estrutura do JSON:
{
  "exams": [
    {
      "name": "Nome do exame identificado no pedido",
      "matched": "Nome exato encontrado na lista fornecida ou null se não houver correspondência clara"
    }
  ]
}

Não inclua textos explicativos, apenas o JSON.
O resultado deve ser uma lista única, sem repetições e com o mapeamento mais preciso possível para a lista fornecida.`;

/** Prompt completo: instruções + a lista de nomes de exames da lista de preços. */
export function montarPromptPedidoMedico(nomesExames: readonly string[]): string {
  let prompt = `${PROMPT_BASE}\n\nAnalise os arquivos do pedido médico anexos e extraia os nomes dos exames.`;
  if (nomesExames.length > 0) {
    prompt += `\n\nAlém disso, tente encontrar o correspondente mais próximo para cada exame identificado na seguinte lista de procedimentos disponíveis (retorne exatamente o nome que está na lista):\n\n${nomesExames.join('\n')}\n\nNo JSON de retorno, use obrigatoriamente esta estrutura:\n{\n  "exams": [\n    { "name": "nome no pedido", "matched": "nome exato na lista ou null" },\n    ...\n  ]\n}`;
  }
  return prompt;
}
