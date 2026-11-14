import fs from "node:fs";
import path from "node:path";
import { MonitoringMode } from "@prisma/client";
import { MonitorCheckError } from "../src/lib/monitoring/check-error";
import { fetchViaScrapling } from "../src/lib/monitoring/scrapling-adapter";
import {
  isScraplingRuntimeUnavailable,
  ScraplingUnavailableError,
} from "../src/lib/monitoring/scrapling-client";

function assert(name: string, condition: boolean) {
  if (!condition) {
    console.error("FAIL", name);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

assert(
  "a missing runtime stays recognizable after it is wrapped",
  isScraplingRuntimeUnavailable(
    new MonitorCheckError("Scrapling Python runtime is not installed. Run npm run scrapling:install.")
  )
);
assert(
  "the runtime error class is recognized",
  isScraplingRuntimeUnavailable(new ScraplingUnavailableError("Scrapling worker script is missing."))
);

function runtimePresent(): boolean {
  if (process.env.SCRAPLING_PYTHON && fs.existsSync(process.env.SCRAPLING_PYTHON)) return true;
  const root = process.cwd();
  return (
    fs.existsSync(path.join(root, "python", ".venv", "Scripts", "python.exe")) ||
    fs.existsSync(path.join(root, "python", ".venv", "bin", "python"))
  );
}

async function main() {
  if (runtimePresent()) {
    console.log("PASS runtime is installed, live fetch not required");
  } else {
    try {
      await fetchViaScrapling({
        url: "https://example.com/",
        mode: MonitoringMode.ENTIRE_PAGE,
        timeoutMs: 5_000,
        captureScreenshot: false,
      });
      assert("missing runtime does not pretend the page was fetched", false);
    } catch (error) {
      assert("missing runtime is not stored as a finished check error", isScraplingRuntimeUnavailable(error));
      assert("missing runtime is not a terminal monitor error", !(error instanceof MonitorCheckError));
    }
  }
  if (!process.exitCode) console.log("scrapling fallback checks passed");
}

void main();
