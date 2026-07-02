import { DashboardSidebar } from "@/components/dashboard/sidebar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <DashboardSidebar />
      <main className="md:pl-64">
        <div className="container mx-auto p-6 pt-16 md:pt-6 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
