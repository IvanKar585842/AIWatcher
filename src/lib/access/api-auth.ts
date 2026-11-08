import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/errors";
import { assertFeature } from "@/lib/plan-guards";
import { hashSecret } from "@/lib/access/secrets";

export async function requireApiUser(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.slice(0, 7).toLowerCase() === "bearer " ? header.slice(7).trim() : "";
  if (!token.startsWith("wf_")) throw new UnauthorizedError();

  const row = await prisma.apiKey.findFirst({
    where: { keyHash: hashSecret(token), revokedAt: null },
    include: { user: { include: { subscription: true } } },
  });
  if (!row) throw new UnauthorizedError();

  assertFeature(row.user, "API_ACCESS");
  await prisma.apiKey.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });
  return row.user;
}
