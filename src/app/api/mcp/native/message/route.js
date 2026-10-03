import { NextResponse } from "next/server";
import { handleIncomingMessage } from "@/mcp/transport/sse";
import "@/mcp/tools"; // Ensure tools are registered

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId parameter" }, { status: 400 });
  }

  try {
    const body = await request.json();
    await handleIncomingMessage(sessionId, body);
    return new Response(null, { status: 202 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
