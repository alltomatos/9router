let _handleEmbeddings = null;

async function getEmbeddingsHandler() {
  if (!_handleEmbeddings) {
    const mod = await import("../../sse/handlers/embeddings.js");
    _handleEmbeddings = mod.handleEmbeddings;
  }
  return _handleEmbeddings;
}

export const embeddingsTool = {
  name: "embeddings",
  description: "Generate vector embeddings for input strings using configured models",
  inputSchema: {
    type: "object",
    properties: {
      input: {
        oneOf: [
          { type: "string" },
          { type: "array", items: { type: "string" } },
        ],
        description: "Text string or array of strings to generate embeddings for",
      },
      model: { type: "string", description: "Embedding model ID (e.g. openai/text-embedding-3-small)" },
    },
    required: ["input"],
  },
};

export async function handleGetEmbeddings(args) {
  const handleEmbeddings = await getEmbeddingsHandler();
  const req = new Request("http://localhost/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: args.input,
      model: args.model || args.provider,
    }),
  });

  const res = await handleEmbeddings(req);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const listModelsTool = {
  name: "list_models",
  description: "Discover models available in 9Router by category/kind",
  inputSchema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["chat", "image", "tts", "stt", "embedding", "all"],
        description: "Kind of models to list (default: chat)",
      },
    },
  },
};

export async function handleListModels(args) {
  const targetKind = args.kind || "chat";
  const { PROVIDER_MODELS, getModelKind } = await import("../../shared/constants/models.js");
  const results = [];

  for (const [provider, models] of Object.entries(PROVIDER_MODELS)) {
    for (const model of models) {
      const modelId = typeof model === "string" ? model : model.id;
      const kind = getModelKind ? getModelKind(modelId) : "chat";
      if (targetKind === "all" || kind === targetKind) {
        results.push({
          id: `${provider}/${modelId}`,
          provider,
          name: typeof model === "object" ? model.name : modelId,
          kind,
        });
      }
    }
  }

  return {
    total: results.length,
    kind: targetKind,
    models: results,
  };
}
