import { isClerkConfigured, isLocalDevSession } from "../src/lib/clerk-config";

const env = process.env as { NODE_ENV?: string; NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string };
const previousNodeEnv = env.NODE_ENV;
const previousKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function assert(name: string, condition: boolean) {
  if (!condition) {
    console.error("FAIL", name);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

env.NODE_ENV = "production";
delete env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
assert("production without Clerk is not a local session", isLocalDevSession() === false);
assert("production without Clerk is not configured", isClerkConfigured() === false);

env.NODE_ENV = "development";
assert("development without Clerk is a local session", isLocalDevSession() === true);

env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_placeholder";
assert("placeholder key is not configured", isClerkConfigured() === false);
assert("placeholder key still uses the local session", isLocalDevSession() === true);

env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_realkey";
assert("real key disables the local session", isLocalDevSession() === false);
assert("real key counts as configured", isClerkConfigured() === true);

env.NODE_ENV = "production";
assert("production ignores a missing session even with no key", isLocalDevSession() === false);

if (previousNodeEnv === undefined) delete env.NODE_ENV;
else env.NODE_ENV = previousNodeEnv;
if (previousKey === undefined) delete env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
else env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previousKey;

if (process.exitCode) {
  console.error("dev session checks failed");
} else {
  console.log("dev session checks passed");
}
