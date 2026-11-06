import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { getUserById, checkUserQuota } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const session = await getDashboardAuthSession(token);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role === "admin" || !session.userId || session.userId === "admin") {
      return NextResponse.json({
        user: {
          id: "admin",
          username: session.username || "admin",
          name: session.name || "Administrator",
          role: "admin",
        },
      });
    }

    const user = await getUserById(session.userId);
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "User inactive or not found" }, { status: 403 });
    }

    const quota = await checkUserQuota(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        allowedCombos: user.allowedCombos,
        allowedModels: user.allowedModels,
      },
      quota,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
