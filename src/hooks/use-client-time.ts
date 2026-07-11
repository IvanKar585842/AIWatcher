"use client";

import { useEffect, useState } from "react";

export function useGreeting(): string {
  const [mounted, setMounted] = useState(false);
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    setMounted(true);
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  return mounted ? greeting : "Welcome";
}
