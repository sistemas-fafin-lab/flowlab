# 08: Identificação do EPI conferida ou informada na retirada

**What to build:** na tela de retirada de uma solicitação de materiais, cada EPI que será baixado mostra o tipo (CA ou Registro ANVISA) e o número da identificação. Se o produto já tem identificação no cadastro, os campos vêm preenchidos e o estoquista confere, podendo corrigir. Se não tem, vêm vazios e o estoquista informa. O campo é opcional e vale só para aquela entrega: o cadastro do produto não muda. Substitui a cópia automática do issue 03, que não deixava o estoquista informar nada. Spec: `.scratch/epi-relatorio-mensal/spec.md` (história 12; Módulos → Domínio, "copiar a Identificação do EPI").

**Blocked by:** 03 (Cópia da Identificação do EPI na finalização).

**Status:** done

- [x] A tela de retirada mostra, só na solicitação de materiais, um campo de tipo e um de número para cada EPI que será baixado, com o valor inicial vindo do cadastro ou vazio.
- [x] O que o estoquista conferiu ou informou é gravado na cópia do item e prevalece sobre o cadastro.
- [x] A validade vem do cadastro e só é copiada quando o tipo e o número entregues são iguais aos do cadastro.
- [x] Campos vazios não bloqueiam a retirada.
- [x] O cadastro do produto não é alterado.
- [x] Testes cobrem: identificação conferida igual ao cadastro, corrigida, informada para EPI sem cadastro, apagada e informada para item que não é EPI.
