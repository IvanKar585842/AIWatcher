"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Settings,
  Shield,
  User,
} from "lucide-react";
import { DashboardUserButton } from "@/components/auth/clerk-wrappers";
import { cn } from "@/lib/utils";
import { useCommand } from "./command-context";

export function CommandSidebar() {
  const pathname = usePathname();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useCommand();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/user/context")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.isAdmin) setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/monitors", label: "Monitors", icon: Radio },
    { href: "/dashboard/assistant", label: "AI Assistant", icon: MessageSquare },
    { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
    { href: "/dashboard/history", label: "History", icon: Clock },
    { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
    { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
    ...(isAdmin
      ? [{ href: "/dashboard/admin", label: "Admin", icon: Shield, exact: false }]
      : []),
  ];

  const width = collapsed ? 72 : 220;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <motion.aside
        animate={{ width }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className={cn(
          "command-sidebar fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-[#090909]/95 backdrop-blur-xl",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/[0.06] px-4">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
            <span className="absolute inset-0 animate-pulse rounded-lg bg-cyan-500/20 blur-md" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10">
              <Radio className="h-4 w-4 text-cyan-400" />
            </div>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="min-w-0"
              >
                <p className="truncate text-sm font-semibold tracking-wide text-zinc-100">
                  WatchFlow
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-500/70">
                  Command
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className="group relative block"
              >
                {isActive && (
                  <motion.div
                    layoutId="command-nav-active"
                    className="absolute inset-0 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.08] shadow-[0_0_24px_-8px_rgba(34,211,238,0.4)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "text-cyan-100"
                      : "text-zinc-500 group-hover:text-zinc-300"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-cyan-400" : "text-zinc-600 group-hover:text-zinc-400"
                    )}
                  />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="truncate font-medium"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-white/[0.06] p-3">
          <Link
            href="/dashboard/settings"
            title={collapsed ? "Profile" : undefined}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <User className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Profile</span>}
          </Link>

          <div
            className={cn(
              "flex items-center gap-2",
              collapsed ? "flex-col" : "justify-between px-1"
            )}
          >
            <DashboardUserButton />
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="hidden rounded-lg border border-white/[0.06] p-1.5 text-zinc-500 transition-colors hover:border-cyan-400/20 hover:text-cyan-400 lg:block"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
