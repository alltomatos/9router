import test from "node:test";
import assert from "node:assert/strict";
import { createUser, getUserById, checkUserQuota, recordUserSpend } from "../../src/lib/db/repos/usersRepo.js";
import { createApiKey, validateApiKey } from "../../src/lib/db/repos/apiKeysRepo.js";
import { getAdapter } from "../../src/lib/db/driver.js";

test("Segurança e Isolamento Multitenant (Negative Security Testing)", async (t) => {
  const db = await getAdapter();
  db.run("DELETE FROM users");
  db.run("DELETE FROM apiKeys");

  await t.test("SEC-01: Proibir acesso quando cota mensal do cliente atinge 100% (Hard Limit 429)", async () => {
    const user = await createUser({
      username: "empresa_limite",
      password: "SafePassword123!",
      name: "Empresa Limite",
      role: "client",
      monthlyBudgetUsd: 20.0,
      currentCycleSpentUsd: 19.90,
    });

    let quota = await checkUserQuota(user.id);
    assert.equal(quota.allowed, true);
    assert.equal(quota.isExceeded, false);

    // Tentativa de consumo adicional que estoura o orçamento
    await recordUserSpend(user.id, 0.50); // Total: $20.40

    quota = await checkUserQuota(user.id);
    assert.equal(quota.allowed, false, "Usuário com cota estourada não pode ser autorizado");
    assert.equal(quota.isExceeded, true);
    assert.ok(quota.usagePercent >= 100);
  });

  await t.test("SEC-02: Garantir que chave de API vinculada carrega userId e isola permissões", async () => {
    const userA = await createUser({
      username: "empresa_a",
      password: "pass",
      name: "Empresa A",
    });
    const userB = await createUser({
      username: "empresa_b",
      password: "pass",
      name: "Empresa B",
    });

    const keyA = await createApiKey("Key A", "machine-123", userA.id);
    const keyB = await createApiKey("Key B", "machine-123", userB.id);

    const valA = await validateApiKey(keyA.key);
    assert.equal(valA.valid, true);
    assert.equal(valA.userId, userA.id);

    const valB = await validateApiKey(keyB.key);
    assert.equal(valB.valid, true);
    assert.equal(valB.userId, userB.id);

    assert.notEqual(valA.userId, valB.userId, "As chaves de empresas diferentes não podem compartilhar o mesmo tenant");
  });
});
