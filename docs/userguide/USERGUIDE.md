# Guia Completo do Usuário: 9Router (User Guide)

O **9Router** (`9router-app`) é um gateway local corporativo de alto desempenho para roteamento, tradução e orquestração de múltiplos provedores de Inteligência Artificial com endpoint universal compatível com OpenAI (`/v1/*`), suporte a MCP Server, rotação pró-ativa de proxies e compressão de contexto.

---

## Sumário
1. [Tela de Autenticação (Login)](#1-tela-de-autenticação-login)
2. [Endpoint & Chaves de API](#2-endpoint--chaves-de-api)
3. [Empresas & Clientes B2B (Gestão SaaS)](#3-empresas--clientes-b2b-gestão-saas)
4. [Painel do Cliente B2B & Janela de Uso](#4-painel-do-cliente-b2b--janela-de-uso)
5. [Gerenciamento de Provedores (Providers)](#5-gerenciamento-de-provedores-providers)
6. [Combos de Modelos & Adaptador de Visão](#6-combos-de-modelos--adaptador-de-visão)
7. [Estatísticas de Consumo (Usage)](#7-estatísticas-de-consumo-usage)
8. [Rastreador de Cotas (Quota Tracker)](#8-rastreador-de-cotas-quota-tracker)
9. [Economizador de Tokens (Token Saver / RTK)](#9-economizador-de-tokens-token-saver--rtk)
10. [Servidor MCP Nativo (Model Context Protocol)](#10-servidor-mcp-nativo-model-context-protocol)
11. [Ferramentas CLI & IDEs](#11-ferramentas-cli--ides)
12. [Pools de Proxy & Integração Webshare](#12-pools-de-proxy--integração-webshare)
13. [Provedores de Mídia e Busca Web](#13-provedores-de-mídia-e-busca-web)
14. [Habilidades (Skills)](#14-habilidades-skills)
15. [Log do Console & Diagnóstico](#15-log-do-console--diagnóstico)
16. [Configurações Globais (Settings)](#16-configurações-globais-settings)

---

## 1. Tela de Autenticação (Login)

![Login](screenshots/00-login.png)

- **Rota:** `/login`
- **Descrição:** Ponto de entrada protegido do painel de administração. Suporta autenticação por senha local mestre ou SSO corporativo (OIDC / SAML 2.0).
- **Instruções de Uso:**
  1. Digite a senha administrativa (padrão local: `123456` ou o valor configurado em `INITIAL_PASSWORD` no `.env`).
  2. Clique em **Login**. O sistema armazena um cookie de sessão seguro (`auth_token`) com validade automática.

---

## 2. Endpoint & Chaves de API

![Endpoint & Key](screenshots/01-endpoint-key.png)

- **Rota:** `/dashboard/endpoint`
- **Descrição:** Painel principal com os endereços de conexão do gateway e gerenciamento de chaves de acesso para clientes.
- **Recursos Principais:**
  - **Endpoint da API:** Exibe a URL base (ex.: `http://localhost:20127/v1` ou via túnel remoto).
  - **Túnel & Tailscale:** Botões para expor o servidor local de forma segura na internet via Cloudflare Tunnel ou Tailscale.
  - **Chaves de API:** Chave padrão (`Default Key`), toggle para exigir autenticação obrigatória (`Require API Key`) e botão para gerar novas credenciais seguras.

---

## 3. Empresas & Clientes B2B (Gestão SaaS)

![Empresas e Cotas](screenshots/14-users-admin.png)

- **Rota:** `/dashboard/users`
- **Descrição:** Módulo de gerenciamento multitenant (SaaS) para cadastrar e controlar empresas clientes que consom a API do 9Router.
- **Recursos Principais:**
  - **Criação de Clientes:** Cadastro de contas com login próprio (`username`), senha com hash seguro (`bcrypt`) e nome corporativo.
  - **Teto Orçamentário Mensal ($ USD):** Definição de limites financeiros rígidos (*Hard Limit*). Ao atingir 100% da cota mensal, novas requisições da empresa recebem automaticamente `HTTP 429 Too Many Requests`.
  - **Whitelisting Híbrido de Modelos:** Restrição dos modelos acessíveis por cada empresa através de combos atribuídos ou modelos avulsos explicitamente autorizados.
  - **Monitoramento de Uso:** Cards visuais com barras de progresso coloridas destacando o consumo acumulado no ciclo corrente.

---

## 4. Painel do Cliente B2B & Janela de Uso

![Painel do Cliente B2B](screenshots/15-client-dashboard.png)

- **Rota:** `/dashboard/client`
- **Descrição:** Interface simplificada e segura destinada às empresas clientes acessarem após o login.
- **Recursos Principais:**
  - **Janela de Consumo em Tempo Real:** Widget central exibindo a porcentagem utilizada da cota mensal (`% utilizado`), valor gasto em dólares versus o teto contratado.
  - **Autonomia de Chaves de API:** O próprio cliente pode gerar, nomear, copiar com 1 clique e revogar suas próprias chaves de acesso (`sk-...`) com isolamento total (IDOR-safe).
  - **Catálogo de Modelos Liberados:** Lista dos modelos diretos e combos inteligentes disponíveis para o plano contratado.

---

## 5. Gerenciamento de Provedores (Providers)

![Providers](screenshots/02-providers.png)

- **Rota:** `/dashboard/providers`
- **Descrição:** Catálogo e gerenciador de conexões com provedores upstream (Claude, OpenAI, Codex, Antigravity, Gemini, DeepSeek, Ollama, etc.).
- **Recursos Principais:**
  - Suporte a autenticação via OAuth/Session (com auto-refresh de token) ou API Keys tradicionais.
  - Associação de contas com **Proxy Pools** individuais para contornar restrições geográficas ou rate limits.
  - Botão **+ Add Provider** para conectar novos nós compatíveis.

---

## 6. Combos de Modelos & Adaptador de Visão

![Combos](screenshots/03-combos.png)

- **Rota:** `/dashboard/combos`
- **Descrição:** Criação de rotas inteligentes de failover. Permite que um único nome de modelo (ex.: `smart-fallback`) tente uma sequência ordenada de modelos e provedores caso o primário retorne erro ou limite de cota.
- **Recursos Principais:**
  - **Cadeias de Prioridade:** Arraste e solte (drag-and-drop) os modelos para definir a ordem de tentativa.
  - **Adaptador de Visão:** Fallback automático para modelos com capacidade visual quando a mensagem original contiver imagens.

---

## 7. Estatísticas de Consumo (Usage)

![Usage](screenshots/04-usage.png)

- **Rota:** `/dashboard/usage`
- **Descrição:** Painel de observabilidade com gráficos e métricas consolidadas sobre tokens consumidos, custos estimados e requisições.
- **Filtros e Visualização:**
  - Filtro temporal: 24h, 7d, 30d, 60d ou Todo o período (*All Time*).
  - Decomposição por Provedor, Modelo e Chave de API cliente.
  - Aba de **Request Details** para inspecionar payloads e latência de chamadas individuais.

---

## 8. Rastreador de Cotas (Quota Tracker)

![Quota Tracker](screenshots/05-quota.png)

- **Rota:** `/dashboard/quota`
- **Descrição:** Monitoramento em tempo real do limite de requisições, janelas de reinicialização de cotas e créditos disponíveis nas contas de cada provedor (ex.: janelas semanais de Claude, cotas diárias de Gemini, saldos do DeepSeek).

---

## 9. Economizador de Tokens (Token Saver / RTK)

![Token Saver](screenshots/06-token-saver.png)

- **Rota:** `/dashboard/token-saver`
- **Descrição:** Mecanismo avançado de compressão em memória de payloads LLM para economia de contexto.
- **Tecnologias Integradas:**
  - **RTK (Request Token Killer):** Compacta saídas de ferramentas (`tool_result`) mantendo erros e stack traces intactos (*fail-open*).
  - **Headroom Proxy:** Otimização e deduplicação de contexto.
  - **Caveman Mode:** Modo de sistema ultra-compacto que economiza até 75% dos tokens sem perda de precisão técnica.

---

## 10. Servidor MCP Nativo (Model Context Protocol)

![MCP Server](screenshots/07-mcp-server.png)

- **Rota:** `/dashboard/mcp`
- **Descrição:** Central de gerenciamento do servidor MCP integrado ao 9Router.
- **Destaques:**
  - **Transporte Duplo:** Monitoramento dos canais **SSE** (`/api/mcp/native/sse`) e **Stdio** (`src/mcp/bin.js`).
  - **Snippets de 1 Clique:** Configurações prontas para copiar e colar no **OpenCode**, **Claude Code**, **Cursor/Windsurf** e **Claude Desktop**.
  - **12 Ferramentas Registradas:** Busca web (`web_search`, `web_fetch`), mídia (`generate_image`, `text_to_speech`, `speech_to_text`), `embeddings`, `list_models` e ferramentas de administração do gateway (`9router_status`, `9router_list_combos`, etc.).
  - Acesso direto ao **MCP Marketplace** oficial da Anthropic.

---

## 11. Ferramentas CLI & IDEs

![CLI Tools](screenshots/08-cli-tools.png)

- **Rota:** `/dashboard/cli-tools`
- **Descrição:** Conectores automatizados para configurar o 9Router como backend de IA das ferramentas mais populares do ecossistema de desenvolvimento:
  - Claude Code, OpenCode, Codex CLI, Cursor, Cline, Roo, GitHub Copilot, Factory Droid e Hermes Agent.
  - Injeção de proxies MITM locais para ferramentas proprietárias como Antigravity e Kiro.

---

## 12. Pools de Proxy & Integração Webshare

![Proxy Pools](screenshots/09-proxy-pools.png)

- **Rota:** `/dashboard/proxy-pools`
- **Descrição:** Gerenciador completo de redes de proxy e relays.
- **Novidades Implementadas:**
  - **Importação Direta Webshare:** Puxa proxies atribuídos via API Key do Webshare com país e cidade formatados.
  - **Auto-Cura e Substituição de IPs Mortos (`Sync & Auto-Replace`):** Detecta proxies fora do ar, solicita novos IPs via `/api/v3/proxy/replace/` na API do Webshare e atualiza o banco do 9Router automaticamente.
  - **Proxy Padrão Global (Ícone ⭐):** Permite eleger um proxy padrão que será assumido por todas as chamadas do 9Router quando nenhum proxy específico estiver associado à conta.

---

## 13. Provedores de Mídia e Busca Web

![Media & Web](screenshots/10-media-web.png)

- **Rota:** `/dashboard/media-providers/web` (e abas de Imagem, Áudio e Vídeo)
- **Descrição:** Configuração de endpoints especializados em multimodalidade:
  - Mecanismos de busca e raspagem web (Tavily, Brave, Jina Reader, Firecrawl).
  - Geração de imagens (DALL-E, Stability AI, Fal.ai, ComfyUI).
  - Voz e transcrição (ElevenLabs, Edge TTS, Whisper).

---

## 14. Habilidades (Skills)

![Skills](screenshots/11-skills.png)

- **Rota:** `/dashboard/skills`
- **Descrição:** Catálogo e sincronizador de habilidades de engenharia e automação disponíveis para agentes inteligentes que consom o 9Router.

---

## 15. Log do Console & Diagnóstico

![Console Log](screenshots/12-console-log.png)

- **Rota:** `/dashboard/console-log`
- **Descrição:** Buffer em tempo real de logs de execução do servidor, erros de rede, rotação de contas e status de conexões SSE.

---

## 16. Configurações Globais (Settings)

![Settings](screenshots/13-settings.png)

- **Rota:** `/dashboard/profile` (acessível pelo menu *Settings* no rodapé do menu lateral)
- **Descrição:** Ajustes administrativos do servidor e preferências:
  - Localização e status do banco de dados SQLite (`~/.9router/db/data.sqlite`).
  - Download e restauração de backups em 1 clique.
  - Alternância de tema visual (Light, Dark, System) e idioma.
  - Políticas de segurança: ativação/desativação de `Require login` e troca de senha administrativa.
