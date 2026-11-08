import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getEffectivePlan, getUserPlanEntitlements } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { describeDeploymentSchedule } from "@/lib/monitoring/deployment-schedule";
import { describeAlertChannels } from "@/lib/notifications/alert-readiness";
import { isFeatureEnabled } from "@/lib/plan-features";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "user-access",
      async () => {
        const plan = getEffectivePlan(user);
        const entitlements = getUserPlanEntitlements(user);
        const fresh = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            email: true,
            emailNotificationsEnabled: true,
            telegramConnected: true,
            telegramNotificationsEnabled: true,
            webhookUrl: true,
          },
        });

        let apiKeys: Array<{
          id: string;
          name: string;
          prefix: string;
          createdAt: Date;
          lastUsedAt: Date | null;
          revokedAt: Date | null;
        }> = [];
        let team: {
          id: string;
          name: string;
          role: "OWNER" | "MEMBER";
          memberCount: number;
          sharedMonitors: number;
        } | null = null;

        try {
          apiKeys = await prisma.apiKey.findMany({
            where: { userId: user.id, revokedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              prefix: true,
              createdAt: true,
              lastUsedAt: true,
              revokedAt: true,
            },
          });
          const membership = await prisma.teamMember.findFirst({
            where: { userId: user.id },
            include: {
              team: {
                include: { _count: { select: { members: true, monitors: true } } },
              },
            },
          });
          if (membership) {
            team = {
              id: membership.team.id,
              name: membership.team.name,
              role: membership.role,
              memberCount: membership.team._count.members,
              sharedMonitors: membership.team._count.monitors,
            };
          }
        } catch {
          apiKeys = [];
          team = null;
        }

        return NextResponse.json({
          schedule: describeDeploymentSchedule(),
          paymentsReady: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
          alerts: describeAlertChannels({
            resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
            hasEmail: Boolean(fresh?.email?.trim()),
            emailEnabled: fresh?.emailNotificationsEnabled !== false,
            telegramTokenConfigured: Boolean(
              process.env.TELEGRAM_BOT_TOKEN?.trim() ||
                process.env.TELEGRAM_TOKEN?.trim() ||
                process.env.TG_BOT_TOKEN?.trim()
            ),
            telegramConnected: fresh?.telegramConnected === true,
            telegramEnabled: fresh?.telegramNotificationsEnabled !== false,
            planAllowsTelegram: entitlements.telegram,
            webhookConfigured: Boolean(fresh?.webhookUrl),
            planAllowsWebhook: isFeatureEnabled(plan, "WEBHOOKS"),
          }),
          webhook: {
            configured: Boolean(fresh?.webhookUrl),
            url: fresh?.webhookUrl ?? null,
            allowed: isFeatureEnabled(plan, "WEBHOOKS"),
          },
          api: {
            allowed: isFeatureEnabled(plan, "API_ACCESS"),
            keys: apiKeys,
          },
          team: {
            allowed: isFeatureEnabled(plan, "TEAM_MEMBERS"),
            limit: entitlements.teamMembers,
            current: team,
          },
        });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
