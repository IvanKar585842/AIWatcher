import { auth, currentUser } from "@clerk/nextjs/server";
import { Plan } from "@prisma/client";
import { ensureAdminPrivileges, isAdminEmail } from "@/lib/admin";
import { trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/errors";

/**
 * Hot path for authenticated API/dashboard:
 * 1) Prisma lookup by clerkId (no Clerk API round-trip)
 * 2) Only call currentUser() when the row is missing
 * Avoids previous: currentUser + upsert + findUniqueOrThrow on every request.
 */
export async function getOrCreateUser() {
  const clerkConfigured =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!.includes("placeholder");
  if (!clerkConfigured) return null;

  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { subscription: true },
  });

  if (existing) {
    // Bootstrap allowlisted admins once; skip for everyone else
    if (existing.role !== "ADMIN" && isAdminEmail(existing.email)) {
      await ensureAdminPrivileges(existing.id, existing.email);
      return prisma.user.findUniqueOrThrow({
        where: { id: existing.id },
        include: { subscription: true },
      });
    }
    return existing;
  }

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) return null;

  const user = await prisma.user.create({
    data: {
      clerkId: userId,
      email,
      name: clerkUser.fullName ?? clerkUser.firstName ?? null,
      imageUrl: clerkUser.imageUrl ?? null,
      subscription: {
        create: { plan: Plan.FREE },
      },
    },
    include: { subscription: true },
  });

  await ensureAdminPrivileges(user.id, email);

  const fresh = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { subscription: true },
  });

  void trackEvent({
    type: "user.signup",
    userId: fresh.id,
    metadata: { emailDomain: email.split("@")[1] ?? null },
  });

  if (process.env.RESEND_API_KEY?.trim()) {
    void import("@/lib/notifications/email")
      .then(({ sendWelcomeEmail }) =>
        sendWelcomeEmail(email, fresh.name ?? email.split("@")[0] ?? "there")
      )
      .catch((err) => console.error("[auth] welcome email failed:", err));
  }

  return fresh;
}

export async function requireUser() {
  const user = await getOrCreateUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
