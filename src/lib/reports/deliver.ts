import { prisma } from "@/lib/db";
import { sendWeeklyReportEmail } from "@/lib/notifications/weekly-report-email";
import { sendTelegramNotification } from "@/lib/notifications/telegram";
import type { WeeklyReportPayload } from "./types";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://watchflowing.com").replace(
    /\/$/,
    ""
  );
}

export async function deliverWeeklyReport(reportId: string): Promise<{
  email: boolean;
  telegram: boolean;
}> {
  const report = await prisma.weeklyReport.findUnique({
    where: { id: reportId },
    include: {
      user: {
        select: {
          email: true,
          name: true,
          emailNotificationsEnabled: true,
          telegramNotificationsEnabled: true,
          telegramChatId: true,
          telegramConnected: true,
        },
      },
    },
  });

  if (!report) return { email: false, telegram: false };

  const payload = report.payload as WeeklyReportPayload;
  const reportUrl = `${appUrl()}/dashboard/reports/${report.id}`;
  let email = false;
  let telegram = false;

  if (
    report.user.emailNotificationsEnabled &&
    !report.emailSentAt
  ) {
    try {
      await sendWeeklyReportEmail({
        to: report.user.email,
        name: report.user.name,
        periodLabel: payload.periodLabel,
        executiveSummary: report.executiveSummary,
        importantCount: payload.stats.importantCount,
        totalChanges: payload.stats.totalChanges,
        recommendations: payload.recommendations.slice(0, 3),
        importantChanges: payload.importantChanges.slice(0, 3).map((c) => ({
          title: c.monitorName,
          summary: c.summary,
          importance: c.importance,
        })),
        reportUrl,
      });
      email = true;
      await prisma.weeklyReport.update({
        where: { id: reportId },
        data: { emailSentAt: new Date() },
      });
    } catch (err) {
      console.error("[weekly-report] email failed", err);
    }
  }

  if (
    report.user.telegramNotificationsEnabled &&
    report.user.telegramConnected &&
    report.user.telegramChatId &&
    !report.telegramSentAt
  ) {
    try {
      const text = [
        "<b>Your weekly WatchFlowing report is ready.</b>",
        "",
        `${payload.stats.totalChanges} changes detected.`,
        `${payload.stats.importantCount} require attention.`,
        "",
        report.executiveSummary.slice(0, 280),
      ].join("\n");

      await sendTelegramNotification(report.user.telegramChatId, text, {
        parseMode: "HTML",
        replyMarkup: {
          inline_keyboard: [[{ text: "View report", url: reportUrl }]],
        },
      });
      telegram = true;
      await prisma.weeklyReport.update({
        where: { id: reportId },
        data: { telegramSentAt: new Date() },
      });
    } catch (err) {
      console.error("[weekly-report] telegram failed", err);
    }
  }

  return { email, telegram };
}
