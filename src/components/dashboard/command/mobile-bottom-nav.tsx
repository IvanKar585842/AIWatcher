"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_NAV: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/monitors", label: "Monitors", icon: Radio },
  { href: "/dashboard/assistant", label: "AI", icon: MessageSquare },
  { href: "/dashboard/notifications", label: "Alerts", icon: Bell },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#090909]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_NAV.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors",
                  isActive ? "text-cyan-300" : "text-zinc-500 active:text-zinc-300"
                )}
              >
                <item.icon
                  className={cn("h-5 w-5", isActive ? "text-cyan-400" : "text-zinc-600")}
                  aria-hidden
                />
                <span className={cn(isActive && "text-cyan-200")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
