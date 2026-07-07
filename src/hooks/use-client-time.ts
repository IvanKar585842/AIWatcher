"use client";

import { useEffect, useState } from "react";
import { formatDate, formatRelativeTime, formatUpcomingTime } from "@/lib/utils";

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useRelativeTime(date: Date | string | null | undefined, fallback = "—"): string {
  const mounted = useMounted();
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    if (!date) {
      setLabel(fallback);
      return;
    }
    function update() {
      if (date) setLabel(formatRelativeTime(date));
    }
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [date, fallback]);

  if (!mounted || !date) return date ? formatDate(date) : fallback;
  return label;
}

export function useUpcomingTime(date: Date | string | null | undefined): string {
  const mounted = useMounted();
  const [label, setLabel] = useState("—");

  useEffect(() => {
    if (!date) {
      setLabel("—");
      return;
    }
    function update() {
      setLabel(date ? formatUpcomingTime(date) : "—");
    }
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [date]);

  if (!mounted) return "—";
  return label;
}

export function useGreeting(): string {
  const mounted = useMounted();
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  return mounted ? greeting : "Welcome";
}
