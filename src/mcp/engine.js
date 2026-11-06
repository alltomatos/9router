// Protocol Engine for Model Context Protocol (MCP) JSON-RPC 2.0
export const PROTOCOL_VERSION = "2024-11-05";
export const SERVER_NAME = "9router-mcp";
export const SERVER_VERSION = "0.5.81";

export class McpEngine {
  constructor() {
    this.tools = new Map();
  }

  registerTool(toolDefinition, handler) {
    if (!toolDefinition?.name) {
      throw new Error("Tool definition must have a 'name' property.");
    }
    this.tools.set(toolDefinition.name, {
      definition: toolDefinition,
      handler,
    });
  }

  getToolsList() {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async handleMessage(message) {
    if (!message || typeof message !== "object") {
      return this._makeError(null, -32600, "Invalid Request");
    }

    const { id, method, params } = message;

    // Handle notifications (no id)
    if (id === undefined || id === null) {
      if (method === "notifications/initialized") {
        return null;
      }
      return null;
    }

    try {
      switch (method) {
        case "initialize":
          return this._makeResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            serverInfo: {
              name: SERVER_NAME,
              version: SERVER_VERSION,
            },
            capabilities: {
              tools: {
                listChanged: false,
              },
            },
          });

        case "tools/list":
          return this._makeResult(id, {
            tools: this.getToolsList(),
          });

        case "tools/call": {
          const toolName = params?.name;
          const toolArgs = params?.arguments || {};
          const tool = this.tools.get(toolName);

          if (!tool) {
            return this._makeError(id, -32601, `Unknown tool: ${toolName}`);
          }

          try {
            const result = await tool.handler(toolArgs);
            return this._makeResult(id, {
              content: [
                {
                  type: "text",
                  text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                },
              ],
              isError: false,
            });
          } catch (toolError) {
            return this._makeResult(id, {
              content: [
                {
                  type: "text",
                  text: `Error executing tool '${toolName}': ${toolError.message || String(toolError)}`,
                },
              ],
              isError: true,
            });
          }
        }

        case "ping":
          return this._makeResult(id, {});

        default:
          return this._makeError(id, -32601, `Method not found: ${method}`);
      }
    } catch (err) {
      return this._makeError(id, -32603, `Internal error: ${err.message}`);
    }
  }

  _makeResult(id, result) {
    return {
      jsonrpc: "2.0",
      id,
      result,
    };
  }

  _makeError(id, code, message) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
      },
    };
  }
}

export const defaultEngine = new McpEngine();
