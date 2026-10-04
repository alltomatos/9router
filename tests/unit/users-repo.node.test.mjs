// Test suite executável diretamente com o test runner nativo do Node.js (Node 22)
import test from "node:test";
import assert from "node:assert/strict";
import {
  createUser,
  getUserById,
  getUserByUsername,
  getUsers,
  updateUser,
  deleteUser,
  checkUserQuota,
  recordUserSpend,
  validateUserPassword,
} from "../../src/lib/db/repos/usersRepo.js";
import { getAdapter } from "../../src/lib/db/driver.js";

test("usersRepo - Ciclo de Vida e Segurança (TDD)", async (t) => {
  const db = await getAdapter();
  db.run("DELETE FROM users");

  await t.test("cria usuário com hash seguro e busca por id/username", async () => {
    const user = await createUser({
      username: "empresa_teste",
      password: "MinhaSenhaForte123!",
      name: "Empresa Teste LTDA",
      role: "client",
      monthlyBudgetUsd: 50.0,
      allowedCombos: ["combo-1"],
      allowedModels: ["gpt-4o-mini"],
    });

    assert.ok(user.id);
    assert.equal(user.username, "empresa_teste");
    assert.equal(user.role, "client");
    assert.equal(user.monthlyBudgetUsd, 50.0);
    assert.deepEqual(user.allowedCombos, ["combo-1"]);
    assert.deepEqual(user.allowedModels, ["gpt-4o-mini"]);
    assert.equal(user.passwordHash, undefined);

    const foundById = await getUserById(user.id);
    assert.equal(foundById.username, "empresa_teste");

    const foundByUsername = await getUserByUsername("empresa_teste");
    assert.equal(foundByUsername.id, user.id);

    const isValid = await validateUserPassword("empresa_teste", "MinhaSenhaForte123!");
    assert.equal(isValid, true);

    const isInvalid = await validateUserPassword("empresa_teste", "SenhaErrada");
    assert.equal(isInvalid, false);
  });

  await t.test("valida cálculo de cota e bloqueio 429", async () => {
    const user = await createUser({
      username: "empresa_cota",
      password: "123",
      name: "Empresa Cota",
      role: "client",
      monthlyBudgetUsd: 10.0,
      currentCycleSpentUsd: 8.0,
    });

    const status1 = await checkUserQuota(user.id);
    assert.equal(status1.isExceeded, false);
    assert.equal(status1.usagePercent, 80.0);

    // Adiciona $2.50 de gasto -> $10.50 de $10.00 (Excede 100%)
    await recordUserSpend(user.id, 2.50);

    const status2 = await checkUserQuota(user.id);
    assert.equal(status2.isExceeded, true);
    assert.equal(status2.currentCycleSpentUsd, 10.50);
    assert.equal(status2.usagePercent, 105.0);
  });

  await t.test("atualiza dados e deleta usuário", async () => {
    const user = await createUser({
      username: "empresa_edit",
      password: "123",
      name: "Antes",
    });

    await updateUser(user.id, { name: "Depois", monthlyBudgetUsd: 100 });
    const updated = await getUserById(user.id);
    assert.equal(updated.name, "Depois");
    assert.equal(updated.monthlyBudgetUsd, 100);

    await deleteUser(user.id);
    const deleted = await getUserById(user.id);
    assert.equal(deleted, null);
  });
});
