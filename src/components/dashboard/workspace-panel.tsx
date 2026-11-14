"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OsExpandableSection } from "@/components/dashboard/os/os-primitives";

type WorkspaceCard = { id: string; name: string; role: string };

type ClientCard = { id: string; name: string; monitors: number };
type ProblemCard = {
  id: string;
  name: string;
  status: string;
  client: { name: string } | null;
  summary: string | null;
  importance: string | null;
  groupCount?: number;
};
type ClientReport = {
  clientName: string;
  periodLabel: string;
  brandName: string;
  poweredBy: string | null;
  totalMonitors: number;
  monitorsActive: number;
  monitorsError: number;
  importantCount: number;
  changes: Array<{ changeId: string; summary: string; importance: string; similar: number }>;
};
type AttachableMonitor = { id: string; name: string; url: string };
type ClientDetail = {
  id: string;
  name: string;
  activeMonitors: number;
  changesToday: number;
  monitors: Array<{ id: string; name: string; url: string; status: string }>;
  recentChanges: Array<{ id: string; summary: string; importance: string; monitor: { name: string } }>;
};

export function WorkspacePanel() {
  const [workspaces, setWorkspaces] = useState<WorkspaceCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ name: string; role: string } | null>(null);
  const [clients, setClients] = useState<ClientCard[]>([]);
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [clientName, setClientName] = useState("");
  const [problems, setProblems] = useState<ProblemCard[]>([]);
  const [attachable, setAttachable] = useState<AttachableMonitor[]>([]);
  const [attachMonitorId, setAttachMonitorId] = useState("");
  const [attachClientId, setAttachClientId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [hidePoweredBy, setHidePoweredBy] = useState(false);
  const [report, setReport] = useState<ClientReport | null>(null);
  const [name, setName] = useState("Agency");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/workspaces");
    if (!response.ok) return;
    const data = (await response.json()) as { workspaces?: WorkspaceCard[] };
    setWorkspaces(data.workspaces ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function selectWorkspace(id: string) {
    setSelectedId(id);
    setDetail(null);
    setClients([]);
    setClientDetail(null);
    setReport(null);
    setProblems([]);
    setAttachable([]);
    setMessage(null);
    const response = await fetch(`/api/workspaces/${id}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(typeof data.error === "string" ? data.error : "Not found");
      return;
    }
    const role = data.workspace.role as string;
    setDetail({ name: data.workspace.name, role });
    const [clientsResponse, problemsResponse, attachableResponse] = await Promise.all([
      fetch(`/api/workspaces/${id}/clients`),
      fetch(`/api/workspaces/${id}/problems`),
      role === "VIEWER" ? Promise.resolve(null) : fetch(`/api/workspaces/${id}/attachable-monitors`),
    ]);
    const clientsData = await clientsResponse.json().catch(() => ({}));
    if (!clientsResponse.ok) {
      setMessage(typeof clientsData.error === "string" ? clientsData.error : "Not found");
      return;
    }
    setClients(clientsData.clients ?? []);
    const problemsData = await problemsResponse.json().catch(() => ({}));
    if (!problemsResponse.ok) {
      setMessage(typeof problemsData.error === "string" ? problemsData.error : "Not found");
      return;
    }
    setProblems(problemsData.problems ?? []);
    if (attachableResponse) {
      const attachableData = await attachableResponse.json().catch(() => ({}));
      if (attachableResponse.ok) setAttachable(attachableData.monitors ?? []);
    }
    const brandResponse = await fetch(`/api/workspaces/${id}/brand`);
    const brandData = await brandResponse.json().catch(() => ({}));
    if (brandResponse.ok) {
      setBrandName(brandData.brand?.brandName ?? "");
      setHidePoweredBy(Boolean(brandData.brand?.hidePoweredBy));
    }
  }

  async function attachSite() {
    if (!selectedId || !attachMonitorId || !attachClientId) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/workspaces/${selectedId}/clients/${attachClientId}/monitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitorId: attachMonitorId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Could not attach the site");
        return;
      }
      setAttachMonitorId("");
      await selectWorkspace(selectedId);
    } finally {
      setBusy(false);
    }
  }

  async function openClient(clientId: string) {
    if (!selectedId) return;
    setClientDetail(null);
    const response = await fetch(`/api/workspaces/${selectedId}/clients/${clientId}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(typeof data.error === "string" ? data.error : "Not found");
      return;
    }
    setClientDetail(data.client as ClientDetail);
    await loadReport(clientId, "week");
  }

  async function loadReport(clientId: string, period: "week" | "month") {
    if (!selectedId) return;
    const response = await fetch(`/api/workspaces/${selectedId}/clients/${clientId}/report?period=${period}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(typeof data.error === "string" ? data.error : "Not found");
      return;
    }
    setReport(data.report as ClientReport);
  }

  async function saveBrand() {
    if (!selectedId) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/workspaces/${selectedId}/brand`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: brandName, hidePoweredBy }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Could not save the brand");
        return;
      }
      setBrandName(data.brand?.brandName ?? "");
      setHidePoweredBy(Boolean(data.brand?.hidePoweredBy));
    } finally {
      setBusy(false);
    }
  }

  async function addClient() {
    if (!selectedId || !clientName.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/workspaces/${selectedId}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clientName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Could not add the client");
        return;
      }
      setClientName("");
      await selectWorkspace(selectedId);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Could not create the workspace");
        return;
      }
      await load();
      if (data.workspace?.id) await selectWorkspace(data.workspace.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <OsExpandableSection
      title="Workspaces"
      subtitle="Agencies you can access"
      icon={<Building2 className="h-5 w-5" />}
    >
      <div className="space-y-3 text-sm text-zinc-300">
        <div className="flex flex-wrap gap-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <Button type="button" disabled={busy} onClick={() => void create()}>
            Create workspace
          </Button>
        </div>
        <ul className="space-y-2">
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <button
                type="button"
                onClick={() => void selectWorkspace(workspace.id)}
                className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2 text-left hover:border-cyan-500/30"
              >
                <span>{workspace.name}</span>
                <span className="text-xs text-cyan-200">{workspace.role}</span>
              </button>
            </li>
          ))}
        </ul>
        {selectedId && !detail && <p className="text-zinc-500">Loading this workspace…</p>}
        {detail && (
          <div className="space-y-3">
            <p>
              Open workspace: <span className="text-zinc-100">{detail.name}</span> · {detail.role}
            </p>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Problems</p>
              {problems.length === 0 ? (
                <p className="text-zinc-500">No failing checks or important changes in the last 7 days.</p>
              ) : (
                <ul className="space-y-1">
                  {problems.map((problem) => (
                    <li key={problem.id} className="rounded-lg border border-white/[0.06] px-3 py-2">
                      <span className="text-zinc-100">{problem.name}</span>
                      {" · "}
                      {problem.client?.name ?? "No client"}
                      {" · "}
                      {problem.status}
                      {problem.importance ? ` · ${problem.importance}: ${problem.summary}` : ""}
                      {problem.groupCount && problem.groupCount > 1 ? ` · ${problem.groupCount} similar` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {detail.role !== "VIEWER" && clients.length > 0 && attachable.length > 0 && (
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                <select
                  value={attachMonitorId}
                  onChange={(event) => setAttachMonitorId(event.target.value)}
                  className="h-10 w-full min-w-0 rounded-md border border-white/10 bg-black/40 px-2 text-sm sm:w-auto"
                >
                  <option value="">Site</option>
                  {attachable.map((monitor) => (
                    <option key={monitor.id} value={monitor.id}>
                      {monitor.name}
                    </option>
                  ))}
                </select>
                <select
                  value={attachClientId}
                  onChange={(event) => setAttachClientId(event.target.value)}
                  className="h-10 w-full min-w-0 rounded-md border border-white/10 bg-black/40 px-2 text-sm sm:w-auto"
                >
                  <option value="">Client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <Button type="button" disabled={busy || !attachMonitorId || !attachClientId} onClick={() => void attachSite()}>
                  Attach site
                </Button>
              </div>
            )}
            {detail.role === "OWNER" || detail.role === "ADMIN" ? (
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Input
                  value={brandName}
                  onChange={(event) => setBrandName(event.target.value)}
                  placeholder="Report brand"
                />
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={hidePoweredBy}
                    onChange={(event) => setHidePoweredBy(event.target.checked)}
                  />
                  Hide Watchflowing credit
                </label>
                <Button type="button" disabled={busy} onClick={() => void saveBrand()}>
                  Save brand
                </Button>
              </div>
            ) : null}
            {detail.role !== "VIEWER" && (
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Input
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Client name"
                />
                <Button type="button" disabled={busy} onClick={() => void addClient()}>
                  Add client
                </Button>
              </div>
            )}
            <ul className="space-y-2">
              {clients.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => void openClient(client.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2 text-left hover:border-cyan-500/30"
                  >
                    <span>{client.name}</span>
                    <span className="text-xs text-zinc-400">{client.monitors} sites</span>
                  </button>
                </li>
              ))}
            </ul>
            {clientDetail && (
              <div className="rounded-lg border border-white/[0.06] px-3 py-2">
                <p className="text-zinc-100">{clientDetail.name}</p>
                <p className="text-xs text-zinc-400">
                  {clientDetail.activeMonitors} active · {clientDetail.changesToday} changes today
                </p>
                <ul className="mt-2 space-y-1">
                  {clientDetail.monitors.map((monitor) => (
                    <li key={monitor.id}>
                      {monitor.name} · {monitor.status}
                    </li>
                  ))}
                  {clientDetail.recentChanges.map((change) => (
                    <li key={change.id} className="text-xs text-zinc-400">
                      {change.importance}: {change.summary}
                    </li>
                  ))}
                </ul>
                {report && (
                  <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
                    <p className="text-zinc-100">{report.brandName}</p>
                    <p className="text-xs text-zinc-400">
                      {report.periodLabel} · {report.monitorsActive} active · {report.monitorsError} failing · {report.importantCount} important
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => void loadReport(clientDetail.id, "week")}>
                        Week
                      </Button>
                      <Button type="button" onClick={() => void loadReport(clientDetail.id, "month")}>
                        Month
                      </Button>
                    </div>
                    <ul className="space-y-1">
                      {report.changes.map((change) => (
                        <li key={change.changeId} className="text-xs text-zinc-400">
                          {change.importance}: {change.summary}
                          {change.similar > 1 ? ` · ${change.similar} similar` : ""}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-zinc-500">{report.poweredBy ? `Powered by ${report.poweredBy}` : "Prepared for the client"}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {message && <p className="text-amber-200">{message}</p>}
      </div>
    </OsExpandableSection>
  );
}
