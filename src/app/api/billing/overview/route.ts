import { requireUser } from "@/lib/auth";
import { getUserPlanEntitlements, isAdminUser, getEffectivePlan } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailureFromError, apiSuccess } from "@/lib/api-response";
import { FEATURE_COMPARISON_ROWS, listActiveFeatures } from "@/lib/plan-features";
import { withRateLimit } from "@/lib/rate-limit";
import { toUserSubscriptionView } from "@/lib/subscription";
import { getUserUsage } from "@/lib/usage";
import {
  getMissingStripeEnvKeys,
  isStripeCheckoutReady,
  isStripePaymentsEnabled,
} from "@/lib/stripe-config";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "billing-overview",
      async () => {
        const plan = getEffectivePlan(user);
        const entitlements = getUserPlanEntitlements(user);
        const admin = isAdminUser(user);

        const [monitorCount, changeCount, usage, subscription] = await Promise.all([
          prisma.monitor.count({ where: { userId: user.id } }),
          prisma.change.count({
            where: { monitor: { userId: user.id } },
          }),
          getUserUsage(user.id),
          prisma.subscription.findUnique({ where: { userId: user.id } }),
        ]);

        const storageMb = Math.round(changeCount * 0.12 * 10) / 10;
        const activeFeatures = listActiveFeatures(plan);
        const paymentsEnabled = isStripePaymentsEnabled();
        const checkoutReady = isStripeCheckoutReady();

        return apiSuccess({
          plan,
          isAdmin: admin,
          payments: {
            enabled: paymentsEnabled,
            checkoutReady,
            plans: {
              PRO: isStripeCheckoutReady("PRO"),
              BUSINESS: isStripeCheckoutReady("BUSINESS"),
            },
            missingEnv: paymentsEnabled ? [] : getMissingStripeEnvKeys(),
          },
          subscription: subscription ? toUserSubscriptionView(subscription) : null,
          entitlements: {
            maxMonitors:
              entitlements.maxMonitors === Infinity ? null : entitlements.maxMonitors,
            historyDays: entitlements.historyDays,
            chatDailyMessages: entitlements.chatDailyMessages,
            aiAnalysesPerMonth: entitlements.aiAnalysesPerMonth,
            notificationsPerMonth: entitlements.notificationsPerMonth,
            storageMb: entitlements.storageMb,
            maxVisualMonitors:
              entitlements.maxVisualMonitors === Infinity
                ? null
                : entitlements.maxVisualMonitors,
            teamMembers: entitlements.teamMembers,
            telegram: entitlements.telegram,
            aiSummaries: entitlements.aiSummaries,
            teams: entitlements.teams,
            api: entitlements.api,
            priority: entitlements.priority,
            features: entitlements.features,
          },
          limits: {
            maxMonitors:
              entitlements.maxMonitors === Infinity ? null : entitlements.maxMonitors,
            aiSummaries: entitlements.aiSummaries,
            telegram: entitlements.telegram,
          },
          usage: {
            monitors: monitorCount,
            aiAnalyses: usage.aiRequests,
            monitoringChecks: usage.monitoringChecks,
            notifications: usage.notificationsSent,
            storageMb,
          },
          storageLimitMb: admin ? null : entitlements.storageMb,
          aiLimit: admin ? null : entitlements.aiAnalysesPerMonth,
          notificationLimit: admin ? null : entitlements.notificationsPerMonth,
          activeFeatures,
          comparison: FEATURE_COMPARISON_ROWS,
        });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
