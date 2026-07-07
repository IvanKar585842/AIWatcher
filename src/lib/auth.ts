import { auth, currentUser } from "@clerk/nextjs/server";
import { Plan } from "@prisma/client";
import { ensureAdminPrivileges } from "@/lib/admin";
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

  return user;
}

export async function requireUser() {
  const user = await getOrCreateUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
