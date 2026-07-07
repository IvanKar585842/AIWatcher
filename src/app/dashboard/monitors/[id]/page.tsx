"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MonitorSettings } from "@/components/dashboard/monitor-settings";

export default function MonitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: monitorId } = use(params);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
      <Link
        href="/dashboard/monitors"
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-cyan-400"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Monitors
      </Link>
      <MonitorSettings monitorId={monitorId} />
    </div>
  );
}
