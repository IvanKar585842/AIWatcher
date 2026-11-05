export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installSystemCa } = await import("@/lib/security/system-ca");
    installSystemCa();
  }
}
