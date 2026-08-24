# Regras de negócio CLT/compliance — para o clone do módulo de RH

> Fonte: material produzido a partir de entrevista do Mario com o RH de uma empresa cliente
> (arquivos em `import_files/mario - sistema RH/`, principalmente
> `REGRAS_DE_NEGOCIO_AVANCADAS_CONVENIA.md`), lido e comparado em 2026-08-20.
>
> **Nota de proveniência**: este arquivo documenta legislação trabalhista brasileira
> correta e regras de cálculo plausíveis para um HRIS, mas o texto-fonte lê mais como
> "aula de CLT aplicada ao produto" do que como transcrição direta de "o RH me contou
> que o Convenia faz X". Trate como **requisito de compliance a implementar no clone**,
> não necessariamente como confirmação exata de como o Convenia se comporta hoje (isso
> só foi confirmado por navegação direta para o que está em `requisitos-convenia.md`).
> Os pontos marcados **[NÃO CONFIRMADO POR NAVEGAÇÃO]** merecem validação com o Mario/RH
> antes de virar requisito fechado.

## 1. Admissão e eSocial

- Admissão CLT deve ser informada ao eSocial (evento S-2200/S-2190) até o **dia útil
  imediatamente anterior** ao início da prestação de serviço. Alertar se `data_admissao`
  estiver fora desse prazo.
- ASO admissional obrigatório, com `data_aso <= data_admissao`. Bloquear efetivação se a
  data do exame for posterior à admissão.
- CPF é chave de identificação (Portaria MTP 671/2021): validar dígito verificador
  (módulo 11) e impedir dois colaboradores ativos com o mesmo CPF na mesma empresa.
- E-mail pessoal deve ser único entre admissões em aberto (é usado como credencial de
  token único do link de auto-admissão) e validado no padrão RFC 5322.

### Jornada de trabalho (CLT Arts. 58, 66, 71)
- Carga semanal máxima: 44h. Carga diária padrão: 8h (até 10h em banco de horas).
- Intervalo intrajornada: mínimo 1h (máx. 2h) para jornadas > 6h; 15 min para jornadas
  entre 4h e 6h.
- Intervalo interjornada: mínimo 11h consecutivas entre o fim de uma jornada e o início
  da seguinte.
- DSR: 24h consecutivas, preferencialmente aos domingos.

### Período de experiência (CLT Arts. 445, 451)
- Máximo 90 dias corridos, com **uma única prorrogação** possível.
- Modelos parametrizáveis: `2 x 45 dias`, `30 + 60 dias`, `1 x 90 dias`.
- Cálculo automático: 1º término = `data_admissao + 44 dias`; 2º término =
  `data_admissao + 89 dias`. Alertar RH/gestor **10 dias e 5 dias antes** de cada
  vencimento.

## 2. Férias e recessos (CLT Arts. 129–145)

- Período aquisitivo: 12 meses de contrato → até 30 dias corridos de férias. Período
  concessivo: os 12 meses seguintes ao término do aquisitivo.
- **Dobra de férias (Art. 137)**: se não gozadas dentro do concessivo, remuneração deve
  ser paga em dobro. Monitorar e sinalizar colaboradores "a vencer" (3 e 6 meses).
- Proporcionalidade: fração ≥ 15 dias trabalhados no mês conta como mês integral para
  1/12 de férias proporcionais.

### Redução por faltas injustificadas (Art. 130) — tabela a implementar
| Faltas injustificadas no período | Dias de férias |
|:---:|:---:|
| Até 5 | 30 |
| 6 a 14 | 24 |
| 15 a 23 | 18 |
| 24 a 32 | 12 |
| Mais de 32 | 0 (perda do direito) |

- **Perda por afastamento previdenciário (Art. 133, IV)**: auxílio-doença/acidente de
  trabalho > 6 meses (mesmo descontínuos) no período aquisitivo → perde o direito;
  novo período aquisitivo começa na data de retorno.
- **Fracionamento (Art. 134 §1º)**: até 3 períodos, mediante concordância do
  colaborador; pelo menos um período ≥ 14 dias corridos, nenhum outro < 5 dias.
- **Proibição de início em véspera de DSR/feriado (Art. 134 §3º)**: não pode iniciar
  férias nos 2 dias que antecedem feriado ou o DSR. Bloquear essas datas no calendário
  de solicitação.
- **Abono pecuniário (Art. 143)**: conversão de até 1/3 do período (10 dias) em
  dinheiro; requerido até 15 dias antes do fim do aquisitivo; remuneração = valor das
  férias + 1/3 constitucional.
- **Pagamento**: até 2 dias antes do início do gozo. Adiantamento de 50% do 13º pode ser
  solicitado junto com as férias se requerido em janeiro do ano correspondente.
- **Workflow de aprovação em 3 etapas** [NÃO CONFIRMADO POR NAVEGAÇÃO — a navegação viu
  só status agregados, não o stepper]: 1) Gestor imediato (aprovar/reprovar com
  justificativa) → 2) RH (homologação legal + aviso de férias) → 3)
  Contabilidade/Fechamento de folha (cálculo do recibo, respeitando o prazo de
  pagamento).

## 3. Desligamento e rescisão

- **Aviso prévio proporcional (Lei 12.506/2011)**: base de 30 dias (até 1 ano de casa) +
  3 dias por ano completo de serviço, teto de 90 dias (aos 20 anos).
- **Prazo de pagamento da rescisão (Art. 477 §6º)**: até 10 dias corridos após o término
  do contrato, incluindo entrega dos documentos comprobatórios.
- Verbas por modalidade a implementar:
  - **Sem justa causa**: aviso prévio + saldo de salário + 13º proporcional + férias
    vencidas/proporcionais + 1/3 + FGTS integral + multa de 40% + seguro-desemprego.
  - **Pedido do colaborador**: saldo + 13º proporcional + férias com 1/3; sem saque de
    FGTS, sem multa, sem seguro-desemprego; se não cumprir aviso trabalhado, empresa
    pode descontar o valor na rescisão.
  - **Acordo mútuo (Art. 484-A)**: aviso prévio indenizado pela metade, multa de FGTS
    pela metade (20%), saque de até 80% do saldo de FGTS, sem seguro-desemprego.
  - **Justa causa (Art. 482)**: só saldo de salário + férias vencidas com 1/3; perde
    proporcionais, 13º proporcional e FGTS.

## 4. Benefícios e folha

- **Vale-transporte (Lei 7.418/1985)**: desconto máximo de 6% do salário base (exclui
  adicionais/gratificações/horas extras); excedente custeado pela empresa; valor
  proporcional aos dias úteis efetivamente trabalhados (descontar faltas, atestados,
  férias).
- **VR/VA (PAT)**: desconto automático de faltas não justificadas, afastamentos e
  férias em benefícios com cálculo diário; coparticipação do colaborador limitada a 20%
  do custo direto.
- **Data de corte (cutoff)**: movimentações (admissão, desligamento, inclusão de
  benefício) após a data de corte mensal entram na competência da folha seguinte.

## 5. Desenvolvimento — 9Box e avaliação

- **Fórmula do 9Box** [NÃO CONFIRMADO POR NAVEGAÇÃO — a navegação só viu que a matriz
  existe, não os thresholds]:
  - Potencial (eixo Y) = média ponderada de competências técnicas + comportamentais +
    conhecimento de negócio. `< 2.0` → Baixo; `2.0–2.69` → Médio; `≥ 2.7` → Alto.
  - Desempenho (eixo X) = (média de competências de desempenho × peso) + (atingimento
    de metas/OKRs × peso). `< 70%` → Baixo; `70–89%` → Médio; `≥ 90%` → Alto.
  - 9 quadrantes resultantes: Risco, Eficaz, Especialista, Questionável, Mantenedor,
    Alto Desempenho, Enigma, Forte Desempenho, Estrela/Top Talent.
- **Calibração com distribuição forçada** [NÃO CONFIRMADO POR NAVEGAÇÃO]: comitê de RH
  ajusta notas para atingir uma distribuição recomendada (ex.: 20% Alto / 70% Médio /
  10% Baixo), para reduzir viés de complacência/severidade de gestores.
- **Ciclo de avaliação em 8 estágios** [CONFIRMADO — pelo Mario em 2026-08-20 ("acredito
  que com 8 estágios está o correto") e, depois, visualmente via
  `screenshots/22b_desenvolvimento_ciclos_avaliacao.png` da pasta da entrevista: a barra
  de sub-abas real em Desenvolvimento > Avaliação de Desempenho > Ciclos de Avaliação
  mostra exatamente `Todas · Rascunhos · Programadas · Indicação · Aprovação · Em
  Andamento · Calibração · Concluídas` (cada uma com contador)]: Rascunho → Programada →
  Indicação (liderados/gestores indicam avaliadores de pares) → Aprovação (RH homologa
  avaliadores) → Em Andamento (autoavaliação, gestor, pares) → Calibração → Concluída
  (libera relatórios). Requisito confirmado para o clone.
- **Gatilho de risco de turnover**: quando um gestor marca "Risco Alto" numa 1:1, o
  sistema deveria disparar notificação de intervenção preventiva ao RH e sugerir
  abertura de PDI de retenção.

## 6. Engajamento — eNPS

- **Fórmula oficial**: pergunta "de 0 a 10, o quanto recomendaria a empresa como lugar
  para trabalhar". Promotores = 9–10, Neutros = 7–8, Detratores = 0–6.
  `eNPS = %Promotores − %Detratores` (varia de −100 a +100).
- **Quórum mínimo de anonimato**: relatórios segmentados por departamento/cargo/time só
  exibem médias/comentários se o grupo tiver no mínimo 3 a 5 respondentes (configurável);
  abaixo disso, agrupar na categoria geral da empresa. Regra importante para não expor
  dados individuais em times pequenos.

## 7. Permissões (RBAC) — regras de escopo

- **Árvore hierárquica de gestor**: escopo "liderados diretos" = colaboradores cujo
  `manager_id` aponta direto para o gestor; escopo "diretos e indiretos" = toda a
  sub-árvore (recursão pelos liderados dos liderados).
- **Ocultação de salário**: toggle `gestor_visualiza_salario = false` mascara campos e
  relatórios de remuneração (`***`) na visão de liderança.
- **Contador externo**: perfil de leitura restrita a movimentações de folha, admissões,
  desligamentos, férias homologadas e atestados; sem edição de dados pessoais nem
  acesso a Desenvolvimento.

---

## Divergências encontradas vs. `requisitos-convenia.md` (levantamento por navegação)

- **Wizard de admissão**: `requisitos-convenia.md` lista 10 etapas confirmadas por
  navegação; o material da entrevista lista **12** (mais "Outras informações" — campos
  personalizados — entre Dados Bancários e Documentos, e um passo final "Checklist" de
  integração — crachá, notebook, acessos). **Decisão do Mario (2026-08-20)**: "acho que
  é 12, mas pelo menos fazer os 10 que tem" — ou seja, **12 é o alvo real, mas o MVP do
  clone deve implementar os 10 confirmados primeiro** (Dados da Vaga, Foto de Perfil,
  Dados Pessoais, Formação Acadêmica, Endereços e Contatos, Dependentes, Dados
  Bancários, Documentos, Benefícios, Contabilidade), deixando "Outras informações" e
  "Checklist" para uma iteração seguinte. Evidência de apoio (não confirmação direta):
  screenshot `33b_config_desligamento.png` mostra que "Checklist" é um conceito real e
  configurável do produto (existe uma seção própria "Checklist de Desligamento",
  parametrizada por tipo de vínculo, análoga ao "Checklist Admissão" já visto em
  Configurações > Processos Operacionais) — reforça que o 12º passo do wizard
  provavelmente existe mesmo, só não foi visto renderizado ao vivo.
- **Identidade de gênero**: `requisitos-convenia.md` registra "12 opções, incluindo
  trans/não-binário/queer"; o dicionário de enums da entrevista (com IDs, ver
  `requisitos-convenia.md` seção de enums atualizada) lista **11**. Provavelmente um
  erro de contagem no levantamento original — os enums com ID são a fonte mais confiável
  aqui.
