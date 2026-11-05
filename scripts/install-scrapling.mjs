/**
 * Reproducible Scrapling setup for dev and self-hosted production.
 * Installs the Python package lock and Chromium only (the browser StealthyFetcher uses).
 * Does not install Firefox, WebKit, or a second automation stack for the Node app.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const venvDir = path.join(root, "python", ".venv");
const isWin = process.platform === "win32";
const pythonBin = path.join(venvDir, isWin ? "Scripts/python.exe" : "bin/python");
const requirements = path.join(root, "python", "requirements.txt");

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, ...extraEnv },
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const systemPython = process.env.PYTHON || (isWin ? "python" : "python3");

if (!fs.existsSync(pythonBin)) {
  run(systemPython, ["-m", "venv", venvDir]);
}

run(pythonBin, ["-m", "pip", "install", "--upgrade", "pip"]);
run(pythonBin, ["-m", "pip", "install", "-r", requirements]);

// patchright's downloader is Node. Some Windows environments need the OS CA store.
run(pythonBin, ["-m", "patchright", "install", "chromium"], {
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean).join(" "),
});

console.log("Scrapling and Chromium are installed.");
