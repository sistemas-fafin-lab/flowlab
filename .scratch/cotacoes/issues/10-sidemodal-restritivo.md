# Sidemodal de cotação: navegação restrita + botão do WhatsApp menor

Status: done

## Onde

`src/modules/quotations/components/QuotationDrawer.tsx`:
- Abas (linhas ~156-162, ~290-313)
- Rodapé de ações (linhas ~651-699), botão "Enviar via WhatsApp"
  (linhas ~654-664)

## O que fazer

**Navegação restrita.** As 5 abas (Visão Geral / Itens / Propostas /
Aprovação / Histórico) hoje são clicáveis livremente a qualquer momento.
Trocar para navegação sequencial: as abas viram indicadores de progresso
(não clicáveis, ou clicáveis só para etapas já visitadas/completas), e a
navegação passa a ser via botões **Voltar** / **Avançar** no rodapé.
"Avançar" só habilita quando a etapa atual está completa segundo as regras
que já existem hoje implicitamente na UI, por exemplo:
- Itens → Propostas: precisa ter pelo menos 1 item (mesma regra de
  `quotation.items.length === 0` já usada nos estados vazios da aba).
- Propostas → Aprovação: usa a mesma condição de `canAdvanceToReview` já
  calculada hoje (linha ~167, mínimo de 3 propostas).
- Histórico continua acessível a qualquer momento (não é uma "etapa", é
  consulta).

**Botão do WhatsApp.** O botão "Enviar via WhatsApp" (hoje `flex-1`, largo,
com texto "Enviar via WhatsApp (opcional)") encolhe — vira um botão menor,
ícone + texto curto ou só ícone com tooltip "Enviar via WhatsApp
(opcional)" — para abrir espaço visual para os botões Voltar/Avançar no
mesmo rodapé. Ação e comportamento (`onSendToSuppliers`) não mudam, só o
tamanho/apresentação.

## Critérios de aceite

- Não é mais possível pular direto para a aba Aprovação sem passar pelas
  etapas anteriores clicando na aba.
- Botões Voltar/Avançar no rodapé navegam entre as etapas, respeitando as
  mesmas regras de completude que já existem hoje (`canAdvanceToReview`,
  itens não vazios, etc.).
- Botão do WhatsApp continua funcional, só com apresentação mais compacta.
- Histórico continua acessível sem restrição de etapa.
