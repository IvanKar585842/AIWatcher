-- Workspace membership. Does not move existing monitors or create workspaces for old users.

DO $$ BEGIN
  CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "WorkspaceMember" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceInvite" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "acceptedById" TEXT,
  CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");
CREATE INDEX IF NOT EXISTS "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvite_codeHash_key" ON "WorkspaceInvite"("codeHash");
CREATE INDEX IF NOT EXISTS "WorkspaceInvite_workspaceId_idx" ON "WorkspaceInvite"("workspaceId");

DO $$ BEGIN
  ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_role_not_owner"
    CHECK ("role" <> 'OWNER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION "workspace_owner_immutable"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."ownerId" IS DISTINCT FROM OLD."ownerId" THEN
    RAISE EXCEPTION 'workspace owner cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "workspace_owner_immutable" ON "Workspace";
CREATE TRIGGER "workspace_owner_immutable"
BEFORE UPDATE OF "ownerId" ON "Workspace"
FOR EACH ROW
EXECUTE PROCEDURE "workspace_owner_immutable"();

CREATE OR REPLACE FUNCTION "workspace_member_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_id text;
BEGIN
  SELECT "ownerId" INTO owner_id FROM "Workspace" WHERE "id" = NEW."workspaceId";
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'workspace does not exist';
  END IF;
  IF NEW."role" = 'OWNER' AND NEW."userId" IS DISTINCT FROM owner_id THEN
    RAISE EXCEPTION 'only the workspace owner can hold the owner role';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."userId" = owner_id AND NEW."role" <> 'OWNER' THEN
    RAISE EXCEPTION 'workspace owner cannot be demoted';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."userId" IS DISTINCT FROM OLD."userId" THEN
    RAISE EXCEPTION 'membership user cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "workspace_member_guard" ON "WorkspaceMember";
CREATE TRIGGER "workspace_member_guard"
BEFORE INSERT OR UPDATE ON "WorkspaceMember"
FOR EACH ROW
EXECUTE PROCEDURE "workspace_member_guard"();

CREATE OR REPLACE FUNCTION "workspace_mark_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('watchflowing.deleting_workspace', OLD."id", true);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "workspace_mark_delete" ON "Workspace";
CREATE TRIGGER "workspace_mark_delete"
BEFORE DELETE ON "Workspace"
FOR EACH ROW
EXECUTE PROCEDURE "workspace_mark_delete"();

CREATE OR REPLACE FUNCTION "workspace_member_delete_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_id text;
BEGIN
  IF current_setting('watchflowing.deleting_workspace', true) = OLD."workspaceId" THEN
    RETURN OLD;
  END IF;
  SELECT "ownerId" INTO owner_id FROM "Workspace" WHERE "id" = OLD."workspaceId";
  IF owner_id IS NOT NULL AND OLD."userId" = owner_id THEN
    RAISE EXCEPTION 'workspace owner cannot be removed';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "workspace_member_delete_guard" ON "WorkspaceMember";
CREATE TRIGGER "workspace_member_delete_guard"
BEFORE DELETE ON "WorkspaceMember"
FOR EACH ROW
EXECUTE PROCEDURE "workspace_member_delete_guard"();
