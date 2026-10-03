import { registerSseSession, unregisterSseSession } from "@/mcp/transport/sse";
import "@/mcp/tools"; // Ensure tools are registered

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let sid;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk) => controller.enqueue(encoder.encode(chunk));
      sid = registerSseSession(send);

      // MCP SSE protocol: advertise message endpoint to client
      send(`event: endpoint\ndata: /api/mcp/native/message?sessionId=${sid}\n\n`);
    },
    cancel() {
      if (sid) unregisterSseSession(sid);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
