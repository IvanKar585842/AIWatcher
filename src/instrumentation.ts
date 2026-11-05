export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { useSystemCa } = await import("@/lib/security/system-ca");
    useSystemCa();
  }
}
