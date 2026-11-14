import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { buildSiteInstall, issueSiteToken, readSiteInstallation, revokeSiteToken } from "@/lib/site-sdk";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`site-token-${id}`, async () => {
      const installation = await readSiteInstallation(user.id, id);
      return NextResponse.json({ installation });
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
    return withRateLimit(`site-token-issue-${id}`, async () => {
      const material = await issueSiteToken(user.id, id);
      const installation = buildSiteInstall(request.nextUrl.origin, material.token);
      return NextResponse.json(
        { token: material.token, prefix: material.prefix, ...installation },
        { status: 201 }
      );
    }, user.id, "sensitive");
  } catch (error) {
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
    return withRateLimit(`site-token-revoke-${id}`, async () => {
      await revokeSiteToken(user.id, id);
      return NextResponse.json({ revoked: true });
    }, user.id, "sensitive");
  } catch (error) {
    return apiFailureFromError(error);
  }
}
