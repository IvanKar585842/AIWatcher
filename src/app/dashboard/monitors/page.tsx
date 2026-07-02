import { MonitorList } from "@/components/dashboard/monitor-list";

export default function MonitorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monitors</h1>
        <p className="text-muted-foreground">Manage all your webpage monitors.</p>
      </div>
      <MonitorList />
    </div>
  );
}
