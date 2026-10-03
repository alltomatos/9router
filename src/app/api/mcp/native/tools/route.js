import { NextResponse } from "next/server";
import { defaultEngine } from "@/mcp/engine";
import "@/mcp/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tools = defaultEngine.getToolsList();
  return NextResponse.json({ tools });
}
