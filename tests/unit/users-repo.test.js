import { describe, it, expect, beforeEach } from "vitest";
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
} from "@/lib/db/repos/usersRepo.js";
import { getAdapter } from "@/lib/db/driver.js";

describe("usersRepo (TDD)", () => {
  beforeEach(async () => {
    const db = await getAdapter();
    db.run("DELETE FROM users");
  });

  it("cria e busca usuário por id e username com senha criptografada", async () => {
    const user = await createUser({
      username: "empresa_teste",
      password: "MinhaSenhaForte123!",
      name: "Empresa Teste LTDA",
      role: "client",
      monthlyBudgetUsd: 50.0,
      allowedCombos: ["combo-1"],
      allowedModels: ["gpt-4o-mini"],
    });

    expect(user.id).toBeDefined();
    expect(user.username).toBe("empresa_teste");
    expect(user.role).toBe("client");
    expect(user.monthlyBudgetUsd).toBe(50.0);
    expect(user.allowedCombos).toEqual(["combo-1"]);
    expect(user.allowedModels).toEqual(["gpt-4o-mini"]);
    expect(user.passwordHash).toBeUndefined(); // Não deve vazar o hash no retorno comum

    const foundById = await getUserById(user.id);
    expect(foundById.username).toBe("empresa_teste");

    const foundByUsername = await getUserByUsername("empresa_teste");
    expect(foundByUsername.id).toBe(user.id);

    const isValid = await validateUserPassword("empresa_teste", "MinhaSenhaForte123!");
    expect(isValid).toBe(true);

    const isInvalid = await validateUserPassword("empresa_teste", "SenhaErrada");
    expect(isInvalid).toBe(false);
  });

  it("calcula checagem de cota corretamente (bloqueio 429)", async () => {
    const user = await createUser({
      username: "empresa_cota",
      password: "123",
      name: "Empresa Cota",
      role: "client",
      monthlyBudgetUsd: 10.0,
      currentCycleSpentUsd: 8.0,
    });

    const status1 = await checkUserQuota(user.id);
    expect(status1.isExceeded).toBe(false);
    expect(status1.usagePercent).toBe(80.0);

    // Registra gasto adicional de $2.50 -> Total $10.50 (Excedeu $10.00)
    await recordUserSpend(user.id, 2.50);

    const status2 = await checkUserQuota(user.id);
    expect(status2.isExceeded).toBe(true);
    expect(status2.currentCycleSpentUsd).toBe(10.50);
    expect(status2.usagePercent).toBe(105.0);
  });

  it("permite atualizar campos e deletar usuário", async () => {
    const user = await createUser({
      username: "empresa_edit",
      password: "123",
      name: "Antes",
    });

    await updateUser(user.id, { name: "Depois", monthlyBudgetUsd: 100 });
    const updated = await getUserById(user.id);
    expect(updated.name).toBe("Depois");
    expect(updated.monthlyBudgetUsd).toBe(100);

    await deleteUser(user.id);
    const deleted = await getUserById(user.id);
    expect(deleted).toBeNull();
  });
});
