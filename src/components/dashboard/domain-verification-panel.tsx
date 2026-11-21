"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Verification = {
  token: string | null;
  verifiedAt: string | null;
  method: string | null;
  checkedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  lastError: string | null;
  guidance: string | null;
  targets: { host: string; txtName: string; fileUrl: string; filePath: string };
  egressIps: string[];
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
  const issuedOnce = useRef(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/monitors/${monitorId}/domain-verification`);
    const data = await response.json().catch(() => ({}));
    if (response.status === 404 || response.status === 503) {
      setVerification(null);
      if (response.status === 503) setMessage("Domain verification is unavailable until the database migration is applied.");
      return;
    }
    if (!response.ok) return;
    const next = data.verification as Verification;
    if (!next?.token && !issuedOnce.current) {
      issuedOnce.current = true;
      const issued = await fetch(`/api/monitors/${monitorId}/domain-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issue" }),
      });
      const issuedData = await issued.json().catch(() => ({}));
      if (issued.ok && issuedData.verification) {
        setVerification(issuedData.verification as Verification);
        return;
      }
    }
    setVerification(next);
  }, [monitorId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: "issue" | "check" | "renew") {
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
      <h2 className="text-lg font-medium text-zinc-100">Confirm this domain</h2>
      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
        WatchFlowing checks the page itself after you prove the host is yours. Confirmation does not turn off a challenge, a login, or robots.txt.
      </p>
      {verification?.guidance && <p className="mt-3 text-sm text-amber-200">{verification.guidance}</p>}
      {errorMessage && verification?.verifiedAt && (
        <p className="mt-3 text-sm text-zinc-400">A verified domain still keeps the last good page when a later check is blocked.</p>
      )}
      {verification?.verifiedAt ? (
        <p className="mt-3 text-sm text-emerald-200">
          Verified by {verification.method} on {new Date(verification.verifiedAt).toLocaleString()}.
        </p>
      ) : (
        <p className="mt-3 text-sm text-zinc-300">Not verified yet.</p>
      )}
      {verification?.token && verification.targets && (
        <div className="mt-4 space-y-3 text-sm text-zinc-300">
          <div>
            <p className="font-medium text-zinc-100">File in the site root</p>
            <p className="mt-1 text-zinc-400">
              Upload a text file to the root of the site, the same place as the homepage. The file name is the last part of the address. The file contains only the token. A redirect does not count.
            </p>
            <p className="mt-2 break-all font-mono text-xs text-cyan-100">{verification.targets.fileUrl}</p>
            <p className="mt-1 font-mono text-xs text-cyan-100">Body: {verification.token}</p>
          </div>
          <div>
            <p className="font-medium text-zinc-100">Or a DNS TXT record</p>
            <p className="mt-1 text-zinc-400">In the DNS host, add a TXT record. The name and the value must match.</p>
            <p className="mt-2 font-mono text-xs text-cyan-100">Name: {verification.targets.txtName}</p>
            <p className="mt-1 font-mono text-xs text-cyan-100">Value: {verification.token}</p>
          </div>
          {verification.expiresAt && !verification.verifiedAt && (
            <p className="text-xs text-zinc-500">This token expires {new Date(verification.expiresAt).toLocaleString()}.</p>
          )}
        </div>
      )}
      <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3 text-sm leading-relaxed text-zinc-400">
        <p className="font-medium text-zinc-200">Cloudflare exception for this check</p>
        {verification?.egressIps && verification.egressIps.length > 0 ? (
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Open the site in Cloudflare. Go to Security, then WAF, then Custom rules. Choose Create rule.</li>
            <li>Name it WatchFlowing check. Expression: {verification.egressIps.map((ip) => `(ip.src eq ${ip})`).join(" or ")}.</li>
            <li>Also match the hostname, so the exception is only for this site.</li>
            <li>Action: Skip. Skip Super Bot Fight Mode, Browser Integrity Check, and the custom rules that block this address. Do not skip every rule on the whole site, and do not turn Bot Fight Mode off.</li>
            <li>On the Free plan, Bot Fight Mode often cannot be skipped by IP. If the check stays blocked, leave the firewall on. The last good page is kept.</li>
            <li>Save the rule, then choose Check domain here again.</li>
          </ol>
        ) : (
          <p className="mt-1">
            The crawl address for this deployment is not published yet. A Cloudflare exception needs that address, so the steps stay empty until the owner sets WATCHFLOWING_EGRESS_IPS. Do not turn off the firewall or Bot Fight Mode for the whole site. One pilot address is enough later. Hiding the machine that runs WatchFlowing is a separate proxy in front of this app, and it is not in place yet.
          </p>
        )}
      </div>
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
          <Button type="button" disabled={busy} onClick={() => void post("renew")}>
            New token
          </Button>
        )}
        {verification?.token && (
          <Button type="button" disabled={busy} onClick={() => void remove()}>
            Remove confirmation
          </Button>
        )}
      </div>
      {message && <p className="mt-2 text-sm text-amber-200">{message}</p>}
    </section>
  );
}
