import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
