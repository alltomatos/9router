import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function rowToUser(row, includePassword = false) {
  if (!row) return null;
  const user = {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role || "client",
    allowedCombos: parseJson(row.allowedCombos, []),
    allowedModels: parseJson(row.allowedModels, []),
    monthlyBudgetUsd: Number(row.monthlyBudgetUsd) || 0,
    currentCycleSpentUsd: Number(row.currentCycleSpentUsd) || 0,
    budgetResetDay: Number(row.budgetResetDay) || 1,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (includePassword) {
    user.passwordHash = row.passwordHash;
  }
  return user;
}

export async function getUsers() {
  const db = await getAdapter();
  const rows = db.all("SELECT * FROM users ORDER BY createdAt ASC");
  return rows.map((r) => rowToUser(r));
}

export async function getUserById(id, includePassword = false) {
  const db = await getAdapter();
  const row = db.get("SELECT * FROM users WHERE id = ?", [id]);
  return rowToUser(row, includePassword);
}

export async function getUserByUsername(username, includePassword = false) {
  const db = await getAdapter();
  const row = db.get("SELECT * FROM users WHERE username = ?", [username]);
  return rowToUser(row, includePassword);
}

export async function createUser(data) {
  if (!data.username) throw new Error("username is required");
  if (!data.password && !data.passwordHash) throw new Error("password is required");

  const db = await getAdapter();
  const now = new Date().toISOString();
  const id = data.id || uuidv4();
  const passwordHash = data.passwordHash || (await bcrypt.hash(data.password, 10));

  const user = {
    id,
    username: data.username.toLowerCase().trim(),
    passwordHash,
    name: data.name || data.username,
    role: data.role || "client",
    allowedCombos: data.allowedCombos || [],
    allowedModels: data.allowedModels || [],
    monthlyBudgetUsd: Number(data.monthlyBudgetUsd) || 0,
    currentCycleSpentUsd: Number(data.currentCycleSpentUsd) || 0,
    budgetResetDay: Number(data.budgetResetDay) || 1,
    isActive: data.isActive !== false ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  };

  db.run(
    `INSERT INTO users(id, username, passwordHash, name, role, allowedCombos, allowedModels, monthlyBudgetUsd, currentCycleSpentUsd, budgetResetDay, isActive, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.username,
      user.passwordHash,
      user.name,
      user.role,
      stringifyJson(user.allowedCombos),
      stringifyJson(user.allowedModels),
      user.monthlyBudgetUsd,
      user.currentCycleSpentUsd,
      user.budgetResetDay,
      user.isActive,
      user.createdAt,
      user.updatedAt,
    ]
  );

  return rowToUser(user);
}

export async function updateUser(id, data) {
  const db = await getAdapter();
  let result = null;

  db.transaction(() => {
    const row = db.get("SELECT * FROM users WHERE id = ?", [id]);
    if (!row) return;

    const current = rowToUser(row, true);
    const updated = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    if (data.username) {
      updated.username = data.username.toLowerCase().trim();
    }
    if (data.allowedCombos) {
      updated.allowedCombos = data.allowedCombos;
    }
    if (data.allowedModels) {
      updated.allowedModels = data.allowedModels;
    }

    db.run(
      `UPDATE users SET
         username = ?,
         name = ?,
         role = ?,
         allowedCombos = ?,
         allowedModels = ?,
         monthlyBudgetUsd = ?,
         currentCycleSpentUsd = ?,
         budgetResetDay = ?,
         isActive = ?,
         updatedAt = ?
       WHERE id = ?`,
      [
        updated.username,
        updated.name,
        updated.role,
        stringifyJson(updated.allowedCombos),
        stringifyJson(updated.allowedModels),
        Number(updated.monthlyBudgetUsd) || 0,
        Number(updated.currentCycleSpentUsd) || 0,
        Number(updated.budgetResetDay) || 1,
        updated.isActive ? 1 : 0,
        updated.updatedAt,
        id,
      ]
    );

    result = rowToUser(updated);
  });

  return result;
}

export async function updateUserPassword(id, newPassword) {
  const db = await getAdapter();
  const hash = await bcrypt.hash(newPassword, 10);
  const now = new Date().toISOString();
  db.run("UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?", [hash, now, id]);
  return true;
}

export async function deleteUser(id) {
  const db = await getAdapter();
  db.run("DELETE FROM users WHERE id = ?", [id]);
  return true;
}

export async function validateUserPassword(username, password) {
  const user = await getUserByUsername(username, true);
  if (!user || !user.isActive || !user.passwordHash) return false;
  return await bcrypt.compare(password, user.passwordHash);
}

export async function checkUserQuota(id) {
  const user = await getUserById(id);
  if (!user) return { allowed: false, isExceeded: true, reason: "user_not_found" };

  // Se orçamento mensal for 0, é considerado ilimitado
  if (user.monthlyBudgetUsd <= 0) {
    return {
      allowed: true,
      isExceeded: false,
      monthlyBudgetUsd: 0,
      currentCycleSpentUsd: user.currentCycleSpentUsd,
      usagePercent: 0,
      isUnlimited: true,
    };
  }

  const usagePercent = Number(((user.currentCycleSpentUsd / user.monthlyBudgetUsd) * 100).toFixed(2));
  const isExceeded = user.currentCycleSpentUsd >= user.monthlyBudgetUsd;

  return {
    allowed: !isExceeded,
    isExceeded,
    monthlyBudgetUsd: user.monthlyBudgetUsd,
    currentCycleSpentUsd: user.currentCycleSpentUsd,
    usagePercent,
    isUnlimited: false,
  };
}

export async function recordUserSpend(id, costUsd) {
  if (!costUsd || costUsd <= 0) return;
  const db = await getAdapter();
  const now = new Date().toISOString();
  db.run(
    "UPDATE users SET currentCycleSpentUsd = currentCycleSpentUsd + ?, updatedAt = ? WHERE id = ?",
    [costUsd, now, id]
  );
}
