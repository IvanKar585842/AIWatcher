"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardUserButton } from "@/components/auth/clerk-wrappers";
import {
  Eye,
  LayoutDashboard,
  Monitor,
  History,
  Settings,
  CreditCard,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/monitors", label: "Monitors", icon: Monitor },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-background transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600">
            <Eye className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold gradient-text">WatchFlow AI</span>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <ThemeToggle />
          <DashboardUserButton />
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
