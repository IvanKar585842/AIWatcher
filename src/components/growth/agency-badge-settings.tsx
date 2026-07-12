"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { OsFieldLabel, OsInput } from "@/components/dashboard/os/os-primitives";
import { useToast } from "@/components/ui/os-toast";

export function AgencyBadgeSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<{
    username: string | null;
    agencyModeEnabled: boolean;
    agencyBrandName: string | null;
    agencyShowPoweredBy: boolean;
    badgeEnabled: boolean;
    badgeEmbed: string | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/user/growth")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json) return;
        setData({
          username: json.username,
          agencyModeEnabled: Boolean(json.agencyModeEnabled),
          agencyBrandName: json.agencyBrandName,
          agencyShowPoweredBy: json.agencyShowPoweredBy !== false,
          badgeEnabled: Boolean(json.badgeEnabled),
          badgeEmbed: json.badgeEmbed,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function patch(partial: Record<string, unknown>) {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/growth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const json = await res.json();
      if (!res.ok) throw new Error("Failed");
      const refreshed = await fetch("/api/user/growth").then((r) => r.json());
      setData({
        username: refreshed.username,
        agencyModeEnabled: Boolean(refreshed.agencyModeEnabled),
        agencyBrandName: refreshed.agencyBrandName,
        agencyShowPoweredBy: refreshed.agencyShowPoweredBy !== false,
        badgeEnabled: Boolean(refreshed.badgeEnabled),
        badgeEmbed: refreshed.badgeEmbed,
      });
      toast("Growth settings saved", "success");
      void json;
    } catch {
      toast("Could not save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) {
    return <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3">
        <div>
          <p className="text-sm text-zinc-200">Agency mode</p>
          <p className="text-xs text-zinc-600">
            Brand shared reports for clients · optional “Powered by WatchFlowing”
          </p>
        </div>
        <Switch
          checked={data.agencyModeEnabled}
          disabled={saving}
          onCheckedChange={(v) => {
            setData({ ...data, agencyModeEnabled: v });
            void patch({ agencyModeEnabled: v });
          }}
          className="data-[state=checked]:bg-cyan-500"
        />
      </div>

      {data.agencyModeEnabled && (
        <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div>
            <OsFieldLabel>Agency / brand name</OsFieldLabel>
            <OsInput
              value={data.agencyBrandName ?? ""}
              onChange={(e) =>
                setData({ ...data, agencyBrandName: e.target.value })
              }
              onBlur={() =>
                void patch({ agencyBrandName: data.agencyBrandName })
              }
              placeholder="Acme Digital"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-200">Show “Powered by WatchFlowing”</p>
              <p className="text-xs text-zinc-600">Keep subtle credit on client reports</p>
            </div>
            <Switch
              checked={data.agencyShowPoweredBy}
              disabled={saving}
              onCheckedChange={(v) => {
                setData({ ...data, agencyShowPoweredBy: v });
                void patch({ agencyShowPoweredBy: v });
              }}
              className="data-[state=checked]:bg-cyan-500"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3">
        <div>
          <p className="text-sm text-zinc-200">WatchFlowing badge</p>
          <p className="text-xs text-zinc-600">
            Optional embed: “Monitored by WatchFlowing AI”
            {!data.username ? " · set a username in Status page first" : ""}
          </p>
        </div>
        <Switch
          checked={data.badgeEnabled}
          disabled={saving || !data.username}
          onCheckedChange={(v) => {
            setData({ ...data, badgeEnabled: v });
            void patch({ badgeEnabled: v });
          }}
          className="data-[state=checked]:bg-cyan-500"
        />
      </div>

      {data.badgeEnabled && data.badgeEmbed && (
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <p className="mb-2 text-xs text-zinc-500">Embed code</p>
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-white/[0.06] bg-black/40 p-3 font-mono text-[10px] text-zinc-400">
            {data.badgeEmbed}
          </pre>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-10 rounded-full border-white/[0.08]"
            onClick={async () => {
              await navigator.clipboard.writeText(data.badgeEmbed!);
              setCopied(true);
              toast("Badge embed copied", "success");
              window.setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy embed"}
          </Button>
        </div>
      )}
    </div>
  );
}
