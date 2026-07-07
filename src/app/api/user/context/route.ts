import { NextResponse } from "next/server";
import { getEffectivePlan, isAdminUser } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: (user as { role?: string }).role ?? "USER",
      isAdmin: isAdminUser(user),
      plan: getEffectivePlan(user),
    });
  } catch (error) {
    return apiFailureFromError(error);
  }
}
