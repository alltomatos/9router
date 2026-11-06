# Mapeamento Arquitetural — 9Router

> **Documento gerado por auditoria estática de código.**
> Repositório: `D:\dev\9router`
> Branch: `master` | Commit: `33a7888f` | Versão: `0.5.95` | Árvore limpa
> Data da análise: 2026-11-06
> Escopo: inspeção estática do código real, contagens automatizadas e `npm audit`.

**Dimensão:** 1.338 arquivos-fonte, ~182.767 linhas, 180 rotas de API, 26 páginas de dashboard, 330 arquivos de teste.

---

## 1. Resumo executivo

O 9Router é um **gateway local de IA compatível com OpenAI** (`/v1/*`) com dashboard Next.js, que roteia requisições entre ~132 definições de provedores, traduz formatos (OpenAI/Claude/Gemini/Responses/Cursor/Kiro), gerencia múltiplas contas por provedor, OAuth, refresh de tokens, fallback em cascata, compressão de tokens (RTK/Headroom/Pxpipe) e cobrança/quota multitenant (B2B SaaS). Há dois artefatos no mesmo repositório: o dashboard/gateway (`package.json`) e o launcher CLI publicado como `9router` (`cli/package.json`).

**Maturidade geral:** alta para um projeto desse tipo — há separação real entre app (`src/`) e motor (`open-sse/`), registry config-driven, fallback resiliente, middleware deny-by-default e testes em volume. Os riscos concentram-se em **cadeia de suprimentos** (lockfile ausente + 1 CVE crítica), **segredos em texto plano**, **monólitos de UI/executor**, **suíte de testes não executável pela raiz e não verde** e **observabilidade fraca**.

**Três riscos prioritários**
1. `npm audit`: 1 crítica (Next.js), 5 altas (undici, node-forge, body-parser, follow-redirects, dompurify) e 3 moderadas (`package.json:40` usa faixa `^16.1.6`; instalado 16.3.8).
2. Credenciais de provedores e API keys persistidas **sem criptografia** (`src/lib/db/repos/connectionsRepo.js:49-59`, `src/lib/db/repos/apiKeysRepo.js:48,78`).
3. Build não reprodutível: `package-lock.json` está no `.gitignore` (`.gitignore:63`) e o Docker usa `npm install` (`Dockerfile:24`).

**Três pontos fortes**
1. Fronteira arquitetural explícita `src/sse` (glue do app) ↔ `open-sse` (motor agnóstico) documentada em `CLAUDE.md:57-65` e `open-sse/AGENTS.md:1-12`.
2. Resiliência operacional real: fallback de modelo/conta, backoff exponencial e locks por modelo (`open-sse/services/accountFallback.js:20-60`, `src/sse/handlers/chat.js:367-391`).
3. Postura de segurança acima da média: middleware deny-by-default (`src/dashboardGuard.js:200-260`), token de peer não falsificável (`custom-server.js:9-74`), SSRF guard em 3 camadas (`src/shared/utils/ssrfGuard.js:1-15`) e lockout progressivo de login (`src/lib/auth/loginLimiter.js:1-45`).

---

## 2. Stack técnica

| Camada | Tecnologia | Evidência |
|---|---|---|
| Runtime/linguagem | Node.js ≥18, JavaScript ESM puro (sem TypeScript) | `cli/package.json:44`, `CLAUDE.md:87` |
| Framework web | Next.js 16 (App Router, standalone output) + React 19.2.4 | `package.json:40,46-47`, `next.config.mjs:16` |
| UI | Tailwind CSS v4, PostCSS, Monaco, Recharts, @xyflow/react, @dnd-kit, Zustand | `package.json:22-56,61-66` |
| Server HTTP | `custom-server.js` embrulha o Next standalone; `http` nativo + h2c downgrade | `custom-server.js:52-126` |
| Persistência | SQLite com cadeia de adaptadores: `bun:sqlite` → `better-sqlite3` → `node:sqlite` → `sql.js` | `src/lib/db/driver.js:44-59` |
| Migrações/Esquema | Schema declarativo + migrações versionadas | `src/lib/db/schema.js:1-185`, `src/lib/db/migrations/001-initial.js`, `002-multitenancy.js` |
| Auth | JWT HS256 em cookie httpOnly, bcrypt, OIDC, SAML | `src/lib/auth/dashboardSession.js:22-69`, `src/lib/auth/oidc.js`, `src/lib/auth/saml.js` |
| Criptografia auxiliar | `jose`, `node-forge`, `selfsigned` | `package.json:36,41,50` |
| Rede | `undici`, `socks-proxy-agent`, `http-proxy-middleware` | `package.json:35,51,53` |
| Motor SSE | `open-sse/` próprio (providers, executors, translators, RTK) | `open-sse/index.js`, `open-sse/AGENTS.md` |
| Testes | Vitest 4 em pacote ESM separado | `tests/package.json:6-9`, `tests/vitest.config.js:1-24` |
| Lint | ESLint 9 + `eslint-config-next` (sem script no `package.json`) | `eslint.config.mjs:1-13`, `package.json:6-17` |
| Build/Deploy | `next build --webpack`, Docker multi-stage Alpine, compose com Headroom | `package.json:9-10`, `Dockerfile:1-93`, `docker-compose.yml:1-24` |
| CLI | Pacote npm independente, menu interativo, tray (PowerShell/Go) | `cli/package.json:2-27`, `cli/cli.js` |

**Observações de versão:** `package.json` declara `next ^16.1.6`, mas o ambiente tem **16.3.8**; não há campo `engines` no `package.json` raiz, embora o CLI exija Node ≥18 (`cli/package.json:44`) e o driver desative `better-sqlite3` em Node ≥24 (`src/lib/db/driver.js:20-24`).

---

## 3. Estrutura do projeto

```
9router/
├─ src/                    # Next.js: dashboard + APIs de gestão + compat APIs
│  ├─ app/(dashboard)/     # 26 páginas (providers, combos, usage, proxy-pools, cli-tools...)
│  ├─ app/api/             # 180 rotas route.js
│  │  ├─ v1/, v1beta/      # superfície compatível (OpenAI/Claude/Gemini/Responses)
│  │  ├─ providers/, oauth/, keys/, combos/, usage/, users/, settings/
│  │  └─ cli-tools/ (30), tunnel/, proxy-pools/, mcp/, headroom/, pxpipe/
│  ├─ sse/                 # glue do app: handlers + auth + refresh + model
│  ├─ lib/                 # db, auth, oauth, tunnel, mitm-adjacent, network, updater
│  ├─ mitm/                # proxy MITM (CA, DNS, servidor)
│  ├─ shared/              # componentes, constantes, utils
│  └─ proxy.js             # middleware de entrada
├─ open-sse/               # motor agnóstico
│  ├─ providers/registry/  # 132 definições de provedor (index.js gerado)
│  ├─ executors/           # 31 arquivos (default + 27 especializados)
│  ├─ translator/          # 12 request + 10 response + schema/concerns
│  ├─ handlers/            # chat, imagem, áudio, embeddings, busca, vídeo
│  ├─ services/            # combo, fallback, token refresh, usage (22 provedores)
│  ├─ rtk/                 # 24 arquivos de compressão de tokens
│  └─ utils/               # stream, sse, proxyFetch, protobuf...
├─ cli/                    # launcher npm + tray + comandos
├─ tests/                  # 330 arquivos (299 unit, 36 translator, auth, baseline)
├─ scripts/                # geração de registry, assets, migrações
└─ docs/ARCHITECTURE.md    # doc arquitetural (desatualizada)
```

**Fluxo de requisição**
1. `/v1/*` é reescrito para `/api/v1/*` (`next.config.mjs:61-99`).
2. `src/app/api/v1/chat/completions/route.js:29-33` inicializa tradutores e chama `handleChat`.
3. `src/sse/handlers/chat.js:34` autentica API key, valida quota/whitelist multitenant (`:84-133`), expande combos (`:148-191`) e seleciona conta (`:286-394`).
4. `open-sse/handlers/chatCore.js` detecta formato, aplica hooks RTK e delega ao executor.
5. `open-sse/executors/*` chama o upstream; `open-sse/translator/*` converte a resposta; SSE volta ao cliente.

**Comunicação entre camadas:** `src/sse` importa `open-sse` diretamente por alias (`@/` → `src/`, `open-sse/` → `open-sse/`); a persistência é acessada por barris (`src/lib/db/index.js`) com `src/lib/localDb.js` como shim legado (`src/lib/localDb.js:1-3`).

---

## 4. Funcionalidades implementadas

| # | Funcionalidade | Propósito | Onde está |
|---|---|---|---|
| 1 | Gateway OpenAI-compatible | Ponto único `/v1` para Claude Code, Codex, Cursor, Cline etc. | `src/app/api/v1/*` (23 rotas), rewrites em `next.config.mjs:61-99` |
| 2 | Superfície multi-formato | Chat, Responses, Messages, embeddings, imagens, áudio, vídeo, busca | `src/app/api/v1/messages`, `responses`, `images`, `audio`, `videos`, `search`, `embeddings` |
| 3 | Registry de 132 provedores | Catálogo config-driven de upstreams | `open-sse/providers/registry/` (132 arquivos), `open-sse/providers/capabilities.js` |
| 4 | Executores especializados | Protocolos binários/protobuf/NDJSON (Kiro, Cursor, Codex, Gemini CLI, Qoder...) | `open-sse/executors/` (31 arquivos; ex.: `kiro.js`, `cursor.js`) |
| 5 | Tradução de formatos | Conversão request/response com rotas diretas para pares frágeis | `open-sse/translator/request` (12), `response` (10), `translator/index.js` |
| 6 | Combos de modelos | Cadeia de fallback entre modelos, com estratégias (`fallback`, `fusion`) | `open-sse/services/combo.js:1-19`, `src/sse/handlers/chat.js:148-191` |
| 7 | Fallback de contas | Rotação por erro/429/401, backoff exponencial, lock por modelo | `open-sse/services/accountFallback.js:20-60`, `src/sse/services/auth.js:10-90` |
| 8 | OAuth multi-provedor | Login interativo, device-code, PKCE, callbacks locais | `src/lib/oauth/providers/` (41 arquivos), `src/lib/oauth/services/` |
| 9 | Refresh automático de tokens | Renovação em background e sob demanda | `src/sse/services/backgroundTokenRefresh.js`, `open-sse/services/tokenRefresh/providers.js` |
| 10 | RTK Token Saver | Compressão de `tool_result` antes da tradução, fail-open | `open-sse/rtk/` (24 arquivos + 12 filtros) |
| 11 | Headroom/Pxpipe/Caveman/Ponytail | Compressão externa e injeção de sistema | `src/lib/headroom/`, `src/lib/pxpipe/`, `open-sse/rtk/headroom.js`, `caveman.js`, `ponytail.js` |
| 12 | Uso, custo e quota | Histórico, custo por modelo, quota por provedor | `src/lib/db/repos/usageRepo.js`, `open-sse/services/usage/` (22 arquivos) |
| 13 | Multitenancy B2B | Usuários, papéis, orçamento mensal, whitelist de modelos/combos | `src/lib/db/migrations/002-multitenancy.js:1-20`, `src/lib/db/repos/usersRepo.js`, `chat.js:84-133` |
| 14 | Gestão de chaves/API keys | Criação, validação e escopo por usuário | `src/app/api/keys/*`, `src/lib/db/repos/apiKeysRepo.js` |
| 15 | Configuração de CLIs | Escrita de settings para 30 ferramentas (Claude, Codex, Cursor, Cline...) | `src/app/api/cli-tools/` (30 rotas) |
| 16 | Bridge MCP | Converte MCP remoto (SSE) em stdio local | `src/lib/mcp/stdioSseBridge.js`, `src/app/api/mcp/[plugin]` |
| 17 | MITM local | Interceptação TLS para ferramentas que não aceitam base URL | `src/mitm/manager.js` (803 linhas), `src/mitm/server.js` |
| 18 | Túneis e proxy pools | Cloudflare Tunnel, Tailscale, pools Webshare/Cloudflare/Deno/Vercel | `src/lib/tunnel/*`, `src/app/api/proxy-pools/*`, `src/lib/network/*` |
| 19 | Dashboard operacional | Providers, combos, uso, quotas, proxy pools, token saver, usuários | `src/app/(dashboard)/dashboard/` (26 páginas) |
| 20 | Launcher CLI | Instala, inicia servidor, menu, tray, autostart | `cli/cli.js`, `cli/src/cli/*`, `cli/hooks/*` |

---

## 5. Pontos fortes

### Arquitetura
- Fronteira clara app ↔ motor, com convenções próprias do motor (`CLAUDE.md:57-65`, `open-sse/AGENTS.md:1-12`).
- Registry de provedores config-driven e gerado por script, não editado à mão (`CLAUDE.md:72-74`).
- Tradutores com rotas diretas para evitar o pivô lossy via OpenAI (`CLAUDE.md:68-70`).
- Persistência com cadeia de fallback de drivers que funciona sem toolchain nativa (`src/lib/db/driver.js:44-59`).
- Migrações versionadas e esquema declarativo com índices relevantes (`src/lib/db/schema.js:48-177`).

### Resiliência
- Fallback em dois níveis (modelo → conta) com classificação de erro por status/texto (`open-sse/services/accountFallback.js:20-60`).
- Cooldown exponencial e locks por modelo para não derrubar conta saudável (`chat.js:367-391`).
- Refresh de token com deduplicação (`open-sse/services/tokenRefresh/dedup.js`).
- RTK e savers são explicitamente fail-open (`open-sse/AGENTS.md:35-37`).

### Segurança
- Middleware deny-by-default para `/api/*`, allowlist pública explícita (`src/dashboardGuard.js:200-260`).
- IP real derivado do socket TCP e `X-Forwarded-For` descartado, com token de peer por processo (`custom-server.js:9-74`, `src/lib/auth/trustedPeer.js:1-7`).
- Lockout progressivo de login (5 falhas → 30s…30min) (`src/lib/auth/loginLimiter.js:1-45`).
- Bloqueio de senha padrão para acesso remoto (`src/app/api/auth/login/route.js:79-90`).
- SSRF guard em 3 camadas, incluindo DNS e redirects (`src/shared/utils/ssrfGuard.js:1-15`).
- Rotas que geram processos/leem segredos do host restritas a localhost/CLI token (`src/dashboardGuard.js:63-91`).
- `requireApiKey` e `requireLogin` vêm habilitados por padrão (`src/lib/db/repos/settingsRepo.js` defaults).

### Qualidade e testes
- 330 arquivos de teste (299 unitários + 36 de tradução) e baselines de regressão (`tests/__baseline__/verify-*.mjs`).
- Documentação operacional incomum para o porte: `CLAUDE.md`, `open-sse/AGENTS.md`, `docs/ARCHITECTURE.md` (ainda que parcialmente desatualizada).
- Build Docker multi-stage e healthcheck operacional documentado (`Dockerfile:1-93`, `DOCKER.md`).

---

## 6. Pontos fracos e dívidas técnicas

### 6.1 Segurança e cadeia de suprimentos

| Severidade | Achado | Evidência |
|---|---|---|
| Crítico | 1 CVE crítica (Next.js RCE em Image Optimization/Server Actions), 5 altas (undici, node-forge, body-parser, follow-redirects, dompurify) e 3 moderadas; correções disponíveis | `npm audit` no checkout; `package.json:40` |
| Alto | Credenciais de provedores (`accessToken`, `refreshToken`, `apiKey`, `idToken`) persistidas em JSON sem criptografia | `src/lib/db/repos/connectionsRepo.js:49-59` |
| Alto | API keys armazenadas em texto plano e validadas por igualdade SQL | `src/lib/db/repos/apiKeysRepo.js:48,78` |
| Alto | `keyId` gerado com `Math.random()` (não criptográfico) e secret HMAC com fallback fixo | `src/shared/utils/apiKey.js:3,15-20` |
| Médio | Diretório de dados criado com permissões padrão do processo, sem `0700` | `src/lib/db/paths.js:16-19` |
| Médio | 20+ rotas usam `child_process` (`exec`, `execSync`) para escrever configs/instalar túneis; superfície ampla | `src/app/api/cli-tools/*/route.js`, `src/app/api/tunnel/tailscale-install/route.js:4` |
| Baixo | CORS `*` no endpoint de chat; mitigado pela checagem de `Origin` loopback no guard | `src/app/api/v1/chat/completions/route.js:19-27`, `src/dashboardGuard.js:117-125` |
| Médio | Sem lockfile versionado e Docker usando `npm install` com dependências em caret | `.gitignore:63`, `Dockerfile:24`, `package.json:22-56` |

### 6.2 Arquitetura e acoplamento

- **Monólitos de UI e executor** (violam SRP e dificultam teste):
  - `src/app/(dashboard)/dashboard/providers/[id]/page.js` — 1.850 linhas
  - `src/app/(dashboard)/dashboard/profile/page.js` — 1.577
  - `src/app/(dashboard)/dashboard/usage/components/ProviderLimits/index.js` — 1.551
  - `src/app/(dashboard)/dashboard/proxy-pools/page.js` — 1.331
  - `open-sse/executors/kiro.js` — 1.240; `open-sse/executors/cursor.js` — 1.163
- **Duplicação de lógica de combo**: o mesmo bloco de expansão/estratégia aparece duas vezes em `src/sse/handlers/chat.js:148-191` e `:223-268`.
- **Mutex global de seleção de conta**: serializa a escolha de credenciais de *todos* os provedores, criando gargalo de throughput sob concorrência (`src/sse/services/auth.js:10,36-38`).
- **Patch global de `fetch`**: `open-sse/utils/proxyFetch.js:422` substitui `globalThis.fetch` no import, acoplando comportamento de rede a efeitos colaterais de módulo.
- **Dependência morta**: `express` declarado em `package.json:34` sem uso no código-fonte (grep não encontrou imports), aumentando superfície e tempo de instalação.

### 6.3 Testes e qualidade

- A suíte **não é executável pela raiz**: não existe script `test`/`lint` no `package.json:6-17`; é preciso `cd tests && npx vitest` (`CLAUDE.md:34-41`).
- A suíte **não é verde no checkout**: ~938 passam e ~64 falham, com 26 falhas catalogadas (`CLAUDE.md:43-47`, `tests/__baseline__/known-fails.txt`).
- **Sem cobertura configurada**: `tests/vitest.config.js:8-22` não define `coverage` nem thresholds.
- **Ausência de testes de autorização**: só existe `tests/auth/saml.test.js`; não há testes de RBAC/IDOR/SSRF, apesar das rotas multitenant e do histórico de correções (commit `be2209c3`).
- **Sem CI de qualidade**: os únicos workflows são Docker, GitBook e tray (`.github/workflows/`); não há lint, testes nem auditoria de dependências no PR.
- **697 `console.log`** no total (345 em `src/`, 21 em `open-sse/`), convivendo com um logger que também escreve em `console` (`src/sse/utils/logger.js:38-42`), sem logs estruturados, request-id ou métricas.

### 6.4 Documentação e operação

- `docs/ARCHITECTURE.md` descreve persistência em `db.json`/`usage.json` (`docs/ARCHITECTURE.md:59,141,147,380`), mas a implementação real é SQLite (`src/lib/db/paths.js:8`); o próprio `CLAUDE.md:76` admite que o doc está desatualizado.
- `docs/ARCHITECTURE.md:157-161` documenta cloud sync (`src/app/api/sync`, `src/shared/services/cloudSyncScheduler.js`), mas **não existe mais** diretório `sync`/`cloud` em `src/app/api`.
- `package.json` raiz **sem `engines`**, permitindo instalação em versões onde o driver nativo é desativado (`src/lib/db/driver.js:20-24`).
- Todo o diretório `docs/*` é ignorado pelo Git, exceto exceções (`.gitignore`), o que favorece drift entre código e documentação.

### 6.5 Desempenho e escalabilidade

- Agregações de uso feitas em JavaScript sobre todas as linhas filtradas (`src/lib/db/repos/usageRepo.js:343,469-539`), com ring buffer em memória de apenas 50 itens (`:14`) e agregados diários em blobs JSON (`usageDaily` em `src/lib/db/schema.js`). Isso não escala para alto volume nem permite consultas analíticas eficientes.
- `getProviderConnections` carrega todas as conexões do provedor e ordena em JS (`src/lib/db/repos/connectionsRepo.js`), em vez de ordenar no SQL.
- `getSettings()` é chamado múltiplas vezes por requisição (`src/sse/handlers/chat.js:71,319`), sem cache curto por request.
- Seleção de conta sob mutex global (ver 6.2) é o principal limitador de concorrência do gateway.

### 6.6 Inconsistências menores

- `src/app/api/v1/route.js:1` apenas reexporta `/models`, enquanto a documentação o descreve como lista estática (drift menor).
- `react-is` e `express` constam como dependências sem uso direto detectado.

---

## 7. Melhorias recomendadas (priorizadas)

| Prioridade | Ação | Impacto | Esforço | Evidência-base |
|---|---|---|---|---|
| **P0** | Atualizar Next.js para versão corrigida e rodar `npm audit fix` para undici/node-forge/body-parser/follow-redirects | Fecha 1 CVE crítica e 5 altas | Baixo | `npm audit`, `package.json:40` |
| **P0** | Commitar `package-lock.json`, trocar Docker para `npm ci` e adicionar `npm audit` no CI | Builds reprodutíveis e bloqueio de regressão de dependências | Baixo | `.gitignore:63`, `Dockerfile:24` |
| **P0** | Criptografar segredos em repouso (AES-256-GCM com chave em env/OS keychain); armazenar hash das API keys em vez do valor; `chmod 0700` no `DATA_DIR` | Reduz impacto de vazamento do SQLite | Médio | `connectionsRepo.js:49-59`, `apiKeysRepo.js:48,78`, `paths.js:16-19` |
| **P0** | Trocar `Math.random()` por `crypto.randomBytes` e remover fallback do `API_KEY_SECRET` (fail-closed) | Elimina previsibilidade de chaves | Baixo | `apiKey.js:3,15-20` |
| **P1** | Criar scripts `lint`/`test` na raiz e pipeline CI com ESLint + Vitest + baseline + secret scan | Impede regressões e reduz dívida invisível | Baixo | `package.json:6-17`, `CLAUDE.md:34-47`, `.github/workflows/` |
| **P1** | Adicionar testes de autorização (RBAC, IDOR, SSRF, rotas local-only) | Protege as áreas mais sensíveis do produto | Médio | `src/dashboardGuard.js`, `tests/auth/` |
| **P1** | Substituir o mutex global por lock por provedor/conexão | Aumenta throughput e isola falhas | Médio | `src/sse/services/auth.js:10,36-38` |
| **P1** | Quebrar monólitos (>250 linhas) em hooks/componentes no front e em submódulos no executor | Testabilidade, revisão e redução de risco | Alto | arquivos de 1.163–1.850 linhas |
| **P1** | Deduplicar a lógica de combo em `chat.js` | Remove divergência de comportamento | Baixo | `chat.js:148-191` vs `:223-268` |
| **P2** | Logs estruturados (JSON) com request-id, níveis e métricas golden signals; substituir `console.log` pelo logger | Operação e debugging em produção | Médio | 345 `console.log` em `src/`, `logger.js:38-42` |
| **P2** | Reescrever `docs/ARCHITECTURE.md` para SQLite e remover seções de cloud sync inexistente | Elimina decisões baseadas em doc falso | Baixo | `docs/ARCHITECTURE.md:59,141,157-161` |
| **P2** | Pré-agregar uso (tabelas diárias/horárias) e paginar consultas; mover ordenação para SQL | Escala analítica e menor latência | Médio | `usageRepo.js:343,469-539`, `connectionsRepo.js` |
| **P2** | Adicionar `engines` na raiz e documentar matriz Node/Bun | Evita runtime inconsistente | Baixo | `package.json` (ausente), `driver.js:20-24` |
| **P3** | Introduzir TypeScript gradual ou `// @ts-check` + JSDoc nos contratos de request/response | Segurança de tipos sem reescrita | Alto | `CLAUDE.md:87` |
| **P3** | Configurar cobertura com thresholds no Vitest | Torna a dívida de testes mensurável | Baixo | `tests/vitest.config.js:8-22` |
| **P3** | Remover dependências mortas (`express`, `react-is`) e revisar `@next/third-parties` | Menor superfície e install mais rápido | Baixo | `package.json:34,48` |

---

## 8. Como reproduzir as medições

```powershell
# contagens
Get-ChildItem src,open-sse,cli,tests -Recurse -File -Include *.js,*.mjs |
  Where-Object { $_.FullName -notmatch 'node_modules|\.next' }

# auditoria de dependências
npm audit --omit=dev

# testes (pacote separado)
cd tests; npx vitest run

# baseline de regressão
node tests/__baseline__/verify-no-regression.mjs
```

---

## 9. Ressalva metodológica

A análise é estática; o gateway e a suíte completa não foram executados. O `npm audit` reflete a árvore instalada neste checkout e pode variar com atualizações de advisory. As falhas de teste citadas vêm da documentação do próprio repositório (`CLAUDE.md:43-47`) e do `known-fails.txt`.
