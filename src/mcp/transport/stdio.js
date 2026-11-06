import readline from "readline";
import { defaultEngine } from "../engine.js";

export function startStdioServer(engine = defaultEngine) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const message = JSON.parse(trimmed);
      const response = await engine.handleMessage(message);
      if (response) {
        process.stdout.write(JSON.stringify(response) + "\n");
      }
    } catch (e) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${e.message}`,
        },
      };
      process.stdout.write(JSON.stringify(errorResponse) + "\n");
    }
  });

  process.stderr.write("[9router-mcp] Stdio transport started\n");
}
