# 03: Cópia da Identificação do EPI na finalização

**What to build:** ao finalizar uma solicitação de materiais, cada item cujo produto é EPI recebe uma cópia da Identificação do EPI vigente naquele momento (tipo, número, validade). Se o Compras mudar o CA depois, a entrega antiga continua com o CA da época. A rotina do estoquista não muda. Spec: `.scratch/epi-relatorio-mensal/spec.md` (histórias 11–13; Módulos → Domínio, "copiar a Identificação do EPI"; Esquema → Item da solicitação).

**Blocked by:** 02 (Produto EPI e Identificação do EPI).

**Status:** done

- [x] Função do domínio do Relatório mensal de EPI que recebe os itens e os produtos e devolve os itens, com a cópia `{tipo, numero, validade}` só nos que são EPI; os outros itens ficam intactos.
- [x] A finalização da solicitação de materiais usa essa função e grava os itens com a cópia.
- [x] Item de produto EPI sem identificação recebe cópia vazia (ou nenhuma), sem erro.
- [x] Itens digitados à mão, sem produto cadastrado, não recebem cópia.
- [x] Testes da função cobrem: item EPI com identificação, EPI sem identificação, produto não EPI, item sem produto.
