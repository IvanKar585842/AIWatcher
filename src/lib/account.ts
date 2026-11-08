import { prisma } from "@/lib/db";
import { isClerkConfigured } from "@/lib/clerk-config";
import { isStripeSecretConfigured } from "@/lib/stripe-config";

export function isDeleteConfirmed(value: unknown): boolean {
  return value === "DELETE";
}

type ExportUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  telegramUsername: string | null;
  telegramConnected: boolean;
  emailNotificationsEnabled: boolean;
  subscription: {
    plan: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date | null;
  } | null;
};

/** Personal data export. Omits session cookies, secrets, and stored HTML snapshots. */
export function buildAccountExport(input: {
  user: ExportUser;
  monitors: Array<{
    id: string;
    name: string;
    url: string;
    mode: string;
    status: string;
    interval: string;
    createdAt: Date;
    lastCheckedAt: Date | null;
    lastChangedAt: Date | null;
  }>;
  changes: Array<{
    id: string;
    monitorId: string;
    summary: string;
    createdAt: Date;
    importance: string;
  }>;
}) {
  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: input.user.id,
      email: input.user.email,
      name: input.user.name,
      createdAt: input.user.createdAt,
      telegramUsername: input.user.telegramUsername,
      telegramConnected: input.user.telegramConnected,
      emailNotificationsEnabled: input.user.emailNotificationsEnabled,
      plan: input.user.subscription?.plan ?? "FREE",
      subscriptionStatus: input.user.subscription?.status ?? null,
      cancelAtPeriodEnd: input.user.subscription?.cancelAtPeriodEnd ?? false,
      currentPeriodEnd: input.user.subscription?.currentPeriodEnd ?? null,
    },
    monitors: input.monitors,
    changes: input.changes,
  };
}

export async function exportAccount(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { subscription: true },
  });
  const [monitors, changes] = await Promise.all([
    prisma.monitor.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        url: true,
        mode: true,
        status: true,
        interval: true,
        createdAt: true,
        lastCheckedAt: true,
        lastChangedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.change.findMany({
      where: { monitor: { userId } },
      select: {
        id: true,
        monitorId: true,
        summary: true,
        createdAt: true,
        importance: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);
  return buildAccountExport({ user, monitors, changes });
}

export async function deleteAccount(user: { id: string; clerkId: string }) {
  const [monitors, subscription] = await Promise.all([
    prisma.monitor.findMany({ where: { userId: user.id }, select: { id: true } }),
    prisma.subscription.findUnique({ where: { userId: user.id } }),
  ]);

  if (subscription?.stripeSubscriptionId && isStripeSecretConfigured()) {
    const { getStripe } = await import("@/lib/stripe");
    await getStripe().subscriptions.cancel(subscription.stripeSubscriptionId).catch((error: unknown) => {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code === "resource_missing") return;
      throw error;
    });
  }

  const monitorIds = monitors.map((monitor) => monitor.id);
  if (monitorIds.length > 0) {
    await prisma.monitorQueue.deleteMany({ where: { monitorId: { in: monitorIds } } });
  }
  await prisma.analyticsEvent.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  if (isClerkConfigured() && user.clerkId && user.clerkId !== "local-dev") {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    await client.users.deleteUser(user.clerkId).catch(() => undefined);
  }
}
