// Migration 002: Add users table and link apiKeys to users (Multitenant B2B)
import { buildCreateTableSql, TABLES } from "../schema.js";

export default {
  version: 2,
  name: "add_users_and_multitenancy",
  up(db) {
    // 1. Criar tabela users se não existir
    if (TABLES.users) {
      db.exec(buildCreateTableSql("users", TABLES.users));
      for (const idx of TABLES.users.indexes || []) {
        db.exec(idx);
      }
    }

    // 2. Adicionar coluna userId em apiKeys se ausente
    const akCols = db.all("PRAGMA table_info(apiKeys)").map((c) => c.name);
    if (!akCols.includes("userId")) {
      db.exec("ALTER TABLE apiKeys ADD COLUMN userId TEXT");
      db.exec("CREATE INDEX IF NOT EXISTS idx_ak_userId ON apiKeys(userId)");
    }
  },
};
