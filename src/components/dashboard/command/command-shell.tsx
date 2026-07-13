"use client";

import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/ui/os-toast";
import { CommandProvider, useCommand } from "./command-context";
import { CommandSidebar } from "./command-sidebar";
import { CommandTopbar } from "./command-topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";

function CommandMain({ children }: { children: React.ReactNode }) {
  const { collapsed } = useCommand();

  return (
    <div
      className={cn(
        "min-h-screen transition-[margin-left] duration-300 ease-out",
        collapsed ? "lg:ml-[72px]" : "lg:ml-[220px]"
      )}
    >
      <CommandTopbar />
      <div className="relative min-h-[calc(100vh-4rem)] max-w-full overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </div>
      <MobileBottomNav />
    </div>
  );
}

/** Uses root-layout fonts (--font-syne / --font-os-mono) — no duplicate next/font loads. */
export function CommandShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CommandProvider>
        <div
          className="command-os dark min-h-screen bg-[#090909] text-zinc-300"
          style={{ fontFamily: "var(--font-syne), system-ui, sans-serif" }}
        >
          <CommandSidebar />
          <CommandMain>{children}</CommandMain>
        </div>
      </CommandProvider>
    </ToastProvider>
  );
}
