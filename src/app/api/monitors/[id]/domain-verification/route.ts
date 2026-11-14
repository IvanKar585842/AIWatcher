import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import {
  checkDomainVerification,
  issueDomainVerification,
  readDomainVerification,
  revokeDomainVerification,
} from "@/lib/domain-verification";

const bodySchema = z.object({ action: z.enum(["issue", "check"]) }).strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`domain-verification-${id}`, async () => {
      const verification = await readDomainVerification(user.id, id);
      return NextResponse.json({ verification });
    }, user.id);
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`domain-verification-check-${id}`, async () => {
      const body = bodySchema.parse(await parseJsonBody(request));
      if (body.action === "issue") {
        const issued = await issueDomainVerification(user.id, id);
        const verification = await readDomainVerification(user.id, id);
        return NextResponse.json({ token: issued.token, verification }, { status: issued.created ? 201 : 200 });
      }
      const result = await checkDomainVerification(user.id, id);
      const verification = await readDomainVerification(user.id, id);
      return NextResponse.json({ result, verification });
    }, user.id, "sensitive");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Choose issue or check" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`domain-verification-revoke-${id}`, async () => {
      await revokeDomainVerification(user.id, id);
      return NextResponse.json({ removed: true });
    }, user.id, "sensitive");
  } catch (error) {
    return apiFailureFromError(error);
  }
}
