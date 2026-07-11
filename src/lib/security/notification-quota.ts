import { NotificationChannel } from "@prisma/client";
import { getUserPlanEntitlements, isAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { securityLog } from "@/lib/security/log";

function startOfUtcMonth(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Enforce plan notificationsPerMonth for outbound email/Telegram.
 * In-app notifications are not counted against this quota.
 */
export async function canSendOutboundNotification(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) {
    return { allowed: false, used: 0, limit: 0 };
  }

  if (isAdminUser(user)) {
    return { allowed: true, used: 0, limit: null };
  }

  const limit = getUserPlanEntitlements(user).notificationsPerMonth;
  if (limit == null) {
    return { allowed: true, used: 0, limit: null };
  }

  const used = await prisma.notification.count({
    where: {
      userId,
      status: "SENT",
      channel: { in: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM] },
      createdAt: { gte: startOfUtcMonth() },
    },
  });

  const allowed = used < limit;
  if (!allowed) {
    securityLog({
      type: "quota.exceeded",
      message: "Outbound notification monthly quota exceeded",
      userId,
      metadata: { used, limit },
    });
  }

  return { allowed, used, limit };
}
