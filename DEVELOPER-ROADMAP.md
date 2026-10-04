# DEVELOPER ROADMAP: 9Router Multitenant B2B AI Gateway

> **Nota:** Como o repositório remoto `alltomatos/9router` está com as Issues desabilitadas no GitHub, este documento atua como o tracker central de Epics e Slices arquiteturais da evolução corporativa.

---

## Epics

### [E01] Arquitetura Multitenant B2B, Cotas e Whitelisting de Modelos - `in_progress`
- **Artefatos:** `docs/architecture/ADD-multitenant-gateway.md`, `docs/adr/0002-multitenant-b2b-gateway.md`, `docs/agents/multitenant-gateway.md`
- **Objetivo:** Transformar o 9Router em gateway B2B com múltiplos usuários/empresas, controle de cota em % ($ USD), whitelist de modelos e gestão isolada de API Keys.

#### Slices Verticais
- [x] **Slice 1.1**: Migração de banco SQLite (tabela `users`, coluna `apiKeys.userId`) e WAL mode no driver.
- [ ] **Slice 1.2**: Implementação do repositório `usersRepo.js` (CRUD, hash bcrypt, controle de cotas).
- [ ] **Slice 1.3**: Testes automatizados do repositório de usuários e migrações.
- [ ] **Slice 2**: Autenticação Multitenant e RBAC (`/api/auth/login`, JWT, guards e `/api/auth/me`).
- [ ] **Slice 3**: Gateway Enforcement (validação da chave por tenant, bloqueio de cota 429 e whitelist de modelos/combos).
- [ ] **Slice 4**: APIs REST de Gestão (`/api/users`, filtro de chaves por `userId`, `/api/client/usage`).
- [ ] **Slice 5**: Telas de Dashboard (Gestão de Empresas para Admin e Painel do Cliente com % de uso).
- [ ] **Slice 6**: Verificação E2E, Testes de Segurança e QA.
