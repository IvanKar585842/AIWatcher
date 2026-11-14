"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AgencyCard = {
  id: string;
  name: string;
  role: string;
  clients: number;
  sites: number;
  problems: number;
};

export function AgencyStrip() {
  const [cards, setCards] = useState<AgencyCard[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/workspaces/summary")
      .then((response) => (response.ok ? response.json() : { workspaces: [] }))
      .then((data: { workspaces?: AgencyCard[] }) => {
        if (!cancelled) setCards(data.workspaces ?? []);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!cards || cards.length === 0) return null;

  return (
    <section className="space-y-2" aria-label="Agencies">
      {cards.map((card) => (
        <Link
          key={card.id}
          href="/dashboard/settings"
          className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-cyan-500/30"
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-sm text-zinc-100">{card.name}</p>
            <span className="shrink-0 text-xs text-cyan-200">{card.role}</span>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="min-w-0">
              <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Clients</dt>
              <dd className="text-lg text-zinc-100">{card.clients}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Sites</dt>
              <dd className="text-lg text-zinc-100">{card.sites}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Problems</dt>
              <dd className="text-lg text-zinc-100">{card.problems}</dd>
            </div>
          </dl>
        </Link>
      ))}
    </section>
  );
}
