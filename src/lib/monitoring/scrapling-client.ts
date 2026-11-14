import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { MonitorCheckError } from "./check-error";

export class ScraplingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScraplingUnavailableError";
  }
}

export function isScraplingRuntimeUnavailable(error: unknown): boolean {
  if (error instanceof ScraplingUnavailableError) return true;
  if (!(error instanceof Error)) return false;
  if (error.name === "ScraplingUnavailableError") return true;
  return (
    error.message.includes("Scrapling Python runtime is not installed") ||
    error.message.includes("Scrapling worker script is missing")
  );
}

export interface ScraplingWorkerResponse {
  id?: string;
  ok?: boolean;
  outcome?: "success" | "blocked" | "partial" | "failure";
  status?: number;
  finalUrl?: string;
  strategy?: string;
  browserLaunched?: boolean;
  durationMs?: number;
  rawHtml?: string;
  text?: string;
  structured?: Record<string, unknown>;
  dynamicShell?: boolean;
  message?: string | null;
  retryable?: boolean;
  screenshotBase64?: string | null;
  visualFingerprint?: number[];
  cookies?: Array<Record<string, unknown>>;
  cmd?: string;
}

interface Pending {
  resolve: (value: ScraplingWorkerResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let child: ChildProcessWithoutNullStreams | null = null;
let pending = new Map<string, Pending>();
let chain: Promise<unknown> = Promise.resolve();
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let stdoutBuffer = "";

function pythonPath(): string {
  if (process.env.SCRAPLING_PYTHON && fs.existsSync(process.env.SCRAPLING_PYTHON)) {
    return process.env.SCRAPLING_PYTHON;
  }
  const root = process.cwd();
  const win = path.join(root, "python", ".venv", "Scripts", "python.exe");
  const unix = path.join(root, "python", ".venv", "bin", "python");
  if (fs.existsSync(win)) return win;
  if (fs.existsSync(unix)) return unix;
  throw new ScraplingUnavailableError(
    "Scrapling Python runtime is not installed. Run npm run scrapling:install."
  );
}

function scriptPath(): string {
  const script = path.join(process.cwd(), "python", "watchflowing_fetch.py");
  if (!fs.existsSync(script)) {
    throw new ScraplingUnavailableError("Scrapling worker script is missing.");
  }
  return script;
}

function failPending(error: Error): void {
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(error);
  }
  pending = new Map();
}

function stopChild(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const current = child;
  child = null;
  if (!current) return;
  try {
    current.stdin.write(`${JSON.stringify({ cmd: "shutdown" })}\n`);
  } catch {
    // process may already be gone
  }
  current.kill();
}

function ensureChild(): ChildProcessWithoutNullStreams {
  if (child && !child.killed) return child;
  const proc = spawn(pythonPath(), [scriptPath()], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
    windowsHide: true,
  });
  child = proc;
  stdoutBuffer = "";

  proc.stdout.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString("utf8");
    let newline = stdoutBuffer.indexOf("\n");
    while (newline >= 0) {
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      newline = stdoutBuffer.indexOf("\n");
      if (!line.startsWith("{")) continue;
      let parsed: ScraplingWorkerResponse;
      try {
        parsed = JSON.parse(line) as ScraplingWorkerResponse;
      } catch {
        continue;
      }
      const id = parsed.id;
      if (!id || !pending.has(id)) continue;
      const entry = pending.get(id)!;
      pending.delete(id);
      clearTimeout(entry.timer);
      entry.resolve(parsed);
    }
  });

  proc.stderr.on("data", () => {
    // Scrapling logs stay off the JSON protocol. They are not check results.
  });

  proc.on("exit", () => {
    if (child === proc) child = null;
    failPending(new Error("Scrapling worker exited"));
  });

  return proc;
}

function scheduleIdleClose(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (pending.size > 0 || !child) return;
    try {
      child.stdin.write(`${JSON.stringify({ cmd: "close_browser" })}\n`);
    } catch {
      stopChild();
    }
  }, 15_000);
}

export function shutdownScrapling(): void {
  stopChild();
  failPending(new MonitorCheckError("Scrapling worker stopped", true));
}

export function scraplingRequest(
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<ScraplingWorkerResponse> {
  const run = chain.then(() => invoke(payload, timeoutMs));
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function invoke(payload: Record<string, unknown>, timeoutMs: number): Promise<ScraplingWorkerResponse> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const id = crypto.randomUUID();
  const proc = ensureChild();
  return new Promise<ScraplingWorkerResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      stopChild();
      reject(new MonitorCheckError("Scrapling fetch timed out", false));
    }, timeoutMs + 10_000);
    pending.set(id, { resolve, reject, timer });
    try {
      proc.stdin.write(`${JSON.stringify({ ...payload, id })}\n`);
    } catch (error) {
      pending.delete(id);
      clearTimeout(timer);
      stopChild();
      reject(error instanceof Error ? error : new ScraplingUnavailableError("Failed to start Scrapling"));
    }
  }).finally(() => {
    scheduleIdleClose();
  });
}
