import type { Metadata } from "next";
import { CommandShell } from "@/components/dashboard/command/command-shell";
import { requireAdmin } from "@/lib/admin";
import { AdminForbidden } from "@/components/dashboard/admin/admin-forbidden";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch {
    return <AdminForbidden />;
  }

  return <CommandShell>{children}</CommandShell>;
}
