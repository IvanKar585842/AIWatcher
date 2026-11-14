import { ChangeHistory } from "@/components/dashboard/change-history";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";

export default function HistoryPage() {
  return (
    <div className="p-4 lg:p-6">
      <CommandPageHeader
        label="Archive"
        title="Change History"
        description="What changed on the sites your company owns, and when."
      />
      <ChangeHistory />
    </div>
  );
}
