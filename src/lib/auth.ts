import { auth, currentUser } from "@clerk/nextjs/server";
import { Plan } from "@prisma/client";
import { ensureAdminPrivileges } from "@/lib/admin";
import { trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/errors";

export async function getOrCreateUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) return null;

  const existing = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });
  const isNewUser = !existing;

  let user = await prisma.user.upsert({
    where: { clerkId: userId },
    update: {
      email,
      name: clerkUser.fullName ?? clerkUser.firstName ?? null,
      imageUrl: clerkUser.imageUrl ?? null,
    },
    create: {
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

  user = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { subscription: true },
  });

  if (isNewUser) {
    void trackEvent({
      type: "user.signup",
      userId: user.id,
      metadata: { emailDomain: email.split("@")[1] ?? null },
    });

    // Welcome email — never block login
    if (process.env.RESEND_API_KEY?.trim()) {
      void import("@/lib/notifications/email")
        .then(({ sendWelcomeEmail }) =>
          sendWelcomeEmail(email, user.name ?? email.split("@")[0] ?? "there")
        )
        .catch((err) => console.error("[auth] welcome email failed:", err));
    }
  }

  return user;
}

export async function requireUser() {
  const user = await getOrCreateUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
