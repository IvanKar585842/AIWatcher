"use client";

import { Syne, IBM_Plex_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/ui/os-toast";
import { CommandProvider, useCommand } from "./command-context";
import { CommandSidebar } from "./command-sidebar";
import { CommandTopbar } from "./command-topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-command",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-command-mono",
  display: "swap",
});

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
      <div className="relative min-h-[calc(100vh-4rem)] overflow-x-hidden pb-20 lg:pb-0">
        {children}
      </div>
      <MobileBottomNav />
    </div>
  );
}

export function CommandShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CommandProvider>
        <div
          className={`command-os dark min-h-screen bg-[#090909] text-zinc-300 ${syne.variable} ${mono.variable}`}
          style={{ fontFamily: "var(--font-command), system-ui, sans-serif" }}
        >
          <style jsx global>{`
            .command-os .font-mono {
              font-family: var(--font-command-mono), ui-monospace, monospace;
            }
          `}</style>
          <CommandSidebar />
          <CommandMain>{children}</CommandMain>
        </div>
      </CommandProvider>
    </ToastProvider>
  );
}
