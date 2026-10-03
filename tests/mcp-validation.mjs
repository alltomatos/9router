import assert from "node:assert/strict";
import { defaultEngine, PROTOCOL_VERSION } from "../src/mcp/engine.js";
import { registerAllTools } from "../src/mcp/tools/index.js";

async function runTests() {
  console.log("Starting MCP Server Unit Validation...");
  registerAllTools(defaultEngine);

  // 1. Handshake Initialize
  const initRes = await defaultEngine.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  });

  assert.equal(initRes.jsonrpc, "2.0");
  assert.equal(initRes.id, 1);
  assert.equal(initRes.result.serverInfo.name, "9router-mcp");
  assert.ok(initRes.result.capabilities.tools);
  console.log("✓ Handshake initialize passed");

  // 2. Tools List
  const listRes = await defaultEngine.handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });

  assert.ok(Array.isArray(listRes.result.tools));
  const toolNames = listRes.result.tools.map((t) => t.name);

  const expectedTools = [
    "web_search",
    "web_fetch",
    "generate_image",
    "text_to_speech",
    "speech_to_text",
    "embeddings",
    "list_models",
    "9router_status",
    "9router_list_providers",
    "9router_list_combos",
    "9router_create_combo",
    "9router_get_usage",
  ];

  for (const tool of expectedTools) {
    assert.ok(toolNames.includes(tool), `Missing expected tool: ${tool}`);
  }
  console.log(`✓ Tools list passed (${toolNames.length} tools registered)`);

  // 3. Ping
  const pingRes = await defaultEngine.handleMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "ping",
  });
  assert.equal(pingRes.id, 3);
  assert.deepEqual(pingRes.result, {});
  console.log("✓ Ping passed");

  // 4. Call unknown tool
  const errorRes = await defaultEngine.handleMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "unknown_tool",
      arguments: {},
    },
  });
  assert.ok(errorRes.error?.code === -32601 || errorRes.result?.isError === true);
  console.log("✓ Error handling passed");

  console.log("All MCP native tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
