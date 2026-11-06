let _handleSearch = null;
let _handleFetch = null;

async function getHandlers() {
  if (!_handleSearch) {
    const searchModule = await import("../../sse/handlers/search.js");
    _handleSearch = searchModule.handleSearch;
  }
  if (!_handleFetch) {
    const fetchModule = await import("../../sse/handlers/fetch.js");
    _handleFetch = fetchModule.handleFetch;
  }
  return { handleSearch: _handleSearch, handleFetch: _handleFetch };
}

export const webSearchTool = {
  name: "web_search",
  description: "Search the web using configured 9Router search providers (Tavily, Brave, etc.)",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query text" },
      provider: { type: "string", description: "Search provider or model id (optional, e.g. tavily, brave)" },
      maxResults: { type: "number", description: "Maximum number of search results (default 5)" },
      searchType: { type: "string", description: "Search type (web or news)" },
    },
    required: ["query"],
  },
};

export async function handleWebSearch(args) {
  const { handleSearch } = await getHandlers();
  const req = new Request("http://localhost/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: args.query,
      provider: args.provider || args.model,
      maxResults: args.maxResults,
      searchType: args.searchType,
    }),
  });

  const res = await handleSearch(req);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const webFetchTool = {
  name: "web_fetch",
  description: "Fetch web content from a URL converted to clean markdown, text, or HTML",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Target webpage URL to fetch" },
      provider: { type: "string", description: "Fetch provider id (optional, e.g. jina, firecrawl)" },
      format: { type: "string", enum: ["markdown", "text", "html"], description: "Output format" },
      maxCharacters: { type: "number", description: "Max characters limit" },
    },
    required: ["url"],
  },
};

export async function handleWebFetch(args) {
  const { handleFetch } = await getHandlers();
  const req = new Request("http://localhost/v1/web/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: args.url,
      provider: args.provider || args.model,
      format: args.format || "markdown",
      maxCharacters: args.maxCharacters,
    }),
  });

  const res = await handleFetch(req);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}
