# Documentação do Webservice AOL (Álvaro / DASA)

## 1. Visão geral

Este projeto documenta e operacionaliza a integração com o **Webservice AOL** do Álvaro/DASA, usado para comunicação entre um LIS externo e o apoio laboratorial.

A API segue padrão REST e trabalha principalmente com:

- **XML** para envio e retorno de solicitações e resultados;
- **JSON** em alguns endpoints de rastreabilidade e status;
- **PDF binário** para laudos;
- **Basic Auth** na maior parte das rotas autenticadas.

Versão de referência encontrada no projeto:

- **OpenAPI:** `0.2.0.16`
- **Servidor base:** `http://webservice.alvaro.com.br`

---

## 2. O que existe neste projeto

### Arquivos principais

- **`webservice-aol-openapi-0_2_0_16-readonly.yaml`**  
  Especificação OpenAPI oficial usada como fonte de verdade dos endpoints.

- **`worklab/proxy.py`**  
  Proxy reverso local que:
  - roda em `http://localhost:8000`;
  - serve a interface web local;
  - encaminha chamadas `/webserviceaol/*` para o host do Álvaro;
  - evita problemas de **CORS / Mixed Content** no navegador.

- **`worklab/index.html`**  
  Interface visual para testar os endpoints manualmente.

- **`worklab/app.js`**  
  Lógica do front-end: geração dos XMLs, autenticação, envio das requisições e exibição das respostas.

- **`worklab/index.css`**  
  Estilo da interface de testes.

---

## 3. Arquitetura do fluxo

```text
Navegador
   ↓
Interface local (index.html + app.js)
   ↓
Proxy local Python (proxy.py)
   ↓
http://webservice.alvaro.com.br
   ↓
Webservice AOL / Álvaro
```

### Motivo do proxy
O webservice do Álvaro opera em **HTTP**, e o navegador pode bloquear chamadas diretas por política de segurança. O proxy local resolve isso encaminhando as requisições pelo backend Python.

---

## 4. Como executar localmente

### Pré-requisito
- Python 3 instalado.

### Subir o proxy
Na pasta `worklab`:

```bash
python proxy.py
```

Saída esperada:

```text
[OK] Proxy rodando em http://localhost:8000
Encaminhando /webserviceaol/* para http://webservice.alvaro.com.br
```

### Abrir no navegador
Acesse:

```text
http://localhost:8000
```

---

## 5. Autenticação

O webservice usa **três padrões** neste projeto:

### 5.1. Sem autenticação
Usado para teste de conectividade:

- `GET /webserviceaol/rest/producao/teste`

### 5.2. Credenciais dentro do XML
Usado principalmente para inclusão de solicitação e inclusão de exame:

- atributos como `idagente`, `senha`, `codigo` e `chave` vão no XML.

Exemplo estrutural:

```xml
<solicitacoes idagente="SEU_AGENTE" senha="SUA_SENHA">
  <entidade codigo="SUA_ENTIDADE" chave="SUA_CHAVE">
    ...
  </entidade>
</solicitacoes>
```

### 5.3. Basic Auth no header
Usado nas consultas e atualizações autenticadas:

```http
Authorization: Basic BASE64(idagente:senha)
```

### 5.4. Headers `idagente` e `senha`
Algumas rotas auxiliares de materiais/amostras foram descritas no YAML com autenticação por header simples:

```http
idagente: SEU_AGENTE
senha: SUA_SENHA
```

---

## 6. Status HTTP esperados

| Código | Significado |
|---|---|
| 200 | Sucesso total |
| 206 | Sucesso parcial |
| 400 | Dados inválidos / regra de negócio falhou |
| 401 | Credenciais inválidas ou ausentes |
| 403 | Agente ou entidade sem autorização |
| 500 | Erro interno do serviço |

---

## 7. Endpoints principais do Webservice

Abaixo está o mapeamento consolidado do que foi encontrado no YAML e no tester local.

### 7.1. Conectividade

| Método | Rota | Finalidade | Auth |
|---|---|---|---|
| GET | `/webserviceaol/rest/producao/teste` | Testar conectividade e versão do serviço | Não |

### 7.2. Solicitações

| Método | Rota | Finalidade | Auth |
|---|---|---|---|
| PUT | `/webserviceaol/rest/producao` | Incluir solicitação de exames | Credenciais no XML |
| PUT | `/webserviceaol/rest/producao/solicitacao` | Atualizar data de coleta e observação | Basic Auth |
| PUT | `/webserviceaol/rest/producao/dados-adicionais` | Complementar exame com dados adicionais | Basic Auth |

### 7.3. Exames

| Método | Rota | Finalidade | Auth |
|---|---|---|---|
| POST | `/webserviceaol/rest/producao` | Incluir exame em solicitação existente | Credenciais no XML |
| DELETE | `/webserviceaol/rest/producao/v2/{entidade}/{solicitacao}/{codigoBarras}/{codigoExame}` | Excluir exame por parâmetros na URL | Basic Auth |
| DELETE | `/webserviceaol/rest/producao/v2` | Excluir exame por XML no body | Basic Auth |

### 7.4. Resultados

| Método | Rota | Finalidade | Auth |
|---|---|---|---|
| PUT | `/webserviceaol/rest/producao/v2/resultados` | Buscar resultado por OS / exame | Basic Auth |
| GET | `/webserviceaol/rest/producao/v2/resultados/pdf` | Baixar laudo PDF | Basic Auth |
| GET | `/webserviceaol/rest/producao/v3/resultados/lote/{idEntidade}/{dataInicial}/{dataFinal}` | Buscar resultados por lote/período | Basic Auth |

### 7.5. Status e rastreabilidade

| Método | Rota | Finalidade | Auth |
|---|---|---|---|
| GET | `/webserviceaol/rest/producao/v1/orders/{orderId}/exams/status` | Status dos exames de uma OS | Basic Auth |
| GET | `/webserviceaol/rest/producao/v1/orders/status/{idEntidade}` | Status consolidado por período/status | Basic Auth |
| GET | `/webserviceaol/rest/producao/v1/notificacao/{idEntidade}` | Notificações de recoleta por período | Basic Auth |

### 7.6. Apoio operacional

| Método | Rota | Finalidade | Auth |
|---|---|---|---|
| GET | `/webserviceaol/rest/producao/listarMateriais` | Lista todos os materiais disponíveis | Header `idagente` + `senha` |
| GET | `/webserviceaol/rest/producao/listarMaterial-exame/{codigoExame}` | Lista materiais aceitos por exame | Header `idagente` + `senha` |
| GET | `/webserviceaol/rest/producao/situacaoAmostra` | Consulta situação da amostra por código de barras | Header `idagente` + `senha` |
| GET | `/webserviceaol/rest/producao/criticasAll` | Lista críticas/metadados de exames | Basic Auth |
| GET | `/webserviceaol/rest/producao/criticasExame` | Lista críticas de um exame específico | Basic Auth |
| GET | `/webserviceaol/rest/producao/catalogoMensagens` | Catálogo documental das mensagens de retorno | Documental |

---

## 8. O que a interface local já cobre

O tester implementado em `worklab/app.js` já possui telas/ações para:

1. **Teste de conexão**
2. **Incluir solicitação**
3. **Atualizar coleta/observação**
4. **Incluir dados adicionais**
5. **Incluir exame**
6. **Excluir exame**
7. **Buscar resultados por OS**
8. **Baixar PDF**
9. **Buscar resultados por lote**
10. **Status por OS**
11. **Status consolidado**

Ou seja: o projeto já serve como um **laboratório funcional** para validar a maior parte do fluxo principal da integração.

---

## 9. Fluxo funcional da integração

### Fluxo típico

1. **Testar a conectividade** com o endpoint de healthcheck.
2. **Incluir uma solicitação** via XML.
3. Receber o **ID Alvaro / OS** e os metadados da solicitação.
4. Se necessário:
   - atualizar data de coleta;
   - incluir dados adicionais;
   - incluir ou excluir exames.
5. Consultar:
   - **resultado por OS**;
   - **PDF do laudo**;
   - **resultado por lote**.
6. Acompanhar andamento por:
   - **status de exames por OS**;
   - **status consolidado**;
   - **notificações de recoleta**.

---

## 10. Exemplos de payloads XML

### 10.1. Inclusão de solicitação simples

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<solicitacoes datahora="2026-03-03T08:39:37.402-03:00" idagente="SEU_AGENTE" lis="SEU_LIS" operador="OPERADOR" senha="SUA_SENHA" versao="20170918">
  <entidade chave="SUA_CHAVE" codigo="SUA_ENTIDADE">
    <pacientes>
      <paciente codigolis="PAC-0001" datanasc="1991-01-01" nome="PACIENTE TESTE" sexo="M" cpf="00000000000" email="teste@dominio.com"/>
    </pacientes>
    <medicos>
      <medico crm="123456-RJ" nome="Médico Teste"/>
    </medicos>
    <solicitacao codigolis="SOL-0001" codigopaciente="PAC-0001" crm="123456-RJ" data="2026-03-03-03:00" dataColeta="2026-03-03T00:00:00.000-03:00" postoDeColeta="POSTO_01">
      <amostra descricao="Basal" material="543">
        <exame codigo="TSH" dadosadicionais="" urgente="false"/>
      </amostra>
    </solicitacao>
  </entidade>
</solicitacoes>
```

### 10.2. Atualização de coleta

```xml
<?xml version="1.0" encoding="utf-8"?>
<solicitacoes datahora="2026-03-03T10:54:50.198-03:00">
  <entidade codigo="19812">
    <solicitacao idAlvaro="372098991" observacao="Medicamento: ENALAPRIL 10 mg" dataColeta="2026-03-05T13:00:00.000-03:00"/>
  </entidade>
</solicitacoes>
```

### 10.3. Dados adicionais

```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<solicitacoes datahora="2026-03-03T10:54:50.198-03:00">
  <entidade codigo="19812">
    <solicitacao idAlvaro="372110835">
      <amostra codigoBarras="704306874555">
        <exame codigo="CLEAR1">
          <dadoAdicional dado="VOLUME" valor="2000" />
          <dadoAdicional dado="ALTURA" valor="180" />
          <dadoAdicional dado="PESO" valor="85" />
        </exame>
      </amostra>
    </solicitacao>
  </entidade>
</solicitacoes>
```

---

## 11. Parâmetros importantes de consulta

### Resultado por lote
Formato das datas no path:

```text
YYYYMMDDHHmmss
```

Exemplo:

```text
20260303000000
20260303235959
```

Parâmetros úteis:

- `exportado=true`
- `exportado=false`
- `habilitaLocalCNES=true`

### Status consolidado
Parâmetros comuns:

- `dataInicial=YYYY-MM-DD`
- `dataFinal=YYYY-MM-DD`
- `status=FINALIZADO` (ou outro status disponível)
- `nextCursor=...` para paginação

### Resultados por OS
Parâmetros opcionais descritos no YAML:

- `referenciaResultado=true`
- `habilitaInformacoesComplementares=true`
- `habilitaNotaFixa=true`
- `habilitaLocalCNES=true`
- `anexoFormato=PNG|SVG`

---

## 12. Tipos de retorno

### XML
Usado principalmente em:
- inclusão de solicitação;
- inclusão/exclusão de exames;
- atualização de coleta;
- resultados por OS e lote.

### JSON
Usado principalmente em:
- status por OS;
- status consolidado;
- recoleta;
- críticas de exames.

### PDF
Usado em:
- geração de laudo por OS.

---

## 13. Regras e observações de negócio

- A API aceita **HTTP** e não HTTPS no endpoint de produção descrito no projeto.
- Algumas rotas usam **Basic Auth**, outras exigem credenciais no próprio XML.
- O endpoint de **catálogo de mensagens** é **documental**, não necessariamente uma rota executável real.
- O YAML informa que as **críticas/metadados** desta versão têm validade até **31/05/2026**.
- O retorno pode ser **200**, **206** ou **400** dependendo do sucesso total, parcial ou falha de negócio.
- Em resultados por lote e status consolidado, o volume retornado pode ser grande; é recomendável filtrar por período curto.

---

## 14. Mensagens de erro de negócio mais comuns

Com base no catálogo embutido no YAML, algumas mensagens relevantes são:

- **ID ou Senha incorreta**
- **Agente ou Entidade não autorizado a utilizar o WebService**
- **Entidade inválida**
- **Solicitação não cadastrada**
- **Solicitação já processada**
- **OS não inserida por duplicidade de exame**
- **Material inválido**
- **Exame inválido não autorizado**
- **Exame já existente na amostra**
- **Exame excluído com sucesso**
- **Exame incluído com sucesso**

---

## 15. Resumo técnico do projeto atual

### Pontos fortes
- Interface simples para teste manual dos principais endpoints.
- Proxy Python resolve a parte crítica de acesso local.
- Geração automática de XMLs de exemplo.
- Persistência local das credenciais no navegador.
- Boa cobertura do fluxo operacional principal.

### Limitações atuais
- Não há backend de produção próprio: o projeto é um **tester/integrador local**.
- O serviço remoto depende de disponibilidade externa do Álvaro.
- As credenciais precisam ser válidas para ambiente real.
- Parte dos endpoints auxiliares está documentada no YAML, mas não exposta na UI.

---

## 16. Validação real executada em 16/04/2026

Foi executada uma bateria de chamadas reais contra `http://webservice.alvaro.com.br` para validar o comportamento descrito.

### 16.1. Matriz de teste (resultado real)

| Endpoint | Resultado real |
|---|---|
| `GET /webserviceaol/rest/producao/teste` | **200** |
| `PUT /webserviceaol/rest/producao` | **200** |
| `PUT /webserviceaol/rest/producao/solicitacao` | **400** |
| `PUT /webserviceaol/rest/producao/dados-adicionais` | **200** |
| `POST /webserviceaol/rest/producao` | **200** |
| `DELETE /webserviceaol/rest/producao/v2/{entidade}/{solicitacao}/{codigoBarras}/{codigoExame}` | **400** |
| `GET /webserviceaol/rest/producao/v1/orders/{orderId}/exams/status` | **200** |
| `PUT /webserviceaol/rest/producao/v2/resultados` | **200** |
| `GET /webserviceaol/rest/producao/v2/resultados/pdf` | **200** |
| `GET /webserviceaol/rest/producao/v3/resultados/lote/{idEntidade}/{dataInicial}/{dataFinal}?exportado=false` | **204** |
| `GET /webserviceaol/rest/producao/v1/orders/status/{idEntidade}` | **200** |
| `GET /webserviceaol/rest/producao/v1/notificacao/{idEntidade}` | **204** |
| `GET /webserviceaol/rest/producao/listarMateriais` | **200** |
| `GET /webserviceaol/rest/producao/listarMaterial-exame/TSH` | **404** |
| `GET /webserviceaol/rest/producao/v1/exames/criticas/all` | **200** |
| `GET /webserviceaol/rest/producao/v1/exames/criticas/all?codigo=tsh` | **200** |

### 16.2. Observações da validação

- `listarMaterial-exame/TSH` retornou **404** no ambiente testado, apesar de estar documentado no YAML.
- As rotas de críticas funcionaram na forma **real**: `/v1/exames/criticas/all`.
- Em períodos sem dados, os endpoints de lote e recoleta retornaram **204 No Content**.
- O endpoint de atualização de coleta retornou **400** no cenário testado; isso indica regra de negócio/dado inválido para aquela OS.
- `POST /producao` para incluir exame respondeu **200**, mas com mensagem de negócio de solicitação já processada para a OS usada no teste.
- O `DELETE` de exame respondeu **400** no cenário testado (falha de regra/estado do exame).

---

## 17. Entrada e saída de dados (endpoint por endpoint)

Esta seção descreve, de forma prática, o que enviar e o que esperar de retorno.

### 17.1. Teste de conexão

- Endpoint: `GET /webserviceaol/rest/producao/teste`
- Entrada:
  - sem body
  - sem autenticação
- Saída esperada:
  - tipo: texto simples
  - exemplo real: `OK v2026.2.4`

### 17.2. Incluir solicitação

- Endpoint: `PUT /webserviceaol/rest/producao`
- Entrada:
  - `Content-Type: application/xml`
  - XML com `idagente`, `senha`, `entidade`, `paciente`, `medico`, `solicitacao`, `amostra`, `exame`
- Saída esperada:
  - tipo: XML
  - campos importantes de retorno:
    - `idAlvaro` da solicitação
    - `codigoBarras` da amostra
    - status/informação por bloco

### 17.3. Atualizar data de coleta

- Endpoint: `PUT /webserviceaol/rest/producao/solicitacao`
- Entrada:
  - `Authorization: Basic ...`
  - `Content-Type: application/xml`
  - XML com:
    - `entidade codigo`
    - `solicitacao idAlvaro`
    - `dataColeta`
    - `observacao` (opcional)
- Saída esperada:
  - tipo: XML em sucesso
  - no teste real: **400**

### 17.4. Incluir dados adicionais

- Endpoint: `PUT /webserviceaol/rest/producao/dados-adicionais`
- Entrada:
  - `Authorization: Basic ...`
  - `Content-Type: application/xml`
  - XML com:
    - `solicitacao idAlvaro`
    - `amostra codigoBarras`
    - `exame codigo`
    - um ou mais `dadoAdicional` com par `dado/valor`
- Saída esperada:
  - tipo: XML
  - no teste real: **200** com status `SUCESSO` por nível (solicitação, amostra, exame e dados)

### 17.5. Incluir exame

- Endpoint: `POST /webserviceaol/rest/producao`
- Entrada:
  - `Content-Type: application/xml`
  - XML de `inclusoes` com:
    - `idagente/senha`
    - `entidade`
    - `solicitacao idAlvaro`
    - `amostra`
    - `exame codigoExame`
- Saída esperada:
  - tipo: XML
  - no teste real: **200**, porém com mensagem de negócio informando que a solicitação já estava processada

### 17.6. Excluir exame

- Endpoint: `DELETE /webserviceaol/rest/producao/v2/{entidade}/{solicitacao}/{codigoBarras}/{codigoExame}`
- Entrada:
  - `Authorization: Basic ...`
  - parâmetros no path:
    - `entidade`
    - `solicitacao`
    - `codigoBarras`
    - `codigoExame`
- Saída esperada:
  - tipo: XML em sucesso
  - no teste real: **400**

### 17.7. Resultados por OS

- Endpoint: `PUT /webserviceaol/rest/producao/v2/resultados`
- Entrada:
  - `Authorization: Basic ...`
  - `Content-Type: application/xml`
  - XML com:
    - `resultados idagente/senha`
    - `entidade codigo`
    - `solicitacao idAlvaro`
    - `exame codigo` (vazio para todos)
  - query params opcionais:
    - `referenciaResultado=true`
    - `habilitaInformacoesComplementares=true`
    - `habilitaNotaFixa=true`
    - `habilitaLocalCNES=true`
- Saída esperada:
  - tipo: XML
  - blocos comuns:
    - `cadastros` (paciente/material/exame)
    - `solicitacao`
    - `exame`
    - `resultado`

### 17.8. Resultado PDF

- Endpoint: `GET /webserviceaol/rest/producao/v2/resultados/pdf`
- Entrada:
  - `Authorization: Basic ...`
  - query params:
    - `idOrdemServico` (obrigatório)
    - `idEntidade` (obrigatório)
    - `exames` (opcional, CSV)
    - `logo` e `assinatura` (opcionais)
- Saída esperada:
  - tipo: `application/pdf` (binário)
  - no tester local: download do arquivo

### 17.9. Resultado por lote

- Endpoint: `GET /webserviceaol/rest/producao/v3/resultados/lote/{idEntidade}/{dataInicial}/{dataFinal}`
- Entrada:
  - `Authorization: Basic ...`
  - `dataInicial` e `dataFinal` no formato `YYYYMMDDHHmmss`
  - query opcional: `exportado=true|false`
- Saída esperada:
  - tipo: XML quando há dados
  - pode retornar `204` quando não há resultado no período

### 17.10. Status dos exames por OS

- Endpoint: `GET /webserviceaol/rest/producao/v1/orders/{orderId}/exams/status?laboratoryId={idEntidade}`
- Entrada:
  - `Authorization: Basic ...`
  - `orderId` no path
  - `laboratoryId` na query
- Saída esperada:
  - tipo: JSON
  - quando encontra a OS: lista de exames com status
  - quando não encontra: JSON de erro (no teste real veio `status: 200` com payload `NOT_FOUND`)

### 17.11. Status consolidado

- Endpoint: `GET /webserviceaol/rest/producao/v1/orders/status/{idEntidade}`
- Entrada:
  - `Authorization: Basic ...`
  - query:
    - `dataInicial=YYYY-MM-DD`
    - `dataFinal=YYYY-MM-DD`
    - `status` (opcional)
    - `nextCursor` (opcional)
- Saída esperada:
  - tipo: JSON
  - campos principais:
    - `countStatus`
    - `orders`
    - `nextCursor`
    - `hasNext`

### 17.12. Recoleta por período

- Endpoint: `GET /webserviceaol/rest/producao/v1/notificacao/{idEntidade}`
- Entrada:
  - `Authorization: Basic ...`
  - query:
    - `dataInicial=YYYY-MM-DD HH:MM:SS`
    - `dataFinal=YYYY-MM-DD HH:MM:SS`
  - datas devem ser URL-encoded
- Saída esperada:
  - tipo: JSON (array) quando há eventos
  - `204` quando não há eventos

### 17.13. Listar materiais

- Endpoint: `GET /webserviceaol/rest/producao/listarMateriais`
- Entrada:
  - headers `idagente` e `senha` (conforme YAML)
  - no teste também funcionou com `Authorization: Basic ...`
- Saída esperada:
  - tipo: XML
  - estrutura: `consultaMaterialRetorno` com exames e materiais possíveis

### 17.14. Materiais por exame

- Endpoint documentado: `GET /webserviceaol/rest/producao/listarMaterial-exame/{codigoExame}`
- Entrada:
  - path com código do exame
  - headers `idagente`/`senha`
- Saída esperada:
  - tipo: XML (pela especificação)
  - resultado real do teste: **404**

### 17.15. Críticas de exames

- Endpoint real validado:
  - `GET /webserviceaol/rest/producao/v1/exames/criticas/all`
  - `GET /webserviceaol/rest/producao/v1/exames/criticas/all?codigo=tsh`
- Entrada:
  - `Authorization: Basic ...`
  - `codigo` opcional para filtrar exame
- Saída esperada:
  - tipo: JSON
  - blocos comuns:
    - `materials`
    - `exams`
    - críticas e metadados associados

---

## 18. Mapa rápido de entrada e saída por tipo

| Grupo | Entrada típica | Saída típica |
|---|---|---|
| Solicitação/exame | XML + Basic/Auth no XML | XML |
| Resultados por OS/lote | XML (OS) ou params de período (lote) | XML |
| PDF | Query params + Basic Auth | PDF binário |
| Status/recoleta | Query params + Basic Auth | JSON |
| Materiais | Headers `idagente/senha` | XML |
| Críticas | Query opcional + Basic Auth | JSON |

---

## 19. Conclusão

Além da documentação funcional, este arquivo agora registra **validação real de execução** e o contrato prático de **entrada e saída de dados** para cada grupo de endpoint.