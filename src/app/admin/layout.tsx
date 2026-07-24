import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AppProviders } from "@/components/providers/app-providers";
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
    return (
      <AppProviders>
        <AdminForbidden />
      </AppProviders>
    );
  }

  return (
    <AppProviders>
      <CommandShell>{children}</CommandShell>
      <SpeedInsights />
    </AppProviders>
  );
}
