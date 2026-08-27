# Envio ao Apoio (Álvaro/AOL): cobertura de testes

O pipeline de envio de exames de Análises Clínicas ao laboratório de apoio
(Álvaro Online/AOL) — `api/_lib/apoio/aol.ts`, `api/_lib/handlers/apoio-transferir.ts`,
`api/_lib/apoio/xmlAol.ts` — não tem nenhum teste automatizado. `npx vitest run`
filtrado pro módulo AC passa 77/77, mas nenhum desses testes toca esse pipeline
especificamente; a ausência de falha não é evidência de que o envio funciona.

Confirmado em 27/08/2026: o serviço externo do Álvaro está no ar
(`GET https://webservice.alvaro.com.br/webserviceaol/rest/producao/teste` →
200 OK), mas isso só valida a conectividade de rede — não exercita o código
do flowlab, que nem implementa esse endpoint de teste.

Ver `.scratch/apoio-alvaro-testes/issues/01-cobertura-testes-pipeline-apoio.md`.
