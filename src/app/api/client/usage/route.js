import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getUserById, checkUserQuota, getCombos } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);

    if (!session || !session.userId || session.role !== "client") {
      return NextResponse.json({ error: "Client access required" }, { status: 403 });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const quota = await checkUserQuota(user.id);
    const allCombos = await getCombos();
    const resolvedCombos = allCombos.filter((c) =>
      user.allowedCombos.includes(c.id) || user.allowedCombos.includes(c.name)
    );

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
      quota,
      allowedModels: user.allowedModels,
      allowedCombos: resolvedCombos,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
