# Ver imagens da requisição no Histórico (apLIS) de Glosas e Recursos

Pedido em 11/08/2026: no módulo Faturamento → Glosas e Recursos → aba
"Histórico (apLIS)", poder ver as imagens/documentos digitalizados anexados a
uma requisição, tanto na sub-aba Glosas quanto na de Recursos.

**Status**: bloqueado — a única fonte de imagem encontrada no backup do
laboratório tem os dados corrompidos na origem (irrecuperável). Precisa de
outra fonte antes de continuar. Nada disso está em produção; os arquivos de
código já criados (seção 3) ficam prontos pra retomar assim que houver uma
fonte de dado válida.

---

## 1. O que existe no legado

O MySQL de backup do laboratório (mesmo banco que `api/_lib/faturamento/bdLab.ts`
já usa para lotes/glosas/recursos) tem uma tabela `requisicaoimagem`:

```
IdRequisicaoImagem  int (PK)
IdRequisicao        int (FK -> requisicao.IdRequisicao)
NomArquivo           varchar(255)
ExtArquivo           varchar(3)   -- JPG/PNG/PDF/BMP/... (ver achado 2 abaixo)
Tipo                 int          -- sem tabela de descrição conhecida
CodDiagnostico       int
DesLaudo             longtext
ImpLaudo             tinyint(1)
Img                  longblob     -- os bytes do arquivo
DtaImg               datetime     -- quando foi digitalizado
Inativo              tinyint(1)
```

Volumetria (levantamento em 11/08/2026): ~1,09M linhas ao todo, mas só
**~23,1 mil (≈1,4%)** têm `Img` preenchido — o resto é requisição sem
digitalização ainda. `DtaImg` fica `NULL` até a digitalização acontecer, o que
pode levar alguns dias mesmo pra requisições já antigas (à parte do atraso de
~1 dia que a réplica inteira já tem, documentado no topo de `bdLab.ts`).

## 2. Achado — os dados de `Img` estão corrompidos na origem

Testado com evidência forte, não é suposição:

- Peguei o registro `IdRequisicaoImagem=42` (`ExtArquivo='JPG'`) e comparei os
  primeiros bytes com a assinatura esperada de um JPEG (`FF D8 FF E0`). Vieram
  `00 10 4A 46 49 46 00 01...` — ou seja, o `FF D8 FF E0` do início não existe,
  mas o resto bate exatamente com o conteúdo de um segmento APP0/JFIF válido
  (`"JFIF\0"` na posição certa, tamanho de segmento certo).
- Contei ocorrências do byte `0xFF` no blob inteiro: **zero**. Estatisticamente,
  um JPEG desse tamanho deveria ter ~8-9 ocorrências ao acaso — vir zero não é
  coincidência, é o byte `0xFF` especificamente ausente dos dados armazenados
  (mais outros valores altos também ausentes, ver lista abaixo).
- Repeti a leitura de várias formas pra eliminar causas do meu lado:
  - `mysql2` com `execute()` (protocolo binário) e `query()` (protocolo texto)
    — mesmo resultado.
  - Forçando `charset: 'binary'` na conexão — mesmo resultado.
  - Driver totalmente diferente, **PyMySQL** em vez de `mysql2` — mesmo
    resultado.
  - `SELECT HEX(Img)` — conversão pra hex feita **dentro do servidor MySQL**,
    então nenhum driver/túnel/charset do lado cliente entra no caminho — **mesmo
    resultado**. Esse é o teste decisivo: prova que o dado já está assim
    armazenado no servidor, não é problema de leitura.
  - Testei em outra tabela sem nenhuma relação (`rptimagens`, logos de
    relatório) — mesmo padrão (zero `0xFF`), confirmando que não é um problema
    específico de `requisicaoimagem`, é geral pra BLOB nesse banco/ambiente.
    Ainda assim, como o teste #3 (`HEX()` server-side) já isola isso do lado
    cliente, o mais provável é que seja um bug de escrita em algum componente
    do apLIS que grava esses campos — não do meu acesso.
  - Testei os **9 tipos diferentes** (`Tipo` 1, 3, 5, 9, 10, 13, 18, 24, 25)
    que têm blob preenchido — todos com o mesmo padrão corrompido.
  - Testei os **registros mais antigos que existem** (`IdRequisicaoImagem`
    42–56, novembro/2020) — mesmo padrão. Não existe um período "bom" pra
    trás; a corrupção cobre a tabela inteira, de 2020 até ontem.
- Byte a byte, os valores que nunca aparecem num blob de exemplo (2255 bytes):
  `0x81, 0x84, 0x87, 0x8B, 0x92, 0xA1, 0xAB, 0xAF, 0xB2, 0xB3, 0xB8, 0xC0, 0xC1,
  0xC6` e **todo o intervalo `0xE0`–`0xFF`**. Esse padrão (bytes específicos
  faltando, não um intervalo contíguo limpo) é mais consistente com o dado
  tendo passado por uma conversão de charset com perda (ex.: tratado como texto
  UTF-8 em algum ponto da escrita) do que com truncamento simples.
- Achado 2 (extensão não bate com o conteúdo real): registros com
  `ExtArquivo='PNG'` têm exatamente o mesmo cabeçalho `"JFIF\0"` dos `JPG` —
  ou seja, são JPEG também, só com a extensão errada no cadastro. Não existe
  nenhum registro com blob preenchido pra `PDF`, `BMP`, `GIF` ou `TIF` (essas
  extensões aparecem na tabela, mas sempre com `Img IS NULL`).

**Conclusão**: os bytes armazenados em `requisicaoimagem.Img` não são um
arquivo de imagem válido pra nenhum registro testado. Como o teste decisivo
(`HEX()` rodando dentro do MySQL) já elimina qualquer coisa do lado cliente,
isso não é específico do túnel de dev (`DB_HOST=1.tcp.sa.ngrok.io` no `.env`) —
o mesmo aconteceria contra produção, porque é o mesmo dado. Provavelmente um
bug (antigo e ainda ativo hoje) em algum componente do apLIS que grava esse
campo.

## 3. O que já foi construído (não depende da decisão abaixo)

Toda a parte de "listar quais imagens existem pra uma requisição" e a UI de
navegação estão prontas e funcionam — o que não funciona é só a última etapa
(os bytes do arquivo em si). Fica tudo pronto pra reaproveitar assim que
houver uma fonte válida:

- `api/_lib/faturamento/bdLab.ts` — `listarImagensRequisicaoLegado()` (lista
  metadados) e `buscarImagemRequisicaoLegado()` (busca o blob de um item —
  é essa função que vai precisar apontar pra outra fonte).
- `api/_lib/handlers/faturamento-imagens-legado.ts` (GET
  `/api/faturamento/imagens-legado?idRequisicao=`) e
  `api/_lib/handlers/faturamento-imagem-legado-arquivo.ts` (GET
  `/api/faturamento/imagem-legado-arquivo?id=`), registrados em
  `api/faturamento/[action].ts`.
- `src/modules/billing/types/index.ts` — tipo `ImagemRequisicaoLegado`.
- `src/modules/faturamento/hooks/useImagensRequisicaoLegado.ts` — busca a
  lista + os bytes sob demanda (object URL, com cache e revogação).
- `src/modules/faturamento/components/ImagensRequisicaoLegadoModal.tsx` —
  visualizador (lightbox) com navegação Anterior/Próxima, trata imagem vs. PDF
  vs. formato não suportado, e o estado "ainda não digitalizada".
- Botão "Ver imagens" (ícone) já plugado em
  `HistoricoGlosasLegado.tsx` (usa `g.idRequisicao`, direto na linha) e em
  `HistoricoRecursosLegado.tsx` (usa `proc.idRequisicao`, dentro do
  procedimento expandido — o lote de recurso em si não carrega esse id).

Nada disso foi commitado ainda.

## 4. Decisão pendente — de onde vêm as imagens de verdade

Opções levantadas com o usuário, nenhuma escolhida ainda:

1. **Outra fonte de dado** (API do apLIS ao vivo, pasta de rede onde o
   scanner grava, outro sistema) — se existir um caminho que devolva o
   arquivo íntegro, só troca a implementação de
   `buscarImagemRequisicaoLegado()`/`imagem-legado-arquivo`; o resto (lista,
   UI, botão) não muda.
2. **Lista sem pré-visualização** — mantém o botão "Ver imagens", mas troca o
   visualizador por uma lista de nome/data/tipo de cada arquivo (dado que
   `listarImagensRequisicaoLegado()` já devolve e que não depende do blob
   corrompido), com aviso de que a pré-visualização não está disponível.
3. **Descartar a feature** — reverter os arquivos da seção 3.

## 5. Próximos passos sugeridos

- [ ] Descobrir se existe alguma outra fonte acessível pras imagens (API do
      apLIS em produção — não a réplica de backup —, pasta de rede do
      scanner, sistema de digitalização em si).
- [ ] Se existir: mapear como autenticar/acessar essa fonte a partir da
      Vercel function e redesenhar `buscarImagemRequisicaoLegado()` em cima
      dela.
- [ ] Se não existir: decidir entre lista-sem-preview e descartar a feature.
