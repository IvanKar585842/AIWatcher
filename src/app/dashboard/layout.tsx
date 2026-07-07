import { CommandShell } from "@/components/dashboard/command/command-shell";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CommandShell>{children}</CommandShell>;
}
