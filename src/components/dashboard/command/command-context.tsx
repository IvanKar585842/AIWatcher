"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface CommandContextValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const CommandContext = createContext<CommandContextValue | null>(null);

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("command-nav-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  function handleSetCollapsed(v: boolean) {
    setCollapsed(v);
    localStorage.setItem("command-nav-collapsed", String(v));
  }

  return (
    <CommandContext.Provider
      value={{
        collapsed,
        setCollapsed: handleSetCollapsed,
        mobileOpen,
        setMobileOpen,
      }}
    >
      {children}
    </CommandContext.Provider>
  );
}

export function useCommand() {
  const ctx = useContext(CommandContext);
  if (!ctx) throw new Error("useCommand must be used within CommandProvider");
  return ctx;
}
