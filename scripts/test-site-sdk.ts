/**
 * Owner-installed site script: hashed key, origin check, public page text only.
 *
 * Usage: npx tsx scripts/test-site-sdk.ts
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { loadEnv } from "./load-env";
import { hashSecret } from "../src/lib/access/secrets";
import { ApiError } from "../src/lib/errors";
import { POST } from "../src/app/api/ingest/site/route";
import { POST as postReport } from "../src/app/api/ingest/report/route";
import { acceptOwnerReport, acceptScriptPage, ownerReportSchema } from "../src/lib/monitoring/owner-report";
import {
  acceptSiteSignal,
  cleanSignalMessage,
  issueSiteToken,
  originMatchesMonitor,
  revokeSiteToken,
  safeSelector,
  siteEventSchema,
} from "../src/lib/site-sdk";
import { createWorkspace, listWorkspaceProblems } from "../src/lib/workspace-access";

loadEnv();
const prisma = new PrismaClient();

function assert(name: string, condition: boolean, detail = "") {
  if (!condition) {
    console.error("FAIL", name, detail);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

async function denied(name: string, run: () => Promise<unknown>, status: number) {
  try {
    await run();
    assert(name, false, "expected denial");
  } catch (error) {
    assert(name, error instanceof ApiError && error.status === status, error instanceof Error ? error.message : "");
  }
}

async function main() {
  const script = readFileSync("public/monitor.js", "utf8");
  assert(
    "the script does not read cookies, storage, or form values",
    !script.includes("document.cookie") &&
      !script.includes("localStorage") &&
      !script.includes("sessionStorage") &&
      !script.includes("innerHTML") &&
      !script.includes(".value") &&
      script.includes("textContent") &&
      script.includes("form,input,textarea")
  );
  assert("a matching origin is accepted", originMatchesMonitor("https://example.com", "https://example.com/pricing"));
  assert("another host is rejected", !originMatchesMonitor("https://evil.test", "https://example.com/pricing"));
  assert("a form selector is rejected", safeSelector("input[type=password]") === null && safeSelector("#checkout") === "#checkout");
  assert("a sensitive error message is replaced", cleanSignalMessage("password=hunter2") === "error");
  assert("extra event fields are rejected", !siteEventSchema.safeParse({ siteKey: "wfsite_abcdefghijklmnopqrstuvwxyz", kind: "js_error", html: "<form>" }).success);

  const stamp = Date.now().toString();
  const owner = await prisma.user.create({
    data: { clerkId: `sdk-owner-${stamp}`, email: `sdk-owner-${stamp}@watchflowing.localhost`, name: "Owner" },
  });
  const outsider = await prisma.user.create({
    data: { clerkId: `sdk-out-${stamp}`, email: `sdk-out-${stamp}@watchflowing.localhost`, name: "Outsider" },
  });
  const workspace = await createWorkspace(owner.id, "SDK Agency");
  const other = await createWorkspace(outsider.id, "Other SDK");
  const client = await prisma.client.create({ data: { workspaceId: workspace.id, name: "SDK Client" } });
  const monitor = await prisma.monitor.create({
    data: {
      userId: owner.id,
      workspaceId: workspace.id,
      clientId: client.id,
      name: "SDK site",
      url: `https://example.com/sdk-${stamp}`,
    },
  });
  const foreign = await prisma.monitor.create({
    data: { userId: outsider.id, workspaceId: other.id, name: "Foreign SDK", url: `https://example.com/foreign-sdk-${stamp}` },
  });

  await denied("an outsider cannot create a key for this monitor", () => issueSiteToken(outsider.id, monitor.id), 404);
  const issued = await issueSiteToken(owner.id, monitor.id);
  const stored = await prisma.siteToken.findUnique({ where: { monitorId: monitor.id } });
  assert(
    "the key is stored only as a hash",
    stored?.tokenHash === hashSecret(issued.token) && stored.tokenHash !== issued.token && !stored.prefix.includes(issued.token.slice(-8))
  );

  await acceptSiteSignal({
    token: issued.token,
    origin: "https://example.com",
    event: { siteKey: issued.token, kind: "js_error", message: "checkout broke" },
  });
  await acceptSiteSignal({
    token: issued.token,
    origin: "https://example.com",
    event: { siteKey: issued.token, kind: "element_missing", selector: "#checkout" },
  });
  await acceptSiteSignal({
    token: issued.token,
    origin: "https://example.com",
    event: { siteKey: issued.token, kind: "element_present", selector: ".selected" },
  });
  await denied("a form selector is not stored", () =>
    acceptSiteSignal({
      token: issued.token,
      origin: "https://example.com",
      event: { siteKey: issued.token, kind: "element_missing", selector: "input[name=card]" },
    }),
  400);
  await denied("a different host cannot send a signal", () =>
    acceptSiteSignal({
      token: issued.token,
      origin: "https://evil.test",
      event: { siteKey: issued.token, kind: "js_error", message: "stolen" },
    }),
  403);

  const signals = await prisma.siteSignal.findMany({ where: { monitorId: monitor.id } });
  assert(
    "only the three allowed signals were stored",
    signals.length === 3 && signals.some((item) => item.message === "checkout broke") && !signals.some((item) => item.message === "stolen")
  );
  const changes = await prisma.change.count({ where: { monitorId: monitor.id } });
  const snapshots = await prisma.snapshot.count({ where: { monitorId: monitor.id } });
  assert("a signal does not create a change or a snapshot", changes === 0 && snapshots === 0);

  const problems = await listWorkspaceProblems(owner.id, workspace.id);
  assert(
    "workspace problems include the error and the missing element",
    problems.some((item) => item.reason === "signal" && item.summary === "checkout broke") &&
      problems.some((item) => item.summary === "#checkout is missing") &&
      !problems.some((item) => item.summary?.includes(".selected"))
  );
  const foreignProblems = await listWorkspaceProblems(outsider.id, other.id);
  assert("another workspace does not see these signals", foreignProblems.every((item) => item.reason !== "signal"));

  const response = await POST(
    new NextRequest("http://localhost:3000/api/ingest/site", {
      method: "POST",
      headers: { origin: "https://example.com", "content-type": "text/plain" },
      body: JSON.stringify({ siteKey: issued.token, kind: "js_error", message: "from the route", html: "<form>" }),
    })
  );
  assert("the ingest route rejects extra fields", response.status === 400);

  const accepted = await POST(
    new NextRequest("http://localhost:3000/api/ingest/site", {
      method: "POST",
      headers: { origin: "https://example.com", "content-type": "text/plain" },
      body: JSON.stringify({ siteKey: issued.token, kind: "js_error", message: "from the route" }),
    })
  );
  assert("the ingest route stores a valid event", accepted.status === 200);

  const page = `<main><h1>Pricing</h1><p>${"The public plan costs nineteen dollars. ".repeat(3)}</p></main>`;
  assert(
    "a browser cannot submit an owner report",
    (
      await postReport(
        new NextRequest("http://localhost:3000/api/ingest/report", {
          method: "POST",
          headers: { origin: "https://example.com", "content-type": "application/json" },
          body: JSON.stringify({ siteKey: issued.token, status: 200, html: page }),
        })
      )
    ).status === 403
  );
  assert(
    "extra owner report fields are rejected",
    !ownerReportSchema.safeParse({ siteKey: issued.token, status: 200, html: page, cookie: "session" }).success
  );
  const first = await acceptOwnerReport({ siteKey: issued.token, status: 200, html: page });
  const afterFirst = await prisma.snapshot.count({ where: { monitorId: monitor.id } });
  assert("the first server report stores a baseline snapshot", first.storedPage && first.result === "baseline" && afterFirst === 1);
  const same = await acceptOwnerReport({ siteKey: issued.token, status: 200, html: page });
  const afterSame = await prisma.snapshot.count({ where: { monitorId: monitor.id } });
  assert("an unchanged server report does not add a snapshot", same.storedPage && same.result === "no_change" && afterSame === 1);
  await acceptOwnerReport({ siteKey: issued.token, status: 503 });
  const afterStatus = await prisma.snapshot.findFirst({
    where: { monitorId: monitor.id },
    orderBy: { createdAt: "desc" },
    select: { contentHash: true },
  });
  const statusMonitor = await prisma.monitor.findUnique({
    where: { id: monitor.id },
    select: { errorMessage: true, status: true },
  });
  assert(
    "an error status keeps the snapshot and records the server code",
    afterStatus != null &&
      (await prisma.snapshot.count({ where: { monitorId: monitor.id } })) === 1 &&
      (statusMonitor?.errorMessage ?? "").includes("HTTP 503") &&
      statusMonitor?.status === "ACTIVE"
  );
  await prisma.monitor.update({ where: { id: monitor.id }, data: { status: "PAUSED" } });
  await denied("a paused site does not accept a server report", () => acceptOwnerReport({ siteKey: issued.token, status: 200, html: page }), 409);
  await prisma.monitor.update({ where: { id: monitor.id }, data: { status: "ACTIVE" } });

  const watched = await prisma.monitor.create({
    data: {
      userId: owner.id,
      workspaceId: workspace.id,
      clientId: client.id,
      name: "Script site",
      url: `https://example.com/script-${stamp}`,
    },
  });
  const scriptKey = await issueSiteToken(owner.id, watched.id);
  const pageText = "Pricing The public plan costs nineteen dollars. Contact [email] for the company plan.";
  const seen = await acceptScriptPage({
    token: scriptKey.token,
    origin: "https://example.com",
    text: pageText.replace("[email]", "sales@example.com"),
  });
  const scriptSnapshot = await prisma.snapshot.findFirst({
    where: { monitorId: watched.id },
    orderBy: { createdAt: "desc" },
    select: { extractedText: true },
  });
  assert(
    "a consented script stores the public page and redacts email addresses",
    seen.storedPage &&
      seen.result === "baseline" &&
      (scriptSnapshot?.extractedText ?? "").includes("[email]") &&
      !(scriptSnapshot?.extractedText ?? "").includes("sales@example.com")
  );
  const again = await acceptScriptPage({ token: scriptKey.token, origin: "https://example.com", text: pageText });
  const scriptSnapshots = await prisma.snapshot.count({ where: { monitorId: watched.id } });
  assert("a second look in the same minute does not store another snapshot", !again.storedPage && scriptSnapshots === 1);
  await denied("another host cannot send the public page", () =>
    acceptScriptPage({ token: scriptKey.token, origin: "https://evil.test", text: pageText }),
  403);
  await denied("cookies are not accepted in the public page", () =>
    acceptScriptPage({
      token: scriptKey.token,
      origin: "https://example.com",
      text: "authorization: Bearer secret The public plan costs nineteen dollars today.",
    }),
  400);
  assert(
    "a small error event cannot carry page text",
    !siteEventSchema.safeParse({ siteKey: scriptKey.token, kind: "js_error", message: "broken", text: pageText }).success
  );

  await revokeSiteToken(owner.id, monitor.id);
  await denied("a revoked key cannot send a server report", () => acceptOwnerReport({ siteKey: issued.token, status: 200, html: page }), 404);
  await denied("a revoked key is rejected", () =>
    acceptSiteSignal({
      token: issued.token,
      origin: "https://example.com",
      event: { siteKey: issued.token, kind: "js_error", message: "after revoke" },
    }),
  404);
  await denied("an outsider cannot revoke this key", () => revokeSiteToken(outsider.id, monitor.id), 404);

  const example = await prisma.monitor.findFirst({
    where: { url: "https://example.com" },
    select: { workspaceId: true, clientId: true },
  });
  if (example) {
    assert("the pre-existing example monitor was not assigned", example.workspaceId === null && example.clientId === null);
  } else {
    console.log("SKIP pre-existing example monitor — not in this database");
  }

  await prisma.user.deleteMany({ where: { id: { in: [owner.id, outsider.id] } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
