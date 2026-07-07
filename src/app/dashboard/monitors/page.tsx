import { MonitorList } from "@/components/dashboard/monitor-list";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";

export default function MonitorsPage() {
  return (
    <div className="p-4 lg:p-6">
      <CommandPageHeader
        label="Network"
        title="Monitors"
        description="Manage every website under active surveillance."
      />
      <MonitorList />
    </div>
  );
}
