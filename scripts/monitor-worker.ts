import http from "node:http";
import { loadEnv } from "./load-env";

loadEnv();

const intervalMs = 60_000;
const port = Number(process.env.MONITOR_WORKER_PORT ?? 8787);
const host = process.env.MONITOR_WORKER_HOST?.trim() || "127.0.0.1";

type CycleResult = { processed: number; analysesProcessed: number };

let running: Promise<CycleResult> | null = null;

async function tick(): Promise<CycleResult> {
  if (running) return running;
  running = (async () => {
    const { runMonitoringCycle } = await import("../src/trigger/monitoring");
    const started = Date.now();
    const result = await runMonitoringCycle();
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        ms: Date.now() - started,
        ...result,
      })
    );
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

function authorized(req: http.IncomingMessage): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) return req.headers.authorization === `Bearer ${secret}`;
  const remote = req.socket.remoteAddress ?? "";
  return remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
}

const loopback = host === "127.0.0.1" || host === "localhost" || host === "::1";
if (!loopback && !process.env.CRON_SECRET?.trim()) {
  console.error("MONITOR_WORKER_HOST is public, so CRON_SECRET is required.");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (req.method === "GET" && path === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method === "POST" && path === "/run") {
    if (!authorized(req)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    try {
      const result = await tick();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: true, executor: "worker", ...result }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Worker failed";
      console.error(message);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Monitoring worker failed" }));
    }
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, host, () => {
  console.log(`monitor worker listening on http://${host}:${port}`);
});

tick().catch((error) => console.error(error));
setInterval(() => {
  tick().catch((error) => console.error(error));
}, intervalMs);
