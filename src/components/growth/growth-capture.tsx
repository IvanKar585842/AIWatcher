"use client";

import { useEffect } from "react";

const REF_KEY = "wf_ref";
const SOURCE_KEY = "wf_signup_source";

/**
 * Quiet growth helper:
 * - stores ?ref= for referrals
 * - claims referral once the user is authenticated
 * - records signup_from_report source without popups
 */
export function GrowthCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) localStorage.setItem(REF_KEY, ref.trim().toUpperCase());
      const from = params.get("from");
      if (from) localStorage.setItem(SOURCE_KEY, from);
    } catch {
      /* ignore */
    }

    async function claim() {
      try {
        const code = localStorage.getItem(REF_KEY);
        if (!code) return;
        const res = await fetch("/api/user/referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (res.ok || res.status === 401) {
          // 401 = not signed in yet; keep code for later
          if (res.ok) localStorage.removeItem(REF_KEY);
        }
      } catch {
        /* ignore */
      }
    }

    void claim();
  }, []);

  return null;
}
