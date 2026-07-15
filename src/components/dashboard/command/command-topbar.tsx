"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { DashboardUserButton } from "@/components/auth/clerk-wrappers";
import { useGreeting } from "@/hooks/use-client-time";
import { NotificationDropdown } from "./notification-dropdown";
import { MonitorHeaderSearch } from "./monitor-header-search";
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
    <header className="command-topbar sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/[0.06] bg-[#090909]/80 px-3 backdrop-blur-xl sm:h-16 sm:gap-4 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] text-zinc-400 transition-colors hover:border-white/[0.1] hover:text-zinc-200 lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium text-zinc-200">
            {greeting}, <span className="text-cyan-300">{name}</span>
          </h1>
          <div className="hidden sm:block">
            <LiveClock />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-4">
        <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 md:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-300/90">
            AI Monitoring Active
          </span>
        </div>

        <MonitorHeaderSearch className="hidden sm:block" />

        <NotificationDropdown />

        <div className="hidden sm:block">
          <DashboardUserButton />
        </div>
      </div>
    </header>
  );
}
