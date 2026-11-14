import { MonitorList } from "@/components/dashboard/monitor-list";
import { CreateMonitorDialog } from "@/components/dashboard/create-monitor-dialog";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";

export default function MonitorsPage() {
  return (
    <div className="p-4 lg:p-6">
      <CommandPageHeader
        label="Your sites"
        title="Sites"
        description="Pages your company owns. The assistant explains what changes."
      >
        <CreateMonitorDialog
          variant="os"
          enableTourControl
          triggerLabel="+ Add a site"
          triggerClassName="h-11 px-6 text-sm font-medium shadow-[0_0_32px_-8px_rgba(34,211,238,0.55)]"
        />
      </CommandPageHeader>
      <MonitorList
        embedded
        showHeaderCreate={false}
        emptyStateShowCreate
        emptyVariant="monitors"
      />
    </div>
  );
}
