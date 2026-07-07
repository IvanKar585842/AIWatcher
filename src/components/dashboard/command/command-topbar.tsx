"use client";

import { useEffect, useState } from "react";
import { Menu, Search } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { DashboardUserButton } from "@/components/auth/clerk-wrappers";
import { useGreeting } from "@/hooks/use-client-time";
import { NotificationDropdown } from "./notification-dropdown";
import { useCommand } from "./command-context";

function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-xs tabular-nums text-zinc-500">{time}</span>
  );
}

export function CommandTopbar() {
  const { user } = useUser();
  const { setMobileOpen } = useCommand();
  const greeting = useGreeting();

  const name = user?.firstName ?? user?.username ?? "Operator";

  return (
    <header className="command-topbar sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-white/[0.06] bg-[#090909]/80 px-4 backdrop-blur-xl lg:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="rounded-lg border border-white/[0.06] p-2 text-zinc-400 lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div>
          <h1 className="text-sm font-medium text-zinc-200">
            {greeting}, <span className="text-cyan-300">{name}</span>
          </h1>
          <LiveClock />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-300/90">
            AI Monitoring Active
          </span>
        </div>

        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            type="search"
            placeholder="Search monitors, changes..."
            aria-label="Search monitors and changes"
            disabled
            title="Search coming soon"
            className="h-9 w-48 rounded-full border border-white/[0.06] bg-white/[0.03] pl-9 pr-4 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none transition-colors focus:border-cyan-400/30 focus:ring-1 focus:ring-cyan-400/20 lg:w-64 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <NotificationDropdown />

        <div className="hidden sm:block">
          <DashboardUserButton />
        </div>
      </div>
    </header>
  );
}
