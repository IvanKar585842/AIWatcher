import { ReportFrequency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { alertsLookRelated, importanceRank } from "@/lib/notifications/alert-group";
import { requireWorkspacePermission } from "@/lib/workspace-access";
import { readWorkspaceBrand } from "@/lib/reports/brand";
import { getReportPeriod } from "@/lib/reports/collect";

const NOT_FOUND = () => new ApiError("Not found", 404);

type ReportChange = {
  changeId: string;
  monitorName: string;
  summary: string;
  importance: string;
  category: string;
  similar: number;
};

export async function buildClientReport(
  userId: string,
  workspaceId: string,
  clientId: string,
  frequency: ReportFrequency
) {
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "clients.read");
    const client = await tx.client.findFirst({
      where: { id: clientId, workspaceId: access.workspaceId },
      select: { id: true, name: true },
    });
    if (!client) throw NOT_FOUND();
    const workspace = await tx.workspace.findUnique({
      where: { id: access.workspaceId },
      select: { name: true, settings: true },
    });
    if (!workspace) throw NOT_FOUND();
    const period = getReportPeriod(frequency);
    const monitors = await tx.monitor.findMany({
      where: { workspaceId: access.workspaceId, clientId: client.id },
      select: { id: true, status: true },
    });
    const rows = monitors.length
      ? await tx.change.findMany({
          where: {
            monitorId: { in: monitors.map((monitor) => monitor.id) },
            createdAt: { gte: period.start, lte: period.end },
          },
          orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
          take: 50,
          select: {
            id: true,
            summary: true,
            importance: true,
            category: true,
            monitor: { select: { name: true } },
          },
        })
      : [];
    const changes: ReportChange[] = [];
    for (const row of rows) {
      const match = changes.find((item) =>
        alertsLookRelated(
          { summary: item.summary, category: item.category },
          { summary: row.summary, category: row.category }
        )
      );
      if (!match) {
        changes.push({
          changeId: row.id,
          monitorName: row.monitor.name,
          summary: row.summary.slice(0, 280),
          importance: row.importance,
          category: row.category,
          similar: 1,
        });
        continue;
      }
      match.similar += 1;
      if (importanceRank(row.importance) > importanceRank(match.importance)) {
        match.changeId = row.id;
        match.monitorName = row.monitor.name;
        match.summary = row.summary.slice(0, 280);
        match.importance = row.importance;
        match.category = row.category;
      }
    }
    const brand = readWorkspaceBrand(workspace.settings);
    const importantCount = changes.filter((item) => item.importance === "HIGH" || item.importance === "CRITICAL").length;
    return {
      clientName: client.name,
      periodLabel: period.label,
      frequency,
      brandName: brand.brandName ?? workspace.name,
      poweredBy: brand.hidePoweredBy ? null : "Watchflowing",
      totalMonitors: monitors.length,
      monitorsActive: monitors.filter((monitor) => monitor.status === "ACTIVE").length,
      monitorsError: monitors.filter((monitor) => monitor.status === "ERROR").length,
      importantCount,
      changes: changes.slice(0, 10),
    };
  });
}
