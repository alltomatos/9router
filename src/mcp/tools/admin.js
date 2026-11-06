let _db = null;
let _models = null;
let _usageDb = null;

async function getAdminDeps() {
  if (!_db) {
    _db = await import("../../../src/lib/db/index.js");
  }
  if (!_models) {
    _models = await import("../../models/index.js");
  }
  if (!_usageDb) {
    _usageDb = await import("../../lib/usageDb.js");
  }
  return {
    localDb: _db,
    models: _models,
    usageDb: _usageDb,
  };
}

export const statusTool = {
  name: "9router_status",
  description: "Check 9Router runtime status, configuration, and security settings",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function handleStatus() {
  const { localDb } = await getAdminDeps();
  const settings = await localDb.getSettings();
  const { password, oidcClientSecret, ...safeSettings } = settings;

  return {
    status: "online",
    version: "0.5.81",
    requireApiKey: !!safeSettings.requireApiKey,
    requireLogin: !!safeSettings.requireLogin,
    cloudSyncEnabled: !!safeSettings.cloudSyncEnabled,
    tailscaleEnabled: !!safeSettings.tailscaleEnabled,
    tunnelEnabled: !!safeSettings.tunnelEnabled,
  };
}

export const listProvidersTool = {
  name: "9router_list_providers",
  description: "List configured upstream providers and connection states in 9Router",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function handleListProviders() {
  const { models } = await getAdminDeps();
  const connections = await models.getProviderConnections();
  return {
    total: connections.length,
    providers: connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      status: c.status || "active",
      hasApiKey: !!c.apiKey,
      createdAt: c.createdAt,
    })),
  };
}

export const listCombosTool = {
  name: "9router_list_combos",
  description: "List configured model combinations and fallback chains in 9Router",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function handleListCombos() {
  const { localDb } = await getAdminDeps();
  const combos = await localDb.getCombos();
  return {
    total: combos.length,
    combos: combos.map((c) => ({
      id: c.id,
      name: c.name,
      models: c.models || [],
      kind: c.kind || "chat",
    })),
  };
}

export const createComboTool = {
  name: "9router_create_combo",
  description: "Create or replace a model combo with fallback order in 9Router",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Unique name of the combo (e.g. fast-fallback)" },
      models: {
        type: "array",
        items: { type: "string" },
        description: "List of provider/model IDs in fallback priority order",
      },
      kind: { type: "string", description: "Optional kind (e.g. chat, image)" },
    },
    required: ["name", "models"],
  },
};

export async function handleCreateCombo(args) {
  const { localDb } = await getAdminDeps();
  const combo = await localDb.createCombo({
    name: args.name,
    models: args.models || [],
    kind: args.kind || null,
  });
  return {
    success: true,
    combo,
  };
}

export const getUsageTool = {
  name: "9router_get_usage",
  description: "Retrieve token usage statistics and cost summaries by period",
  inputSchema: {
    type: "object",
    properties: {
      period: {
        type: "string",
        enum: ["24h", "7d", "30d", "all"],
        description: "Aggregation period (default: 7d)",
      },
    },
  },
};

export async function handleGetUsage(args) {
  const { usageDb } = await getAdminDeps();
  const period = args.period || "7d";
  const stats = await usageDb.getUsageStats(period);
  return stats;
}
