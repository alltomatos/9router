import { describe, it, expect } from "vitest";
import { defaultEngine, PROTOCOL_VERSION } from "../../src/mcp/engine.js";
import "../../src/mcp/tools/index.js";

describe("9Router Native MCP Server", () => {
  it("responds to initialize handshake", async () => {
    const res = await defaultEngine.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    expect(res).toBeDefined();
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(1);
    expect(res.result.serverInfo.name).toBe("9router-mcp");
    expect(res.result.capabilities.tools).toBeDefined();
  });

  it("lists all registered tools via tools/list", async () => {
    const res = await defaultEngine.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    expect(res.result).toBeDefined();
    expect(Array.isArray(res.result.tools)).toBe(true);

    const toolNames = res.result.tools.map((t) => t.name);
    // Operações e Recursos
    expect(toolNames).toContain("web_search");
    expect(toolNames).toContain("web_fetch");
    expect(toolNames).toContain("generate_image");
    expect(toolNames).toContain("text_to_speech");
    expect(toolNames).toContain("speech_to_text");
    expect(toolNames).toContain("embeddings");
    expect(toolNames).toContain("list_models");

    // Gestão do 9Router
    expect(toolNames).toContain("9router_status");
    expect(toolNames).toContain("9router_list_providers");
    expect(toolNames).toContain("9router_list_combos");
    expect(toolNames).toContain("9router_create_combo");
    expect(toolNames).toContain("9router_get_usage");
  });

  it("executes list_models tool cleanly", async () => {
    const res = await defaultEngine.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "list_models",
        arguments: { kind: "chat" },
      },
    });

    expect(res.result).toBeDefined();
    expect(res.result.isError).toBe(false);
    expect(res.result.content[0].type).toBe("text");
    const parsed = JSON.parse(res.result.content[0].text);
    expect(parsed.total).toBeGreaterThan(0);
    expect(parsed.kind).toBe("chat");
  });

  it("executes 9router_status tool cleanly", async () => {
    const res = await defaultEngine.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "9router_status",
        arguments: {},
      },
    });

    expect(res.result).toBeDefined();
    expect(res.result.isError).toBe(false);
    const parsed = JSON.parse(res.result.content[0].text);
    expect(parsed.status).toBe("online");
    expect(parsed.version).toBeDefined();
  });

  it("handles unknown tool gracefully with isError or error frame", async () => {
    const res = await defaultEngine.handleMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "non_existent_tool",
        arguments: {},
      },
    });

    expect(res).toBeDefined();
    expect(res.error || res.result?.isError).toBeTruthy();
  });
});
