import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getUsers, createUser } from "@/lib/localDb";

export const dynamic = "force-dynamic";

async function requireAdminSession() {
  const cookieStore = await cookies();
  const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
  if (!session || (session.role !== "admin" && session.userId && session.userId !== "admin")) {
    return null;
  }
  return session;
}

// GET /api/users - Listar todas as empresas/usuários
export async function GET() {
  try {
    const session = await requireAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const users = await getUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/users - Criar nova empresa/usuário
export async function POST(request) {
  try {
    const session = await requireAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { username, password, name, monthlyBudgetUsd, allowedCombos, allowedModels } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "username and password are required" }, { status: 400 });
    }

    const user = await createUser({
      username,
      password,
      name: name || username,
      role: "client",
      monthlyBudgetUsd: Number(monthlyBudgetUsd) || 0,
      allowedCombos: Array.isArray(allowedCombos) ? allowedCombos : [],
      allowedModels: Array.isArray(allowedModels) ? allowedModels : [],
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
