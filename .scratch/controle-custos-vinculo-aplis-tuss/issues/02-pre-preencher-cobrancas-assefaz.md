# 02: Pré-preencher as cobranças da ASSEFAZ com TUSS único

**What to build:** sem ninguém digitar, as cobranças da ASSEFAZ que têm um TUSS só no apLIS aparecem ligadas aos exames do catálogo. Um script lê a tabela de preço 1 (`fattabelaprocedimento` ativos), liga cada cobrança com exatamente um `Codigo` ao único exame de `custo_exames` com esse `tuss`, e lista no fim o que ligou e o que ficou de fora (com o motivo), para conferência. Ver `../spec.md`, "Pré-preenchimento".

**Blocked by:** 01 (Ligar exame do catálogo a cobrança/teste do apLIS na tela)

**Status:** done no código (20/Out/2026); falta aplicar 20261020233000_custo_exames_pre_vinculo_assefaz em produção, depois de 20261020210000

- [x] Escolha é uma função pura (linhas do apLIS + catálogo → vínculos + descartes com motivo), testada sem banco: TUSS único, cobrança com dois TUSS, TUSS compartilhado por vários exames do catálogo, TUSS ausente do catálogo
- [x] Script versionado aplica os vínculos sem sobrescrever vínculo já preenchido à mão
- [ ] Rodado no ambiente (migration gerada da leitura de produção; falta aplicar): 3, 7 e 23 ligados; 1, 2, 8 e 25 sem vínculo. 6, 12, 13, 15, 18 e 19 ficaram de fora — ver Comments
- [x] Relatório do que ligou/ficou de fora anexado nos comentários deste ticket

## Comments

### 20/10/2026 — implementação e relatório

**Critério mudou.** A spec dizia "cobrança com exatamente um `Codigo` ativo", mas a tabela 1 não é assim: 3 tem 5 códigos ativos (40601129 + 40601340/358/366/374), 12 tem 2, 13 tem 4, 19 tem 8, 23 tem 3. Ao pé da letra só a 7 ligaria. Decidido com o usuário: contar só os códigos da cobrança que existem em `custo_exames` e ligar quando sobra um, com um exame só. A 22 (BIOLOGIA MOLECULAR) fica fora por exceção explícita: dos seus 7 TUSS só 40310140 (cultura para fungos) está no catálogo, e ligar seria errado.

- Função pura: `api/_lib/faturamento/preVinculoAssefaz.ts` (+ `.test.ts`)
- Script (só leitura, gera a migration): `supabase/scripts/pre-vinculo-aplis-assefaz.ts`
- Migration gerada com o catálogo de produção: `supabase/migrations/20261020233000_custo_exames_pre_vinculo_assefaz.sql`. Cada UPDATE só liga se o exame e a cobrança ainda estiverem sem vínculo na hora de aplicar.

**Ligou (3):**
- 3 CITOLOGIA DE LÍQUIDO → 40601129 CITOLOGIA DE LIQUIDOS
- 7 COLORAÇÃO → 40601269 BIÓPSIA COM COLORAÇÃO ESPECIAL
- 23 CITOLOGIA EM MEIO LÍQUIDO → 40601323 CITOLOGIA EM MEIO LÍQUIDO

**Ficou de fora (17), para a tela:**
- 1 BIÓPSIA: mais de um TUSS no catálogo (40601110, 40601196, 40601200, 40601226)
- 2 PEÇA CIRÚRGICA SIMPLES: mais de um TUSS no catálogo (40601110, 40601200, 40601226)
- 4 PER-OPERATÓRIO: nenhum TUSS da cobrança está no catálogo (40601021, 40601030)
- 5 PER-OPERATÓRIO SEM DESLOCAMENTO: nenhum TUSS no catálogo (40601080)
- 6 REVISÃO DE LÂMINA: nenhum TUSS no catálogo (40601153)
- 8 IMUNOISTOQUÍMICA: nenhum TUSS no catálogo (40601170, 40601188)
- 12 PUNÇÃO BIOPSIA ASPIRATIVA: mais de um TUSS no catálogo (40601129, 40601250)
- 13 CITOLOGIA CONVENCIONAL: mais de um TUSS no catálogo (40601137, 41301188)
- 15 CITOLOGIA HORMONAL ISOLADA: nenhum TUSS no catálogo (40601161)
- 17 IMUNOFLUORESCÊNCIA: nenhum TUSS no catálogo (40601277)
- 18 PAINEL DE HIBRIDIZAÇÃO: 40601285 está em 4 exames (HPV DETECÇÃO E GENOTIPAGEM DE ALTO RISCO; PCR HPV ALTO RISCO; PCR HPV GENOTIPAGEM 28 TIPOS; PCR PARA HPV A/B)
- 19 CAPTURA HIBRIDA: mais de um TUSS no catálogo (40314057, 40314154, 40319326, 40601293)
- 20 PUNÇÃO BIÓPSIA ASPIRATIVA C/ DESLOCAMENTO: nenhum TUSS no catálogo (40601099, 40601102)
- 22 BIOLOGIA MOLECULAR: os outros TUSS da cobrança faltam no catálogo; ligar na tela (exceção explícita, ver acima)
- 25 PEÇA CIRÚRGICA COMPLEXA: mais de um TUSS no catálogo (40601218, 40601226)
- 28 MEDICINA LABORATORIAL: mais de um TUSS no catálogo (40302504, 40305767, 40307271, 40310060, 40310124, 40310426, 40310558)
- 30 PCR: nenhum TUSS no catálogo (99902034) — testes ligados à mão (issue 04)

Para gerar de novo (ex. depois de mexer no catálogo): `set -a; . ./.env.prod.local; set +a; npx tsx supabase/scripts/pre-vinculo-aplis-assefaz.ts supabase/migrations/20261020233000_custo_exames_pre_vinculo_assefaz.sql`.
