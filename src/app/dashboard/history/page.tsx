import { ChangeHistory } from "@/components/dashboard/change-history";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Change History</h1>
        <p className="text-muted-foreground">
          Timeline of all detected changes across your monitors.
        </p>
      </div>
      <ChangeHistory />
    </div>
  );
}
