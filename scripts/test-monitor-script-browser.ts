/**
 * Loads the real monitor.js in a browser and checks the stored page.
 * Requires the local site at http://127.0.0.1:3000.
 *
 * Usage: npx tsx scripts/test-monitor-script-browser.ts
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "./load-env";
import { issueSiteToken } from "../src/lib/site-sdk";

loadEnv();
const prisma = new PrismaClient();
const appOrigin = "http://127.0.0.1:3000";

function installedChromium(): string | undefined {
  const root = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  if (!fs.existsSync(root)) return undefined;
  const hits = fs
    .readdirSync(root)
    .filter((name) => name.startsWith("chromium_headless_shell-"))
    .sort();
  const latest = hits.at(-1);
  if (!latest) return undefined;
  const exe = path.join(root, latest, "chrome-headless-shell-win64", "chrome-headless-shell.exe");
  return fs.existsSync(exe) ? exe : undefined;
}

function assert(name: string, condition: boolean, detail = "") {
  if (!condition) {
    console.error("FAIL", name, detail);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

function startPageServer() {
  let html = "";
  const server = http.createServer((_req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html);
  });
  return new Promise<{ port: number; setHtml: (value: string) => void; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        port,
        setHtml: (value) => {
          html = value;
        },
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

async function main() {
  const ready = await fetch(`${appOrigin}/monitor.js`).then((response) => response.ok).catch(() => false);
  assert("the local site is serving monitor.js", ready);
  if (!ready) return;

  await prisma.user.deleteMany({ where: { clerkId: { startsWith: "script-browser-" } } });
  const pageServer = await startPageServer();
  const stamp = Date.now().toString();
  const owner = await prisma.user.create({
    data: { clerkId: `script-browser-${stamp}`, email: `script-browser-${stamp}@watchflowing.localhost`, name: "Script browser" },
  });
  const monitor = await prisma.monitor.create({
    data: {
      userId: owner.id,
      name: "Script browser",
      url: `http://127.0.0.1:${pageServer.port}/pricing`,
    },
  });
  const issued = await issueSiteToken(owner.id, monitor.id);
  pageServer.setHtml(`<!doctype html><html><body>
    <main>
      <h1>Pricing</h1>
      <p>The public plan costs nineteen dollars for this company.</p>
      <p>Write to sales@example.com for a quote.</p>
      <form><label>Card</label><input value="secret-card-4111"><textarea>secret note</textarea></form>
    </main>
    <script src="${appOrigin}/monitor.js" data-site-key="${issued.token}" defer></script>
  </body></html>`);

  const executablePath = installedChromium();
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage();
    const posted = page.waitForResponse(
      (response) => response.url().includes("/api/ingest/site") && response.request().method() === "POST",
      { timeout: 15_000 }
    );
    await page.goto(`http://127.0.0.1:${pageServer.port}/pricing`, { waitUntil: "load" });
    const response = await posted;
    assert("the script posted the page from the browser", response.ok());
  } finally {
    await browser.close();
  }

  let stored: { extractedText: string | null } | null = null;
  for (let attempt = 0; attempt < 10 && !stored; attempt += 1) {
    stored = await prisma.snapshot.findFirst({
      where: { monitorId: monitor.id },
      orderBy: { createdAt: "desc" },
      select: { extractedText: true },
    });
    if (!stored) await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const text = stored?.extractedText ?? "";
  assert("the stored page includes the public price", text.includes("nineteen dollars"));
  assert("an email address is redacted", text.includes("[email]") && !text.includes("sales@example.com"));
  assert("a form value is not stored", !text.includes("secret-card-4111") && !text.includes("secret note"));

  await prisma.user.deleteMany({ where: { clerkId: { startsWith: "script-browser-" } } });
  await pageServer.close();
  if (!process.exitCode) console.log("browser script checks passed");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "browser script check failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
