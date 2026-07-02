import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? "watchflow-ai",
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
});
