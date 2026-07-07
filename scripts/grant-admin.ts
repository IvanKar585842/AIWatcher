/**
 * Grant admin role + Business plan to configured admin emails.
 * Usage: npx tsx scripts/grant-admin.ts [email]
 */
import { Plan } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { getAdminEmails, isAdminEmail } from "../src/lib/admin";

const prisma = new PrismaClient();

async function grantAdmin(email: string) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user) {
    console.log(`User not found: ${normalized} — they must sign in once first.`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  });

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: { plan: Plan.BUSINESS, status: "active" },
    create: { userId: user.id, plan: Plan.BUSINESS, status: "active" },
  });

  console.log(`Admin granted: ${normalized} (BUSINESS plan, role=ADMIN)`);
}

async function main() {
  const arg = process.argv[2];
  const emails = arg ? [arg] : getAdminEmails();

  for (const email of emails) {
    if (!isAdminEmail(email) && arg) {
      console.warn(`Warning: ${email} is not in ADMIN_EMAILS — granting anyway via CLI.`);
    }
    await grantAdmin(email);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
