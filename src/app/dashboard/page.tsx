import { CommandCenter } from "@/components/dashboard/command/command-center";
import { MonitorList } from "@/components/dashboard/monitor-list";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <CommandCenter />
      <MonitorList />
    </div>
  );
}
