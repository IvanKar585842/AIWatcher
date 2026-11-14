/**
 * Pure tenancy rule for later workspace APIs.
 * The database trigger is the enforcement point. This function mirrors it.
 */
export function monitorTenancyError(input: {
  workspaceId: string | null;
  clientId: string | null;
  clientWorkspaceId: string | null;
}): string | null {
  if (!input.clientId) return null;
  if (!input.clientWorkspaceId) return "monitor client does not exist";
  if (input.workspaceId !== input.clientWorkspaceId) {
    return "monitor client belongs to another workspace";
  }
  return null;
}

export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type WorkspaceRoleName = (typeof WORKSPACE_ROLES)[number];

export const WORKSPACE_PERMISSIONS = [
  "workspace.read",
  "workspace.update",
  "workspace.delete",
  "members.read",
  "members.invite",
  "members.update",
  "members.remove",
  "clients.read",
  "clients.write",
  "monitors.read",
  "monitors.write",
] as const;
export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<WorkspaceRoleName, ReadonlySet<WorkspacePermission>> = {
  OWNER: new Set(WORKSPACE_PERMISSIONS),
  ADMIN: new Set([
    "workspace.read",
    "workspace.update",
    "members.read",
    "members.invite",
    "members.update",
    "members.remove",
    "clients.read",
    "clients.write",
    "monitors.read",
    "monitors.write",
  ]),
  MEMBER: new Set([
    "workspace.read",
    "members.read",
    "clients.read",
    "clients.write",
    "monitors.read",
    "monitors.write",
  ]),
  VIEWER: new Set(["workspace.read", "members.read", "clients.read", "monitors.read"]),
};

export function roleAllows(role: WorkspaceRoleName, permission: WorkspacePermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Ordinary role changes. OWNER is never granted or removed here. */
export function canGrantWorkspaceRole(
  actor: WorkspaceRoleName,
  target: WorkspaceRoleName | null,
  next: WorkspaceRoleName
): boolean {
  if (next === "OWNER" || target === "OWNER") return false;
  if (actor === "OWNER") return next === "ADMIN" || next === "MEMBER" || next === "VIEWER";
  if (actor === "ADMIN") {
    if (target === "ADMIN") return false;
    return next === "MEMBER" || next === "VIEWER";
  }
  return false;
}

export function canRemoveWorkspaceMember(actor: WorkspaceRoleName, target: WorkspaceRoleName): boolean {
  if (target === "OWNER") return false;
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") return target === "MEMBER" || target === "VIEWER";
  return false;
}

