# Integracao Canva Connect API — DashIG

> **Status:** POC / Stub — nenhuma integracao ativa ainda.
> **Data:** 2026-03-31

---

## 1. O que a Canva Connect API oferece

A [Canva Connect API](https://www.canva.dev/docs/connect/) permite que aplicacoes externas interajam programaticamente com o ecossistema Canva:

- **Criacao de designs** a partir de templates existentes
- **Gerenciamento de templates** — listar, filtrar e clonar templates de uma conta/brand
- **Brand Kits** — acessar paletas de cores, fontes e logos configurados na conta Canva
- **Preenchimento de dados (Autofill)** — injetar texto, imagens e dados em campos variaveis de um template
- **Exportacao** — gerar PNG, JPG, PDF ou MP4 a partir de um design finalizado
- **Folders & Assets** — organizar designs em pastas e gerenciar uploads de midia

### Relevancia para o DashIG

O caso de uso principal e automatizar a geracao de assets visuais para campanhas do Instagram da Welcome Weddings:

1. O sistema gera campanhas com posts (caption, visual_brief, formato)
2. Com a integracao Canva, o designer prepararia **templates parametrizados** no Canva
3. O DashIG preencheria automaticamente os campos do template com dados da campanha
4. O resultado seria exportado como imagem/video pronto para agendamento

---

## 2. Fluxo de Autenticacao (OAuth 2.0)

A Canva Connect API usa OAuth 2.0 com PKCE:

1. **Registro do app** no [Canva Developer Portal](https://www.canva.dev/)
2. Redirect do usuario para `https://www.canva.com/api/oauth/authorize` com `client_id`, `redirect_uri`, `scope`, `code_challenge`
3. Usuario autoriza o acesso
4. Callback retorna `authorization_code`
5. Troca do code por `access_token` + `refresh_token` via `POST /api/oauth/token`
6. Access token usado em todas as chamadas subsequentes (Bearer token)

**Scopes necessarios:**
- `design:read` — listar designs e templates
- `design:write` — criar e editar designs
- `asset:read` — acessar brand kit e assets
- `asset:write` — upload de midias

---

## 3. Endpoints-chave para o DashIG

### 3.1 Listar Templates

```
GET /v1/designs?ownership=owned&type=template
Authorization: Bearer {access_token}
```

Retorna templates disponiveis na conta conectada. Permite filtrar por tipo (Instagram Post, Story, Reel).

### 3.2 Criar Design a partir de Template (Autofill)

```
POST /v1/autofill
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "brand_template_id": "DAF...",
  "data": {
    "titulo": "Casamento no Caribe",
    "caption": "Descubra os melhores destinos...",
    "cta": "Saiba mais no link da bio"
  }
}
```

Os campos (`titulo`, `caption`, `cta`) devem corresponder aos campos variaveis definidos no template Canva.

### 3.3 Exportar Design

```
POST /v1/designs/{design_id}/exports
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "format": "png",
  "quality": "high"
}
```

A exportacao e assincrona. Retorna um `export_id` que deve ser consultado:

```
GET /v1/designs/{design_id}/exports/{export_id}
```

Quando `status: "completed"`, o campo `url` contem o link para download.

---

## 4. Pre-requisitos

| Item | Detalhes |
|------|---------|
| Conta Canva | Canva Pro ou Canva for Teams (necessario para Brand Kit e templates avancados) |
| Developer App | Registrar app em [canva.dev](https://www.canva.dev/) |
| Aprovacao | Apps que acessam dados de terceiros precisam de revisao do Canva |
| Env vars | `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_REDIRECT_URI` |
| Templates | Designer precisa criar templates com campos variaveis no Canva |

---

## 5. Estimativa de Esforco

| Fase | Esforco estimado |
|------|-----------------|
| Setup OAuth + token management | 2-3 dias |
| Listagem de templates | 1 dia |
| Autofill (criar design a partir de template) | 2-3 dias |
| Exportacao + polling de status | 1-2 dias |
| UI no DashIG (selecao de template, preview, download) | 3-5 dias |
| Testes e ajustes | 2-3 dias |
| **Total estimado** | **~2-3 semanas** |

---

## 6. Limitacoes e Custos

### Limitacoes
- **Rate limits:** A API tem limites de requisicoes por minuto (varia por plano)
- **Autofill** so funciona com templates que tenham campos variaveis configurados — exige trabalho previo do designer
- **Exportacao assincrona** — nao e instantanea, pode levar alguns segundos
- **Formatos de video** — suporte limitado; templates de video sao mais complexos
- **Sem edicao granular** — a API nao permite editar elementos individuais de um design (apenas preencher campos pre-definidos)

### Custos
- **Canva Pro:** ~R$ 35/mes por usuario (necessario para Brand Kit)
- **Canva for Teams:** ~R$ 50/mes por usuario (recomendado para uso corporativo)
- **API:** Sem custo adicional por chamada no momento (incluso no plano), mas isso pode mudar
- **Canva Connect API** esta em fase de expansao — verificar termos atualizados em [canva.dev/docs/connect](https://www.canva.dev/docs/connect/)

---

## 7. Proximos Passos

1. [ ] Criar conta de desenvolvedor no Canva Developer Portal
2. [ ] Registrar app e obter `client_id` / `client_secret`
3. [ ] Designer criar 2-3 templates de teste com campos variaveis
4. [ ] Implementar fluxo OAuth no DashIG
5. [ ] Conectar stub `lib/canva-client.ts` com chamadas reais
6. [ ] Testar fluxo completo: template -> autofill -> export -> download

---

## Referencia

- Documentacao oficial: https://www.canva.dev/docs/connect/
- API Reference: https://www.canva.dev/docs/connect/api-reference/
- Canva Developer Portal: https://www.canva.dev/
