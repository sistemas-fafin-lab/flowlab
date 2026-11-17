# 05: Teste de ponta a ponta com o LAB-BRAIN

**What to build:** confirmação em produção de que o LAB-BRAIN abre um chamado e acompanha a situação dele pelo FlowLab. Ver `../spec.md`, D5 e D7.

**Blocked by:** 03, 04

**Status:** ready-for-human

- [ ] O LAB-BRAIN abre um chamado de teste com um solicitante real e ativo, e recebe o código.
- [ ] O chamado aparece na tela com o selo "via LAB-BRAIN", no nome do solicitante.
- [ ] Reenviar o mesmo `id_externo` não cria outro chamado.
- [ ] O LAB-BRAIN consulta a situação e vê a mudança depois que o TI move o chamado.
- [ ] O chamado de teste é cancelado.

## Comments

- 13/11/2026: ainda bloqueada pela 04. Em produção, `GET /api/integracoes/lab-brain-chamado-consultar` sem chave responde `500 Erro interno`, e não `401`. É o `isBearerApiKeyValid` lançando erro porque `LAB_BRAIN_CHAMADOS_API_KEY` não existe no deploy (a rota do apoio responde `401` normalmente). Depois de criar a variável e fazer o redeploy, a mesma chamada sem chave tem que voltar `401`.
- 13/11/2026: o guard comum (`api/_lib/agentes/rotaAgente.ts`) passou a responder `503 Integração não configurada` quando a variável da chave falta, nas três rotas do LAB-BRAIN. Antes do redeploy com a chave, o GET sem chave volta `503`; depois, `401`.
- 13/11/2026: roteiro rodado no local (`vercel dev` → banco de teste `eqz`): 401, 405, 400, 404, 422, 201 `IT-132`, 200 no reenvio, consulta antes e depois de mover. A migration `20261113110000` faltava no teste e foi aplicada; em produção já constava no histórico. O IT-132 no teste está aberto para conferir o selo e cancelar.
- Corrigida a URL do GET no texto do Slack da 04: era `lab-brain-chamado`, o certo é `lab-brain-chamado-consultar`.
- Roteiro para quem tem a chave (o FlowLab pode fazer antes do LAB-BRAIN, com `export K=<chave>`):

  ```sh
  B=https://flow-lab.vercel.app/api/integracoes
  ID=teste-e2e-$(date +%s)
  # 1. Criar (201 { id, codigo })
  curl -s -X POST "$B/lab-brain-chamado-criar" -H "Authorization: Bearer $K" -H 'Content-Type: application/json' \
    -d "{\"titulo\":\"[TESTE] integração LAB-BRAIN\",\"descricao\":\"Chamado de teste, pode cancelar.\",\"solicitante_email\":\"<email de um usuário ativo>\",\"id_externo\":\"$ID\"}"
  # 2. Reenviar o mesmo corpo: 200 com o mesmo codigo
  # 3. Consultar: 200, situacao "pending", coluna_kanban null
  curl -s "$B/lab-brain-chamado-consultar?id_externo=$ID" -H "Authorization: Bearer $K"
  # 4. Na tela: selo "via LAB-BRAIN", no nome do solicitante. Mover o chamado e repetir o passo 3.
  # 5. Cancelar o chamado de teste pela tela.
  ```

  A cota é de 10 chamadas por minuto, somando criação e consulta.
- 16/11/2026: o FlowLab rodou parte do roteiro em produção com a chave, em 13/11 (`bf03fac`): `POST` com `tech2.laboratorio.lab@gmail.com` → `201` IT-434; consulta `pending` com `coluna_kanban: null`; aviso no sino abrindo a EVA; sugestão rejeitada pela tela → consulta `cancelled` com o motivo em `resolucao`. Ver `.scratch/lab-brain-aprovacao-eva/issues/05-documentacao-e-teste-ponta-a-ponta.md`. Em produção ainda não foram conferidos o reenvio do mesmo `id_externo` (`200`, mesmo código) nem a consulta depois de mover o card no Kanban; os dois passaram no local. Os itens ficam abertos até o LAB-BRAIN rodar com a chave dele, provavelmente no primeiro chamado real (solicitante: a Suane, do RH).
- 17/11/2026: solicitante do primeiro chamado conferido em produção (`user_profiles`, projeto `jqx`): Suane Batista De Oliveira, RH, ativa, com o e-mail `labrh00421@gmail.com`. Esse é o e-mail principal dela. Ela responde também por `rh@laboratoriolab.com.br`, que não é usuário do FlowLab: o `POST` com ele daria `422`. O LAB-BRAIN deve enviar `solicitante_email: labrh00421@gmail.com`.
