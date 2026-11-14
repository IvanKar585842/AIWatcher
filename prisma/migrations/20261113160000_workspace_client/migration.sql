-- Workspace and Client are additive. Existing monitors keep userId and null tenancy links.
-- Deleting a workspace detaches monitors first, then removes only that workspace's clients.

ALTER TABLE "Monitor" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "Monitor" ADD COLUMN IF NOT EXISTS "clientId" TEXT;

CREATE TABLE IF NOT EXISTS "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Client" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Workspace_ownerId_idx" ON "Workspace"("ownerId");
CREATE INDEX IF NOT EXISTS "Client_workspaceId_idx" ON "Client"("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "Client_id_workspaceId_key" ON "Client"("id", "workspaceId");
CREATE INDEX IF NOT EXISTS "Monitor_workspaceId_idx" ON "Monitor"("workspaceId");
CREATE INDEX IF NOT EXISTS "Monitor_clientId_idx" ON "Monitor"("clientId");

DO $$ BEGIN
  ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A client link without a workspace is not a valid tenancy state.
-- Cross-workspace matching still requires monitor_tenant_guard.
DO $$ BEGIN
  ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_client_requires_workspace"
    CHECK ("clientId" IS NULL OR "workspaceId" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION "monitor_tenant_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  client_workspace text;
BEGIN
  IF NEW."clientId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "workspaceId" INTO client_workspace FROM "Client" WHERE "id" = NEW."clientId";
  IF client_workspace IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."workspaceId" IS DISTINCT FROM client_workspace THEN
    RAISE EXCEPTION 'monitor client belongs to another workspace';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "monitor_tenant_guard" ON "Monitor";
CREATE TRIGGER "monitor_tenant_guard"
BEFORE INSERT OR UPDATE OF "clientId", "workspaceId" ON "Monitor"
FOR EACH ROW
EXECUTE PROCEDURE "monitor_tenant_guard"();

CREATE OR REPLACE FUNCTION "client_workspace_immutable"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."workspaceId" IS DISTINCT FROM OLD."workspaceId" THEN
    RAISE EXCEPTION 'client workspace cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "client_workspace_immutable" ON "Client";
CREATE TRIGGER "client_workspace_immutable"
BEFORE UPDATE OF "workspaceId" ON "Client"
FOR EACH ROW
EXECUTE PROCEDURE "client_workspace_immutable"();

CREATE OR REPLACE FUNCTION "workspace_detach_monitors"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "Monitor"
  SET "clientId" = NULL, "workspaceId" = NULL
  WHERE "workspaceId" = OLD."id";
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "workspace_detach_monitors" ON "Workspace";
CREATE TRIGGER "workspace_detach_monitors"
BEFORE DELETE ON "Workspace"
FOR EACH ROW
EXECUTE PROCEDURE "workspace_detach_monitors"();
