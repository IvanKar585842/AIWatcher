import { DashboardWidgets } from "@/components/dashboard/widgets";
import { MonitorList } from "@/components/dashboard/monitor-list";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your web monitoring activity.</p>
      </div>
      <DashboardWidgets />
      <MonitorList />
    </div>
  );
}
