// api/_lib/apoio/promptGemini.ts
// Prompt de extração da requisição médica (port de prompt_gemini.txt do envio_alvaro).
// O catálogo de exames (ac_apoio_exames) é embutido no lugar de {CATALOGO} para o
// Gemini já correlacionar os exames lidos com os códigos AOL.

const PROMPT_BASE = `Você é um especialista em leitura de requisições de exames laboratoriais brasileiros.
Analise esta imagem (foto, scan ou PDF) de uma requisição médica e extraia TODAS as informações.

{CATALOGO}

Retorne APENAS um JSON válido sem texto extra e sem markdown:
{
  "paciente": {
    "nome": "NOME COMPLETO EM MAIUSCULAS ou null",
    "datanasc": "DD/MM/AAAA ou null",
    "sexo": "M ou F ou null",
    "cpf": "somente digitos sem pontuacao ou null",
    "email": "email ou null"
  },
  "medico": {
    "nome": "NOME DO MEDICO ou null",
    "crm": "numero CRM com UF ex: 123456-SP ou null"
  },
  "data_solicitacao": "DD/MM/AAAA ou null",
  "numero_requisicao": "numero ou codigo da requisicao visivel na imagem ou null",
  "exames": [
    {
      "nome_original": "NOME EXATAMENTE COMO APARECE NA IMAGEM",
      "nome_normalizado": "NOME PADRONIZADO SEM ACENTO EM MAIUSCULAS",
      "codigo_aol_sugerido": "COD_EXAME da tabela acima ou null se nao encontrar",
      "cod_material": "COD_MATERIAL da tabela acima ou null",
      "desc_material": "DESCRICAO_MATERIAL da tabela acima ou null",
      "nome_pardini": "DESCRICAO_EXAME da tabela acima ou null",
      "material": "sangue/urina/fezes/swab ou null",
      "urgente": false,
      "certeza": "certeza da extracao e correlacao do exame (de 0 a 100) - numero inteiro"
    }
  ],
  "observacoes": "texto de observacoes ou null",
  "convenio": "nome do convenio ou plano se visivel ou null"
}

REGRAS IMPORTANTES:
- Extraia TODOS os exames marcados ou escritos (X, circulo, sublinhado, manuscrito, pre-impresso).
- Para cada exame encontrado, procure o nome mais proximo na TABELA DE CATALOGO acima.
- Use o COD_EXAME, COD_MATERIAL e DESCRICAO_MATERIAL da tabela quando encontrar correspondencia.
- Se nao encontrar correspondencia na tabela, use null para codigo_aol_sugerido e cod_material.
- Nao invente dados do paciente: use null se nao conseguir ler com seguranca.
- Retorne SOMENTE o JSON, sem nenhum texto antes ou depois, sem markdown.`;

export function montarPrompt(catalogoTexto: string): string {
  return PROMPT_BASE.replace('{CATALOGO}', catalogoTexto);
}
