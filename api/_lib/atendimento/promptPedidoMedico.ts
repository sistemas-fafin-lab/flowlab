// api/_lib/atendimento/promptPedidoMedico.ts
// Prompt da leitura do pedido médico (Gerador de Orçamento). Trazido da
// Tabela-Particular, que o buscava no `prompt.txt` de uma pasta do Google Drive;
// aqui fica versionado, e mudanças passam por revisão. Ponto de partida: a cópia
// local lib/prompt.txt da Tabela-Particular, sem o "correspondente mais próximo" de
// lá — a IA escolhia exame diferente só por ser parecido.
//
// O formato de resposta pedido ({ exams: [{ name, matched, relacionados, tipo }] }) é
// o que leituraPedidoMedico.ts lê — mudar um exige mudar o outro.

const PROMPT_BASE = `Prompt de Especialista em Identificação de Exames.
Sua função é analisar imagens de pedidos médicos e extrair os nomes dos exames solicitados.

Fluxo de Trabalho:
1. Analise TODAS as imagens fornecidas em conjunto (manuscritos e impressos).
2. Consolide os dados: se o mesmo exame aparecer em múltiplas imagens, ele deve ser listado APENAS UMA VEZ.
3. Em "name", escreva o exame exatamente como está no pedido. Quando uma linha pedir mais de um exame (ex: "FSH e LH", "Sódio e potássio", "Função renal (creatinina, ureia, ácido úrico)", "Dengue IgM e IgG"), liste CADA exame separadamente, com o nome de cada um.
4. Se uma lista de procedimentos disponíveis for fornecida, ela seguirá o padrão "MNEMONICO - DESCRIÇÃO".
   - Preencha "matched" SOMENTE quando o exame do pedido for o MESMO exame de um item da lista: pelo nome, por uma sigla consagrada (TGO, TGP, GGT, TSH, CEA etc.) ou por um sinônimo inequívoco.
   - Dê prioridade ao "MNEMONICO" (ex: se no pedido diz "TGO" e na lista existe "TGO - TRANSAMINASE...", o "matched" deve ser o item da lista).
   - Use "matched": null quando houver dúvida, quando só parte do nome coincidir ou quando o item da lista for outro exame da mesma família (ex: o pedido diz "Lipo B" e a lista só tem "LIPOPROTEÍNA - a": é null).
   - Material diferente (soro, sangue, urina, saliva, fezes) ou outro analito é OUTRO exame: "Cortisol" não é "Cortisol salivar", "Sódio" (sérico) não é "Sódio - U" (urina), "Relação albumina/creatinina" não é "Relação proteína/creatinina", "IgG e IgM" não é "Anticorpos totais". Nesses casos, "matched": null e o item da lista vai em "relacionados". Sem material indicado no pedido, considere sangue/soro.
   - NUNCA escolha um exame diferente por parecer próximo. Um exame errado no orçamento é pior que um exame não encontrado.
5. Para cada exame com "matched": null:
   - Em "relacionados", liste os nomes exatos da lista que são da mesma família ou do mesmo tipo do exame pedido (ex: para "Lipo B", "LIPOPROTEÍNA - a"). Use [] se não houver.
   - Em "tipo", use "variante" quando o pedido especifica uma variante que não está na lista (ex: pede Lipoproteína B e a lista só tem a A), "generico" quando o pedido cita a família sem especificar qual exame (ex: só "Lipoproteína"), ou null se nenhum dos dois se aplica.
   - Para exames com "matched" preenchido, use "relacionados": [] e "tipo": null.

Estrutura do JSON:
{
  "exams": [
    {
      "name": "Nome do exame como está no pedido",
      "matched": "Nome exato do MESMO exame na lista fornecida, ou null",
      "relacionados": ["Nomes exatos da lista da mesma família, só quando matched é null"],
      "tipo": "variante | generico | null"
    }
  ]
}

Não inclua textos explicativos, apenas o JSON.
O resultado deve ser uma lista única, sem repetições.`;

/** Prompt completo: instruções + a lista de nomes de exames da lista de preços. */
export function montarPromptPedidoMedico(nomesExames: readonly string[]): string {
  let prompt = `${PROMPT_BASE}\n\nAnalise os arquivos do pedido médico anexos e extraia os nomes dos exames.`;
  if (nomesExames.length > 0) {
    prompt += `\n\nLista de procedimentos disponíveis (em "matched" e "relacionados", retorne exatamente o nome que está na lista):\n\n${nomesExames.join('\n')}\n\nNo JSON de retorno, use obrigatoriamente esta estrutura:\n{\n  "exams": [\n    { "name": "nome no pedido", "matched": "nome exato do mesmo exame na lista ou null", "relacionados": [], "tipo": null },\n    ...\n  ]\n}`;
  }
  return prompt;
}
