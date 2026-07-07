import { MonitorList } from "@/components/dashboard/monitor-list";
import { CreateMonitorDialog } from "@/components/dashboard/create-monitor-dialog";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";

export default function MonitorsPage() {
  return (
    <div className="p-4 lg:p-6">
      <CommandPageHeader
        label="Network"
        title="Monitors"
        description="Manage every website under active surveillance."
      >
        <CreateMonitorDialog
          variant="os"
          triggerLabel="+ Create Monitor"
          triggerClassName="h-11 px-6 text-sm font-medium shadow-[0_0_32px_-8px_rgba(34,211,238,0.55)]"
        />
      </CommandPageHeader>
      <MonitorList embedded />
    </div>
  );
}
