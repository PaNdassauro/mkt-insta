# Meta App Review — Guia Completo

Guia pratico para submeter o aplicativo DashIG para revisao da Meta e obter as permissoes necessarias para publicacao no Instagram da @welcomeweddings.

---

## Pre-requisitos

Antes de iniciar a submissao, confirme que todos os itens abaixo estao prontos:

- [ ] **Verificacao de Negocio (Business Verification)** concluida no Meta Business Suite
  - Acesse: Meta Business Suite > Configuracoes > Central de Seguranca > Verificacao de Negocio
  - Documentos aceitos: CNPJ, contrato social, conta de luz em nome da empresa
  - Prazo da verificacao: 1-5 dias uteis
- [ ] **Pagina do Facebook** criada e vinculada ao perfil profissional do Instagram (@welcomeweddings)
  - A pagina precisa estar ativa e publica
  - O Instagram deve ser uma conta Profissional (Business ou Creator)
- [ ] **App registrado** no Meta for Developers (developers.facebook.com)
  - Produto "Instagram Graph API" adicionado ao app
  - App configurado com a URL de politica de privacidade
  - App configurado com a URL de termos de uso
  - Icone do app carregado
- [ ] **Token de acesso longo (Long-Lived Token)** funcionando em modo de desenvolvimento
  - Testar chamadas basicas com o Graph API Explorer antes de submeter
- [ ] **URLs publicas de politica de privacidade e termos de uso** da Welcome Weddings hospedadas e acessiveis

---

## Permissoes Necessarias

As seguintes permissoes devem ser solicitadas na App Review:

### 1. `instagram_content_publish`

**Para que serve:** Permite publicar fotos, carrosseis e reels no Instagram via API.

**Endpoints utilizados:**
- `POST /{ig-user-id}/media` — Cria o container de midia
- `POST /{ig-user-id}/media_publish` — Publica o container

**Justificativa sugerida para o formulario:**
> "Nosso aplicativo permite que a equipe de marketing agende e publique conteudo (fotos, carrosseis e reels) diretamente no perfil profissional do Instagram, a partir de um calendario editorial interno. O fluxo de publicacao e: 1) criar um container de midia com imagem/video e caption, 2) publicar o container. Apenas administradores autenticados da conta podem executar publicacoes."

### 2. `pages_read_engagement`

**Para que serve:** Permite ler informacoes da Pagina do Facebook vinculada ao Instagram, necessario para acessar metricas e insights.

**Endpoints utilizados:**
- `GET /{ig-user-id}/insights` — Metricas da conta
- `GET /{media-id}/insights` — Metricas de posts individuais
- `GET /{ig-user-id}/media` — Listagem de posts

**Justificativa sugerida para o formulario:**
> "Nosso aplicativo exibe um painel de metricas (dashboard) para a equipe de marketing acompanhar o desempenho do perfil do Instagram. Coletamos dados como alcance, impressoes, curtidas, comentarios e compartilhamentos para gerar relatorios internos e otimizar a estrategia de conteudo."

---

## Passo a Passo da Submissao

### Passo 1 — Acessar o App Dashboard

1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. Va em "Meus Apps" e selecione o app do DashIG
3. No menu lateral, clique em **App Review > Permissoes e Recursos**

### Passo 2 — Solicitar Permissoes

1. Na lista de permissoes, localize `instagram_content_publish` e clique em **Solicitar**
2. Faca o mesmo para `pages_read_engagement`
3. Para cada permissao, preencha o formulario com:
   - **Descricao detalhada** de como a permissao e usada (use as justificativas acima)
   - **Plataforma:** Web
   - **Instrucoes de teste:** Credenciais de acesso ao DashIG para que o revisor possa verificar o funcionamento

### Passo 3 — Gravar o Screencast

Para cada permissao, a Meta exige um **video (screencast)** demonstrando o uso real. Veja abaixo o que demonstrar em cada video.

### Passo 4 — Enviar para Revisao

1. Revise todos os campos preenchidos
2. Confirme que o video esta anexado a cada permissao
3. Clique em **Enviar para Revisao**

---

## Requisitos do Screencast

A Meta exige um video demonstrando como o app utiliza cada permissao solicitada. Dicas importantes:

### Formato

- Duracao: 1-3 minutos por permissao
- Resolucao minima: 720p
- Formato: MP4 ou link para video hospedado (Loom, YouTube nao listado, Google Drive publico)
- Sem edicao sofisticada necessaria — pode ser gravacao de tela simples

### Video para `instagram_content_publish`

Demonstre o fluxo completo de publicacao:

1. **Login** — Mostre o usuario fazendo login no DashIG
2. **Calendario editorial** — Navegue ate o calendario e abra uma entrada com status "Aprovado"
3. **Edicao do post** — Mostre a caption, hashtags, URL da midia e pre-visualizacao
4. **Publicacao** — Clique no botao "Publicar no Instagram" e mostre a confirmacao
5. **Verificacao** — Abra o Instagram e mostre o post publicado no perfil
6. **Status atualizado** — Volte ao DashIG e mostre o badge "Publicado" com timestamp

### Video para `pages_read_engagement`

Demonstre a leitura de metricas:

1. **Login** — Mostre o usuario fazendo login no DashIG
2. **Dashboard principal** — Mostre as metricas de seguidores, alcance e engajamento
3. **Detalhes de post** — Abra um post e mostre curtidas, comentarios, saves, shares e alcance
4. **Insights de audiencia** — Mostre dados demograficos (cidades, faixa etaria, genero)

### Dicas para Aprovacao

- Narre ou adicione legenda explicando cada acao (pode ser em ingles ou portugues)
- Use dados reais, nao mockados — a Meta verifica se os dados vem de chamadas reais a API
- Mostre claramente que o app so funciona para administradores autenticados
- Nao mostre tokens ou credenciais no video

---

## Prazo Esperado

| Etapa | Prazo |
|-------|-------|
| Verificacao de Negocio | 1-5 dias uteis |
| Revisao do App (primeira submissao) | 2-4 semanas |
| Correcoes e re-submissao (se necessario) | +1-2 semanas |

**Total estimado:** 2-6 semanas dependendo se ha necessidade de ajustes.

A Meta pode solicitar alteracoes ou informacoes adicionais. Nesse caso, voce recebera um email com instrucoes especificas. Responda o mais rapido possivel para nao perder a posicao na fila.

---

## Apos a Aprovacao

Quando o app for aprovado:

### 1. Ativar o Modo Ativo (Live Mode)

- No App Dashboard, mude o app de **Modo de Desenvolvimento** para **Modo Ativo (Live)**
- Isso permite que o app funcione com qualquer usuario autorizado (nao apenas os testadores)

### 2. Gerar o Token de Producao

- Gere um novo Long-Lived User Token via Graph API Explorer
- Ou configure o fluxo de login para obter tokens automaticamente
- Salve o token no DashIG via a tela de configuracoes (Settings)
- O token tem validade de ~60 dias — o DashIG ja possui renovacao automatica

### 3. Testar em Producao

- Publique um post de teste usando o calendario editorial
- Verifique se as metricas estao sendo coletadas corretamente
- Confirme que o cron de auto-publish esta funcionando

### 4. Monitorar Limites

- A API de publicacao tem limite de **25 posts por dia** por conta do Instagram
- O DashIG ja exibe o uso da quota via `content_publishing_limit`
- Monitore os logs para erros de rate limiting

### 5. Manter Conformidade

- Mantenha a politica de privacidade e termos de uso atualizados
- A Meta pode fazer auditorias periodicas — mantenha o app funcional
- Se adicionar novas permissoes no futuro, sera necessaria nova submissao

---

## Checklist Resumido

- [ ] Verificacao de Negocio aprovada
- [ ] Pagina do Facebook vinculada ao Instagram @welcomeweddings
- [ ] App registrado com icone, politica de privacidade e termos de uso
- [ ] Permissao `instagram_content_publish` solicitada com justificativa e screencast
- [ ] Permissao `pages_read_engagement` solicitada com justificativa e screencast
- [ ] Instrucoes de teste fornecidas para o revisor
- [ ] Submissao enviada
- [ ] (Pos-aprovacao) Modo Ativo habilitado
- [ ] (Pos-aprovacao) Token de producao gerado e salvo no DashIG
- [ ] (Pos-aprovacao) Teste de publicacao realizado com sucesso

---

## Links Uteis

- [Meta for Developers — App Dashboard](https://developers.facebook.com/apps/)
- [Documentacao da Instagram Graph API](https://developers.facebook.com/docs/instagram-api/)
- [Content Publishing API](https://developers.facebook.com/docs/instagram-api/guides/content-publishing/)
- [App Review — Guia Oficial](https://developers.facebook.com/docs/app-review/)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Meta Business Suite](https://business.facebook.com/)
