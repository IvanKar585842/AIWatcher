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
