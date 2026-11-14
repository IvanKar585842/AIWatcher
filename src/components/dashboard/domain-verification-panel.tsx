"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Verification = {
  token: string | null;
  verifiedAt: string | null;
  method: string | null;
  lastError: string | null;
  guidance: string | null;
  targets: { host: string; fileUrl: string };
};

export function DomainVerificationPanel({
  monitorId,
  errorMessage,
}: {
  monitorId: string;
  errorMessage?: string | null;
}) {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/monitors/${monitorId}/domain-verification`);
    const data = await response.json().catch(() => ({}));
    if (response.status === 404 || response.status === 503) {
      setVerification(null);
      if (response.status === 503) setMessage("Domain verification is unavailable until the database migration is applied.");
      return;
    }
    if (!response.ok) return;
    setVerification(data.verification as Verification);
  }, [monitorId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: "issue" | "check") {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/monitors/${monitorId}/domain-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Could not check the domain");
        return;
      }
      if (data.verification) setVerification(data.verification as Verification);
      else await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/monitors/${monitorId}/domain-verification`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(typeof data.error === "string" ? data.error : "Could not remove the check");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!verification && !message) return null;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Domain</p>
      <h2 className="text-lg font-medium text-zinc-100">Domain verification</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Prove this host is yours. A verified domain does not bypass a challenge, login, or robots.txt.
      </p>
      {verification?.guidance && <p className="mt-3 text-sm text-amber-200">{verification.guidance}</p>}
      {!verification?.guidance && errorMessage && verification?.verifiedAt && (
        <p className="mt-3 text-sm text-zinc-400">Verification does not change how the public page is fetched.</p>
      )}
      {verification?.verifiedAt && (
        <p className="mt-3 text-sm text-emerald-200">Verified by {verification.method}.</p>
      )}
      {verification?.token && (
        <ul className="mt-3 space-y-1 text-xs text-zinc-300">
          <li>DNS TXT on {verification.targets.host}: watchflowing-verify={verification.token}</li>
          <li>File {verification.targets.fileUrl} containing the token</li>
          <li>Meta tag name watchflowing-verify with the token as content</li>
        </ul>
      )}
      {verification?.lastError && <p className="mt-3 text-sm text-amber-200">{verification.lastError}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!verification?.token && (
          <Button type="button" disabled={busy} onClick={() => void post("issue")}>
            Create check
          </Button>
        )}
        {verification?.token && (
          <Button type="button" disabled={busy} onClick={() => void post("check")}>
            Check domain
          </Button>
        )}
        {verification?.token && (
          <Button type="button" disabled={busy} onClick={() => void remove()}>
            Remove check
          </Button>
        )}
      </div>
      {message && <p className="mt-2 text-sm text-amber-200">{message}</p>}
    </section>
  );
}
