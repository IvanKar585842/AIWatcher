import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/**
 * Server-rendered 403 surface for non-admin visitors of /admin.
 * Access decisions are made only in requireAdmin() on the server.
 */
export function AdminForbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090909] px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-400/25 bg-red-500/10">
          <ShieldAlert className="h-6 w-6 text-red-300" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-red-400/70">
          403 Forbidden
        </p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-100">Admin access required</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          You do not have permission to view the WatchFlowing admin console.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/[0.08] px-5 text-sm text-zinc-300 transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
