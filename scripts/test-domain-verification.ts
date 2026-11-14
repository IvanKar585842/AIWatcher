/**
 * Domain verification proves host control. It does not change fetching.
 *
 * Usage: npx tsx scripts/test-domain-verification.ts
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { ApiError } from "../src/lib/errors";
import { containsAntiBotChallenge } from "../src/lib/monitoring/compatibility";
import { classifyMonitoringError } from "../src/lib/monitoring/error-messages";
import {
  fileTokenPresent,
  issueDomainVerification,
  matchVerification,
  metaTokenPresent,
  refusalGuidance,
  revokeDomainVerification,
  verificationTargets,
} from "../src/lib/domain-verification";

const prisma = new PrismaClient();
const token = "wfverify_testtokenvalue";

function assert(name: string, condition: boolean, detail = "") {
  if (!condition) {
    console.error("FAIL", name, detail);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

async function denied(name: string, run: () => Promise<unknown>) {
  try {
    await run();
    assert(name, false, "expected denial");
  } catch (error) {
    assert(name, error instanceof ApiError && error.status === 404, error instanceof Error ? error.message : "");
  }
}

async function main() {
  const source = readFileSync("src/lib/domain-verification.ts", "utf8");
  assert(
    "verification does not call the page fetcher",
    !source.includes("monitoring/fetcher") && !source.includes("monitoring/processor") && !source.includes("solve_cloudflare")
  );

  const targets = verificationTargets("https://example.com/pricing");
  assert(
    "the verification file stays on the monitor host",
    targets.host === "example.com" && targets.fileUrl === "https://example.com/.well-known/watchflowing-verify.txt"
  );

  const dns = matchVerification({
    token,
    dnsRecords: [`watchflowing-verify=${token}`],
    file: { error: "missing" },
    page: { error: "missing" },
  });
  assert("a DNS TXT record verifies the host", "method" in dns && dns.method === "dns");

  const file = matchVerification({
    token,
    dnsRecords: [],
    file: { status: 200, body: `${token}\n`, redirected: false },
    page: { error: "missing" },
  });
  assert("the verification file verifies the host", "method" in file && file.method === "file");
  assert(
    "a redirected file does not verify",
    !fileTokenPresent({ status: 200, body: token, redirected: true }, token)
  );

  const challenge = `<meta name="watchflowing-verify" content="${token}"><p>cf-browser-verification</p>`;
  assert("a challenge page is still a challenge when it also has the meta tag", containsAntiBotChallenge(challenge));
  const meta = matchVerification({
    token,
    dnsRecords: [],
    file: { status: 404, body: "", redirected: false },
    page: { status: 200, body: challenge, redirected: false },
  });
  assert("the meta tag can prove ownership", "method" in meta && meta.method === "meta");
  assert(
    "page text that merely contains the token does not prove ownership",
    !metaTokenPresent({ status: 200, body: `token ${token}`, redirected: false }, token)
  );
  const missed = matchVerification({
    token,
    dnsRecords: ["unrelated"],
    file: { status: 404, body: "", redirected: false },
    page: { status: 200, body: "<html>challenge-platform</html>", redirected: false },
  });
  assert("a challenge page without the token stays unverified", "error" in missed);

  assert(
    "a blocked check tells the owner this is not a bypass",
    refusalGuidance("Anti-bot challenge detected on this public page", false)?.includes("does not bypass") === true
  );
  assert(
    "verification still does not bypass a blocked check",
    refusalGuidance("Anti-bot challenge detected on this public page", true)?.includes("does not bypass") === true
  );
  assert(
    "robots.txt stays a refusal",
    refusalGuidance("Robots.txt blocked request", false)?.includes("robots.txt") === true
  );
  assert("an ordinary timeout has no verification lecture", refusalGuidance("Check timed out", false) === null);
  assert(
    "the blocked status offers ownership without a bypass",
    classifyMonitoringError("Anti-bot challenge detected").suggestions.some((line) => line.includes("does not bypass"))
  );

  const stamp = Date.now().toString();
  const owner = await prisma.user.create({
    data: { clerkId: `dom-owner-${stamp}`, email: `dom-owner-${stamp}@watchflowing.localhost`, name: "Owner" },
  });
  const outsider = await prisma.user.create({
    data: { clerkId: `dom-out-${stamp}`, email: `dom-out-${stamp}@watchflowing.localhost`, name: "Outsider" },
  });
  const monitor = await prisma.monitor.create({
    data: { userId: owner.id, name: "Domain site", url: `https://example.com/domain-${stamp}` },
  });
  await denied("an outsider cannot start verification", () => issueDomainVerification(outsider.id, monitor.id));
  const first = await issueDomainVerification(owner.id, monitor.id);
  const second = await issueDomainVerification(owner.id, monitor.id);
  assert("the same monitor keeps one verification token", first.token === second.token && second.created === false);
  const stored = await prisma.domainVerification.findUnique({ where: { monitorId: monitor.id } });
  assert("the token is stored and the monitor is not verified yet", stored?.token === first.token && stored.verifiedAt === null);
  await revokeDomainVerification(owner.id, monitor.id);
  const gone = await prisma.domainVerification.findUnique({ where: { monitorId: monitor.id } });
  assert("removing the check deletes the proof", gone === null);

  const example = await prisma.monitor.findFirst({
    where: { url: "https://example.com" },
    select: { id: true, workspaceId: true, clientId: true },
  });
  if (example) {
    const proof = await prisma.domainVerification.findUnique({ where: { monitorId: example.id } });
    assert(
      "the pre-existing example monitor was not verified or assigned",
      proof === null && example.workspaceId === null && example.clientId === null
    );
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
