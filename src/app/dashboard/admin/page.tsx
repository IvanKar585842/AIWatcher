import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

/**
 * Legacy path — keep bookmarks working. Auth is still enforced server-side.
 */
export default async function DashboardAdminRedirect() {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }
  redirect("/admin");
}
