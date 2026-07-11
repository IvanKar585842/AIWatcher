import { prisma } from "@/lib/db";
import { deliverWeeklyReport } from "./deliver";
import { generateWeeklyReportForUser } from "./generate";

/**
 * Monday (or on-demand cron) batch:
 * - only users with weeklyReportEnabled
 * - respects WEEKLY vs MONTHLY cadence simply via period cache key
 * - caches reports; skips AI when cached
 */
export async function runWeeklyReportCycle(options?: {
  userId?: string;
  force?: boolean;
  deliver?: boolean;
}) {
  const deliver = options?.deliver !== false;

  const users = await prisma.user.findMany({
    where: {
      weeklyReportEnabled: true,
      ...(options?.userId ? { id: options.userId } : {}),
    },
    select: {
      id: true,
      reportFrequency: true,
      reportType: true,
    },
    take: options?.userId ? 1 : 200,
  });

  const results: Array<{
    userId: string;
    reportId: string;
    cached: boolean;
    email: boolean;
    telegram: boolean;
  }> = [];

  for (const user of users) {
    try {
      // Monthly users: only generate around the 1st–2nd of month unless forced
      if (
        !options?.force &&
        user.reportFrequency === "MONTHLY" &&
        new Date().getDate() > 2
      ) {
        continue;
      }

      const { report, cached } = await generateWeeklyReportForUser(user.id, {
        force: options?.force,
        frequency: user.reportFrequency,
        reportType: user.reportType,
      });

      let email = false;
      let telegram = false;
      if (deliver && (!cached || options?.force)) {
        const sent = await deliverWeeklyReport(report.id);
        email = sent.email;
        telegram = sent.telegram;
      } else if (deliver && cached) {
        // Still try delivery if never sent
        const sent = await deliverWeeklyReport(report.id);
        email = sent.email;
        telegram = sent.telegram;
      }

      results.push({
        userId: user.id,
        reportId: report.id,
        cached,
        email,
        telegram,
      });
    } catch (err) {
      console.error(`[weekly-report] failed for ${user.id}`, err);
    }
  }

  return {
    processed: results.length,
    results,
  };
}
