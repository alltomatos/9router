# Mapeamento Arquitetural — 9Router

> **Documento gerado por auditoria estática de código.**
> Repositório: `D:\dev\9router`
> Branch: `master` | Commit: `bffbb389` | Versão: `0.5.112` | Árvore limpa
> Revisão 2 — atualizada após o merge do trabalho multitenant/B2B, MCP nativo, RBAC e upstream v0.5.112.
> Data da revisão: 2026-11-06
> Escopo: inspeção estática do código real, contagens automatizadas e `npm audit`.

**Dimensão:** 1.545 arquivos-fonte, ~219.824 linhas, 183 rotas de API, 26 páginas de dashboard, 146 definições de provedor, 43 arquivos de executor e 422 arquivos de teste/especificação.

---

## 1. Resumo executivo

O 9Router é um **gateway local de IA compatível com OpenAI** (`/v1/*`) com dashboard Next.js, que roteia requisições entre **146 definições de provedores**, traduz formatos (OpenAI/Claude/Gemini/Responses/Cursor/Kiro), gerencia múltiplas contas por provedor, OAuth, refresh de tokens, fallback em cascata, compressão de tokens (RTK/Headroom/Pxpipe) e cobrança/quota multitenant (B2B SaaS). Há dois artefatos no mesmo repositório: o dashboard/gateway (`package.json`) e o launcher CLI publicado como `9router` (`cli/package.json`).

**Maturidade geral:** alta para um projeto desse tipo — há separação real entre app (`src/`) e motor (`open-sse/`), registry config-driven, fallback resiliente, middleware deny-by-default, RBAC/IDOR endurecido e testes em volume. Os riscos concentram-se em **cadeia de suprimentos** (lockfile ausente + 1 CVE crítica no tree instalado), **segredos em texto plano**, **especificações de segurança fora do runner padrão**, **monólitos de UI/executor** e **observabilidade fraca**.

**Três riscos prioritários**
1. `npm audit` no tree instalado: 6 vulnerabilidades — 1 crítica (Next.js), 3 altas (dompurify, node-forge, undici) e 2 moderadas (ip-address, monaco-editor). O `package.json` já declara `next ^16.4.2` e overrides para `dompurify`/`ip-address`, mas `node_modules` ainda contém as versões antigas (Next 16.3.8, Monaco 0.55.1, undici 7.30.0) — é preciso reinstalar e reauditar.
2. Credenciais de provedores e API keys persistidas **sem criptografia** (`src/lib/db/repos/connectionsRepo.js:52-62`, `src/lib/db/repos/apiKeysRepo.js:48,78`).
3. Build não reprodutível: `package-lock.json` está no `.gitignore` (`.gitignore:63`) e o Docker usa `npm install` (`Dockerfile:24`).

**Três pontos fortes**
1. Fronteira arquitetural explícita `src/sse` (glue do app) ↔ `open-sse` (motor agnóstico) documentada em `CLAUDE.md:57-65` e `open-sse/AGENTS.md:1-12`.
2. Resiliência operacional real: fallback de modelo/conta, backoff exponencial e locks por modelo (`open-sse/services/accountFallback.js:20-60`, `src/sse/handlers/chat.js:324-403`).
3. Postura de segurança acima da média: middleware deny-by-default (`src/dashboardGuard.js:200-260`), token de peer não falsificável (`custom-server.js:9-74`), SSRF guard em 3 camadas (`src/shared/utils/ssrfGuard.js:1-15`), lockout progressivo de login (`src/lib/auth/loginLimiter.js:1-45`), RBAC/IDOR em chaves/configurações/provedores e escopo de acesso por API key (`src/sse/services/keyAccess.js`).

---

## 2. Stack técnica

| Camada | Tecnologia | Evidência |
|---|---|---|
| Runtime/linguagem | Node.js ≥18, JavaScript ESM puro (sem TypeScript) | `cli/package.json:44`, `CLAUDE.md:87` |
| Framework web | Next.js 16 (`^16.4.2`; instalado 16.3.8), App Router, standalone output, React 19.2.4 | `package.json:39,45-46`, `next.config.mjs:16` |
| UI | Tailwind CSS v4, PostCSS, Monaco `^0.57.0`, Recharts, @xyflow/react, @dnd-kit, Zustand | `package.json:38,63-72` |
| Server HTTP | `custom-server.js` embrulha o Next standalone; `http` nativo + h2c downgrade | `custom-server.js:52-126` |
| Persistência | SQLite com cadeia de adaptadores: `bun:sqlite` → `better-sqlite3` → `node:sqlite` → `sql.js` | `src/lib/db/driver.js:44-59` |
| Migrações/Esquema | Schema declarativo + migrações versionadas (inclui multitenancy) | `src/lib/db/schema.js:1-187`, `src/lib/db/migrations/001-initial.js`, `002-multitenancy.js` |
| Auth | JWT HS256 em cookie httpOnly, bcrypt, OIDC, SAML | `src/lib/auth/dashboardSession.js:22-69`, `src/lib/auth/oidc.js`, `src/lib/auth/saml.js` |
| Criptografia auxiliar | `jose`, `node-forge` | `package.json:36-37` |
| Rede | `undici ^7.30.1`, `socks-proxy-agent` | `package.json:50-51` |
| Dependências opcionais | `@aws-sdk/credential-providers`, `ajv`, `better-sqlite3`, `ws` (instaladas por padrão, carregadas sob demanda) | `package.json:54-61` |
| Runtime sob demanda | `playwright-core` e `wreq-js` baixados na primeira utilização para `<DATA_DIR>/runtime` | `package.json:63-70` |
| Overrides de segurança | `dompurify ^3.4.17`, `ip-address ^10.7.4` | `package.json:72-75` |
| Motor SSE | `open-sse/` próprio (providers, executors, translators, RTK) | `open-sse/index.js`, `open-sse/AGENTS.md` |
| MCP nativo | Engine JSON-RPC 2.0 própria + transportes stdio/SSE | `src/mcp/engine.js`, `src/app/api/mcp/native/*` |
| Testes | Vitest 4 em pacote ESM separado | `tests/package.json:6-9`, `tests/vitest.config.js:1-24` |
| Lint | ESLint 9 + `eslint-config-next` (sem script no `package.json`) | `eslint.config.mjs:1-13`, `package.json:6-17` |
| Build/Deploy | `next build --webpack`, Docker multi-stage Alpine, compose com Headroom em loopback | `package.json:9-10`, `Dockerfile:1-93`, `docker-compose.yml:26` |
| CLI | Pacote npm independente, menu interativo, tray (PowerShell/Go) | `cli/package.json:2-27`, `cli/cli.js` |

**Mudanças relevantes desde a revisão 1:** removidas `express`, `http-proxy-middleware`, `react-is` e `selfsigned`; adicionadas `enquirer`, dependências opcionais AWS/Ajv/ws, `playwright-core`/`wreq-js` em dev e `overrides` para dompurify/ip-address. O `package.json` raiz continua **sem `engines`** e sem scripts `lint`/`test`.

---

## 3. Estrutura do projeto

```
9router/
├─ src/                    # Next.js: dashboard + APIs de gestão + compat APIs
│  ├─ app/(dashboard)/     # 26 páginas (providers, combos, usage, users, client, mcp...)
│  ├─ app/api/             # 183 rotas route.js
│  │  ├─ v1/, v1beta/      # superfície compatível (OpenAI/Claude/Gemini/Responses)
│  │  ├─ providers/, oauth/, keys/, combos/, usage/, users/, client/, settings/
│  │  └─ cli-tools/ (30+), tunnel/, proxy-pools/ (Webshare/Netlify), mcp/ (nativo), headroom/, pxpipe/
│  ├─ sse/                 # glue do app: handlers + auth + keyAccess + refresh + model
│  ├─ lib/                 # db, auth, oauth, tunnel, network, updater
│  ├─ mcp/                 # engine MCP, tools, transportes stdio/SSE
│  ├─ mitm/                # proxy MITM (CA, DNS, servidor)
│  ├─ shared/              # componentes, constantes, utils
│  └─ proxy.js             # middleware de entrada
├─ open-sse/               # motor agnóstico
│  ├─ providers/registry/  # 146 definições de provedor (index.js gerado)
│  ├─ executors/           # 43 arquivos (base/index/default + especializados)
│  ├─ translator/          # 12 request + 10 response + schema/concerns
│  ├─ handlers/            # chat, imagem, áudio, embeddings, busca, vídeo
│  ├─ services/            # combo, fallback, token refresh, usage (22 provedores)
│  ├─ rtk/                 # 24 arquivos de compressão de tokens
│  └─ utils/               # stream, sse, proxyFetch, protobuf...
├─ cli/                    # launcher npm + tray + comandos
├─ tests/                  # 419 .test.js (Vitest) + 1 .test.mjs + 2 .spec.sec.mjs (node:test)
├─ scripts/                # geração de registry, assets, migrações
└─ docs/ARCHITECTURE.md    # doc arquitetural (desatualizada)
```

**Fluxo de requisição**
1. `/v1/*` é reescrito para `/api/v1/*` (`next.config.mjs:61-99`).
2. `src/app/api/v1/chat/completions/route.js:31-33` inicializa tradutores e chama `handleChat`.
3. `src/sse/handlers/chat.js:37` autentica API key, valida quota/whitelist multitenant (`:90-139`) e escopo por chave (`:149-151`), expande combos (`:161-230` e `:249-296`) e seleciona conta (`:324-403`).
4. `open-sse/handlers/chatCore.js` detecta formato, aplica hooks RTK e delega ao executor.
5. `open-sse/executors/*` chama o upstream; `open-sse/translator/*` converte a resposta; SSE volta ao cliente.

**Comunicação entre camadas:** `src/sse` importa `open-sse` diretamente por alias (`@/` → `src/`, `open-sse/` → `open-sse/`); a persistência é acessada por barris (`src/lib/db/index.js`) com `src/lib/localDb.js` como shim legado (`src/lib/localDb.js:1-3`).

---

## 4. Funcionalidades implementadas

| # | Funcionalidade | Propósito | Onde está |
|---|---|---|---|
| 1 | Gateway OpenAI-compatible | Ponto único `/v1` para Claude Code, Codex, Cursor, Cline etc. | `src/app/api/v1/*` (23 rotas), rewrites em `next.config.mjs:61-99` |
| 2 | Superfície multi-formato | Chat, Responses, Messages, embeddings, imagens, áudio, vídeo, busca | `src/app/api/v1/messages`, `responses`, `images`, `audio`, `videos`, `search`, `embeddings` |
| 3 | Registry de 146 provedores | Catálogo config-driven de upstreams | `open-sse/providers/registry/` (146 arquivos), `open-sse/providers/capabilities.js` |
| 4 | Executores especializados | Protocolos binários/protobuf/NDJSON (Kiro, Cursor, Codex, Gemini CLI, Qoder...) | `open-sse/executors/` (43 arquivos) |
| 5 | Tradução de formatos | Conversão request/response com rotas diretas para pares frágeis | `open-sse/translator/request` (12), `response` (10), `translator/index.js` |
| 6 | Combos de modelos | Cadeia de fallback entre modelos, com estratégias (`fallback`, `fusion`) | `open-sse/services/combo.js:1-19`, `src/sse/handlers/chat.js:161-230` |
| 7 | Fallback de contas | Rotação por erro/429/401, backoff exponencial, lock por modelo | `open-sse/services/accountFallback.js:20-60`, `src/sse/services/auth.js:10-90` |
| 8 | OAuth multi-provedor | Login interativo, device-code, PKCE, callbacks locais | `src/lib/oauth/providers/` (41 arquivos), `src/lib/oauth/services/` |
| 9 | Refresh automático de tokens | Renovação em background e sob demanda | `src/sse/services/backgroundTokenRefresh.js`, `open-sse/services/tokenRefresh/providers.js` |
| 10 | RTK Token Saver | Compressão de `tool_result` antes da tradução, fail-open | `open-sse/rtk/` (24 arquivos, incluindo 12 filtros) |
| 11 | Headroom/Pxpipe/Caveman/Ponytail | Compressão externa e injeção de sistema | `src/lib/headroom/`, `src/lib/pxpipe/`, `open-sse/rtk/headroom.js`, `caveman.js`, `ponytail.js` |
| 12 | Uso, custo e quota | Histórico, custo por modelo, quota por provedor | `src/lib/db/repos/usageRepo.js`, `open-sse/services/usage/` (22 arquivos) |
| 13 | Multitenancy B2B | Usuários, papéis, orçamento mensal, whitelist de modelos/combos | `src/lib/db/migrations/002-multitenancy.js:1-20`, `src/lib/db/repos/usersRepo.js`, `chat.js:90-139` |
| 14 | Portal do cliente e admin de usuários | Dashboard do tenant, consumo próprio e CRUD administrativo | `src/app/(dashboard)/dashboard/client/page.js`, `.../users/page.js`, `src/app/api/users/*`, `src/app/api/client/usage/route.js`, `src/app/api/auth/me/route.js` |
| 15 | Escopo de acesso por API key | Restringe modelos/provedores por chave, além da whitelist do usuário | `src/sse/services/keyAccess.js` (188 linhas), `src/shared/utils/keyAccess.js`, `src/shared/constants/keyAccess.js`, `chat.js:149-167` |
| 16 | Gestão de chaves/API keys | Criação, validação e escopo por usuário | `src/app/api/keys/*`, `src/lib/db/repos/apiKeysRepo.js` |
| 17 | MCP nativo | Servidor MCP JSON-RPC 2.0 com ferramentas admin/mídia/web/embeddings e transportes stdio/SSE | `src/mcp/engine.js`, `src/mcp/tools/*`, `src/app/api/mcp/native/{sse,message,tools}`, `tests/unit/mcp-native.test.js` |
| 18 | Configuração de CLIs | Escrita de settings para 30+ ferramentas (Claude, Codex, Cursor, Cline, Hermes...) | `src/app/api/cli-tools/` (30+ rotas) |
| 19 | Bridge MCP legado | Converte MCP remoto (SSE) em stdio local | `src/lib/mcp/stdioSseBridge.js`, `src/app/api/mcp/[plugin]` |
| 20 | MITM local | Interceptação TLS para ferramentas que não aceitam base URL | `src/mitm/manager.js` (803 linhas), `src/mitm/server.js` |
| 21 | Túneis e proxy pools | Cloudflare Tunnel, Tailscale, Webshare (import/sync), Netlify/Cloudflare/Deno/Vercel deploy | `src/lib/tunnel/*`, `src/app/api/proxy-pools/*`, `src/lib/network/*` |
| 22 | Credenciais AWS Bedrock | Perfil/SSO via SDK carregado sob demanda; chaves estáticas não carregam o SDK | `package.json:55`, `next.config.mjs:29`, `open-sse/shared/awsCredentials.js` (lazy) |
| 23 | Runtime sob demanda | Playwright-core/wreq-js baixados na primeira utilização (navegador/stealth) | `package.json:67-70`, `open-sse/services/lazyRuntime.js` |
| 24 | Dashboard operacional | Providers, combos, uso, quotas, proxy pools, token saver, usuários, cliente, MCP | `src/app/(dashboard)/dashboard/` (26 páginas) |
| 25 | Launcher CLI | Instala, inicia servidor, menu, tray, autostart | `cli/cli.js`, `cli/src/cli/*`, `cli/hooks/*` |

---

## 5. Pontos fortes

### Arquitetura
- Fronteira clara app ↔ motor, com convenções próprias do motor (`CLAUDE.md:57-65`, `open-sse/AGENTS.md:1-12`).
- Registry de provedores config-driven e gerado por script, não editado à mão (`CLAUDE.md:72-74`).
- Tradutores com rotas diretas para evitar o pivô lossy via OpenAI (`CLAUDE.md:68-70`).
- Persistência com cadeia de fallback de drivers que funciona sem toolchain nativa (`src/lib/db/driver.js:44-59`).
- Migrações versionadas e esquema declarativo com índices relevantes (`src/lib/db/schema.js:48-187`).
- MCP nativo implementado como engine isolada, com transportes separados (`src/mcp/engine.js`, `src/mcp/transport/*`).

### Resiliência
- Fallback em dois níveis (modelo → conta) com classificação de erro por status/texto (`open-sse/services/accountFallback.js:20-60`).
- Cooldown exponencial e locks por modelo para não derrubar conta saudável (`chat.js:324-403`).
- Refresh de token com deduplicação (`open-sse/services/tokenRefresh/dedup.js`).
- RTK e savers são explicitamente fail-open (`open-sse/AGENTS.md:35-37`).
- Dependências pesadas movidas para carregamento opcional/sob demanda (AWS SDK, Playwright/wreq), reduzindo o install padrão.

### Segurança
- Middleware deny-by-default para `/api/*`, allowlist pública explícita (`src/dashboardGuard.js:200-260`).
- IP real derivado do socket TCP e `X-Forwarded-For` descartado, com token de peer por processo (`custom-server.js:9-74`, `src/lib/auth/trustedPeer.js:1-7`).
- Lockout progressivo de login (5 falhas → 30s…30min) (`src/lib/auth/loginLimiter.js:1-45`).
- Bloqueio de senha padrão para acesso remoto (`src/app/api/auth/login/route.js:79-90`).
- SSRF guard em 3 camadas, incluindo DNS e redirects (`src/shared/utils/ssrfGuard.js:1-15`).
- RBAC/IDOR aplicado em chaves/configurações/provedores e escopo por API key (`src/app/api/keys/[id]/route.js:7-18`, `src/app/api/providers/route.js`, `src/app/api/settings/route.js`, `src/sse/services/keyAccess.js`).
- Rotas que geram processos/leem segredos do host restritas a localhost/CLI token (`src/dashboardGuard.js:63-91`).
- `requireApiKey` e `requireLogin` habilitados por padrão (`src/lib/db/repos/settingsRepo.js` defaults).
- Headroom exposto apenas em loopback no compose (`docker-compose.yml:26`).
- Existem especificações de segurança negativa (RBAC/IDOR e multitenant) em `tests/unit/rbac-idor-security.spec.sec.mjs` e `tests/unit/multitenant-security.spec.sec.mjs`.

### Qualidade e testes
- 419 arquivos `.test.js` executáveis pelo Vitest, além de 2 especificações de segurança e 1 `.test.mjs`.
- Baselines de regressão (`tests/__baseline__/verify-*.mjs`) e testes de repositório de usuários.
- Documentação operacional incomum para o porte: `CLAUDE.md`, `open-sse/AGENTS.md`, `DEVELOPER-ROADMAP.md`, `docs/ARCHITECTURE.md` (parcialmente desatualizada).
- Build Docker multi-stage e healthcheck operacional documentado (`Dockerfile:1-93`, `DOCKER.md`).

---

## 6. Pontos fracos e dívidas técnicas

### 6.1 Segurança e cadeia de suprimentos

| Severidade | Achado | Evidência |
|---|---|---|
| Crítico | `npm audit` no tree instalado aponta 1 crítica (Next.js 16.3.8) + 3 altas (dompurify, node-forge, undici) + 2 moderadas (ip-address, monaco-editor). O `package.json` já declara versões/overrides corretivos, mas `node_modules` não foi reinstalado | `npm audit`, `package.json:38-39,50,72-75` |
| Alto | Credenciais de provedores (`accessToken`, `refreshToken`, `apiKey`, `idToken`) persistidas em JSON sem criptografia | `src/lib/db/repos/connectionsRepo.js:52-62` |
| Alto | API keys armazenadas em texto plano e validadas por igualdade SQL | `src/lib/db/repos/apiKeysRepo.js:48,78` |
| Alto | `keyId` gerado com `Math.random()` (não criptográfico) e secret HMAC com fallback fixo | `src/shared/utils/apiKey.js:3,8-12` |
| Médio | Diretório de dados criado com permissões padrão do processo, sem `0700` | `src/lib/db/paths.js:16-19` |
| Médio | 20+ rotas usam `child_process` (`exec`, `execSync`) para escrever configs/instalar túneis; superfície ampla | `src/app/api/cli-tools/*/route.js`, `src/app/api/tunnel/tailscale-install/route.js:4` |
| Baixo | CORS `*` no endpoint de chat; mitigado pela checagem de `Origin` loopback no guard | `src/app/api/v1/chat/completions/route.js:19-27`, `src/dashboardGuard.js:117-125` |
| Médio | Sem lockfile versionado e Docker usando `npm install` com dependências em caret | `.gitignore:63`, `Dockerfile:24`, `package.json:22-52` |
| Médio | `node_modules` local está atrás do `package.json` (Next 16.3.8 vs `^16.4.2`), mascarando o estado real de segurança até um novo install | `node_modules/next/package.json`, `package.json:39` |

### 6.2 Arquitetura e acoplamento

- **Monólitos de UI e executor** (violam SRP e dificultam teste):
  - `src/app/(dashboard)/dashboard/providers/[id]/page.js` — 1.885 linhas
  - `src/app/(dashboard)/dashboard/usage/components/ProviderLimits/index.js` — 1.591
  - `src/app/(dashboard)/dashboard/profile/page.js` — 1.577
  - `src/app/(dashboard)/dashboard/proxy-pools/page.js` — 1.436
  - `open-sse/executors/cursor.js` — 1.323; `open-sse/executors/kiro.js` — 1.146
  - `src/app/(dashboard)/dashboard/combos/page.js` — 1.290; `EndpointPageClient.js` — 1.255
- **Duplicação de lógica de combo**: o bloco de expansão/estratégia aparece duas vezes em `src/sse/handlers/chat.js:161-230` e `:249-296`.
- **Mutex global de seleção de conta**: serializa a escolha de credenciais de *todos* os provedores, criando gargalo de throughput sob concorrência (`src/sse/services/auth.js:10,36-38`).
- **Patch global de `fetch`**: `open-sse/utils/proxyFetch.js:422` substitui `globalThis.fetch` no import, acoplando comportamento de rede a efeitos colaterais de módulo.

### 6.3 Testes e qualidade

- **Especificações de segurança não são executadas**: `tests/unit/rbac-idor-security.spec.sec.mjs` e `tests/unit/multitenant-security.spec.sec.mjs` usam `node:test`, mas o `tests/vitest.config.js:8` coleta apenas `**/*.test.js`; nenhum script/CI as executa. O `.test.mjs` também fica fora do include.
- A suíte **não é executável pela raiz**: não existe script `test`/`lint` no `package.json:6-17`; é preciso `cd tests && npx vitest` (`CLAUDE.md:34-41`).
- A suíte **não é verde no checkout**: ~938 passam e ~64 falham, com 26 falhas catalogadas (`CLAUDE.md:43-47`, `tests/__baseline__/known-fails.txt`).
- **Sem cobertura configurada**: `tests/vitest.config.js:8-22` não define `coverage` nem thresholds.
- **Sem CI de qualidade**: os únicos workflows são Docker, GitBook e tray (`.github/workflows/`); não há lint, testes nem auditoria de dependências no PR.
- **423 `console.log`** em `src/` + `open-sse/` (era 366), convivendo com um logger que também escreve em `console` (`src/sse/utils/logger.js:38-42`), sem logs estruturados, request-id ou métricas.

### 6.4 Documentação e operação

- `docs/ARCHITECTURE.md` descreve persistência em `db.json`/`usage.json` (`docs/ARCHITECTURE.md:59,141,147,380`), mas a implementação real é SQLite (`src/lib/db/paths.js:8`); o próprio `CLAUDE.md:76` admite que o doc está desatualizado.
- `docs/ARCHITECTURE.md:157-161` documenta cloud sync (`src/app/api/sync`, `src/shared/services/cloudSyncScheduler.js`), mas **não existe mais** diretório `sync`/`cloud` em `src/app/api`.
- `package.json` raiz **sem `engines`**, permitindo instalação em versões onde o driver nativo é desativado (`src/lib/db/driver.js:20-24`).
- Todo o diretório `docs/*` é ignorado pelo Git, exceto exceções (`.gitignore`), o que favorece drift entre código e documentação.

### 6.5 Desempenho e escalabilidade

- Agregações de uso feitas em JavaScript sobre todas as linhas filtradas (`src/lib/db/repos/usageRepo.js:343,469-539`), com ring buffer em memória de apenas 50 itens (`:14`) e agregados diários em blobs JSON (`usageDaily` em `src/lib/db/schema.js`). Isso não escala para alto volume nem permite consultas analíticas eficientes.
- `getProviderConnections` carrega todas as conexões do provedor e ordena em JS (`src/lib/db/repos/connectionsRepo.js`), em vez de ordenar no SQL.
- `getSettings()` é chamado múltiplas vezes por requisição (`src/sse/handlers/chat.js:77,251,363`), sem cache curto por request.
- Seleção de conta sob mutex global (ver 6.2) é o principal limitador de concorrência do gateway.

### 6.6 Inconsistências menores

- `src/app/api/v1/route.js:1` apenas reexporta `/models`, enquanto a documentação o descreve como lista estática (drift menor).
- `tests/unit/mcp-validation.mjs` é um script de validação manual, não integrado ao runner.
- `src/mcp/engine.js:4` anuncia `SERVER_VERSION = "0.5.81"` enquanto o pacote está em `0.5.112`; o handshake MCP reporta versão defasada.

---

## 7. Melhorias recomendadas (priorizadas)

| Prioridade | Ação | Impacto | Esforço | Evidência-base |
|---|---|---|---|---|
| **P0** | Rodar `npm install` para materializar `next ^16.4.2`/overrides, reexecutar `npm audit` e corrigir o que restar | Fecha a CVE crítica e as altas no tree real | Baixo | `npm audit`, `package.json:38-39,72-75` |
| **P0** | Commitar `package-lock.json`, trocar Docker para `npm ci` e adicionar `npm audit` no CI | Builds reprodutíveis e bloqueio de regressão de dependências | Baixo | `.gitignore:63`, `Dockerfile:24` |
| **P0** | Criptografar segredos em repouso (AES-256-GCM com chave em env/OS keychain); armazenar hash das API keys em vez do valor; `chmod 0700` no `DATA_DIR` | Reduz impacto de vazamento do SQLite | Médio | `connectionsRepo.js:52-62`, `apiKeysRepo.js:48,78`, `paths.js:16-19` |
| **P0** | Trocar `Math.random()` por `crypto.randomBytes` e remover fallback do `API_KEY_SECRET` (fail-closed) | Elimina previsibilidade de chaves | Baixo | `apiKey.js:3,8-12` |
| **P1** | Incluir `**/*.spec.sec.mjs` no Vitest (ou converter para Vitest) e rodar no CI | Ativa os testes de RBAC/IDOR/multitenant que hoje não executam | Baixo | `tests/vitest.config.js:8`, `tests/unit/*.spec.sec.mjs` |
| **P1** | Criar scripts `lint`/`test` na raiz e pipeline CI com ESLint + Vitest + baseline + secret scan | Impede regressões e reduz dívida invisível | Baixo | `package.json:6-17`, `CLAUDE.md:34-47`, `.github/workflows/` |
| **P1** | Substituir o mutex global por lock por provedor/conexão | Aumenta throughput e isola falhas | Médio | `src/sse/services/auth.js:10,36-38` |
| **P1** | Quebrar monólitos (>250 linhas) em hooks/componentes no front e em submódulos no executor | Testabilidade, revisão e redução de risco | Alto | arquivos de 1.146–1.885 linhas |
| **P1** | Deduplicar a lógica de combo em `chat.js` | Remove divergência de comportamento | Baixo | `chat.js:161-230` vs `:249-296` |
| **P2** | Logs estruturados (JSON) com request-id, níveis e métricas golden signals; substituir `console.log` pelo logger | Operação e debugging em produção | Médio | 423 `console.log`, `logger.js:38-42` |
| **P2** | Reescrever `docs/ARCHITECTURE.md` para SQLite e remover seções de cloud sync inexistente | Elimina decisões baseadas em doc falso | Baixo | `docs/ARCHITECTURE.md:59,141,157-161` |
| **P2** | Pré-agregar uso (tabelas diárias/horárias) e paginar consultas; mover ordenação para SQL | Escala analítica e menor latência | Médio | `usageRepo.js:343,469-539`, `connectionsRepo.js` |
| **P2** | Adicionar `engines` na raiz e documentar matriz Node/Bun | Evita runtime inconsistente | Baixo | `package.json` (ausente), `driver.js:20-24` |
| **P3** | Introduzir TypeScript gradual ou `// @ts-check` + JSDoc nos contratos de request/response | Segurança de tipos sem reescrita | Alto | `CLAUDE.md:87` |
| **P3** | Configurar cobertura com thresholds no Vitest | Torna a dívida de testes mensurável | Baixo | `tests/vitest.config.js:8-22` |
| **P3** | Automatizar atualização de dependências (Dependabot/Renovate) | Reduz janela de exposição a CVEs | Baixo | `.github/workflows/` |

---

## 8. Como reproduzir as medições

```powershell
# contagens
Get-ChildItem src,open-sse,cli,tests -Recurse -File -Include *.js,*.mjs |
  Where-Object { $_.FullName -notmatch 'node_modules|\.next' }

# materializar e auditar dependências
npm install
npm audit --omit=dev

# testes (pacote separado)
cd tests; npx vitest run

# especificações de segurança (node:test, fora do Vitest)
node --test tests/unit/rbac-idor-security.spec.sec.mjs tests/unit/multitenant-security.spec.sec.mjs

# baseline de regressão
node tests/__baseline__/verify-no-regression.mjs
```

---

## 9. Ressalva metodológica

A análise é estática; o gateway e a suíte completa não foram executados. O `npm audit` reflete a árvore de `node_modules` instalada neste checkout (que está atrás do `package.json`) e pode variar após `npm install` e com atualizações de advisory. As falhas de teste citadas vêm da documentação do próprio repositório (`CLAUDE.md:43-47`) e do `known-fails.txt`.

---

## 10. Histórico de revisões

| Revisão | Data | Base | Mudanças |
|---|---|---|---|
| 1 | 2026-11-06 | `33a7888f` / v0.5.95 | Auditoria inicial: 1.338 arquivos, ~182.767 LOC, 180 rotas, 132 provedores, 330 testes |
| 2 | 2026-11-06 | `bffbb389` / v0.5.112 | Atualização pós-merge: 1.545 arquivos, ~219.824 LOC, 183 rotas, 146 provedores, 43 executores, 422 testes; novas features (MCP nativo, portal do cliente, key access, Webshare/Netlify, runtime sob demanda); correção do achado de testes de autorização; atualização de CVEs, versões e monólitos |
