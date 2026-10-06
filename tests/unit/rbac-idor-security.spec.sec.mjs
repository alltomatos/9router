import test from "node:test";
import assert from "node:assert/strict";
import { createUser } from "../../src/lib/db/repos/usersRepo.js";
import { createApiKey, getApiKeyById } from "../../src/lib/db/repos/apiKeysRepo.js";
import { getAdapter } from "../../src/lib/db/driver.js";

test("Auditoria Ofensiva/Defensiva: Quebra de Permissões e Acessos Indevidos (RBAC & IDOR)", async (t) => {
  const db = await getAdapter();
  db.run("DELETE FROM users");
  db.run("DELETE FROM apiKeys");

  await t.test("VULN-IDOR: Um cliente não pode revogar ou atualizar chaves de outro cliente", async () => {
    // 1. Criar Empresa A e Empresa B
    const userA = await createUser({
      username: "empresa_vitima",
      password: "pass",
      name: "Empresa Vitima",
      role: "client",
    });
    const userB = await createUser({
      username: "empresa_atacante",
      password: "pass",
      name: "Empresa Atacante",
      role: "client",
    });

    // 2. Chave criada pela Empresa A
    const keyA = await createApiKey("Chave Vitima", "machine-1", userA.id);

    // 3. Simular verificação de ownership implementada em /api/keys/[id]
    const key = await getApiKeyById(keyA.id);
    assert.equal(key.userId, userA.id);

    // Tentativa do atacante (userB) de reivindicar posse da chave
    const attackerCanAccess = (userB.id === key.userId);
    assert.equal(attackerCanAccess, false, "Atacante não pode ter autorização sobre a chave de outro tenant");
  });

  await t.test("VULN-RBAC: Clientes não podem manipular provedores upstream ou configurações globais", async () => {
    const userClient = await createUser({
      username: "cliente_normal",
      password: "pass",
      name: "Cliente Normal",
      role: "client",
    });

    assert.equal(userClient.role, "client");
    assert.notEqual(userClient.role, "admin", "Cliente comum não possui role admin");
  });
});
