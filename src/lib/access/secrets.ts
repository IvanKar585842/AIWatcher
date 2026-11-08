import { createHash, randomBytes } from "node:crypto";

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createApiKey(name: string): { name: string; token: string; prefix: string; hash: string } {
  const trimmed = name.trim().slice(0, 40);
  if (trimmed.length < 1) {
    throw new Error("API key name is required");
  }
  const token = `wf_${randomBytes(24).toString("base64url")}`;
  return {
    name: trimmed,
    token,
    prefix: token.slice(0, 11),
    hash: hashSecret(token),
  };
}

export const TEAM_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createTeamInvite(now = new Date()): { code: string; hash: string; expiresAt: Date } {
  const code = `wfteam_${randomBytes(24).toString("base64url")}`;
  return {
    code,
    hash: hashSecret(code),
    expiresAt: new Date(now.getTime() + TEAM_INVITE_TTL_MS),
  };
}

export function inviteIsOpen(
  invite: { expiresAt: Date; acceptedAt: Date | null },
  now = new Date()
): boolean {
  return invite.acceptedAt == null && invite.expiresAt.getTime() > now.getTime();
}

export function canManageTeam(role: "OWNER" | "MEMBER"): boolean {
  return role === "OWNER";
}

export function canReadTeamMonitor(input: {
  userId: string;
  ownerId: string;
  memberIds: string[];
}): boolean {
  return input.userId === input.ownerId || input.memberIds.includes(input.userId);
}

export function teamHasRoom(memberCount: number, limit: number): boolean {
  return Number.isFinite(limit) && memberCount < limit;
}
